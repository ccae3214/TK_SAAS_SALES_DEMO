import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canUpdateWorkflow, canTransition, workflowBlockReason } from '../src/lib/hr-case-flow.js';

// Execute the actual handler branch with explicit DB/transport doubles. No auth
// bypass endpoint or artificial production response is added to the application.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const mainSource = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../src/app/api/hr/agency-workers/[id]/route.js', import.meta.url), 'utf8');
const mainBranch = mainSource.slice(mainSource.indexOf("    if (body.type === 'workflow') {"), mainSource.indexOf("    if (!validId(body.id))", mainSource.indexOf("    if (body.type === 'workflow') {")));
const workerBranch = workerSource.slice(workerSource.indexOf("    if (body.type === 'status') {"), workerSource.indexOf("    return NextResponse.json({ error: '更新項目不正確。'"));
const stepBranch = workerSource.slice(workerSource.indexOf("    if (body.type === 'step') {"), workerSource.indexOf("    if (body.type === 'status') {"));

function fixture(fault = '', flags = {}) {
  let state = { caseStatus: 'scheduled', workerStatus: 'scheduled', stage: 'documents', step: null, activity: 0 };
  let transaction;
  const events = [];
  async function execute(sql, params = [], inside = false) {
    events.push(sql);
    if (sql === 'BEGIN') { transaction = structuredClone(state); return { rows: [] }; }
    if (sql === 'ROLLBACK') { transaction = undefined; return { rows: [] }; }
    if (sql === 'COMMIT') { state = transaction; transaction = undefined; return { rows: [] }; }
    const data = inside && transaction ? transaction : state;
    if (sql.includes('current_status')) return { rows: [{ current_status: data.caseStatus, worker_id: 7, agency_can_manage: true, gate_closed: false, documents_open: false, arrived: true, ...flags }] };
    if (sql.includes(' AS gate_closed')) return { rows: [{ gate_closed: false, documents_open: false }] };
    if (sql.includes('TEST_ARRIVED')) return { rows: [{ arrived: true }] };
    if (/^UPDATE hr_cases SET training_status/.test(sql)) { data.caseStatus = params[1]; return { rows: [] }; }
    if (sql.includes('INSERT INTO hr_worker_health_training') || sql.includes('UPDATE hr_worker_health_training SET')) {
      if (fault === 'worker-write' && sql.includes('training_status')) throw new Error('injected worker failure');
      if (params[1]) data.workerStatus = params[1];
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO hr_worker_progress_steps')) { data.step = 'worker'; return { rows: [] }; }
    if (sql.includes('INSERT INTO hr_application_steps')) { data.step = 'worker+case'; return { rows: [] }; }
    if (sql.includes('INSERT INTO hr_case_activity')) { data.activity++; return { rows: [] }; }
    if (sql === 'TEST_REFRESH_STAGE') {
      if (fault === 'stage') throw new Error('injected stage failure');
      data.stage = 'application'; return { rows: [] };
    }
    if (sql.includes('SELECT') && sql.includes('hr_workers')) return { rows: [{ id: 7, worker_id: 7 }] };
    throw new Error(`Unexpected SQL in regression double: ${sql}`);
  }
  const pool = { connect: async () => ({ query: (sql, params) => execute(sql, params, true), release: () => {} }) };
  const query = async (sql, params) => (await execute(sql, params)).rows;
  const refreshStage = async run => { await run('TEST_REFRESH_STAGE'); };
  const env = {
    body: { type: 'workflow', caseId: 1, workflowType: 'training', status: 'completed' },
    principal: { role: 'admin' }, actor: 'DEMO reviewer', workerId: 7, pool, query,
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
    clean: value => value || '', validId: value => Number(value) > 0,
    MEDICAL_STATUSES: new Set(['not_scheduled', 'scheduled', 'passed']),
    TRAINING_STATUSES: new Set(['not_scheduled', 'scheduled', 'in_progress', 'completed']),
    statusSetFor: () => new Set(['not_scheduled', 'scheduled', 'in_progress', 'completed']),
    canUpdateWorkflow, canTransition, workflowBlockReason, WORKFLOW_DENIED_MESSAGES: {},
    recordActivity: async () => { await query('INSERT INTO hr_case_activity'); },
    refreshCaseStage: async () => { await query('TEST_REFRESH_STAGE'); },
    refreshStage, refreshWorkerCases: async run => { await run('TEST_REFRESH_STAGE'); },
    workerHasArrived: async run => { await run('TEST_ARRIVED'); return true; },
    WORKER_PROGRESS_STEPS: [['visa', '簽證']], isValidDateText: () => true,
    canManageStep: () => true, OWNER_LABELS: {}, STEP_OWNERS: {},
  };
  const run = branch => new AsyncFunction('env', `const {${Object.keys(env).join(',')}} = env; ${branch}`)(env);
  return { run, env, events, state: () => state };
}

for (const fault of ['worker-write', 'stage']) {
  test(`case workflow ${fault} failure must not partially commit`, async () => {
    const f = fixture(fault), before = structuredClone(f.state());
    await assert.rejects(f.run(mainBranch), /injected/);
    assert.deepEqual(f.state(), before);
  });
}
test('case workflow success commits status, worker mirror, activity and stage together', async () => {
  const f = fixture();
  assert.equal((await f.run(mainBranch)).status, 200);
  assert.deepEqual(f.state(), { caseStatus: 'completed', workerStatus: 'completed', stage: 'application', step: null, activity: 1 });
  assert.ok(f.events.includes('BEGIN') && f.events.includes('COMMIT'));
});
test('worker workflow stage failure rolls back worker and case updates', async () => {
  const f = fixture('stage'), before = structuredClone(f.state());
  f.env.body.type = 'status';
  await assert.rejects(f.run(workerBranch), /injected/);
  assert.deepEqual(f.state(), before);
});
test('worker step stage failure rolls back both levels and activity', async () => {
  const f = fixture('stage'), before = structuredClone(f.state());
  f.env.body = { type: 'step', stepKey: 'visa', startedOn: '2026-11-12', completedOn: '2026-11-13' };
  await assert.rejects(f.run(stepBranch), /injected/);
  assert.deepEqual(f.state(), before);
});
for (const [name, principal, flags, code] of [
  ['worker role denied', { role: 'worker' }, {}, 403],
  ['cross agency denied', { role: 'agency', agency_type: 'taiwan' }, { agency_can_manage: false }, 403],
  ['unapproved documents blocked', { role: 'admin' }, { documents_open: true }, 409],
  ['completed cannot regress', { role: 'admin' }, { current_status: 'completed' }, 409],
]) {
  test(`case workflow ${name} retains data`, async () => {
    const f = fixture('', flags), before = structuredClone(f.state());
    f.env.principal = principal;
    if (principal.role === 'agency') { f.env.body.workflowType = 'medical'; f.env.body.status = 'scheduled'; }
    if (flags.current_status) f.env.body.status = 'in_progress';
    assert.equal((await f.run(mainBranch)).status, code);
    assert.deepEqual(f.state(), before);
  });
}
test('both workflow entry points lock the worker before mutating status', () => {
  for (const branch of [mainBranch, workerBranch]) {
    const lock = branch.indexOf('FOR UPDATE');
    const write = branch.indexOf('UPDATE hr_cases SET');
    assert.ok(lock >= 0 && lock < write);
  }
});
