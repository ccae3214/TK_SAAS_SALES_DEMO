// Real PostgreSQL transaction regressions against already initialized fictional
// tk_saas_review only. No schema/trigger changes; fixtures are retained inactive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { canUpdateWorkflow, canTransition, workflowBlockReason } from '../src/lib/hr-case-flow.js';
import { WORKER_PROGRESS_STEPS, isValidDateText, statusSetFor } from '../src/lib/hr-worker-progress.js';
import { canManageStep, OWNER_LABELS, STEP_OWNERS } from '../src/lib/hr-case-flow.js';

if (process.env.LOCAL_REVIEW_ONLY !== '1' || !process.env.REVIEW_DB_PASSWORD) throw new Error('Explicit local review credentials required');
const pool = new pg.Pool({ host: 'review-postgres', database: 'tk_saas_review', user: 'review', password: process.env.REVIEW_DB_PASSWORD, ssl: false });
const query = async (sql, params) => (await pool.query(sql, params)).rows;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const main = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../src/app/api/hr/agency-workers/[id]/route.js', import.meta.url), 'utf8');
const branches = {
  case: main.slice(main.indexOf("    if (body.type === 'workflow') {"), main.indexOf("    if (!validId(body.id))", main.indexOf("    if (body.type === 'workflow') {"))),
  worker: worker.slice(worker.indexOf("    if (body.type === 'status') {"), worker.indexOf("    return NextResponse.json({ error: '更新項目不正確。'")),
  step: worker.slice(worker.indexOf("    if (body.type === 'step') {"), worker.indexOf("    if (body.type === 'status') {")),
};
const stageSource = (await readFile(new URL('../src/lib/hr-case-stage.js', import.meta.url), 'utf8')).replace("'@/lib/hr-case-flow'", JSON.stringify(new URL('../src/lib/hr-case-flow.js', import.meta.url).href));
const stage = await import(`data:text/javascript;base64,${Buffer.from(stageSource).toString('base64')}`);

async function fixture() {
  const tag = `DEMO atomic-review ${randomUUID()}`;
  const w = (await query('INSERT INTO hr_workers(name) VALUES($1) RETURNING id', [tag]))[0];
  const e = (await query('INSERT INTO hr_employers(name) VALUES($1) RETURNING id', [tag]))[0];
  const c = (await query("INSERT INTO hr_cases(case_number,worker_id,employer_id,training_status,stage) VALUES($1,$2,$3,'scheduled','documents') RETURNING id", [tag, w.id, e.id]))[0];
  await query("INSERT INTO hr_worker_health_training(worker_id,training_status) VALUES($1,'scheduled')", [w.id]);
  await query("INSERT INTO hr_worker_documents(worker_id,name,status) VALUES($1,'DEMO ready document','approved')", [w.id]);
  return {
    workerId: w.id, caseId: c.id,
    read: async () => ({
      cases: await query('SELECT training_status,stage FROM hr_cases WHERE id=$1', [c.id]),
      worker: await query('SELECT training_status FROM hr_worker_health_training WHERE worker_id=$1', [w.id]),
      steps: await query('SELECT step_key,started_on,completed_on,note FROM hr_worker_progress_steps WHERE worker_id=$1', [w.id]),
      caseSteps: await query('SELECT step_key,started_on,completed_on,note FROM hr_application_steps WHERE case_id=$1', [c.id]),
      activity: await query('SELECT action,detail FROM hr_case_activity WHERE case_id=$1', [c.id]),
    }),
    close: async () => {
      await query("UPDATE hr_cases SET status='closed' WHERE id=$1", [c.id]);
      await query("UPDATE hr_workers SET status='inactive' WHERE id=$1", [w.id]);
      await query("UPDATE hr_employers SET status='inactive' WHERE id=$1", [e.id]);
    },
  };
}

async function run(f, kind, fault = '', status = 'completed') {
  const faulted = sql => (fault === 'mirror' && sql.includes('INSERT INTO hr_worker_health_training') && sql.includes('training_status')) || (fault === 'stage' && sql.startsWith('UPDATE hr_cases SET stage='));
  const wrappedPool = { connect: async () => {
    const client = await pool.connect();
    return { query: (sql, params) => faulted(sql) ? client.query('SELECT 1/0') : client.query(sql, params), release: () => client.release() };
  } };
  const wrappedQuery = async (sql, params) => faulted(sql) ? query('SELECT 1/0') : query(sql, params);
  const env = {
    body: kind === 'step' ? { type: 'step', stepKey: 'visa', startedOn: '2026-11-12', completedOn: '2026-11-13' } : { type: kind === 'case' ? 'workflow' : 'status', caseId: f.caseId, workflowType: 'training', status },
    principal: { role: 'admin' }, actor: 'DEMO atomic reviewer', workerId: f.workerId,
    pool: wrappedPool, query: wrappedQuery,
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
    clean: value => value || '', validId: value => Number(value) > 0,
    MEDICAL_STATUSES: statusSetFor('medical'), TRAINING_STATUSES: statusSetFor('training'), statusSetFor,
    canUpdateWorkflow, canTransition, workflowBlockReason, WORKFLOW_DENIED_MESSAGES: {},
    WORKER_PROGRESS_STEPS, isValidDateText, canManageStep, OWNER_LABELS, STEP_OWNERS,
    recordActivity: (id, actor, action, detail) => wrappedQuery('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) VALUES($1,$2,$3,$4)', [id, actor, action, detail]),
    refreshCaseStage: id => stage.refreshCaseStage(wrappedQuery, id),
    refreshStage: stage.refreshCaseStage, refreshWorkerCases: stage.refreshWorkerCases, workerHasArrived: stage.workerHasArrived,
  };
  return new AsyncFunction('env', `const {${Object.keys(env).join(',')}} = env; ${branches[kind]}`)(env);
}

test.after(async () => pool.end());
test('PostgreSQL concurrent case/worker entry points do not regress completed training', async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const f = await fixture();
    try {
      const responses = await Promise.all([run(f, 'case'), run(f, 'worker', '', 'in_progress')]);
      assert.equal(responses[0].status, 200);
      assert.ok([200, 409].includes(responses[1].status));
      const saved = await f.read();
      assert.equal(saved.cases[0].training_status, 'completed');
      assert.equal(saved.worker[0].training_status, 'completed');
      assert.equal(saved.cases[0].stage, 'application');
    } finally { await f.close(); }
  }
});
for (const [kind, fault] of [['case', 'mirror'], ['case', 'stage'], ['worker', 'stage'], ['step', 'stage']]) {
  test(`PostgreSQL ${kind}/${fault}: actual SQL error rolls back all persisted fields`, async () => {
    const f = await fixture();
    try {
      const before = await f.read();
      await assert.rejects(run(f, kind, fault), error => error.code === '22012');
      assert.deepEqual(await f.read(), before);
    } finally { await f.close(); }
  });
}
for (const kind of ['case', 'worker', 'step']) {
  test(`PostgreSQL ${kind}: real successful commit persists both levels and stage`, async () => {
    const f = await fixture();
    try {
      assert.equal((await run(f, kind)).status, 200);
      const saved = await f.read();
      assert.equal(saved.activity.length, 1);
      if (kind === 'step') {
        assert.equal(saved.steps[0].step_key, 'visa');
        assert.equal(saved.caseSteps[0].step_key, 'visa');
        assert.equal(saved.cases[0].stage, 'medical_training');
      } else {
        assert.equal(saved.worker[0].training_status, 'completed');
        assert.equal(saved.cases[0].training_status, 'completed');
        assert.equal(saved.cases[0].stage, 'application');
        assert.equal((await run(f, kind, '', 'in_progress')).status, 409);
        assert.deepEqual(await f.read(), saved);
      }
    } finally { await f.close(); }
  });
}
