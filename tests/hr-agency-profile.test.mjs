import assert from 'node:assert/strict';
import test from 'node:test';
import * as m from '../src/lib/hr-agency-profile.js';

const manager = { role: 'agency', agency_id: 7, is_agency_admin: true };
const staff = { role: 'agency', agency_id: 7, is_agency_admin: false };
const admin = { role: 'admin' };

test('normalize: name is required and fields are trimmed and capped', () => {
  assert.equal(m.normalizeAgencyProfileInput({ name: '   ' }).error, 'name_required');
  const { value } = m.normalizeAgencyProfileInput({ name: '  甲仲介 ', country: '', contactPerson: ' 王小明 ', phone: '02-2345-6789 #12', email: 'a@b.co', address: 'x'.repeat(500), licenseNumber: ' L-1 ' }, 'taiwan');
  assert.equal(value.name, '甲仲介');
  assert.equal(value.country, '台灣');
  assert.equal(value.contact_person, '王小明');
  assert.equal(value.address.length, 300);
  assert.equal(value.license_number, 'L-1');
});

test('normalize: default country follows agency type and can be overridden', () => {
  assert.equal(m.normalizeAgencyProfileInput({ name: 'A' }, 'philippines').value.country, '菲律賓');
  assert.equal(m.normalizeAgencyProfileInput({ name: 'A', country: 'Philippines' }, 'philippines').value.country, 'Philippines');
});

test('normalize: rejects bad phone and email, accepts blanks', () => {
  assert.equal(m.normalizeAgencyProfileInput({ name: 'A', phone: 'abc' }).error, 'phone_invalid');
  assert.equal(m.normalizeAgencyProfileInput({ name: 'A', email: 'not-an-email' }).error, 'email_invalid');
  assert.ok(m.normalizeAgencyProfileInput({ name: 'A', phone: '', email: '' }).value);
  assert.equal(m.normalizeAgencyProfileInput({ name: 'A', phone: '+63 (2) 8123-4567' }).error, undefined);
});

test('normalize: non-string values do not throw', () => {
  const { value } = m.normalizeAgencyProfileInput({ name: 'A', phone: 123, email: null, address: {} });
  assert.equal(value.phone, ''); assert.equal(value.email, ''); assert.equal(value.address, '');
});

test('expiry: blank means none, invalid dates are rejected', () => {
  assert.equal(m.normalizeExpiry(''), null);
  assert.equal(m.normalizeExpiry(null), null);
  assert.equal(m.normalizeExpiry('2027-02-28'), '2027-02-28');
  assert.equal(m.normalizeExpiry('2027-02-30'), undefined);
  assert.equal(m.normalizeExpiry('27/02/28'), undefined);
});

test('expiry: past dates are expired, today and blank are not', () => {
  const today = new Date('2026-11-14T08:00:00Z');
  assert.equal(m.isCertificateExpired('2026-11-13', today), true);
  assert.equal(m.isCertificateExpired('2026-11-14', today), false);
  assert.equal(m.isCertificateExpired(null, today), false);
});

test('permissions: manager edits own agency only, staff view only, admin everything', () => {
  assert.equal(m.canManageAgencyProfile(manager, 7), true);
  assert.equal(m.canManageAgencyProfile(manager, '7'), true);
  assert.equal(m.canManageAgencyProfile(manager, 8), false);
  assert.equal(m.canViewAgencyProfile(manager, 8), false);
  assert.equal(m.canManageAgencyProfile(staff, 7), false);
  assert.equal(m.canViewAgencyProfile(staff, 7), true);
  assert.equal(m.canManageAgencyProfile(admin, 99), true);
  for (const other of [{ role: 'employer', employer_id: 1 }, { role: 'worker' }, null, undefined]) {
    assert.equal(m.canViewAgencyProfile(other, 7), false);
    assert.equal(m.canManageAgencyProfile(other, 7), false);
  }
});

test('resolveAgencyId: agencies are pinned to their own agency, admins choose', () => {
  assert.equal(m.resolveAgencyId(manager, 8), 7);
  assert.equal(m.resolveAgencyId(manager, undefined), 7);
  assert.equal(m.resolveAgencyId(admin, '12'), 12);
  assert.equal(m.resolveAgencyId(admin, 'x'), null);
  assert.equal(m.resolveAgencyId({ role: 'agency' }, 3), null);
});

function fakePool({ updateRows = [{ id: 7 }], failOn = null } = {}) {
  const log = [];
  const client = {
    async query(sql, params) {
      const head = sql.trim().split(/\s+/)[0];
      log.push([head, params]);
      if (failOn && sql.includes(failOn.sql)) throw Object.assign(new Error('x'), { code: failOn.code });
      if (sql.startsWith('UPDATE hr_agencies')) return { rows: updateRows };
      return { rows: [] };
    },
    release() { log.push(['RELEASE']); },
  };
  return { log, async connect() { return client; } };
}
const value = { name: '甲', country: '台灣', contact_person: '', phone: '', email: '', address: '', license_number: '' };

test('save: updates agency and upserts profile inside one committed transaction', async () => {
  const pool = fakePool();
  assert.deepEqual(await m.saveAgencyProfile(pool, 7, value, 'me'), { ok: true });
  assert.deepEqual(pool.log.map(entry => entry[0]), ['BEGIN', 'UPDATE', 'INSERT', 'COMMIT', 'RELEASE']);
});

test('save: unknown agency rolls back', async () => {
  const pool = fakePool({ updateRows: [] });
  assert.deepEqual(await m.saveAgencyProfile(pool, 99, value), { error: 'not_found' });
  assert.deepEqual(pool.log.map(entry => entry[0]), ['BEGIN', 'UPDATE', 'ROLLBACK', 'RELEASE']);
});

test('save: duplicate agency name becomes name_taken and rolls back', async () => {
  const pool = fakePool({ failOn: { sql: 'UPDATE hr_agencies', code: '23505' } });
  assert.deepEqual(await m.saveAgencyProfile(pool, 7, value), { error: 'name_taken' });
  assert.ok(pool.log.some(entry => entry[0] === 'ROLLBACK'));
  assert.equal(pool.log.at(-1)[0], 'RELEASE');
});

test('save: unexpected database errors are rethrown after rollback and release', async () => {
  const pool = fakePool({ failOn: { sql: 'INSERT INTO hr_agency_profiles', code: '08006' } });
  await assert.rejects(() => m.saveAgencyProfile(pool, 7, value));
  assert.ok(pool.log.some(entry => entry[0] === 'ROLLBACK'));
  assert.equal(pool.log.at(-1)[0], 'RELEASE');
});
