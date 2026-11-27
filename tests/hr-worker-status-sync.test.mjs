import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BACKFILL_HEALTH_SQL, BACKFILL_STEPS_SQL, DRIFT_SQL, HEALTH_TRIGGER_SQL, STEPS_TRIGGER_SQL, syncWorkerStatusSchema,
} from '../src/lib/hr-worker-status-sync.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('補資料只新增、不覆寫：只補還沒有工作者層級紀錄的，且衝突時不更新', () => {
  for (const sql of [BACKFILL_HEALTH_SQL, BACKFILL_STEPS_SQL]) {
    assert.match(sql, /^INSERT INTO/);
    assert.match(sql, /WHERE NOT EXISTS|AND NOT EXISTS/);
    assert.match(sql, /ON CONFLICT \([^)]+\) DO NOTHING$/);
    assert.doesNotMatch(sql, /DO UPDATE|DELETE|UPDATE hr_/);
  }
  // 優先用尚未結案的案件，再看最近更新
  assert.match(BACKFILL_HEALTH_SQL, /ORDER BY c\.worker_id,\(c\.status<>'closed'\) DESC,c\.updated_at DESC/);
  // 只補有填過內容的申請程序
  assert.match(BACKFILL_STEPS_SQL, /s\.started_on IS NOT NULL OR s\.completed_on IS NOT NULL OR s\.note<>'' OR s\.detail<>''/);
});

test('trigger 只同步到尚未結案、而且值不同的案件（已結案保留歷史）', () => {
  const health = HEALTH_TRIGGER_SQL.join('\n'), steps = STEPS_TRIGGER_SQL.join('\n');
  for (const sql of [health, steps]) {
    assert.match(sql, /status<>'closed'/);
    assert.match(sql, /IS DISTINCT FROM/);
    assert.match(sql, /DROP TRIGGER IF EXISTS/);
  }
  assert.match(health, /AFTER INSERT OR UPDATE OF medical_status,training_status ON hr_worker_health_training/);
  assert.match(steps, /AFTER INSERT OR UPDATE ON hr_worker_progress_steps/);
  // 方向只有「工作者 → 案件」，案件表上沒有反向 trigger，不會互相觸發
  assert.doesNotMatch(health + steps, /ON hr_cases|ON hr_application_steps/);
});

test('一致性檢查只讀不改', () => {
  assert.match(DRIFT_SQL, /^SELECT/);
  assert.doesNotMatch(DRIFT_SQL, /UPDATE|INSERT|DELETE/);
});

test('流程：先補資料再建 trigger，全程在 transaction 裡；缺表時略過', async () => {
  const sql = [];
  const pool = { connect: async () => ({
    async query(text) {
      sql.push(text);
      if (/to_regclass/.test(text)) return { rows: [{ t: 'x' }] };
      if (text === DRIFT_SQL) return { rows: [{ status_drift: 0, step_drift: 0 }] };
      return { rows: [], rowCount: text === BACKFILL_HEALTH_SQL ? 3 : 0 };
    },
    release() {},
  }) };
  assert.deepEqual(await syncWorkerStatusSchema(pool), ['health_backfilled:3']);
  assert.equal(sql[0], 'BEGIN');
  assert.equal(sql.at(-1), 'COMMIT');
  assert.ok(sql.indexOf(BACKFILL_STEPS_SQL) < sql.indexOf(HEALTH_TRIGGER_SQL[0]));

  const missing = { connect: async () => ({ async query(text) { return /to_regclass/.test(text) ? { rows: [{ t: null }] } : { rows: [] }; }, release() {} }) };
  assert.deepEqual(await syncWorkerStatusSchema(missing), ['skipped:missing_tables']);
});

test('接線：案件頁存申請程序時也寫入工作者層級（只限尚未結案），並登記到啟動遷移', async () => {
  const [route, migrations] = await Promise.all([read('../src/app/api/hr/route.js'), read('../src/lib/hr-migrations.js')]);
  assert.match(route, /INSERT INTO hr_worker_progress_steps\(worker_id,step_key,started_on,completed_on,note,detail,updated_by,updated_at\)\s+SELECT c\.worker_id[\s\S]*?c\.status<>'closed'/);
  assert.match(migrations, /\['worker-status-sync', \(\) => ensureWorkerStatusSyncSchema\(pool\)\]/);
  const steps = [...migrations.matchAll(/\['([\w-]+)', /g)].map(match => match[1]);
  assert.ok(steps.indexOf('worker-status-sync') > steps.indexOf('worker-progress'));
  assert.equal(steps.at(-1), 'schema-normalize');
});
