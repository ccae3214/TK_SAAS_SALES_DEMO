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
