// 資料表整理（正規化第一批）。原則：不刪任何資料。
// 1. 舊表移到 hr_archive schema（ALTER TABLE ... SET SCHEMA，資料原封不動，一行 SQL 就能搬回來）：
//    - hr_case_requirements：文件改為工人層後留下的空表
//    - hr_staff：舊的承辦人表，已由 hr_cases.assigned_member_id 取代；hr_cases.assigned_staff_id 只有在「全部是 NULL」時才移除
//    - schema_migrations：別的專案留下的紀錄（001_init.sql、002_seed_fashion_catalog.sql），這個專案沒有用到
// 2. hr_worker_documents 的主鍵、約束、序列名稱改回與表名一致（只改名稱）。
// 3. 文件種類對照表 hr_document_types ＋ hr_worker_documents.type_key（固定代碼；顯示名稱仍以 name 為準）。
// 4. 外鍵欄位補索引。
// 5. 狀態欄位加 CHECK：先 NOT VALID（新寫入立即受檢查），再 VALIDATE 舊資料；舊資料不符時保留 NOT VALID 並記錄，不讓啟動失敗。
//
// 整個流程在一個 transaction 裡，可重複執行；每一步都先檢查現況，已經做過就略過。
import { migrateOnce } from './migrate-once.js';
import { WORKER_DOCUMENT_TYPES } from './hr-requirements.js';
import { MEDICAL_STATUSES, TRAINING_STATUSES } from './hr-worker-progress.js';

export const ARCHIVE_SCHEMA = 'hr_archive';
export const ARCHIVED_TABLES = ['hr_case_requirements', 'hr_staff', 'schema_migrations'];

const EMPLOYER_TYPES = ['home_care', 'factory', 'domestic_helper', 'nursing_home', 'other'];

// [資料表, 欄位]：外鍵欄位補上的索引（名稱 = 表_欄位_idx）。
export const FOREIGN_KEY_INDEXES = [
  ['hr_employers', 'agency_id'], ['hr_workers', 'agency_id'],
  ['hr_cases', 'assigned_member_id'], ['hr_cases', 'employer_id'], ['hr_cases', 'worker_id'],
  ['hr_case_activity', 'case_id'],
  ['hr_members', 'last_employer_id'], ['hr_members', 'last_worker_id'], ['hr_members', 'requested_agency_id'], ['hr_members', 'training_center_id'],
  ['hr_job_orders', 'employer_id'],
  ['hr_job_order_agencies', 'broker_member_id'], ['hr_job_order_agencies', 'taiwan_agency_id'],
  ['hr_job_order_routes', 'philippines_agency_id'],
  ['hr_job_order_candidates', 'deposit_recorded_by'], ['hr_job_order_candidates', 'proposed_by'], ['hr_job_order_candidates', 'worker_id'],
  ['hr_chat_messages', 'member_id'], ['hr_chat_reads', 'room_id'], ['hr_chat_participants', 'member_id'],
  ['hr_tc_teacher_certifications', 'certification_id'], ['hr_tc_courses', 'certification_id'],
  ['hr_tc_classes', 'certification_id'], ['hr_tc_classes', 'course_id'], ['hr_tc_classes', 'teacher_id'],
  ['hr_agency_certifications', 'decided_by_member_id'], ['hr_agency_certifications', 'requested_by_member_id'],
  ['hr_notification_outbox', 'recipient_member_id'], ['hr_notification_outbox', 'subject_member_id'],
  ['hr_agency_cert_progress', 'updated_by_member_id'],
  ['hr_tc_course_units', 'center_id'], ['hr_tc_unit_progress', 'unit_id'], ['hr_tc_quiz_results', 'unit_id'],
];

const list = values => values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');

// [資料表, 約束名稱, 條件]
export const STATUS_CHECKS = [
  ['hr_employers', 'hr_employers_employer_type_check', `employer_type IN (${list(EMPLOYER_TYPES)})`],
  ['hr_worker_documents', 'hr_worker_documents_applicability_source_check', "applicability_source IN ('auto','manual')"],
  ['hr_cases', 'hr_cases_medical_status_check', `medical_status IN (${list(MEDICAL_STATUSES)})`],
  ['hr_cases', 'hr_cases_training_status_check', `training_status IN (${list(TRAINING_STATUSES)})`],
  ['hr_worker_health_training', 'hr_worker_health_training_medical_status_check', `medical_status IN (${list(MEDICAL_STATUSES)})`],
  ['hr_worker_health_training', 'hr_worker_health_training_training_status_check', `training_status IN (${list(TRAINING_STATUSES)})`],
];

// [舊名稱, 新名稱]：hr_worker_documents 是由 hr_case_requirements 改名來的，約束名稱還留著舊名。
export const WORKER_DOCUMENT_RENAMES = [
  ['hr_case_requirements_pkey', 'hr_worker_documents_pkey'],
  ['hr_case_requirements_status_check', 'hr_worker_documents_status_check'],
];

const exists = async (client, sql, params) => (await client.query(sql, params)).rows.length > 0;
const tableExists = (client, schema, table) => exists(client, 'SELECT 1 FROM pg_tables WHERE schemaname=$1 AND tablename=$2', [schema, table]);
const columnExists = (client, table, column) => exists(client,
  "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2", [table, column]);
const constraintExists = (client, table, name) => exists(client,
  "SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.'||$1) AND conname=$2", [table, name]);

async function archiveTable(client, table, log) {
  if (!(await tableExists(client, 'public', table))) return;
  if (await tableExists(client, ARCHIVE_SCHEMA, table)) { log.push(`skip_archive_exists:${table}`); return; }
  await client.query(`ALTER TABLE public.${table} SET SCHEMA ${ARCHIVE_SCHEMA}`);
  log.push(`archived:${table}`);
}

async function archiveLegacyTables(client, log) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${ARCHIVE_SCHEMA}`);
  await client.query(`COMMENT ON SCHEMA ${ARCHIVE_SCHEMA} IS '已停用的舊資料表（資料保留，必要時可用 ALTER TABLE hr_archive.<表> SET SCHEMA public 搬回）'`);
  await archiveTable(client, 'hr_case_requirements', log);
  // hr_staff：只有在沒有任何案件還指向它時，才移除 hr_cases.assigned_staff_id 並封存。
  if (await columnExists(client, 'hr_cases', 'assigned_staff_id')) {
    const used = (await client.query('SELECT count(*)::int AS n FROM hr_cases WHERE assigned_staff_id IS NOT NULL')).rows[0].n;
    if (used > 0) { log.push(`keep_hr_staff:${used}_cases`); }
    else {
      await client.query('ALTER TABLE hr_cases DROP COLUMN assigned_staff_id');
      log.push('dropped_empty_column:hr_cases.assigned_staff_id');
    }
  }
  if (!(await columnExists(client, 'hr_cases', 'assigned_staff_id'))) await archiveTable(client, 'hr_staff', log);
  await archiveTable(client, 'schema_migrations', log);
}

async function renameWorkerDocumentObjects(client, log) {
  if (!(await tableExists(client, 'public', 'hr_worker_documents'))) return;
  for (const [from, to] of WORKER_DOCUMENT_RENAMES) {
    if (await constraintExists(client, 'hr_worker_documents', from) && !(await constraintExists(client, 'hr_worker_documents', to))) {
      await client.query(`ALTER TABLE hr_worker_documents RENAME CONSTRAINT ${from} TO ${to}`);
      log.push(`renamed:${from}`);
    }
  }
  // id 欄位實際使用的序列（用 regclass 找，不看名字）；名稱不對才改。nextval 預設值是用 OID 綁定，改名不影響。
  const seq = (await client.query("SELECT pg_get_serial_sequence('hr_worker_documents','id') AS name")).rows[0]?.name;
  if (seq && seq !== 'public.hr_worker_documents_id_seq' && !(await exists(client, "SELECT 1 FROM pg_class WHERE relname='hr_worker_documents_id_seq' AND relnamespace='public'::regnamespace"))) {
    await client.query(`ALTER SEQUENCE ${seq} RENAME TO hr_worker_documents_id_seq`);
    log.push(`renamed:${seq}`);
  }
}

async function ensureDocumentTypes(client, log) {
  if (!(await tableExists(client, 'public', 'hr_worker_documents'))) return;
  await client.query(`CREATE TABLE IF NOT EXISTS hr_document_types (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]+$'),
    name TEXT NOT NULL UNIQUE,
    applicability TEXT NOT NULL DEFAULT '',
    required BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  for (const type of WORKER_DOCUMENT_TYPES) {
    await client.query(`INSERT INTO hr_document_types(key,name,applicability,required,sort_order) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name,applicability=EXCLUDED.applicability,required=EXCLUDED.required,sort_order=EXCLUDED.sort_order,updated_at=NOW()
      WHERE (hr_document_types.name,hr_document_types.applicability,hr_document_types.required,hr_document_types.sort_order)
        IS DISTINCT FROM (EXCLUDED.name,EXCLUDED.applicability,EXCLUDED.required,EXCLUDED.sort_order)`,
    [type.key, type.name, type.applicability, type.required, type.sortOrder]);
  }
  await client.query('ALTER TABLE hr_worker_documents ADD COLUMN IF NOT EXISTS type_key TEXT REFERENCES hr_document_types(key) ON UPDATE CASCADE');
  // 新增或改名的文件列自動帶上代碼（自訂的額外文件不在對照表裡，維持 NULL）。不改任何程式的寫入方式。
  await client.query(`CREATE OR REPLACE FUNCTION hr_worker_documents_set_type_key() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.type_key := (SELECT key FROM hr_document_types WHERE name = NEW.name);
      RETURN NEW;
    END; $$`);
  await client.query('DROP TRIGGER IF EXISTS hr_worker_documents_type_key ON hr_worker_documents');
  await client.query(`CREATE TRIGGER hr_worker_documents_type_key BEFORE INSERT OR UPDATE OF name ON hr_worker_documents
    FOR EACH ROW EXECUTE FUNCTION hr_worker_documents_set_type_key()`);
  const filled = await client.query(`UPDATE hr_worker_documents d SET type_key=t.key FROM hr_document_types t
    WHERE t.name=d.name AND d.type_key IS DISTINCT FROM t.key`);
  if (filled.rowCount) log.push(`type_key_backfilled:${filled.rowCount}`);
  // 一般索引（不設 UNIQUE）：以後若在程式裡改文件名稱，舊名與新名的列會暫時共用同一個代碼，UNIQUE 會讓啟動失敗。
  await client.query('CREATE INDEX IF NOT EXISTS hr_worker_documents_type_key_idx ON hr_worker_documents(type_key)');
}

async function ensureForeignKeyIndexes(client, log) {
  for (const [table, column] of FOREIGN_KEY_INDEXES) {
    if (!(await columnExists(client, table, column))) continue;
    const name = `${table}_${column}_idx`;
    if (await exists(client, "SELECT 1 FROM pg_class WHERE relname=$1 AND relnamespace='public'::regnamespace", [name])) continue;
    await client.query(`CREATE INDEX ${name} ON ${table}(${column})`);
    log.push(`index:${name}`);
  }
}

async function ensureStatusChecks(client, log) {
  for (const [table, name, condition] of STATUS_CHECKS) {
    if (!(await tableExists(client, 'public', table))) continue;
    if (!(await constraintExists(client, table, name))) {
      await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${condition}) NOT VALID`);
      log.push(`check:${name}`);
    }
    const valid = (await client.query("SELECT convalidated FROM pg_constraint WHERE conrelid=to_regclass('public.'||$1) AND conname=$2", [table, name])).rows[0]?.convalidated;
    if (valid) continue;
    await client.query('SAVEPOINT validate_check');
    try {
      await client.query(`ALTER TABLE ${table} VALIDATE CONSTRAINT ${name}`);
      await client.query('RELEASE SAVEPOINT validate_check');
    } catch (error) {
      // 舊資料有不符合的值：保留 NOT VALID（新寫入仍受檢查），不讓啟動失敗。
      await client.query('ROLLBACK TO SAVEPOINT validate_check');
      log.push(`check_not_validated:${name}`);
      console.warn('hr_schema_normalize_check_not_validated', name, error?.message || 'Error');
    }
  }
}

export async function normalizeSchema(pool) {
  const client = await pool.connect();
  const log = [];
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(727002)');
    await archiveLegacyTables(client, log);
    await renameWorkerDocumentObjects(client, log);
    await ensureDocumentTypes(client, log);
    await ensureForeignKeyIndexes(client, log);
    await ensureStatusChecks(client, log);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  if (log.length) console.info('hr_schema_normalize', log.join(' '));
  return log;
}

export function ensureSchemaNormalization(pool) {
  return migrateOnce('schema-normalize', () => normalizeSchema(pool));
}
