// 角色隔離：GET /api/hr 對工作者、雇主、仲介回傳的資料，只能是他們各自能看的列。
// 這裡執行 route.js 裡真正的 GET 處理程式（不另外複製過濾邏輯），只把資料庫、登入與外部模組換成測試替身。
// 假資料裡「別人」的 email／備註都帶 -private，只要出現在非管理者的回應就會失敗。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveTrainingStatus, taipeiToday, TRAINING_STATUS_RANK } from '../src/lib/hr-training-auto-status.js';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const source = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
const start = source.indexOf('export async function GET() {');
const end = source.indexOf('// All record/member updates below', start);
assert.ok(start > 0 && end > start, '找不到 GET 處理程式，請更新這個測試的擷取範圍');
const getSource = source.slice(start, end).replace('export async function GET()', 'async function GET()');

const DATA = {
  employers: [
    { id: 1, name: 'Employer One', email: 'employer1@example.test', agency_id: 10, status: 'active', employer_profile: { age: 50 } },
    { id: 2, name: 'Employer Two', email: 'employer2-private@example.test', agency_id: 11, status: 'active', employer_profile: { age: 61 } },
  ],
  workers: [
    { id: 1, name: 'Worker One', email: 'worker1@example.test', agency_id: 20, status: 'active', resume_profile: {} },
    { id: 2, name: 'Worker Two', email: 'worker2-private@example.test', agency_id: 21, status: 'active', resume_profile: {} },
  ],
  cases: [
    { id: 1, case_number: 'C-1', worker_id: 1, employer_id: 1, employer_agency_id: 10, worker_agency_id: 20, status: 'open' },
    { id: 2, case_number: 'C-2', worker_id: 2, employer_id: 2, employer_agency_id: 11, worker_agency_id: 21, status: 'open' },
  ],
  tasks: [
    { id: 1, case_id: 1, title: 'task 1', status: 'open', notes: 'task-of-case-1' },
    { id: 2, case_id: 2, title: 'task 2', status: 'open', notes: 'task-of-case-2-private' },
  ],
  requirements: [
    { id: 1, worker_id: 1, name: 'PSA', status: 'approved' },
    { id: 2, worker_id: 2, name: 'PSA', status: 'approved' },
  ],
  submissions: [{ id: 1, worker_id: 1, filename: 'one.pdf' }, { id: 2, worker_id: 2, filename: 'two-private.pdf' }],
  activity: [
    { id: 1, case_id: 1, detail: 'activity-1', actor_email: 'staff@example.test' },
    { id: 2, case_id: 2, detail: 'activity-2-private', actor_email: 'staff-private@example.test' },
  ],
  agencies: [
    { id: 10, name: 'TW Agency A', agency_type: 'taiwan', active: true },
    { id: 11, name: 'TW Agency B', agency_type: 'taiwan', active: true },
    { id: 20, name: 'PH Agency A', agency_type: 'philippines', active: true },
    { id: 21, name: 'PH Agency B', agency_type: 'philippines', active: true },
  ],
  members: [
    { id: 100, email: 'member-private@example.test', display_name: 'Someone Else', role: 'worker', worker_id: 2, agency_id: null },
    { id: 101, email: 'agency-staff-private@example.test', display_name: 'Staff B', role: 'agency', agency_id: 11 },
  ],
  steps: [{ id: 1, case_id: 1, step_key: 'passport' }, { id: 2, case_id: 2, step_key: 'passport-private' }],
};

const ROUTES = [
  [/FROM hr_employers e WHERE NOT EXISTS/, () => DATA.employers],
  [/FROM hr_workers w WHERE NOT EXISTS/, () => DATA.workers],
  [/FROM hr_cases c JOIN hr_employers e/, () => DATA.cases],
  [/FROM hr_case_tasks t/, () => DATA.tasks],
  [/FROM hr_worker_documents r JOIN hr_workers w/, () => DATA.requirements],
  [/FROM hr_document_submissions s/, () => DATA.submissions],
  [/FROM hr_case_activity a/, () => DATA.activity],
  [/^SELECT \* FROM hr_agencies/, () => DATA.agencies],
  [/FROM hr_members m LEFT JOIN hr_agencies a ON a\.id=m\.agency_id/, () => DATA.members],
  [/FROM hr_application_steps/, () => DATA.steps],
  [/FROM hr_job_orders o/, () => []],
  [/FROM hr_job_order_agencies oa/, () => []],
  [/FROM hr_job_order_routes r/, () => []],
  [/c\.proposed_by IS NULL/, () => []],
  [/WHERE m\.role='agency' AND/, () => []],
  [/FROM hr_case_certifications k/, () => []],
  [/FROM hr_tc_enrollments/, () => []],
  [/FROM hr_case_acknowledgments/, () => []],
  [/FROM hr_workers w LEFT JOIN hr_agencies a ON a\.id=w\.agency_id LEFT JOIN hr_worker_health_training/, () => []],
];

async function callGet(principal, user = { email: 'viewer@example.test' }) {
  const doubles = {
    NextResponse: { json: (body, init = {}) => ({ status: init.status || 200, body }) },
    auth: async () => ({ user }),
    getHrPrincipal: async () => principal,
    isHrRootAdminSession: () => false,
    getAdminEmails: () => [],
    getAdminLineUserIds: () => [],
    ensureSchema: async () => {},
    ensureTrainingCenterSchema: async () => {},
    deriveTrainingStatus, taipeiToday, TRAINING_STATUS_RANK, syncTrainingStatuses: async () => {},
    certifiedPhilippinesAgencyIds: async () => new Set([20]),
    entryGateClosedSql: () => 'FALSE',
    reminderKindsForRole: () => null,
    collectExpiryReminders: async () => [],
    pool: {},
    query: async sql => {
      const route = ROUTES.find(([pattern]) => pattern.test(sql));
      if (!route) throw new Error(`測試替身沒有對應的查詢：${String(sql).slice(0, 80)}`);
      return structuredClone(route[1]());
    },
  };
  const scope = new Proxy({}, { has: (_, key) => key in doubles, get: (_, key) => doubles[key] });
  const run = new AsyncFunction('scope', `with (scope) { ${getSource}\n return GET(); }`);
  const response = await run(scope);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}
const ids = rows => rows.map(row => Number(row.id)).sort();
const caseIdsOf = rows => rows.map(row => Number(row.case_id)).sort();
const assertNoPrivateData = body => assert.doesNotMatch(JSON.stringify(body), /-private/, '回應出現了別人的資料');

test('管理者看得到全部資料（確認假資料裡的「別人資料」真的存在於資料來源）', async () => {
  const body = await callGet({ role: 'admin', name: 'Admin' });
  assert.deepEqual(ids(body.workers), [1, 2]);
  assert.deepEqual(ids(body.cases), [1, 2]);
  assert.match(JSON.stringify(body), /-private/);
});

test('工作者只看得到自己的工人資料、案件、文件、待辦與進度', async () => {
  const body = await callGet({ role: 'worker', worker_id: 1, name: 'Worker One' });
  assert.deepEqual(ids(body.workers), [1]);
  assert.deepEqual(ids(body.cases), [1]);
  assert.deepEqual(ids(body.employers), [1]);
  assert.deepEqual(body.requirements.map(row => Number(row.worker_id)), [1]);
  assert.deepEqual(body.submissions.map(row => Number(row.worker_id)), [1]);
  assert.deepEqual(caseIdsOf(body.tasks), [1]);
  assert.deepEqual(caseIdsOf(body.applicationSteps), [1]);
  assert.deepEqual(caseIdsOf(body.activity), [1]);
  assert.deepEqual(body.members, []);
  assert.deepEqual(body.jobOrders, []);
  assert.deepEqual(ids(body.agencies), [20]);
  assertNoPrivateData(body);
});

test('工作者看不到雇主的年齡、性別與家庭成員資料', async () => {
  const body = await callGet({ role: 'worker', worker_id: 1, name: 'Worker One' });
  for (const employer of body.employers) assert.deepEqual(employer.employer_profile, {});
});

test('雇主只看得到自己的資料與自己案件裡的工人', async () => {
  const body = await callGet({ role: 'employer', employer_id: 1, name: 'Employer One' });
  assert.deepEqual(ids(body.employers), [1]);
  assert.deepEqual(ids(body.cases), [1]);
  assert.deepEqual(ids(body.workers), [1]);
  assert.deepEqual(body.requirements.map(row => Number(row.worker_id)), [1]);
  assert.deepEqual(caseIdsOf(body.tasks), [1]);
  assert.deepEqual(body.members, []);
  assertNoPrivateData(body);
});

test('台灣仲介只看得到自己機構相關的雇主、工人與案件', async () => {
  const body = await callGet({ role: 'agency', agency_id: 10, agency_type: 'taiwan', name: 'TW staff' });
  assert.deepEqual(ids(body.employers), [1]);
  assert.deepEqual(ids(body.cases), [1]);
  assert.deepEqual(ids(body.workers), [1]);
  assert.deepEqual(body.members, []);
  assertNoPrivateData(body);
});

test('菲律賓仲介只看得到自己機構的工人與案件，且看不到雇主個人資料', async () => {
  const body = await callGet({ role: 'agency', agency_id: 20, agency_type: 'philippines', name: 'PH staff' });
  assert.deepEqual(ids(body.workers), [1]);
  assert.deepEqual(ids(body.cases), [1]);
  for (const employer of body.employers) assert.deepEqual(employer.employer_profile, {});
  assert.deepEqual(body.members, []);
  assertNoPrivateData(body);
});

test('訓練中心看不到工人、雇主與案件的完整資料', async () => {
  const body = await callGet({ role: 'training_center', id: 200, name: 'Center' });
  assert.deepEqual(body.workers, []);
  assert.deepEqual(body.employers, []);
  assert.deepEqual(body.cases, []);
  assert.deepEqual(body.requirements, []);
  assertNoPrivateData(body);
});
