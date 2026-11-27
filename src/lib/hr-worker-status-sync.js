// 工作者層級與案件層級的進度：以「工作者層級」為準，尚未結案的案件跟著同步。
//
// 同樣的資訊存了兩份：
// - 體檢／訓練狀態：hr_worker_health_training（工作者）↔ hr_cases.medical_status／training_status（案件）
// - 申請程序：hr_worker_progress_steps（工作者）↔ hr_application_steps（案件）
// 工作者層級在還沒建案時就能記錄，也是三個寫入入口（仲介工作者頁、案件頁、訓練自動同步）共同的依據，所以以它為準。
// 已結案的案件保留結案當時的值（當作歷史），不再跟著變動。
//
// 這支遷移不刪、不覆寫任何既有資料：
// 1. 補資料：有案件但沒有工作者層級紀錄的，從案件複製一份過去（只新增）。
// 2. 資料庫 trigger：工作者層級有變動時，自動同步到這位工作者尚未結案的案件（之後就不會再不一致）。
// 3. 一致性檢查：補完後仍不一致的只記錄在 log，不自動改。
import { migrateOnce } from './migrate-once.js';

// 有案件、但工作者層級還沒有體檢／訓練紀錄：用最近一筆尚未結案的案件（沒有就用最近一筆案件）的值。
export const BACKFILL_HEALTH_SQL = `INSERT INTO hr_worker_health_training(worker_id,medical_status,training_status,updated_by,updated_at)
  SELECT DISTINCT ON (c.worker_id) c.worker_id,c.medical_status,c.training_status,'system:backfill',NOW()
  FROM hr_cases c
  WHERE NOT EXISTS (SELECT 1 FROM hr_worker_health_training h WHERE h.worker_id=c.worker_id)
  ORDER BY c.worker_id,(c.status<>'closed') DESC,c.updated_at DESC,c.id DESC
  ON CONFLICT (worker_id) DO NOTHING`;

// 案件上有填過的申請程序、但工作者層級還沒有：用最近更新的尚未結案案件（沒有就用最近的案件）的值。
export const BACKFILL_STEPS_SQL = `INSERT INTO hr_worker_progress_steps(worker_id,step_key,started_on,completed_on,note,detail,updated_by,updated_at)
  SELECT DISTINCT ON (c.worker_id,s.step_key) c.worker_id,s.step_key,s.started_on,s.completed_on,s.note,s.detail,
    CASE WHEN s.updated_by='' THEN 'system:backfill' ELSE s.updated_by END,s.updated_at
  FROM hr_application_steps s JOIN hr_cases c ON c.id=s.case_id
  WHERE (s.started_on IS NOT NULL OR s.completed_on IS NOT NULL OR s.note<>'' OR s.detail<>'')
    AND NOT EXISTS (SELECT 1 FROM hr_worker_progress_steps w WHERE w.worker_id=c.worker_id AND w.step_key=s.step_key)
  ORDER BY c.worker_id,s.step_key,(c.status<>'closed') DESC,s.updated_at DESC,s.id DESC
  ON CONFLICT (worker_id,step_key) DO NOTHING`;

export const HEALTH_TRIGGER_SQL = [
  `CREATE OR REPLACE FUNCTION hr_sync_worker_health_to_cases() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE hr_cases SET medical_status=NEW.medical_status,training_status=NEW.training_status,updated_at=NOW()
        WHERE worker_id=NEW.worker_id AND status<>'closed'
          AND (medical_status IS DISTINCT FROM NEW.medical_status OR training_status IS DISTINCT FROM NEW.training_status);
      RETURN NULL;
    END; $$`,
  'DROP TRIGGER IF EXISTS hr_worker_health_sync_cases ON hr_worker_health_training',
  `CREATE TRIGGER hr_worker_health_sync_cases AFTER INSERT OR UPDATE OF medical_status,training_status ON hr_worker_health_training
    FOR EACH ROW EXECUTE FUNCTION hr_sync_worker_health_to_cases()`,
];

// 案件建立時就會建好全部申請程序列，所以這裡只需要 UPDATE。
export const STEPS_TRIGGER_SQL = [
  `CREATE OR REPLACE FUNCTION hr_sync_worker_steps_to_cases() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE hr_application_steps s SET started_on=NEW.started_on,completed_on=NEW.completed_on,note=NEW.note,detail=NEW.detail,
          updated_by=NEW.updated_by,updated_at=NOW()
        FROM hr_cases c
        WHERE c.id=s.case_id AND c.worker_id=NEW.worker_id AND c.status<>'closed' AND s.step_key=NEW.step_key
          AND (s.started_on,s.completed_on,s.note,s.detail) IS DISTINCT FROM (NEW.started_on,NEW.completed_on,NEW.note,NEW.detail);
      RETURN NULL;
    END; $$`,
  'DROP TRIGGER IF EXISTS hr_worker_steps_sync_cases ON hr_worker_progress_steps',
  `CREATE TRIGGER hr_worker_steps_sync_cases AFTER INSERT OR UPDATE ON hr_worker_progress_steps
    FOR EACH ROW EXECUTE FUNCTION hr_sync_worker_steps_to_cases()`,
];

// 尚未結案、但和工作者層級不一致的案件（只回報）。
export const DRIFT_SQL = `SELECT
    (SELECT count(*)::int FROM hr_cases c JOIN hr_worker_health_training h ON h.worker_id=c.worker_id
      WHERE c.status<>'closed' AND (c.medical_status IS DISTINCT FROM h.medical_status OR c.training_status IS DISTINCT FROM h.training_status)) AS status_drift,
    (SELECT count(*)::int FROM hr_application_steps s JOIN hr_cases c ON c.id=s.case_id
      JOIN hr_worker_progress_steps w ON w.worker_id=c.worker_id AND w.step_key=s.step_key
      WHERE c.status<>'closed' AND (s.started_on,s.completed_on,s.note,s.detail) IS DISTINCT FROM (w.started_on,w.completed_on,w.note,w.detail)) AS step_drift`;

const tableExists = async (client, table) => (await client.query('SELECT to_regclass($1) AS t', [`public.${table}`])).rows[0]?.t;

export async function syncWorkerStatusSchema(pool) {
  const client = await pool.connect();
  const log = [];
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(727003)');
    for (const table of ['hr_cases', 'hr_worker_health_training', 'hr_application_steps', 'hr_worker_progress_steps']) {
      if (!(await tableExists(client, table))) { await client.query('ROLLBACK'); return ['skipped:missing_tables']; }
    }
    // 先補資料再建 trigger：補資料用的是案件上的值，不會反過來改到案件。
    const health = await client.query(BACKFILL_HEALTH_SQL);
    if (health.rowCount) log.push(`health_backfilled:${health.rowCount}`);
    const steps = await client.query(BACKFILL_STEPS_SQL);
    if (steps.rowCount) log.push(`steps_backfilled:${steps.rowCount}`);
    for (const sql of [...HEALTH_TRIGGER_SQL, ...STEPS_TRIGGER_SQL]) await client.query(sql);
    const drift = (await client.query(DRIFT_SQL)).rows[0];
    if (drift.status_drift || drift.step_drift) log.push(`drift:status=${drift.status_drift},steps=${drift.step_drift}`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
  if (log.length) console.info('hr_worker_status_sync', log.join(' '));
  return log;
}

export function ensureWorkerStatusSyncSchema(pool) {
  return migrateOnce('worker-status-sync', () => syncWorkerStatusSchema(pool));
}
