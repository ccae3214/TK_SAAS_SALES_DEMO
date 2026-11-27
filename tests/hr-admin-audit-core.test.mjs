import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeAdminOperation, targetIdOf, adminActionParams, lineAdminActionParams, adminAuditParams,
} from '../src/lib/hr-admin-audit-core.js';

const d = (method, type, body = {}, name = 'A', before = null, created = null) => describeAdminOperation(method, type, body, name, before, created);

test('新增：用回應裡的名稱；案件沒有名稱也記錄，其他沒有名稱的不記錄', () => {
  assert.deepEqual(d('POST', 'worker', {}, '', null, { name: 'Maria' }), { action: '新增', name: 'Maria', phrase: '新增了Maria工作者' });
  assert.deepEqual(d('POST', 'member', {}, '', null, { display_name: 'Lee' }), { action: '新增', name: 'Lee', phrase: '新增了Lee會員帳號' });
  assert.deepEqual(d('POST', 'case', {}, '', null, { case_number: 'C-1' }).phrase, '新增了案件 C-1');
  assert.deepEqual(d('POST', 'case', {}, '', null, {}), { action: '新增', name: '', phrase: '新增了案件' });
  assert.equal(d('POST', 'task', { title: '補件' }, '').phrase, '新增了待辦「補件」');
  assert.equal(d('POST', 'requirement', { name: '體檢' }, '').phrase, '新增了文件項目「體檢」');
  assert.equal(d('POST', 'worker', {}, ''), null);
  assert.equal(d('POST', 'job-order', { name: 'x' }), null);
});

test('刪除：已核准的會員移到已刪除帳號；待審核或永久刪除才是刪除；仲介機構等直接刪除', () => {
  assert.equal(d('DELETE', 'member', {}, 'Lee', { role: 'worker' }).action, '移到已刪除帳號');
  assert.equal(d('DELETE', 'member', { purge: true }, 'Lee', { role: 'worker' }).phrase, '永久刪除了Lee會員帳號');
  assert.equal(d('DELETE', 'member', {}, 'Lee', { role: null }).phrase, '刪除了Lee會員帳號');
  assert.deepEqual(d('DELETE', 'agency', {}, '甲仲介'), { action: '刪除', name: '甲仲介', phrase: '刪除了甲仲介仲介機構' });
  assert.equal(d('DELETE', 'case', {}, 'C-1').phrase, '刪除了案件 C-1');
  assert.equal(d('DELETE', 'task'), null);
});

test('更新：編輯、停用／啟用、變更類型與權限、各種狀態都有對應敘述；未知值原樣顯示', () => {
  assert.equal(d('PATCH', 'employer', { name: 'x' }).phrase, '編輯了A雇主的資料');
  assert.equal(d('PATCH', 'worker', { status: 'inactive' }).phrase, '停用了A工作者');
  assert.equal(d('PATCH', 'worker', { status: 'active' }).phrase, '啟用了A工作者');
  assert.equal(d('PATCH', 'agency', { active: false }).action, '停用');
  assert.equal(d('PATCH', 'member', { role: 'agency' }).phrase, '將A的會員類型變更為仲介機構員工');
  assert.equal(d('PATCH', 'member', { role: 'toString' }).phrase, '將A的會員類型變更為toString', '不會把物件原型上的函式寫進紀錄');
  assert.equal(d('PATCH', 'member', { active: false }).phrase, '停用了A會員帳號');
  assert.equal(d('PATCH', 'member-admin-scope', { adminScope: 'system' }).phrase, '將A的管理者權限調整為系統管理者');
  assert.equal(d('PATCH', 'case', { status: 'on_hold' }).phrase, '將案件 A 的狀態變更為暫停');
  assert.equal(d('PATCH', 'task', { status: 'mystery' }).phrase, '將待辦「A」的狀態更新為mystery');
  assert.deepEqual(d('PATCH', 'review', { decision: 'approved' }), { action: '核准', name: 'A', phrase: '核准了A' });
  assert.equal(d('PATCH', 'review', {}).action, '退回');
  assert.equal(d('PATCH', 'workflow', { workflowType: 'medical' }).phrase, '更新了案件 A 的體檢狀態');
  assert.equal(d('PATCH', 'job-order-admin-status', { status: 'filled' }).phrase, '將媒合需求單 A 的狀態變更為已滿額');
  for (const type of ['member-restore', 'member-profile', 'certification', 'application-step', 'requirement-applicability', 'worker-resume']) assert.ok(d('PATCH', type), type);
  assert.equal(d('PATCH', 'unknown'), null);
  assert.equal(d('PATCH', 'constructor'), null);
});

test('操作對象編號依類型取不同欄位，不合法的編號是 null', () => {
  const body = { submissionId: '5', requirementId: 6, caseId: '7', id: 8 };
  assert.deepEqual(['review', 'requirement-applicability', 'workflow', 'application-step', 'worker'].map(type => targetIdOf(type, body)), [5, 6, 7, 7, 8]);
  assert.equal(targetIdOf('worker', { id: 'x' }), null);
  assert.equal(targetIdOf('worker', { id: -1 }), null);
});

test('網頁管理操作的紀錄：一律中文「{操作者}系統管理員{做了什麼}」，欄位截到資料表長度', () => {
  const params = adminActionParams({ principal: { id: 3, name: '王小明' }, session: { user: { email: 'a@example.invalid' } }, action: '新增', type: 'course', id: '9', name: 'X'.repeat(300), phrase: '新增了課程' });
  assert.deepEqual(params.slice(0, 6), [3, '王小明', 'a@example.invalid', '新增', 'course', 9]);
  assert.equal(params[6].length, 200);
  assert.equal(params[7], '王小明系統管理員新增了課程');
  assert.equal(adminActionParams({ session: { user: { name: 'Lee' } }, action: 'x', phrase: 'y' })[1], 'Lee');
  assert.equal(adminActionParams({ action: 'x', phrase: 'y' })[1], '系統管理員');
  assert.equal(adminAuditParams({ actorName: 'A', action: 'x', summary: 'S'.repeat(600) })[7].length, 500);
});

test('LINE 管理操作：有會員資料用會員名稱；.env 設定的管理者記「LINE 管理者」並附上 LINE ID', () => {
  const member = lineAdminActionParams({ principal: { id: 4, name: '陳管理', email: 'm@example.invalid' }, lineUserId: 'U123', action: '停用', type: 'worker', id: 2, name: 'Maria', phrase: '停用了Maria工作者' });
  assert.deepEqual(member, [4, '陳管理', 'm@example.invalid', '停用', 'worker', 2, 'Maria', '陳管理系統管理員透過 LINE 機器人停用了Maria工作者']);
  const envAdmin = lineAdminActionParams({ principal: { name: '沒有會員列' }, lineUserId: 'U999', action: '新增', type: 'employer', phrase: '新增了甲雇主' });
  assert.equal(envAdmin[0], null);
  assert.equal(envAdmin[1], 'LINE 管理者', '不寫成「LINE 會員」');
  assert.equal(envAdmin[7], 'LINE 管理者系統管理員透過 LINE 機器人新增了甲雇主（LINE ID：U999）');
});

test('寫入操作紀錄失敗只記錄錯誤，不會丟出例外影響原本的操作', { skip: process.env.DATABASE_URL ? '有 DATABASE_URL 時不測（會真的連資料庫）' : false }, async t => {
  const errors = t.mock.method(console, 'error', () => {});
  const { recordLineAdminAction, recordAdminAction } = await import('../src/lib/hr-audit.js');
  await recordLineAdminAction({ principal: null, lineUserId: 'U1', action: '新增', type: 'worker', phrase: 'x' });
  await recordAdminAction({ principal: null, action: '新增', type: 'worker', phrase: 'x' });
  assert.deepEqual(errors.mock.calls.map(call => call.arguments[0]), ['hr_audit_write_failed', 'hr_audit_write_failed']);
});
