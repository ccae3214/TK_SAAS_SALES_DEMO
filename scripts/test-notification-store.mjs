import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureNotificationSchema, submitMemberRequest, enqueueMemberRequest, dispatchNotifications, MemberRequestConflict } from '../src/lib/hr-notifications.js';
import { reviewPool, fixtures } from '../tests/support/review-fixtures.mjs';

const pool=reviewPool();
let fixture, admin, agency, disabled, noLine;
const authority={adminEmails:[],rootLineIds:[]};
before(async()=>{
  await ensureNotificationSchema(pool); fixture=await fixtures(pool);
  const ph=(await pool.query("SELECT id FROM hr_agencies WHERE agency_type='philippines' AND active=TRUE ORDER BY id LIMIT 1")).rows[0];
  assert.ok(ph);
  admin=await fixture.member('store-admin',{role:'system_admin',adminScope:'system',line:`review-line-admin-${fixture.suffix}`});
  noLine=await fixture.member('store-email-admin',{role:'system_admin',adminScope:'system'});
  agency=await fixture.member('store-agency-admin',{role:'agency',adminScope:'agency',agencyId:ph.id,line:`review-line-agency-${fixture.suffix}`});
  disabled=await fixture.member('store-disabled',{role:'system_admin',adminScope:'system',active:false,line:`review-line-disabled-${fixture.suffix}`});
});
after(async()=>{if(fixture) await fixture.close();await pool.end();});
async function request() {
  const member=await fixture.member('store-applicant');
  const input={email:member.email,lineUserId:null,displayName:member.display_name,requestedRole:'training_center',requestedAgencyId:null};
  return {member,input};
}
async function ownJob(result) {
  const row=(await pool.query('SELECT * FROM hr_notification_outbox WHERE id=ANY($1::bigint[]) AND recipient_member_id=$2',[result.notificationIds,admin.id])).rows[0];
  assert.ok(row);return row;
}
const options=(row,send)=>({ids:[row.id],authority,baseUrl:'https://example.invalid',send});
test('real transaction: recipients include system admin, exclude agency, inactive and email-only',async()=>{
  const {input}=await request();const result=await submitMemberRequest(pool,input,authority);
  const recipients=(await pool.query('SELECT recipient_member_id FROM hr_notification_outbox WHERE id=ANY($1::bigint[])',[result.notificationIds])).rows.map(x=>String(x.recipient_member_id));
  assert.ok(recipients.includes(String(admin.id)));
  for(const excluded of [agency,disabled,noLine]) assert.ok(!recipients.includes(String(excluded.id)));
  assert.ok(result.member.requested_role==='training_center');
});
test('parallel duplicate submit creates one event per recipient',async()=>{
  const {input,member}=await request();await Promise.all([submitMemberRequest(pool,input,authority),submitMemberRequest(pool,input,authority)]);
  const rows=await pool.query('SELECT COUNT(*)::integer AS count FROM hr_notification_outbox WHERE subject_member_id=$1 AND recipient_member_id=$2',[member.id,admin.id]);
  assert.equal(rows.rows[0].count,1);
});
test('actual PostgreSQL rollback on enqueue failure leaves member and outbox unchanged',async()=>{
  const {input,member}=await request();
  const wrapper={connect:async()=>{const client=await pool.connect();return {release:()=>client.release(),query:(sql,params)=>{
    if(sql.startsWith('INSERT INTO hr_notification_outbox')) throw new Error('intentional test-only enqueue failure');
    return client.query(sql,params);
  }};}};
  await assert.rejects(()=>submitMemberRequest(wrapper,input,authority));
  assert.equal((await pool.query('SELECT requested_role FROM hr_members WHERE id=$1',[member.id])).rows[0].requested_role,null);
  assert.equal((await pool.query('SELECT id FROM hr_notification_outbox WHERE subject_member_id=$1',[member.id])).rowCount,0);
});
test('assigned/inactive identity cannot resubmit',async()=>{
  await assert.rejects(()=>submitMemberRequest(pool,{email:admin.email,lineUserId:null,requestedRole:'training_center'},authority),MemberRequestConflict);
  const {input,member}=await request();await pool.query('UPDATE hr_members SET active=FALSE WHERE id=$1',[member.id]);
  await assert.rejects(()=>submitMemberRequest(pool,input,authority),MemberRequestConflict);
});
test('provider failure preserves request, schedules retry, and same key succeeds once',async()=>{
  const {input,member}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));const keys=[];
  let result=await dispatchNotifications(pool,options(row,async job=>{keys.push(job.delivery_key);return {status:'retry',code:'line_http_500'};}));
  assert.equal(result.retry,1);
  assert.equal((await pool.query('SELECT requested_role FROM hr_members WHERE id=$1',[member.id])).rows[0].requested_role,'training_center');
  const retry=(await pool.query('SELECT * FROM hr_notification_outbox WHERE id=$1',[row.id])).rows[0];
  assert.equal(retry.status,'retry');assert.ok(new Date(retry.next_attempt_at)>new Date(retry.updated_at));
  assert.equal((await dispatchNotifications(pool,options(row,async()=>{throw new Error('not due')}))).claimed,0);
  await pool.query("UPDATE hr_notification_outbox SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE id=$1",[row.id]);
  result=await dispatchNotifications(pool,options(row,async job=>{keys.push(job.delivery_key);return {status:'sent'};}));
  assert.equal(result.sent,1);assert.equal(keys[0],keys[1]);
  const sent=(await pool.query('SELECT * FROM hr_notification_outbox WHERE id=$1',[row.id])).rows[0];
  assert.equal(sent.attempts,2);assert.equal(sent.attempt_history.length,2);assert.ok(sent.sent_at);
  assert.equal((await dispatchNotifications(pool,options(row,async()=>{throw new Error('already sent')}))).claimed,0);
});
test('two workers cannot double-claim a row',async()=>{
  const {input}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));let calls=0;
  const send=async()=>{calls++;await new Promise(r=>setTimeout(r,100));return {status:'sent'};};
  const results=await Promise.all([dispatchNotifications(pool,options(row,send)),dispatchNotifications(pool,options(row,send))]);
  assert.equal(calls,1);assert.equal(results.reduce((n,x)=>n+x.sent,0),1);
});
test('revoked recipient cancels without invoking transport',async()=>{
  const {input}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));
  await pool.query("UPDATE hr_members SET admin_scope='none' WHERE id=$1",[admin.id]);
  try {const result=await dispatchNotifications(pool,options(row,async()=>{throw new Error('must not send')}));assert.equal(result.cancelled,1);}
  finally {await pool.query("UPDATE hr_members SET admin_scope='system' WHERE id=$1",[admin.id]);}
});
test('request processed before send cancels stale notification',async()=>{
  const {input,member}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));
  await pool.query("UPDATE hr_members SET requested_role=NULL WHERE id=$1",[member.id]);
  const result=await dispatchNotifications(pool,options(row,async()=>{throw new Error('must not send')}));assert.equal(result.cancelled,1);
});
test('expired lease retries with same delivery key; fifth transient failure is terminal',async()=>{
  const {input}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));
  await pool.query("UPDATE hr_notification_outbox SET status='processing',attempts=4,lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",[row.id]);
  const result=await dispatchNotifications(pool,options(row,async job=>{assert.equal(job.delivery_key,row.delivery_key);return {status:'retry',code:'line_http_503'};}));
  assert.equal(result.failed,1);
  assert.equal((await pool.query('SELECT attempts FROM hr_notification_outbox WHERE id=$1',[row.id])).rows[0].attempts,5);
});
test('binding change and removed environment root cancel before transport',async()=>{
  const {input}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));
  const previousLine=admin.line_user_id;
  await pool.query('UPDATE hr_members SET line_user_id=$2 WHERE id=$1',[admin.id,`review-rebound-${fixture.suffix}`]);
  try {assert.equal((await dispatchNotifications(pool,options(row,async()=>{throw new Error('must not send')}))).cancelled,1);}
  finally {await pool.query('UPDATE hr_members SET line_user_id=$2 WHERE id=$1',[admin.id,previousLine]);}
  const other=await request();const root=`review-removed-root-${fixture.suffix}`;
  const result=await submitMemberRequest(pool,other.input,{...authority,rootLineIds:[root]});
  const rootRow=(await pool.query('SELECT * FROM hr_notification_outbox WHERE id=ANY($1::bigint[]) AND recipient_line_id=$2',[result.notificationIds,root])).rows[0];
  assert.equal((await dispatchNotifications(pool,options(rootRow,async()=>{throw new Error('must not send')}))).cancelled,1);
});
test('permanent error stops immediately; exhausted crash lease is reaped without sending',async()=>{
  const {input}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));
  assert.equal((await dispatchNotifications(pool,options(row,async()=>({status:'failed',code:'line_http_400'})))).failed,1);
  assert.equal((await dispatchNotifications(pool,options(row,async()=>{throw new Error('terminal')}))).claimed,0);
  const next=await request();const crashed=await ownJob(await submitMemberRequest(pool,next.input,authority));
  await pool.query("UPDATE hr_notification_outbox SET status='processing',attempts=5,lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",[crashed.id]);
  assert.equal((await dispatchNotifications(pool,options(crashed,async()=>{throw new Error('exhausted')}))).claimed,0);
  assert.equal((await pool.query('SELECT status FROM hr_notification_outbox WHERE id=$1',[crashed.id])).rows[0].status,'failed');
});
test('lost lease acknowledgement cannot overwrite newer ownership and reuses retry key',async()=>{
  const {input}=await request();const row=await ownJob(await submitMemberRequest(pool,input,authority));
  const result=await dispatchNotifications(pool,options(row,async()=>{
    await pool.query("UPDATE hr_notification_outbox SET lease_key='dcb9aa25-5e72-457e-a9a0-c4f1be156173' WHERE id=$1",[row.id]);
    return {status:'sent'};
  }));
  assert.equal(result.sent,0);
  assert.equal((await pool.query('SELECT status FROM hr_notification_outbox WHERE id=$1',[row.id])).rows[0].status,'processing');
  await pool.query("UPDATE hr_notification_outbox SET lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",[row.id]);
  assert.equal((await dispatchNotifications(pool,options(row,async job=>{assert.equal(job.delivery_key,row.delivery_key);return {status:'sent'};}))).sent,1);
});
test('environment roots deduplicate and do not require a member row',async()=>{
  const {input,member}=await request();const root=`review-root-${fixture.suffix}`;
  const result=await submitMemberRequest(pool,input,{...authority,rootLineIds:[root,root,admin.line_user_id]});
  const rows=(await pool.query('SELECT * FROM hr_notification_outbox WHERE id=ANY($1::bigint[])',[result.notificationIds])).rows;
  assert.equal(rows.filter(x=>x.recipient_line_id===root).length,1);
  assert.equal(rows.filter(x=>x.recipient_line_id===admin.line_user_id).length,1);
  const rootRow=rows.find(x=>x.recipient_line_id===root);assert.equal(rootRow.recipient_member_id,null);
  const delivery=await dispatchNotifications(pool,{...options(rootRow,async()=>({status:'sent'})),authority:{...authority,rootLineIds:[root]}});
  assert.equal(delivery.sent,1);
  assert.ok(member.id);
});
