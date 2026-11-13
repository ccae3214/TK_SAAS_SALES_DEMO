// Actual authenticated HTTP + PostgreSQL checks. Not browser UI E2E.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/lib/passwords.js';

if (process.env.LOCAL_REVIEW_ONLY !== '1' || !process.env.REVIEW_DB_PASSWORD || !process.env.REVIEW_LOGIN_PASSWORD) throw new Error('Local review credentials required');
const pool = new pg.Pool({ host: 'review-postgres', database: 'tk_saas_review', user: 'review', password: process.env.REVIEW_DB_PASSWORD, ssl: false });
const query = async (sql, values) => (await pool.query(sql, values)).rows;
const tag = `DEMO HTTP atomic ${randomUUID()}`;
const fixtureIds = { workers: [], employers: [], cases: [], members: [], agencies: [] };
let admin, outsider;

function client() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const response = await fetch(`http://app:3000${path}`, {
      ...options, redirect: 'manual', headers: { Host: 'localhost:8088', Origin: 'http://localhost:8088',
        Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers },
    });
    for (const value of response.headers.getSetCookie()) {
      const [key, ...rest] = value.split(';')[0].split('='); cookies.set(key, rest.join('='));
    }
    return response;
  };
}
async function login(email) {
  const send = client();
  const csrf = await (await send('/api/auth/csrf')).json();
  const response = await send('/api/auth/callback/credentials', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ email, password: process.env.REVIEW_LOGIN_PASSWORD, csrfToken: csrf.csrfToken, callbackUrl: '/' }),
  });
  assert.equal(response.status, 200);
  const session = await (await send('/api/auth/session')).json();
  assert.equal(session.user.email, email);
  return send;
}
const patch = (send, body, path = '/api/hr') => send(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function fixture() {
  const w = (await query('INSERT INTO hr_workers(name) VALUES($1) RETURNING id', [tag]))[0]; fixtureIds.workers.push(w.id);
  const e = (await query('INSERT INTO hr_employers(name) VALUES($1) RETURNING id', [tag]))[0]; fixtureIds.employers.push(e.id);
  const c = (await query("INSERT INTO hr_cases(case_number,worker_id,employer_id,training_status) VALUES($1,$2,$3,'scheduled') RETURNING id", [`${tag}-${fixtureIds.cases.length}`, w.id, e.id]))[0]; fixtureIds.cases.push(c.id);
  await query("INSERT INTO hr_worker_health_training(worker_id,training_status) VALUES($1,'scheduled')", [w.id]);
  await query("INSERT INTO hr_worker_documents(worker_id,name,status) VALUES($1,'DEMO ready document','approved')", [w.id]);
  const read = async () => ({
    cases: await query('SELECT training_status,medical_status,stage FROM hr_cases WHERE id=$1', [c.id]),
    worker: await query('SELECT training_status FROM hr_worker_health_training WHERE worker_id=$1', [w.id]),
  });
  return { workerId: w.id, caseId: c.id, read };
}

test.before(async () => {
  admin = await login('review.admin@example.invalid');
  const view = await admin('/api/hr'); assert.equal(view.status, 200); assert.equal((await view.json()).role, 'admin');
  const agency = (await query("INSERT INTO hr_agencies(name,agency_type,country) VALUES($1,'taiwan','Taiwan') RETURNING id", [tag]))[0]; fixtureIds.agencies.push(agency.id);
  const email = `review-http-${randomUUID()}@example.invalid`;
  const m = (await query("INSERT INTO hr_members(email,display_name,password_hash,role,agency_id) VALUES($1,$2,$3,'agency',$4) RETURNING id", [email, tag, await hashPassword(process.env.REVIEW_LOGIN_PASSWORD), agency.id]))[0]; fixtureIds.members.push(m.id);
  outsider = await login(email);
});
test.after(async () => {
  await query("UPDATE hr_members SET active=FALSE WHERE id=ANY($1::bigint[])", [fixtureIds.members]);
  await query("UPDATE hr_cases SET status='closed' WHERE id=ANY($1::bigint[])", [fixtureIds.cases]);
  await query("UPDATE hr_workers SET status='inactive' WHERE id=ANY($1::bigint[])", [fixtureIds.workers]);
  await query("UPDATE hr_employers SET status='inactive' WHERE id=ANY($1::bigint[])", [fixtureIds.employers]);
  await query("UPDATE hr_agencies SET active=FALSE WHERE id=ANY($1::bigint[])", [fixtureIds.agencies]);
  await pool.end();
});
test('HTTP admin case workflow writes both statuses and recalculates stage; rejects regression', async () => {
  const f = await fixture();
  assert.equal((await patch(admin, { type: 'workflow', caseId: f.caseId, workflowType: 'training', status: 'completed' })).status, 200);
  const saved = await f.read();
  assert.equal(saved.cases[0].training_status, 'completed'); assert.equal(saved.worker[0].training_status, 'completed'); assert.equal(saved.cases[0].stage, 'application');
  assert.equal((await patch(admin, { type: 'workflow', caseId: f.caseId, workflowType: 'training', status: 'in_progress' })).status, 409);
  assert.deepEqual(await f.read(), saved);
});
test('HTTP admin worker workflow and visa step synchronize to the case', async () => {
  const f = await fixture();
  const url = `/api/hr/agency-workers/${f.workerId}`;
  assert.equal((await patch(admin, { type: 'status', workflowType: 'training', status: 'completed' }, url)).status, 200);
  assert.equal((await f.read()).cases[0].stage, 'application');
  assert.equal((await patch(admin, { type: 'step', stepKey: 'visa', startedOn: '2026-11-12', completedOn: '2026-11-13' }, url)).status, 200);
  assert.equal((await query("SELECT COUNT(*)::int AS n FROM hr_worker_progress_steps WHERE worker_id=$1 AND step_key='visa' AND completed_on IS NOT NULL", [f.workerId]))[0].n, 1);
  assert.equal((await query("SELECT COUNT(*)::int AS n FROM hr_application_steps WHERE case_id=$1 AND step_key='visa' AND completed_on IS NOT NULL", [f.caseId]))[0].n, 1);
});
test('HTTP rejects cross-agency, invalid Origin and anonymous writes without changing state', async () => {
  const f = await fixture(), before = await f.read();
  assert.equal((await patch(outsider, { type: 'workflow', caseId: f.caseId, workflowType: 'medical', status: 'scheduled' })).status, 403);
  assert.equal((await patch(outsider, { type: 'status', workflowType: 'training', status: 'completed' }, `/api/hr/agency-workers/${f.workerId}`)).status, 403);
  assert.equal((await admin('/api/hr', { method: 'PATCH', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'workflow', caseId: f.caseId, workflowType: 'training', status: 'completed' }) })).status, 403);
  assert.equal((await patch(client(), { type: 'workflow', caseId: f.caseId, workflowType: 'training', status: 'completed' })).status, 401);
  assert.deepEqual(await f.read(), before);
});
