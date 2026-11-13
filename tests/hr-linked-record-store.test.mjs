import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LinkedRecordError, normalizeRecordEmail, updateLinkedRecord, updateLinkedMemberProfile } from '../src/lib/hr-linked-record-store.js';

const reserved = ['Admin@Example.invalid'];
const member = { id: 2, email: 'before@example.invalid', line_user_id: null, worker_id: 1, employer_id: null, role: 'worker', admin_scope: 'none' };
const status = expected => error => error instanceof LinkedRecordError && error.status === expected;
function fixture({ linked = member, exists = true, duplicate = false, failMember = false, failRecord = false } = {}) {
  const calls = []; let released = false;
  const client = { async query(sql, args = []) {
    calls.push({ sql, args });
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
    if (sql.startsWith('SELECT 1 FROM hr_members')) return { rows: duplicate ? [{}] : [], rowCount: duplicate ? 1 : 0 };
    if (sql.startsWith('SELECT') && sql.includes('FROM hr_members')) return { rows: linked ? [{ ...linked }] : [], rowCount: linked ? 1 : 0 };
    if (sql.startsWith('SELECT')) return { rows: exists ? [{ id: 1 }] : [], rowCount: exists ? 1 : 0 };
    if (sql.startsWith('UPDATE hr_members') && failMember) throw new Error('member write failure');
    if ((sql.startsWith('UPDATE hr_workers') || sql.startsWith('UPDATE hr_employers')) && failRecord) throw new Error('record write failure');
    return { rows: [{ id: sql.startsWith('UPDATE hr_members') ? 2 : 1 }], rowCount: 1 };
  }, release() { released = true; } };
  return { pool: { connect: async () => client }, calls, released: () => released };
}
const defaults = { kind: 'worker', id: 1, fields: { name: 'After', email: 'After@Example.invalid' }, reservedEmails: reserved,
  update: async (client, fields) => (await client.query('UPDATE hr_workers SET email=$2 WHERE id=$1 RETURNING *', [1, fields.email])).rows[0] };

test('normalizes surrounding whitespace and case', () => assert.equal(normalizeRecordEmail(' User@Example.invalid '), 'user@example.invalid'));
for (const input of ['invalid', 'a@b', 'a b@example.invalid', 'x'.repeat(250) + '@x.invalid']) {
  test('rejects malformed/overlong email: ' + input.slice(0, 30), () => assert.throws(() => normalizeRecordEmail(input), status(400)));
}
test('unlinked legacy contact may remain empty', () => assert.equal(normalizeRecordEmail(''), ''));
test('email-linked login cannot be cleared', () => assert.throws(() => normalizeRecordEmail('', { allowEmpty: false }), status(400)));
test('new reserved admin email rejected case-insensitively', () => assert.throws(() => normalizeRecordEmail('ADMIN@example.invalid', { reservedEmails: reserved }), status(403)));
test('existing legitimate admin email retained', () => assert.equal(normalizeRecordEmail('ADMIN@example.invalid', { reservedEmails: reserved, member: { email: 'admin@example.invalid' } }), 'admin@example.invalid'));
test('non-reserved similar domain is not blocked', () => assert.equal(normalizeRecordEmail('admin@example.invalid.test', { reservedEmails: reserved }), 'admin@example.invalid.test'));

for (const kind of ['worker', 'employer']) test(kind + ' record and login updated using one client, member locked first', async () => {
  const f = fixture();
  await updateLinkedRecord(f.pool, { ...defaults, kind, agencyId: 9 });
  assert.equal(f.calls[0].sql, 'BEGIN');
  assert.match(f.calls[1].sql, /FROM hr_members.*FOR UPDATE/);
  assert.match(f.calls[2].sql, /agency_id=\$2.*FOR UPDATE/);
  assert.deepEqual(f.calls[2].args, [1, 9]);
  const recordWrite = f.calls.find(x => x.sql.startsWith('UPDATE hr_workers'));
  assert.equal(recordWrite.args[1], 'after@example.invalid');
  assert.equal(f.calls.find(x => x.sql.startsWith('UPDATE hr_members')).args[2], 'after@example.invalid');
  assert.equal(f.calls.at(-1).sql, 'COMMIT'); assert(f.released());
});
for (const email of ['', 'bad', 'ADMIN@example.invalid']) test('rejects email before any record write: ' + email, async () => {
  const f = fixture();
  await assert.rejects(updateLinkedRecord(f.pool, { ...defaults, fields: { email } }), status(email.includes('ADMIN') ? 403 : 400));
  assert(!f.calls.some(x => x.sql.startsWith('UPDATE'))); assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert(f.released());
});
test('duplicate member email rejects before record write', async () => {
  const f = fixture({ duplicate: true }); await assert.rejects(updateLinkedRecord(f.pool, defaults), status(409));
  assert(!f.calls.some(x => x.sql.startsWith('UPDATE'))); assert(f.released());
});
test('cross-tenant/missing record is 404 before global email lookup', async () => {
  const f = fixture({ exists: false }); await assert.rejects(updateLinkedRecord(f.pool, { ...defaults, agencyId: 3 }), status(404));
  assert(!f.calls.some(x => x.sql.startsWith('SELECT 1'))); assert(!f.calls.some(x => x.sql.startsWith('UPDATE')));
});
test('member write failure rolls back earlier record update and releases client', async () => {
  const f = fixture({ failMember: true }); await assert.rejects(updateLinkedRecord(f.pool, defaults), /member write failure/);
  assert(f.calls.some(x => x.sql.startsWith('UPDATE hr_workers'))); assert.equal(f.calls.at(-1).sql, 'ROLLBACK');
  assert(!f.calls.some(x => x.sql === 'COMMIT')); assert(f.released());
});
test('record callback failure rolls back and releases', async () => {
  const f = fixture(); await assert.rejects(updateLinkedRecord(f.pool, { ...defaults, update: async () => { throw new Error('record failed'); } }), /record failed/);
  assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert(f.released());
});
test('invalid callback result cannot be committed as a saved record', async () => {
  const f = fixture(); await assert.rejects(updateLinkedRecord(f.pool, { ...defaults, update: async () => ({ status: 400 }) }), status(404));
  assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert(!f.calls.some(x => x.sql.startsWith('UPDATE hr_members')));
});
test('status edit does not alter member email', async () => {
  const f = fixture(); await updateLinkedRecord(f.pool, { ...defaults, fields: { active: false } });
  const write = f.calls.find(x => x.sql.startsWith('UPDATE hr_members')); assert(!write.sql.includes('email=')); assert.equal(write.args[2], false);
});
test('unlinked record can retain empty contact without creating a member', async () => {
  const f = fixture({ linked: null }); await updateLinkedRecord(f.pool, { ...defaults, fields: { email: '' } });
  assert(!f.calls.some(x => x.sql.startsWith('UPDATE hr_members')));
});
test('existing LINE-only member can retain empty email', async () => {
  const f = fixture({ linked: { ...member, email: null, line_user_id: 'fictional-line-id' } });
  await updateLinkedRecord(f.pool, { ...defaults, fields: { email: '' } });
  assert.equal(f.calls.find(x => x.sql.startsWith('UPDATE hr_members')).args[2], null);
});
test('unsupported record kind never connects', async () => {
  await assert.rejects(updateLinkedRecord({ connect: () => { throw new Error('must not connect'); } }, { ...defaults, kind: 'members; DROP' }), status(400));
});
const profile = { id: 2, fields: { displayName: 'After', email: 'after@example.invalid', lineUserId: '' }, reservedEmails: reserved,
  authorize() {}, update: async client => (await client.query('UPDATE hr_members SET display_name=$2 WHERE id=$1 RETURNING *', [2, 'After'])).rows[0] };
test('reverse member-to-record updates share one transaction', async () => {
  const f = fixture(); await updateLinkedMemberProfile(f.pool, profile);
  assert(f.calls.some(x => x.sql.startsWith('UPDATE hr_members'))); assert(f.calls.some(x => x.sql.startsWith('UPDATE hr_workers')));
  assert.equal(f.calls.at(-1).sql, 'COMMIT'); assert(f.released());
});
test('reverse record failure rolls back prior member update', async () => {
  const f = fixture({ failRecord: true }); await assert.rejects(updateLinkedMemberProfile(f.pool, profile), /record write failure/);
  assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert(f.released());
});
test('reverse authorization checked on locked current member', async () => {
  const f = fixture(); await assert.rejects(updateLinkedMemberProfile(f.pool, { ...profile, authorize() { throw new LinkedRecordError('denied', 403); } }), status(403));
  assert(!f.calls.some(x => x.sql.startsWith('UPDATE')));
});
test('reverse reserved email rejected before member update', async () => {
  const f = fixture(); await assert.rejects(updateLinkedMemberProfile(f.pool, { ...profile, fields: { ...profile.fields, email: 'admin@example.invalid' } }), status(403));
  assert(!f.calls.some(x => x.sql.startsWith('UPDATE')));
});
test('reverse LINE-only transition explicitly clears record contact email', async () => {
  const f = fixture(); await updateLinkedMemberProfile(f.pool, { ...profile, fields: { displayName: 'After', email: null, lineUserId: 'fictional-line-id' } });
  assert.equal(f.calls.find(x => x.sql.startsWith('UPDATE hr_workers')).args[2], '');
});
test('all record edit routes use shared transaction; no legacy separate sync helper remains', async () => {
  const source = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
  assert(!source.includes('assertMemberEmailFree')); assert(!source.includes('syncLinkedMember('));
  assert.equal((source.match(/await editLinkedRecord\(/g) || []).length, 5);
  assert(source.includes('await updateLinkedMemberProfile(pool'));
  assert(source.includes('normalizeRecordEmail(email, { reservedEmails: getAdminEmails()'));
});
