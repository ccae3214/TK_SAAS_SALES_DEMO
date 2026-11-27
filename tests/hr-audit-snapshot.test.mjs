import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { changeRows, diffSnapshots, limitSize, snapshotKindOf, takeSnapshot } from '../src/lib/hr-audit-snapshot.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('編輯：只記錄有變動的欄位，JSONB 再往下比一層', () => {
  const before = { id: 3, name: 'Maria', phone: '0911', status: 'active', resume_profile: { gender: 'F', height: '150', religion: 'Catholic' } };
  const after = { id: 3, name: 'Maria Santos', phone: '0911', status: 'active', resume_profile: { gender: 'F', height: '152', hobby: 'cooking', religion: 'Catholic' } };
  assert.deepEqual(diffSnapshots(before, after), {
    before: { name: 'Maria', resume_profile: { height: '150', hobby: null } },
    after: { name: 'Maria Santos', resume_profile: { height: '152', hobby: 'cooking' } },
  });
});

test('身分填錯（變更類型）：看得到原本綁定的工作者與改後的類型', () => {
  const before = { id: 9, role: 'worker', worker_id: 21, employer_id: null, last_worker_id: null, last_employer_id: null };
  const after = { id: 9, role: 'employer', worker_id: null, employer_id: 5, last_worker_id: 21, last_employer_id: null };
  const diff = diffSnapshots(before, after);
  assert.deepEqual(diff.before, { role: 'worker', worker_id: 21, employer_id: null, last_worker_id: null });
  assert.deepEqual(diff.after, { role: 'employer', worker_id: null, employer_id: 5, last_worker_id: 21 });
});

test('刪除存完整的改前資料、新增存完整的改後資料、沒變動時兩者都是 null', () => {
  const row = { id: 1, name: 'A', status: 'active' };
  assert.deepEqual(diffSnapshots(row, null), { before: row, after: null });
  assert.deepEqual(diffSnapshots(null, row), { before: null, after: row });
  assert.deepEqual(diffSnapshots(row, { ...row }), { before: null, after: null });
  assert.deepEqual(diffSnapshots(null, null), { before: null, after: null });
});

test('過長的資料會截斷，整筆不超過 30000 字', () => {
  const huge = { notes: 'x'.repeat(5000), resume_profile: { remarks: 'y'.repeat(100000), list: Array.from({ length: 200 }, () => 'z'.repeat(400)) } };
  const limited = limitSize(huge);
  assert.ok(JSON.stringify(limited).length <= 30000);
  assert.ok(limited.notes.endsWith('…'));
  assert.equal(limitSize(null), null);
});

test('快照：不記錄密碼、LINE ID、照片與時間戳記；日期轉成字串；查詢失敗不影響操作', async () => {
  const calls = [];
  const run = async (sql, params) => {
    calls.push([sql, params]);
    return [{ id: 4, display_name: 'Ana', role: 'worker', password_hash: 'secret', line_user_id: 'U123', updated_at: new Date(), created_at: new Date(),
      deleted_at: new Date('2026-11-28T01:02:03Z'), onboarding_seen: { a: 1 } }];
  };
  const snap = await takeSnapshot(run, 'member-admin-scope', 4);
  assert.deepEqual(snap, { id: 4, display_name: 'Ana', role: 'worker', deleted_at: '2026-11-28T01:02:03.000Z' });
  assert.deepEqual(calls[0][1], [4]);
  assert.doesNotMatch(calls[0][0], /password_hash|line_user_id/);
  const worker = await takeSnapshot(async () => [{ id: 1, resume_profile: { gender: 'F', photoDataUrl: 'data:image/jpeg;base64,AAAA' } }], 'worker-resume', 1);
  assert.deepEqual(worker.resume_profile, { gender: 'F' });
  assert.equal(await takeSnapshot(async () => { throw new Error('db down'); }, 'worker', 1), null);
  assert.equal(await takeSnapshot(run, 'task', 1), null);
  assert.equal(await takeSnapshot(run, 'worker', null), null);
});

test('快照對應：人與機構類型都有，其餘沒有', () => {
  for (const type of ['worker', 'worker-resume', 'employer', 'agency', 'member', 'member-profile', 'member-admin-scope', 'member-restore', 'case']) assert.ok(snapshotKindOf(type), type);
  for (const type of ['task', 'review', 'requirement', '']) assert.equal(snapshotKindOf(type), null);
});

test('畫面用的列表：JSONB 子欄位攤平成「欄位.子欄位」', () => {
  assert.deepEqual(changeRows({ name: 'A', resume_profile: { height: '150' } }, { name: 'B', resume_profile: { height: '152' } }), [
    { field: 'name', before: 'A', after: 'B' },
    { field: 'resume_profile.height', before: '150', after: '152' },
  ]);
  assert.deepEqual(changeRows({ id: 1, name: 'A' }, null), [{ field: 'id', before: 1, after: null }, { field: 'name', before: 'A', after: null }]);
  assert.deepEqual(changeRows(null, null), []);
});

test('接線：兩張操作紀錄表都加了欄位並寫入、讀取，畫面也有顯示', async () => {
  const [audit, agency, adminRoute, management, agencyLog] = await Promise.all([
    read('../src/lib/hr-audit.js'), read('../src/lib/hr-agency-audit.js'), read('../src/app/api/hr/admin-audit/route.js'),
    read('../src/components/HrManagement.jsx'), read('../src/components/HrAgencyAuditLog.jsx'),
  ]);
  for (const source of [audit, agency]) assert.match(source, /ADD COLUMN IF NOT EXISTS before_data JSONB, ADD COLUMN IF NOT EXISTS after_data JSONB/);
  assert.match(audit, /summary,before_data,after_data\)/);
  assert.match(audit, /takeSnapshot\(runQuery, type, id\)/);
  assert.match(audit, /diffSnapshots\(ctx\.snapshot, after\)/);
  assert.match(audit, /recordAgencyAction\(\{[^}]*before: changes\.before, after: changes\.after/);
  assert.match(agency, /summary_zh,summary_en,before_data,after_data\)/);
  assert.match(agency, /summary_en,before_data,after_data,created_at/);
  assert.match(adminRoute, /before_data,after_data/);
  assert.match(management, /<HrAuditChanges before=\{event\.before_data\} after=\{event\.after_data\}\/>/);
  assert.match(agencyLog, /<HrAuditChanges before=\{row\.before_data\} after=\{row\.after_data\}/);
});
