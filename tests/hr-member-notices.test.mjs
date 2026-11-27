import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notifyAfterDocumentReview, notifyStageMilestone, queueStageMilestoneNotice,
  notifyAccountStatusChange, notifyApplicationRejected,
} from '../src/lib/hr-member-notices.js';
import { documentDisplayName } from '../src/lib/hr-line-document-names.js';

// 假的 run（依 SQL 內容回傳資料列）與 push（記錄送出的訊息）。
function fakeDeps(handlers, { languages = {}, failPushTo = null } = {}) {
  const pushed = [];
  const queries = [];
  const run = async (sql, params = []) => {
    queries.push({ sql, params });
    if (/hr_line_member_settings/.test(sql)) return languages[params[0]] ? [{ preferred_language: languages[params[0]] }] : [];
    for (const [pattern, reply] of handlers) if (pattern.test(sql)) return typeof reply === 'function' ? reply(params) : reply;
    return [];
  };
  const push = async (to, messages) => {
    if (to === failPushTo) throw new Error('push failed');
    pushed.push({ to, text: messages[0].text });
  };
  return { deps: { run, push }, pushed, queries };
}
const textTo = (pushed, to) => pushed.find(item => item.to === to)?.text;

// 洪水保護用的是模組層級的計數，先跑這個測試（假時鐘從 0 開始），之後的測試用真實時間就不會被擋。
test('里程碑排程：只處理往前進到里程碑；短時間太多就略過；資料庫還沒更新會延後重試', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const errors = t.mock.method(console, 'error', () => {});
  const previousEnv = process.env.NODE_ENV;
  t.after(() => { if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv; });
  process.env.NODE_ENV = 'test'; // node --test 不會自動設定
  assert.equal(queueStageMilestoneNotice({ caseId: 1, fromStage: 'documents', toStage: 'application' }), false, 'NODE_ENV=test 時預設不排程');
  const opts = { force: true, delays: [10, 20], deps: { run: async () => [], push: async () => {} } };
  assert.equal(queueStageMilestoneNotice({ caseId: 1, fromStage: 'documents', toStage: 'medical_training' }, opts), false, '不是里程碑');
  assert.equal(queueStageMilestoneNotice({ caseId: 1, fromStage: 'arrangement', toStage: 'application' }, opts), false, '往回走');
  assert.equal(queueStageMilestoneNotice({ caseId: 1, fromStage: 'unknown', toStage: 'application' }, opts), false);
  const accepted = Array.from({ length: 22 }, (_, i) => queueStageMilestoneNotice({ caseId: i, fromStage: 'intake', toStage: 'completed' }, opts));
  assert.equal(accepted.filter(Boolean).length, 20);
  assert.equal(errors.mock.calls.filter(call => call.arguments[0] === 'hr_stage_notice_flood_guard_skipped').length, 2);
  t.mock.timers.tick(61_000);
  assert.equal(queueStageMilestoneNotice({ caseId: 99, fromStage: 'intake', toStage: 'completed' }, opts), true, '超過一分鐘就恢復');
  t.mock.timers.reset();
});

test('里程碑排程：階段還沒更新（回傳 null）會依 delays 重試，錯誤只記錄不丟出', async t => {
  const errors = t.mock.method(console, 'error', () => {});
  let attempts = 0;
  const pending = { run: async sql => { if (/FROM hr_cases/.test(sql)) { attempts++; return [{ stage: 'documents' }]; } return []; }, push: async () => {} };
  assert.equal(queueStageMilestoneNotice({ caseId: 5, fromStage: 'documents', toStage: 'application' }, { force: true, delays: [1, 1], deps: pending }), true);
  const broken = { run: async () => { throw new Error('db down'); } };
  queueStageMilestoneNotice({ caseId: 6, fromStage: 'documents', toStage: 'arrangement' }, { force: true, delays: [1], deps: broken });
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(attempts, 2, '第一次不是目標階段，再試一次');
  assert.ok(errors.mock.calls.some(call => call.arguments[0] === 'hr_stage_notice_failed'));
});

const WORKER = { id: 7, name: 'Maria', agency_id: 3 };
const reviewHandlers = (docs, extra = []) => [
  [/FROM hr_workers WHERE id/, [WORKER]],
  [/FROM hr_worker_documents/, docs],
  [/WHERE worker_id=\$1/, [{ line_user_id: 'L-worker', role: 'worker', email: 'w@example.invalid' }]],
  [/FROM hr_document_submissions/, [{ submitted_by: 'staff@example.invalid' }]],
  [/lower\(email\)=lower\(\$1\)/, [{ line_user_id: 'L-staff', role: 'agency', email: 'staff@example.invalid' }]],
  [/role='agency' AND agency_id/, [{ line_user_id: 'L-agency', role: 'agency' }, { line_user_id: 'L-staff', role: 'agency', email: 'staff@example.invalid' }]],
  [/role='training_center'/, [{ line_user_id: 'L-center', role: 'training_center' }]],
  ...extra,
];

test('文件審核：還有待審文件、也沒有里程碑時不通知', async () => {
  const { deps, pushed } = fakeDeps(reviewHandlers([{ name: '護照', status: 'submitted', required: true }]));
  assert.equal(await notifyAfterDocumentReview({ workerId: 7 }, deps), 0);
  assert.deepEqual(pushed, []);
  const missing = fakeDeps([]);
  assert.equal(await notifyAfterDocumentReview({ workerId: 404 }, missing.deps), 0);
});

test('文件審核：一輪審完送一則摘要給工作者與上傳者，退件原因一次列出、文件名依語言顯示', async () => {
  const docs = [
    { name: '護照', status: 'approved', required: true },
    { name: '新護照', status: 'returned', review_reason: '照片模糊', required: true },
    { name: '其他', status: 'returned', review_reason: '', required: false },
  ];
  const { deps, pushed } = fakeDeps(reviewHandlers(docs), { languages: { 'L-staff': 'zh' } });
  const sent = await notifyAfterDocumentReview({ workerId: 7, submissionId: 9, actor: 'admin@example.invalid' }, deps);
  assert.equal(sent, 2);
  const workerText = textTo(pushed, 'L-worker');
  assert.match(workerText, /^📄 Document review result: 1\/2 approved\nNeeds correction \(2\):/, '工作者預設英文、不顯示自己的名字');
  assert.ok(workerText.includes('・New passport：照片模糊'), '退件通知的文件名稱依收件人語言翻譯');
  assert.ok(textTo(pushed, 'L-staff').includes('・新護照：照片模糊'), '中文收件人看中文名稱');
  assert.ok(workerText.includes(`・${documentDisplayName('其他', 'en')}：-`), '沒有原因顯示 -');
  assert.match(workerText, /Please correct them and upload again\.$/);
  assert.match(textTo(pushed, 'L-staff'), /^📄 文件審核結果：已通過 1\/2 份（工作者：Maria）/);
});

test('文件審核：初步審核通過與文件齊全的里程碑，會合併進摘要並通知仲介與訓練中心；操作者本人不收', async () => {
  const docs = [{ name: '護照', status: 'approved', required: true }];
  const { deps, pushed } = fakeDeps(reviewHandlers(docs), { languages: { 'L-worker': 'tl' } });
  const sent = await notifyAfterDocumentReview({ workerId: 7, submissionId: 9, actor: 'STAFF@example.invalid', gateOpened: true, docsComplete: true }, deps);
  assert.equal(sent, 3, '工作者、仲介、訓練中心各一則；上傳者就是操作者，不收');
  assert.deepEqual(pushed.map(item => item.to), ['L-worker', 'L-agency', 'L-center']);
  const workerText = textTo(pushed, 'L-worker');
  assert.match(workerText, /^📄 Resulta ng pagsusuri ng dokumento: 1\/1/);
  assert.match(workerText, /Naaprubahan na ang lahat/);
  assert.match(workerText, /Pumasa na ang iyong paunang pagsusuri/);
  assert.equal(textTo(pushed, 'L-agency'), '✅ 工作者「Maria」初步文件審核已通過，可以安排訓練。\n✅ 工作者「Maria」的所有必要文件都已通過審核。');
  assert.equal(textTo(pushed, 'L-center'), '✅ 工作者「Maria」初步文件審核已通過，可以安排訓練。', '訓練中心不收文件齊全通知');
});

test('文件審核：還有待審文件但達到里程碑時，只送里程碑；HR_NOTIFY_DOCUMENT_ROUND=0 關閉摘要', async t => {
  const docs = [{ name: '護照', status: 'submitted', required: true }];
  const { deps, pushed } = fakeDeps(reviewHandlers(docs));
  await notifyAfterDocumentReview({ workerId: 7, docsComplete: true }, deps);
  assert.equal(textTo(pushed, 'L-worker'), '✅ All required documents have been approved.');
  assert.deepEqual(pushed.map(item => item.to), ['L-worker', 'L-agency', 'L-staff'], '工作者與所屬仲介的所有會員');

  t.after(() => { delete process.env.HR_NOTIFY_DOCUMENT_ROUND; });
  process.env.HR_NOTIFY_DOCUMENT_ROUND = '0';
  const off = fakeDeps(reviewHandlers([{ name: '護照', status: 'approved', required: true }]));
  assert.equal(await notifyAfterDocumentReview({ workerId: 7 }, off.deps), 0);
});

test('發送：同一個 LINE 只收一則、沒有 LINE 的略過；單一收件人失敗不影響其他人', async t => {
  const errors = t.mock.method(console, 'error', () => {});
  const docs = [{ name: '護照', status: 'approved', required: true }];
  const handlers = reviewHandlers(docs, []);
  handlers.splice(2, 1, [/WHERE worker_id=\$1/, [{ line_user_id: 'L-worker', role: 'worker' }, { line_user_id: 'L-worker', role: 'worker' }, { line_user_id: '', role: 'worker' }]]);
  const { deps, pushed } = fakeDeps(handlers, { failPushTo: 'L-worker' });
  const sent = await notifyAfterDocumentReview({ workerId: 7, submissionId: 9 }, deps);
  assert.equal(sent, 1);
  assert.deepEqual(pushed.map(item => item.to), ['L-staff']);
  assert.equal(errors.mock.calls[0].arguments[0], 'hr_member_notice_push_failed');
});

const caseRow = stage => ({ stage, assigned_member_id: null, worker_id: 7, worker_name: 'Maria', worker_agency_id: 3, employer_id: 5, employer_name: '王先生', employer_agency_id: 1 });
const stageHandlers = (stage, claimed = true, extra = []) => [
  [/CREATE TABLE IF NOT EXISTS hr_stage_notices/, []],
  [/FROM hr_cases c/, [caseRow(stage)]],
  [/INSERT INTO hr_stage_notices/, claimed ? [{ case_id: 1 }] : []],
  ...extra,
  [/WHERE worker_id=\$1/, [{ line_user_id: 'L-worker', role: 'worker' }]],
  [/role='agency' AND agency_id=\$1/, params => [{ line_user_id: params[0] === 3 ? 'L-ph' : 'L-tw', role: 'agency' }]],
  [/WHERE employer_id=\$1/, [{ line_user_id: 'L-employer', role: 'employer' }]],
];

test('案件里程碑：每位對象收到對應的文案，每個案件每個里程碑只通知一次', async () => {
  const { deps, pushed } = fakeDeps(stageHandlers('arrangement'));
  assert.equal(await notifyStageMilestone({ caseId: 1, toStage: 'arrangement' }, deps), 4);
  assert.match(textTo(pushed, 'L-worker'), /^✈️ Your OEC and visa are complete!/);
  assert.equal(textTo(pushed, 'L-ph'), '✈️ 工作者「Maria」的 OEC 與簽證已完成。');
  assert.match(textTo(pushed, 'L-tw'), /入境後請安排抵台體檢/);
  assert.match(textTo(pushed, 'L-employer'), /（雇主：王先生）的 OEC 與簽證已完成，接下來安排入境/);

  const again = fakeDeps(stageHandlers('arrangement', false));
  assert.equal(await notifyStageMilestone({ caseId: 1, toStage: 'arrangement' }, again.deps), 0);
  assert.deepEqual(again.pushed, []);
});

test('案件里程碑：沒有專屬文案的對象用一般版；案件負責人優先於仲介全體；不是里程碑或資料不符不通知', async () => {
  const assigned = [[/WHERE id=\$1 AND role='agency'/, [{ line_user_id: 'L-assigned', role: 'agency' }]]];
  const handlers = stageHandlers('completed', true, assigned);
  handlers[1] = [/FROM hr_cases c/, [{ ...caseRow('completed'), assigned_member_id: 44, worker_agency_id: null }]];
  const { deps, pushed } = fakeDeps(handlers);
  assert.equal(await notifyStageMilestone({ caseId: 1, toStage: 'completed' }, deps), 3);
  assert.deepEqual(pushed.map(item => item.to), ['L-worker', 'L-assigned', 'L-employer']);
  assert.match(textTo(pushed, 'L-assigned'), /^🎉 工作者「Maria」（雇主：王先生）的申辦程序已全部完成。$/);

  assert.equal(await notifyStageMilestone({ caseId: 1, toStage: 'documents' }, fakeDeps([]).deps), 0);
  assert.equal(await notifyStageMilestone({ caseId: 1, toStage: 'application' }, fakeDeps([[/FROM hr_cases c/, []]]).deps), 0);
  assert.equal(await notifyStageMilestone({ caseId: 1, toStage: 'application' }, fakeDeps(stageHandlers('documents')).deps), null, '交易還沒完成，稍後再試');
});

test('帳號狀態：停用、重新啟用、待審核申請被停用或刪除，各自送對應通知；狀態沒變不送', async () => {
  const cases = [
    [{ lineUserId: 'L1', role: 'worker', wasActive: true, nowActive: false }, 1, /^⚠️ Your account has been disabled/],
    [{ lineUserId: 'L1', role: 'employer', wasActive: false, nowActive: true }, 1, /^✅ 你的帳號已重新啟用/],
    [{ lineUserId: 'L1', role: null, requestedRole: 'worker', wasActive: true, nowActive: false }, 1, /^你的會員申請目前未通過審核/],
    [{ lineUserId: 'L1', role: null, wasActive: true, nowActive: false }, 0],
    [{ lineUserId: 'L1', role: null, wasActive: false, nowActive: true }, 0],
    [{ lineUserId: 'L1', role: 'worker', wasActive: true, nowActive: true }, 0],
    [{ lineUserId: ' ', role: 'worker', wasActive: true, nowActive: false }, 0],
  ];
  for (const [input, expected, pattern] of cases) {
    const { deps, pushed } = fakeDeps([]);
    assert.equal(await notifyAccountStatusChange(input, deps), expected, JSON.stringify(input));
    if (pattern) assert.match(pushed[0].text, pattern);
  }
  const rejected = fakeDeps([], { languages: { L2: 'en' } });
  assert.equal(await notifyApplicationRejected({ lineUserId: 'L2', requestedRole: 'employer' }, rejected.deps), 1);
  assert.match(rejected.pushed[0].text, /^Your membership application was not approved/);
  assert.equal(await notifyApplicationRejected({ lineUserId: 'L2' }, rejected.deps), 0);
  assert.equal(await notifyApplicationRejected({ lineUserId: null, requestedRole: 'worker' }, rejected.deps), 0);
});

test('語言：沒有設定表或設定值不支援時，工作者用英文、其他人用中文', async () => {
  const broken = { run: async sql => { if (/hr_line_member_settings/.test(sql)) throw new Error('no table'); return []; }, push: async (to, messages) => { broken.sent = messages[0].text; } };
  await notifyAccountStatusChange({ lineUserId: 'L1', role: 'agency', wasActive: true, nowActive: false }, broken);
  assert.match(broken.sent, /^⚠️ 你的帳號已被管理員停用/);
  const unsupported = fakeDeps([], { languages: { L1: 'ja' } });
  await notifyAccountStatusChange({ lineUserId: 'L1', role: 'worker', wasActive: true, nowActive: false }, unsupported.deps);
  assert.match(unsupported.pushed[0].text, /^⚠️ Your account/);
});
