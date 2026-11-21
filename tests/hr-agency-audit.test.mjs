import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENCY_AUDIT_ACTIONS, canViewAgencyAudit, describeAgencyOperation, normalizeAgencyAuditFilters, shouldRecordAgencyAudit } from '../src/lib/hr-agency-audit-core.js';

const agencyAdmin = { role: 'agency', is_agency_admin: true, agency_id: 7 };
const agencyStaff = { role: 'agency', is_agency_admin: false, agency_id: 7 };

test('only the agency administrator of an agency can view the log', () => {
  assert.equal(canViewAgencyAudit(agencyAdmin), true);
  assert.equal(canViewAgencyAudit(agencyStaff), false);
  assert.equal(canViewAgencyAudit({ role: 'admin', is_agency_admin: true, agency_id: 7 }), false);
  assert.equal(canViewAgencyAudit({ role: 'employer', is_agency_admin: true, agency_id: 7 }), false);
  assert.equal(canViewAgencyAudit({ ...agencyAdmin, agency_id: null }), false);
  assert.equal(canViewAgencyAudit(null), false);
});

test('every agency member action is recorded, system admins are not', () => {
  assert.equal(shouldRecordAgencyAudit(agencyStaff), true);
  assert.equal(shouldRecordAgencyAudit(agencyAdmin), true);
  assert.equal(shouldRecordAgencyAudit({ role: 'admin' }), false);
  assert.equal(shouldRecordAgencyAudit({ role: 'agency', agency_id: 0 }), false);
});

test('operations are described in Chinese and English with a known action', () => {
  const cases = [
    { method: 'POST', type: 'worker', created: { name: 'Maria' } },
    { method: 'DELETE', type: 'worker', name: 'Maria' },
    { method: 'PATCH', type: 'worker', name: 'Maria', body: { name: 'Maria' } },
    { method: 'PATCH', type: 'worker', name: 'Maria', body: { active: false } },
    { method: 'PATCH', type: 'case', name: 'C-1', body: { status: 'closed' } },
    { method: 'PATCH', type: 'review', name: 'Passport', body: { decision: 'approved' } },
  ];
  for (const input of cases) {
    const out = describeAgencyOperation(input);
    assert.ok(out, JSON.stringify(input));
    assert.ok(AGENCY_AUDIT_ACTIONS[out.action], out.action);
    assert.match(out.zh, /[一-鿿]/);
    assert.doesNotMatch(out.en, /[一-鿿]/);
  }
  assert.equal(describeAgencyOperation({ method: 'PATCH', type: 'unknown', name: 'x' }), null);
});

test('filters are normalised', () => {
  const f = normalizeAgencyAuditFilters(new URLSearchParams({ actor: '12', q: ' ab ', before: '50' }));
  assert.equal(f.actorId, 12);
  assert.equal(f.q, 'ab');
  assert.equal(f.beforeId, 50);
  const bad = normalizeAgencyAuditFilters(new URLSearchParams({ actor: 'x', before: '-1', q: 'a'.repeat(200) }));
  assert.equal(bad.actorId, null);
  assert.equal(bad.beforeId, null);
  assert.equal(bad.q.length, 80);
});
