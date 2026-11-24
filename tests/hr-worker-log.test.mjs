import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  WORKER_LOG_ACTIONS, canSeeActorName, describeDocumentUpload, describeLearningUnit, describeLogin, describeQuiz, describeWorkerOperation,
  isWorkerRelatedType, normalizeWorkerLogFilters, shapeWorkerLogRow, workerLogAudience,
} from '../src/lib/hr-worker-log-core.js';

const CJK = /[一-鿿]/;

test('只有工人本人與系統管理者看得到工人的紀錄，仲介看不到', () => {
  const worker = { id: 5, agency_id: 9 };
  assert.equal(workerLogAudience({ role: 'worker', worker_id: 5 }, worker), 'self');
  assert.equal(workerLogAudience({ role: 'worker', worker_id: 6 }, worker), null);
  assert.equal(workerLogAudience({ role: 'admin' }, worker), 'staff');
  assert.equal(workerLogAudience({ role: 'agency', agency_type: 'philippines', agency_id: 9 }, worker), null);
  assert.equal(workerLogAudience({ role: 'agency', agency_type: 'taiwan', agency_id: 9, is_agency_admin: true }, worker), null);
  assert.equal(workerLogAudience({ role: 'employer', employer_id: 1 }, worker), null);
  assert.equal(workerLogAudience({ role: 'training_center' }, worker), null);
  assert.equal(workerLogAudience(null, worker), null);
});

test('操作人員姓名只有系統管理者看得到', () => {
  assert.equal(canSeeActorName('admin'), true);
  assert.equal(canSeeActorName('agency'), false);
  assert.equal(canSeeActorName('worker'), false);
  const row = { id: 1, worker_id: 5, worker_name: 'Maria', actor_role: 'admin', actor_name: 'Boss', action: 'edit', summary_zh: 'x', summary_en: 'y', created_at: 'now', actor_email: 'secret@example.com' };
  assert.equal(shapeWorkerLogRow(row, 'worker').actor_name, '');
  assert.equal(shapeWorkerLogRow(row, 'agency').actor_name, '');
  assert.equal(shapeWorkerLogRow(row, 'admin').actor_name, 'Boss');
  assert.equal('actor_email' in shapeWorkerLogRow(row, 'admin'), false);
});

test('工人相關操作都有中英文敘述與已知的 action', () => {
  const cases = [
    { method: 'POST', type: 'worker' },
    { method: 'POST', type: 'job-order-candidate' },
    { method: 'DELETE', type: 'worker' },
    { method: 'DELETE', type: 'member', body: { purge: true } },
    { method: 'DELETE', type: 'member', body: {} },
    { method: 'PATCH', type: 'worker', body: { name: 'Maria' }, isSelf: true },
    { method: 'PATCH', type: 'worker', body: { name: 'Maria' } },
    { method: 'PATCH', type: 'worker', body: { status: 'inactive' } },
    { method: 'PATCH', type: 'worker', body: { active: true } },
    { method: 'PATCH', type: 'worker-resume', body: {} },
    { method: 'PATCH', type: 'worker-resume', body: { clear: true } },
    { method: 'PATCH', type: 'worker-acknowledge', body: { confirmed: true } },
    { method: 'PATCH', type: 'worker-acknowledge', body: { confirmed: false } },
    { method: 'PATCH', type: 'review', body: { decision: 'approved' }, name: 'Passport' },
    { method: 'PATCH', type: 'review', body: { decision: 'returned' }, name: 'Passport' },
    { method: 'PATCH', type: 'review', body: { decision: 'returned' } },
    { method: 'PATCH', type: 'requirement-applicability', body: { applicable: false }, name: 'Passport' },
    { method: 'PATCH', type: 'workflow', body: { workflowType: 'medical', status: 'passed' } },
    { method: 'PATCH', type: 'workflow', body: { workflowType: 'training', status: 'certified' } },
    { method: 'PATCH', type: 'application-step', body: {} },
    { method: 'PATCH', type: 'case', body: { status: 'closed' } },
    { method: 'PATCH', type: 'certification', body: {} },
    { method: 'PATCH', type: 'member', body: { role: 'worker' } },
    { method: 'PATCH', type: 'member', body: { active: false } },
    { method: 'PATCH', type: 'member-profile', body: {} },
    { method: 'PATCH', type: 'member-restore', body: {} },
    { method: 'PATCH', type: 'job-order-candidate-interview', body: { status: 'passed' } },
    { method: 'PATCH', type: 'job-order-candidate-withdraw', body: {} },
  ];
  for (const input of cases) {
    const out = describeWorkerOperation(input);
    assert.ok(out, JSON.stringify(input));
    assert.ok(WORKER_LOG_ACTIONS[out.action], out.action);
    assert.match(out.zh, CJK, JSON.stringify(input));
    assert.doesNotMatch(out.en, CJK, JSON.stringify(input));
    assert.ok(out.en.length > 3);
  }
  assert.equal(describeWorkerOperation({ method: 'PATCH', type: 'task', body: { status: 'done' } }), null);
  assert.equal(describeWorkerOperation({ method: 'PATCH', type: 'unknown' }), null);
  assert.equal(describeWorkerOperation({ method: 'PATCH', type: 'job-order-candidate-interview', body: { status: 'weird' } }), null);
});

test('工人自己編輯與別人編輯的敘述不同', () => {
  const own = describeWorkerOperation({ method: 'PATCH', type: 'worker', body: { name: 'A' }, isSelf: true });
  const other = describeWorkerOperation({ method: 'PATCH', type: 'worker', body: { name: 'A' }, isSelf: false });
  assert.notEqual(own.zh, other.zh);
  assert.notEqual(own.en, other.en);
});

test('英文敘述不含中文，也不會寫出沒翻譯的狀態代碼', () => {
  const en = describeWorkerOperation({ method: 'PATCH', type: 'workflow', body: { workflowType: 'medical', status: 'retest' } }).en;
  assert.match(en, /Retest needed/);
  assert.doesNotMatch(en, CJK);
  const doc = describeWorkerOperation({ method: 'PATCH', type: 'review', body: { decision: 'approved' }, name: '護照' });
  assert.match(doc.zh, /護照/);
  assert.match(doc.en, /護照/); // 文件名稱是資料，原樣保留
});

test('文件、學習、小測驗、登入的敘述', () => {
  const upload = describeDocumentUpload({ name: 'Passport', version: 2, filename: 'p.pdf' });
  assert.equal(upload.action, 'upload');
  assert.match(upload.zh, /第 2 版/);
  assert.match(upload.en, /v2/);
  assert.equal(describeLearningUnit({ completed: true, name: '問候', nameEn: 'Greetings' }).en, 'Finished reading learning unit "Greetings"');
  assert.match(describeLearningUnit({ completed: false, name: '問候', nameEn: '' }).en, /Unmarked learning unit "問候"/);
  const quiz = describeQuiz({ name: '問候', nameEn: 'Greetings', correct: 4, total: 5, passed: true });
  assert.equal(quiz.action, 'quiz');
  assert.match(quiz.zh, /4\/5/);
  assert.match(quiz.en, /4\/5 correct \(passed\)/);
  assert.equal(describeLogin().action, 'login');
  for (const key of Object.keys(WORKER_LOG_ACTIONS)) {
    assert.match(WORKER_LOG_ACTIONS[key].zh, CJK);
    assert.doesNotMatch(WORKER_LOG_ACTIONS[key].en, CJK);
  }
});

test('不相關的 type 會被快速略過', () => {
  assert.equal(isWorkerRelatedType('worker'), true);
  assert.equal(isWorkerRelatedType('review'), true);
  assert.equal(isWorkerRelatedType('employer'), false);
  assert.equal(isWorkerRelatedType('agency'), false);
  assert.equal(isWorkerRelatedType(''), false);
});

test('篩選條件會被整理', () => {
  const f = normalizeWorkerLogFilters(new URLSearchParams({ workerId: '12', q: ' ab ', before: '50' }));
  assert.equal(f.workerId, 12);
  assert.equal(f.q, 'ab');
  assert.equal(f.beforeId, 50);
  const bad = normalizeWorkerLogFilters(new URLSearchParams({ workerId: 'x', before: '-1', q: 'a'.repeat(200) }));
  assert.equal(bad.workerId, null);
  assert.equal(bad.beforeId, null);
  assert.equal(bad.q.length, 80);
});

// 防護：記錄工人活動的每個掛點都還在，之後有人改動時會被這個測試提醒。
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('各個掛點都有寫入工人活動紀錄', () => {
  assert.match(read('src/lib/hr-audit.js'), /prepareWorkerLog[\s\S]*writeWorkerLog/);
  assert.match(read('src/app/api/hr/documents/route.js'), /recordWorkerLog/);
  assert.match(read('src/app/api/hr/learning/route.js'), /recordWorkerLog[\s\S]*describeQuiz[\s\S]*describeLearningUnit/);
  assert.match(read('src/auth.js'), /recordWorkerLogin/);
  assert.match(read('src/lib/hr-migrations.js'), /ensureWorkerLogSchema/);
});

test('活動紀錄的 API 只開放工人本人與系統管理者，工人的範圍由登入身分決定', () => {
  const route = read('src/app/api/hr/worker-log/route.js');
  assert.match(route, /principal\.worker_id/);
  assert.doesNotMatch(route, /agency/);
  assert.match(route, /status: 403/);
  assert.doesNotMatch(route, /request\.json|formData/);
});

test('仲介看不到任何工人活動紀錄的畫面', () => {
  const home = read('src/app/hr/page.jsx');
  assert.doesNotMatch(home, /isPhilippinesAgency/);
  assert.match(read('src/app/hr/workers/[id]/page.jsx'), /principal\?\.role === 'admin' && <HrWorkerActivityLog/);
});

test('工人活動紀錄放在會員頁面的「活動紀錄」選單，且有英文翻譯', () => {
  const portal = read('src/components/HrMemberPortal.jsx');
  assert.match(portal, /data\.role==='worker'\?\[\['activityLog','活動紀錄',History\]\]/);
  assert.match(portal, /activeWorkspaceTab==='activityLog'&&data\.role==='worker'&&<HrWorkerActivityLog self\/>/);
  assert.doesNotMatch(read('src/app/hr/page.jsx'), /HrWorkerActivityLog/);
  assert.match(read('src/lib/hr-translations.jsx'), /'活動紀錄': 'Activity log'/);
});
