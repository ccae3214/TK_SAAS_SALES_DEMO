import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationAuthority, isNotificationAdmin, renderRequestNotification, lineOutcome, pushNotification, dispatchNotifications } from '../src/lib/hr-notifications.js';

const authority = notificationAuthority({ ADMIN_EMAILS: ' A@Example.invalid, b@example.invalid ', HR_ADMIN_EMAILS: 'C@example.invalid', HR_ADMIN_LINE_USER_IDS: ' review-root,other-root ' });
test('authority parses existing environment channels without exposing values', () => {
  assert.deepEqual(authority.adminEmails, ['a@example.invalid','b@example.invalid','c@example.invalid']);
  assert.deepEqual(authority.rootLineIds,['review-root','other-root']);
});
for (const [name, member, expected] of [
  ['active system scope',{active:true,admin_scope:'system'},true],
  ['inactive database system admin',{active:false,admin_scope:'system'},false],
  ['agency administrator',{active:true,role:'agency',admin_scope:'agency'},false],
  ['unapproved member',{active:true,role:null,admin_scope:'none'},false],
  ['role label alone is not system scope',{active:true,role:'system_admin',admin_scope:'none'},false],
  ['environment email precedence mirrors existing authority',{active:false,email:'A@EXAMPLE.INVALID'},true],
  ['environment root precedence',{active:false,line_user_id:'review-root'},true],
  ['ordinary worker',{active:true,role:'worker'},false],
]) test(name, () => assert.equal(isNotificationAdmin(member,authority),expected));
for (const [status,header,expected] of [[200,null,'sent'],[409,'accepted-request','sent'],[409,null,'failed'],[401,null,'failed'],[400,null,'failed'],[429,null,'retry'],[500,null,'retry'],[503,null,'retry']]) {
  test(`LINE HTTP ${status} accepted-header=${!!header}`, () => assert.equal(lineOutcome(status,header).status,expected));
}
for (const language of ['zh','en','tl','unsupported']) test(`minimal authenticated deep link ${language}`, () => {
  const messages=renderRequestNotification('https://example.invalid/base',42,language);
  assert.equal(messages.length,1);
  assert.match(messages[0].text,/https:\/\/example\.invalid\/hr\?memberRequest=42$/);
  assert.doesNotMatch(messages[0].text, /passport|password|display_name|worker_id/);
});
test('credentials in a configured URL are never put into a message',()=>assert.throws(()=>renderRequestNotification('https://user:test-only@example.invalid',42)));
test('invalid delivery scheme refused',()=>assert.throws(()=>renderRequestNotification('javascript:alert(1)',42)));
test('unconfigured worker does not claim jobs or consume attempts',async()=>{
  const result=await dispatchNotifications({connect:()=>{throw new Error('must not claim')}},{token:null,baseUrl:'https://example.invalid'});
  assert.equal(result.configurationMissing,true);assert.equal(result.claimed,0);
});
test('retry key remains stable and acknowledgement is not physical receipt',async()=>{
  const row={delivery_key:'f8b133be-283f-4fb5-aa15-f8d920b9c109',recipient_line_id:'review-only-invalid-line'};
  const captures=[];
  const fetchImpl=async(url,options)=>{captures.push({url,options});return {status:409,headers:new Headers({'x-line-accepted-request-id':'test-accepted'})};};
  for(let i=0;i<2;i++) assert.equal((await pushNotification(row,[{type:'text',text:'test'}],{token:'test-only-not-real',fetchImpl})).status,'sent');
  assert.equal(captures[0].options.headers['X-Line-Retry-Key'],captures[1].options.headers['X-Line-Retry-Key']);
  assert.equal(JSON.parse(captures[0].options.body).to,row.recipient_line_id);
});

// ---- 交易流程：用可程式化的假資料庫，依 SQL 內容回應 ----
const result = rows => ({ rows, rowCount: rows.length });
function fakePool(handlers) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    for (const [pattern, reply] of handlers) if (pattern.test(sql)) return typeof reply === 'function' ? reply(params, sql) : reply;
    return result([]);
  };
  let released = 0;
  return { calls, query, connect: async () => ({ query, release: () => { released++; } }), get released() { return released; } };
}
const sqlOf = (pool, pattern) => pool.calls.filter(call => pattern.test(call.sql));
const pendingSubject = result([{ role: null, active: true, requested_role: 'worker' }]);

test('dispatch：網址設定不合法時不會領取任何工作', async () => {
  const pool = fakePool([]);
  const counts = await dispatchNotifications(pool, { token: 't', baseUrl: 'javascript:alert(1)' });
  assert.equal(counts.configurationMissing, true);
  assert.equal(pool.calls.length, 0);
});

test('dispatch：每筆都重新確認申請與收件人，依結果記錄 sent／cancelled／failed／retry', async () => {
  const rows = [
    { id: 1, attempts: 1, subject_member_id: 10, recipient_kind: 'environment', recipient_line_id: 'review-root', delivery_key: 'k1' },
    { id: 2, attempts: 1, subject_member_id: 11, recipient_kind: 'environment', recipient_line_id: 'review-root', delivery_key: 'k2' },
    { id: 3, attempts: 1, subject_member_id: 10, recipient_kind: 'environment', recipient_line_id: 'not-root', delivery_key: 'k3' },
    { id: 4, attempts: 1, subject_member_id: 10, recipient_kind: 'member', recipient_member_id: 50, recipient_line_id: 'admin-line', delivery_key: 'k4' },
    { id: 5, attempts: 1, subject_member_id: 10, recipient_kind: 'member', recipient_member_id: 51, recipient_line_id: 'admin-line', delivery_key: 'k5' },
    { id: 6, attempts: 2, subject_member_id: 10, recipient_kind: 'environment', recipient_line_id: 'other-root', delivery_key: 'k6' },
    { id: 7, attempts: 5, subject_member_id: 10, recipient_kind: 'environment', recipient_line_id: 'other-root', delivery_key: 'k7' },
    { id: 8, attempts: 1, subject_member_id: 10, recipient_kind: 'environment', recipient_line_id: 'review-root', delivery_key: 'k8' },
  ];
  const pool = fakePool([
    [/WITH due AS/, result(rows)],
    [/SELECT role,active,requested_role FROM hr_members/, ([id]) => (id === 11 ? result([{ role: 'worker', active: true, requested_role: 'worker' }]) : pendingSubject)],
    [/SELECT email,line_user_id,active,admin_scope FROM hr_members/, ([id]) => result([{ line_user_id: id === 50 ? 'admin-line' : 'other', active: true, admin_scope: 'system' }])],
    [/to_regclass/, result([{ name: 'hr_line_member_settings' }])],
    [/preferred_language/, ([line]) => result(line === 'review-root' ? [{ preferred_language: 'en' }] : [])],
    [/SET status=\$3/, params => result(params[0] === 8 ? [] : [{ id: params[0] }])],
  ]);
  const sent = [];
  const send = async (row, messages) => {
    sent.push([row.id, messages[0].text]);
    if (row.id === 6) throw new Error('network');
    if (row.id === 7) return { status: 'retry', code: 'line_http_500' };
    if (row.id === 4) return { status: 'weird' };
    return { status: 'sent' };
  };
  const counts = await dispatchNotifications(pool, { authority, baseUrl: 'https://example.invalid', send, limit: 50 });
  assert.deepEqual(counts, { claimed: 8, sent: 1, retry: 1, failed: 2, cancelled: 3, configurationMissing: false });
  assert.deepEqual(sent.map(([id]) => id), [1, 4, 6, 7, 8]);
  assert.match(sent[0][1], /^A new membership request/, '收件人設定英文就用英文');
  assert.match(sent[2][1], /^有新的會員申請/, '沒有設定語言用中文');
  const saves = sqlOf(pool, /SET status=\$3/).map(call => [call.params[0], call.params[2], call.params[3], call.params[4]]);
  assert.deepEqual(saves, [
    [1, 'sent', null, 5], [2, 'cancelled', 'recipient_or_request_changed', 5], [3, 'cancelled', 'recipient_or_request_changed', 5],
    [4, 'failed', 'invalid_transport_result', 5], [5, 'cancelled', 'recipient_or_request_changed', 5], [6, 'retry', 'transport_or_store_error', 10],
    [7, 'failed', 'attempts_exhausted', 80], [8, 'sent', null, 5],
  ]);
  const claim = sqlOf(pool, /WITH due AS/)[0];
  assert.equal(claim.params[1], 20, '一次最多領 20 筆');
  assert.equal(claim.params[3], 205);
  assert.equal(pool.released, 1);
});

test('dispatch：沒有語言設定表時用中文；領取失敗會 ROLLBACK 並釋放連線', async () => {
  const pool = fakePool([
    [/WITH due AS/, result([{ id: 1, attempts: 1, subject_member_id: 10, recipient_kind: 'environment', recipient_line_id: 'review-root' }])],
    [/SELECT role,active,requested_role/, pendingSubject],
    [/to_regclass/, result([{ name: null }])],
    [/SET status=\$3/, result([{ id: 1 }])],
  ]);
  const texts = [];
  await dispatchNotifications(pool, { authority, baseUrl: 'https://example.invalid', send: async (row, messages) => { texts.push(messages[0].text); return { status: 'sent' }; } });
  assert.match(texts[0], /^有新的會員申請/);
  assert.equal(sqlOf(pool, /preferred_language/).length, 0);

  const broken = fakePool([[/WITH due AS/, () => { throw new Error('db down'); }]]);
  await assert.rejects(dispatchNotifications(broken, { authority, baseUrl: 'https://example.invalid', send: async () => ({ status: 'sent' }) }), /db down/);
  assert.equal(sqlOf(broken, /^ROLLBACK$/).length, 1);
  assert.equal(broken.released, 1);
});

test('enqueue：環境設定的 LINE 管理者與資料庫中的系統管理者各收一則，重複的 LINE 只收一次', async () => {
  const { enqueueMemberRequest } = await import('../src/lib/hr-notifications.js');
  let nextId = 100;
  const pool = fakePool([
    [/FROM hr_members/, result([
      { id: 1, line_user_id: 'review-root', active: true, admin_scope: 'system' },
      { id: 2, line_user_id: 'db-admin', active: true, admin_scope: 'system' },
      { id: 3, line_user_id: 'agency-admin', active: true, admin_scope: 'agency' },
    ])],
    [/INSERT INTO hr_notification_outbox/, params => (params[4] === 'other-root' ? result([]) : result([{ id: nextId++ }]))],
  ]);
  const ids = await enqueueMemberRequest(pool, 9, authority);
  assert.deepEqual(ids, [100, 101]);
  const inserts = sqlOf(pool, /INSERT INTO hr_notification_outbox/).map(call => call.params.slice(0, 5));
  assert.deepEqual(inserts, [
    ['member-request:9', 9, null, 'environment', 'review-root'],
    ['member-request:9', 9, null, 'environment', 'other-root'],
    ['member-request:9', 9, 2, 'member', 'db-admin'],
  ]);
});

test('submit：新申請建立會員並排入通知；已申請過的更新不再通知', async () => {
  const { submitMemberRequest } = await import('../src/lib/hr-notifications.js');
  const newcomer = fakePool([
    [/FOR UPDATE/, result([])],
    [/FROM hr_agencies/, params => { assert.equal(params[1], 'philippines'); return result([{ id: 3 }]); }],
    [/INSERT INTO hr_members/, result([{ id: 9, requested_role: 'worker', requested_agency_id: 3 }])],
    [/INSERT INTO hr_notification_outbox/, result([{ id: 100 }])],
  ]);
  const created = await submitMemberRequest(newcomer, { email: 'a@example.invalid', lineUserId: 'line-a', displayName: 'A', requestedRole: 'worker', requestedAgencyId: 3 }, authority);
  assert.deepEqual(created, { member: { id: 9, requested_role: 'worker', requested_agency_id: 3 }, notificationIds: [100, 100] });
  assert.equal(sqlOf(newcomer, /^COMMIT$/).length, 1);
  assert.equal(newcomer.released, 1);

  const again = fakePool([
    [/FOR UPDATE/, result([{ id: 9, role: null, active: true, requested_role: 'worker' }])],
    [/UPDATE hr_members/, result([{ id: 9, requested_role: 'employer', requested_agency_id: null }])],
  ]);
  const updated = await submitMemberRequest(again, { email: 'a@example.invalid', lineUserId: null, requestedRole: 'employer', requestedAgencyId: null }, authority);
  assert.deepEqual(updated.notificationIds, []);
  assert.equal(sqlOf(again, /FROM hr_agencies/).length, 0, '沒有指定仲介就不查仲介');
  assert.equal(sqlOf(again, /hashtextextended/)[0].params[0], 'a@example.invalid');
});

test('submit：已核准、停用、重複身分、仲介不符或更新不到，都視為衝突並 ROLLBACK', async () => {
  const { submitMemberRequest, MemberRequestConflict } = await import('../src/lib/hr-notifications.js');
  const request = { email: 'a@example.invalid', lineUserId: 'line-a', requestedRole: 'employer', requestedAgencyId: 4 };
  const scenarios = [
    [[/FOR UPDATE/, result([{ id: 1, role: 'worker', active: true }])]],
    [[/FOR UPDATE/, result([{ id: 1, role: null, active: false }])]],
    [[/FOR UPDATE/, result([{ id: 1, role: null, active: true }, { id: 2, role: null, active: true }])]],
    [[/FOR UPDATE/, result([])], [/FROM hr_agencies/, params => { assert.equal(params[1], 'taiwan'); return result([]); }]],
    [[/FOR UPDATE/, result([{ id: 1, role: null, active: true }])], [/FROM hr_agencies/, result([{ id: 4 }])], [/UPDATE hr_members/, result([])]],
  ];
  for (const handlers of scenarios) {
    const pool = fakePool(handlers);
    await assert.rejects(submitMemberRequest(pool, request, authority), MemberRequestConflict);
    assert.equal(sqlOf(pool, /^ROLLBACK$/).length, 1);
    assert.equal(sqlOf(pool, /^COMMIT$/).length, 0);
    assert.equal(pool.released, 1);
  }
  const other = fakePool([[/FOR UPDATE/, result([])], [/FROM hr_agencies/, params => { assert.equal(params[1], null); return result([{ id: 4 }]); }], [/INSERT INTO hr_members/, result([{ id: 5 }])]]);
  await submitMemberRequest(other, { ...request, requestedRole: 'training_center' }, { adminEmails: [], rootLineIds: [] });
});
