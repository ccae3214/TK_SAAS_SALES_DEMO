import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOrganizationAuditHandler } from '../src/lib/hr-organization-audit.js';
import { canViewTrainingCenterAudit } from '../src/lib/hr-tc-audit-shared.js';
import { canViewAgencyAudit } from '../src/lib/hr-agency-audit-core.js';

function fixture({ principal = { role: 'admin' }, session = { user: {} }, rows = [], fail = false } = {}) {
  const calls = [];
  const handler = createOrganizationAuditHandler({
    auth: async () => session, getPrincipal: async () => principal,
    ensure: async kind => { calls.push({ ensure: kind }); },
    query: async (sql, params) => { calls.push({ sql, params }); if (fail) throw new Error('private database detail'); return rows; },
  });
  return { calls, get: suffix => handler(new Request(`http://localhost/api/hr/organization-audit${suffix || ''}`)) };
}

test('anonymous is 401 before accessing any audit storage', async () => {
  const f = fixture({ session: null });
  assert.equal((await f.get()).status, 401); assert.deepEqual(f.calls, []);
});
for (const role of ['agency', 'training_center', 'worker', 'employer', null]) {
  test(`unified endpoint refuses ${role}, including organization administrators`, async () => {
    const f = fixture({ principal: { role, is_agency_admin: true, agency_id: 1, id: 1 } });
    const response = await f.get('?kind=training&centerId=1');
    assert.equal(response.status, 403); assert.deepEqual(f.calls, []);
    assert.match(response.headers.get('cache-control'), /no-store/);
  });
}
for (const [kind, table, column] of [['agency', 'hr_agency_audit_log', 'agency_name'], ['training', 'hr_tc_audit_log', 'center_name']]) {
  test(`system admin reads ${kind} from its own source with bound filters and cursor`, async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({ id: String(200 - i), organization_name: 'DEMO' }));
    const f = fixture({ rows });
    const response = await f.get(`?kind=${kind}&q=${encodeURIComponent("O'Brien%_\\")}&before=9007199254740993`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const body = await response.json();
    assert.equal(body.rows.length, 100); assert.equal(body.nextBefore, '101');
    assert.equal(f.calls[0].ensure, kind);
    assert.match(f.calls[1].sql, new RegExp(`FROM ${table}`));
    assert.match(f.calls[1].sql, new RegExp(`${column} AS organization_name`));
    assert.match(f.calls[1].sql, /ORDER BY id DESC LIMIT \$3/);
    assert.equal(f.calls[1].params[0], '9007199254740993');
    assert.equal(f.calls[1].params[1], "%O'Brien\\%\\_\\\\%");
    assert.equal(f.calls[1].params[2], 101);
    assert.ok(!f.calls[1].sql.includes("O'Brien"));
  });
}
for (const suffix of ['?kind=__proto__', '?kind=training;DROP', '?before=-1', '?before=0', '?before=abc', '?before=9999999999999999999', `?q=${'x'.repeat(81)}`]) {
  test(`bad filters rejected without database access: ${suffix.slice(0, 35)}`, async () => {
    const f = fixture(); assert.equal((await f.get(suffix)).status, 400); assert.deepEqual(f.calls, []);
  });
}
test('empty, last page and query error have explicit non-leaking results', async () => {
  for (const rows of [[], [{ id: '8' }], Array.from({ length: 100 }, (_, i) => ({ id: String(200 - i) }))]) {
    const response = await fixture({ rows }).get();
    const body = await response.json(); assert.deepEqual(body.rows, rows); assert.equal(body.nextBefore, null);
  }
  const response = await fixture({ fail: true }).get(); assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('private database detail'));
});
test('A model preserves center ownership and agency member restrictions', () => {
  assert.equal(canViewTrainingCenterAudit({ role: 'admin' }, 7), true);
  assert.equal(canViewTrainingCenterAudit({ role: 'training_center', id: 7 }, 7), true);
  for (const principal of [null, { role: 'training_center', id: 8 }, { role: 'agency', id: 7 }, { role: 'worker', id: 7 }, { role: 'employer', id: 7 }]) assert.equal(canViewTrainingCenterAudit(principal, 7), false);
  assert.equal(canViewAgencyAudit({ role: 'agency', is_agency_admin: true, agency_id: 7 }), true);
  assert.equal(canViewAgencyAudit({ role: 'agency', is_agency_admin: false, agency_id: 7 }), false);
});
test('production route uses the tested handler; only admin activity view mounts unified logs', async () => {
  const route = await readFile(new URL('../src/app/api/hr/organization-audit/route.js', import.meta.url), 'utf8');
  assert.match(route, /export const GET = createOrganizationAuditHandler/);
  assert.match(route, /getPrincipal: getHrPrincipal/);
  assert.doesNotMatch(route, /export (?:async function|const) (?:POST|PATCH|DELETE)/);
  const ui = await readFile(new URL('../src/components/HrManagement.jsx', import.meta.url), 'utf8');
  assert.match(ui, /data.role==='admin'&&<><AdminAuditList\/><HrOrganizationAuditLog\/><\/>/);
});

test('訓練中心操作紀錄的英文敘述：報名、老師證照、證照批次狀態與一般操作', async () => {
  const { tcAuditSummaryEn } = await import('../src/lib/hr-tc-audit-shared.js');
  const admin = { actor_name: 'Ann', actor_kind: 'system_admin' };
  const center = { actor_name: 'A Center', actor_kind: 'training_center' };
  assert.equal(tcAuditSummaryEn({ ...center, target_type: 'enrollment', action: 'enroll', target_name: 'Maria', detail: 'Class 1' }),
    'A Center (training center) enrolled worker "Maria" in class "Class 1"');
  assert.equal(tcAuditSummaryEn({ ...admin, target_type: 'enrollment', action: 'unenroll', target_name: 'Maria', detail: 'Class 1' }),
    'Ann (system administrator) cancelled the enrollment of worker "Maria" from class "Class 1"');
  assert.equal(tcAuditSummaryEn({ ...admin, target_type: 'enrollment', action: 'enroll', target_name: 'Maria' }),
    'Ann (system administrator) enrolled worker "Maria"');
  assert.equal(tcAuditSummaryEn({ ...admin, target_type: 'teacher-certification', action: 'register', target_name: 'Wang', detail: 'Welding' }),
    'Ann (system administrator) registered certification "Welding" for teacher "Wang"');
  assert.equal(tcAuditSummaryEn({ ...admin, target_type: 'teacher-certification', action: 'delete', target_name: 'Wang' }),
    'Ann (system administrator) removed certification from teacher "Wang"');
  assert.equal(tcAuditSummaryEn({ ...admin, target_type: 'batch', action: 'status', target_name: 'B1', detail: 'issued' }),
    'Ann (system administrator) set the status of certification batch "B1" to Issued');
  assert.equal(tcAuditSummaryEn({ ...admin, target_type: 'batch', action: 'status', target_name: 'B1', detail: 'custom' }),
    'Ann (system administrator) set the status of certification batch "B1" to custom');
  assert.match(tcAuditSummaryEn({ ...admin, target_type: 'course', action: 'create', target_name: 'Mandarin' }), /^Ann \(system administrator\) added .+ "Mandarin"$/);
  assert.equal(tcAuditSummaryEn({ ...admin, action: 'archive' }), 'Ann (system administrator) archive item');
});
