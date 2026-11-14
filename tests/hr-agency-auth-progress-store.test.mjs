import assert from 'node:assert/strict';
import test from 'node:test';
import { readProgress, saveProgress } from '../src/lib/hr-agency-auth-progress-store.js';

const CERT = { id: 5, status: 'pending', taiwan_agency_id: 1, philippines_agency_id: 2, taiwan_agency_name: '台甲', philippines_agency_name: 'Manila A' };
function fakeDb(cert = CERT, progress = []) {
  const writes = [];
  return {
    writes,
    async query(sql, params) {
      if (sql.includes('FROM hr_agency_certifications c')) return { rows: cert && Number(params[0]) === cert.id ? [cert] : [] };
      if (sql.includes('FROM hr_agency_cert_progress')) return { rows: progress };
      if (sql.includes('INSERT INTO hr_agency_cert_progress')) { writes.push(params); return { rows: [] }; }
      throw new Error('unexpected sql ' + sql.slice(0, 40));
    },
  };
}
const twManager = { id: 11, role: 'agency', agency_id: 1, agency_type: 'taiwan', is_agency_admin: true };
const twStaff = { ...twManager, is_agency_admin: false };
const phManager = { id: 12, role: 'agency', agency_id: 2, agency_type: 'philippines', is_agency_admin: true };
const stranger = { id: 13, role: 'agency', agency_id: 9, agency_type: 'taiwan', is_agency_admin: true };
const admin = { id: 1, role: 'admin' };

test('read: both agencies of the pair can see progress; strangers get 404', async () => {
  const progress = [{ side: 'taiwan', item_key: 'spa', stage: 'boca', note: '', updated_at: null }];
  for (const principal of [twManager, twStaff, phManager]) {
    const result = await readProgress(fakeDb(CERT, progress), principal, 5);
    assert.equal(result.status, 200);
    assert.equal(result.body.rows.length, 1);
  }
  assert.equal((await readProgress(fakeDb(), stranger, 5)).status, 404);
  assert.equal((await readProgress(fakeDb(), { role: 'employer' }, 5)).status, 403);
  assert.equal((await readProgress(fakeDb(), twManager, 'x')).status, 400);
});

test('read: canManage only for managers of live certifications', async () => {
  assert.equal((await readProgress(fakeDb(), twManager, 5)).body.canManage, true);
  assert.equal((await readProgress(fakeDb(), twStaff, 5)).body.canManage, false);
  assert.equal((await readProgress(fakeDb({ ...CERT, status: 'revoked' }), twManager, 5)).body.canManage, false);
  assert.equal((await readProgress(fakeDb(), twManager, 5)).body.mySide, 'taiwan');
  assert.equal((await readProgress(fakeDb(), admin, 5)).body.mySide, null);
});

test('save: manager updates only their own side, with trimmed note', async () => {
  const db = fakeDb();
  const result = await saveProgress(db, twManager, { certificationId: 5, itemKey: 'spa', stage: 'notarized', note: '  已送公證處  ' });
  assert.equal(result.status, 200);
  assert.deepEqual(db.writes[0].slice(0, 5), [5, 'taiwan', 'spa', 'notarized', '已送公證處']);
  assert.equal(db.writes[0][5], 11);
});

test('save: the side comes from the principal, never from the request', async () => {
  const db = fakeDb();
  // 菲律賓仲介想用 side=taiwan 更新台灣那一邊 → 以自己的 side 判斷，spa 不屬於菲律賓清單，被拒絕。
  const spoof = await saveProgress(db, phManager, { certificationId: 5, itemKey: 'spa', stage: 'boca', side: 'taiwan' });
  assert.equal(spoof.status, 400);
  assert.equal(db.writes.length, 0);
  const ok = await saveProgress(db, phManager, { certificationId: 5, itemKey: 'dmw_license', stage: 'dfa', side: 'taiwan' });
  assert.equal(ok.status, 200);
  assert.equal(db.writes[0][1], 'philippines');
});

test('save: staff, strangers and non-agency members are refused', async () => {
  const db = fakeDb();
  assert.equal((await saveProgress(db, twStaff, { certificationId: 5, itemKey: 'spa', stage: 'boca' })).status, 403);
  assert.equal((await saveProgress(db, stranger, { certificationId: 5, itemKey: 'spa', stage: 'boca' })).status, 404);
  assert.equal((await saveProgress(db, { role: 'employer' }, { certificationId: 5, itemKey: 'spa', stage: 'boca' })).status, 403);
  assert.equal((await saveProgress(db, null, {})).status, 403);
  assert.equal(db.writes.length, 0);
});

test('save: validates item, stage and certification state', async () => {
  const db = fakeDb();
  assert.equal((await saveProgress(db, twManager, { certificationId: 5, itemKey: 'nope', stage: 'boca' })).status, 400);
  assert.equal((await saveProgress(db, twManager, { certificationId: 5, itemKey: 'spa', stage: 'teco' })).status, 400);
  assert.equal((await saveProgress(db, twManager, { certificationId: 0, itemKey: 'spa', stage: 'boca' })).status, 400);
  assert.equal((await saveProgress(db, twManager, { certificationId: 6, itemKey: 'spa', stage: 'boca' })).status, 404);
  const closed = await saveProgress(fakeDb({ ...CERT, status: 'rejected' }), twManager, { certificationId: 5, itemKey: 'spa', stage: 'boca' });
  assert.equal(closed.status, 409);
  assert.equal(db.writes.length, 0);
});

test('save: certified pairs can still update progress; admin must name the side', async () => {
  assert.equal((await saveProgress(fakeDb({ ...CERT, status: 'certified' }), twManager, { certificationId: 5, itemKey: 'spa', stage: 'delivered' })).status, 200);
  const db = fakeDb();
  assert.equal((await saveProgress(db, admin, { certificationId: 5, itemKey: 'spa', stage: 'boca' })).status, 400);
  assert.equal((await saveProgress(db, admin, { certificationId: 5, side: 'taiwan', itemKey: 'spa', stage: 'boca' })).status, 200);
  assert.equal(db.writes[0][1], 'taiwan');
});

test('save: overly long notes are capped', async () => {
  const db = fakeDb();
  await saveProgress(db, twManager, { certificationId: 5, itemKey: 'spa', stage: 'boca', note: 'x'.repeat(900) });
  assert.equal(db.writes[0][4].length, 300);
});
