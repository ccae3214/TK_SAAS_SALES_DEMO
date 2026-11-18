// 資料表遷移（CREATE／ALTER、舊資料補欄位）集中在這裡，只在伺服器啟動時跑（見 hr-migrations.js），
// 請求路徑裡的 ensure* 只會等待「已完成」的結果，不會再執行 DDL。每個函式用 migrateOnce 保證每個行程只跑一次。
import pool, { query } from '@/lib/db';
import { migrateOnce } from './migrate-once.js';
import { ensureHrIdentitySchema } from '@/lib/hr-access';
import { ensureCertificationSchema } from '@/lib/hr-agency-certification-store';
import { migrateWorkerDocuments } from '@/lib/hr-worker-documents-schema';
import { WORKER_PROGRESS_STEPS as APPLICATION_STEPS } from '@/lib/hr-worker-progress';
import { refreshCaseStage as refreshStage } from '@/lib/hr-case-stage';

// 核心資料表：雇主、工作者、案件、文件、聊天、證照…
export function ensureSchema() {
  return migrateOnce('hr-core', async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_employers (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, contact_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_workers (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, nationality TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', job_preference TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', resume_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query("ALTER TABLE hr_workers ADD COLUMN IF NOT EXISTS resume_profile JSONB NOT NULL DEFAULT '{}'::jsonb");
    await pool.query("UPDATE hr_workers SET resume_profile=resume_profile-'familyStatus'-'sourcePdfText' WHERE resume_profile ? 'familyStatus' OR resume_profile ? 'sourcePdfText'");
    await pool.query(`UPDATE hr_workers SET resume_profile=jsonb_set(COALESCE(resume_profile,'{}'::jsonb),'{referenceNo}',to_jsonb(
      (CASE WHEN job_preference IN ('家庭看護','家庭幫傭') THEN 'CT' WHEN job_preference='工廠技術工' THEN 'SW' WHEN job_preference='農工' THEN 'FM' WHEN job_preference='機構看護工' THEN 'CG' END)
      || (CASE WHEN lower(resume_profile->>'gender') IN ('male','m','男','男性') THEN 'M' WHEN lower(resume_profile->>'gender') IN ('female','f','女','女性') THEN 'F' END)
      || '-' || (CASE WHEN job_preference IN ('家庭看護','家庭幫傭') THEN '' ELSE $1::text END) || LPAD(id::text,3,'0')
    ),true) WHERE COALESCE(resume_profile->>'referenceNo','') = '' AND job_preference IN ('家庭看護','家庭幫傭','工廠技術工','農工','機構看護工')
      AND lower(resume_profile->>'gender') IN ('male','m','男','男性','female','f','女','女性')`,[String(new Date().getFullYear()).slice(-2)]);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_staff (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_cases (
      id BIGSERIAL PRIMARY KEY, case_number TEXT NOT NULL UNIQUE,
      employer_id BIGINT NOT NULL REFERENCES hr_employers(id), worker_id BIGINT NOT NULL REFERENCES hr_workers(id),
      assigned_staff_id BIGINT REFERENCES hr_staff(id), job_type TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'intake' CHECK (stage IN ('intake','matching','documents','medical_training','application','arrangement','completed')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','on_hold','closed')),
      expected_start_date DATE, notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await ensureHrIdentitySchema();
    await pool.query('ALTER TABLE hr_cases ADD COLUMN IF NOT EXISTS assigned_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL');
    await pool.query(`UPDATE hr_cases c SET assigned_member_id=m.id FROM hr_staff s JOIN hr_members m ON lower(m.email)=lower(s.email)
      JOIN hr_agencies a ON a.id=m.agency_id AND a.agency_type='taiwan'
      WHERE c.assigned_staff_id=s.id AND c.assigned_member_id IS NULL AND m.role='agency' AND m.active=TRUE`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_job_orders (
      id BIGSERIAL PRIMARY KEY, employer_id BIGINT NOT NULL REFERENCES hr_employers(id),
      job_type TEXT NOT NULL DEFAULT '', headcount INTEGER NOT NULL CHECK(headcount>0),
      description TEXT NOT NULL DEFAULT '', expected_start_date DATE, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','filled','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_job_order_agencies (
      id BIGSERIAL PRIMARY KEY, job_order_id BIGINT NOT NULL REFERENCES hr_job_orders(id) ON DELETE CASCADE,
      taiwan_agency_id BIGINT NOT NULL REFERENCES hr_agencies(id), status TEXT NOT NULL DEFAULT 'sent',
      broker_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(job_order_id,taiwan_agency_id)
    )`);
    await pool.query('ALTER TABLE hr_job_order_agencies ADD COLUMN IF NOT EXISTS broker_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL');
    // 雇主補充資料（性別、年齡、家庭成員、公司資料）與需求單的被照顧人、月薪。只新增欄位，不改動既有資料。
    await pool.query("ALTER TABLE hr_employers ADD COLUMN IF NOT EXISTS employer_profile JSONB NOT NULL DEFAULT '{}'::jsonb");
    await pool.query("ALTER TABLE hr_job_orders ADD COLUMN IF NOT EXISTS care_recipient JSONB NOT NULL DEFAULT '{}'::jsonb");
    await pool.query('ALTER TABLE hr_job_orders ADD COLUMN IF NOT EXISTS monthly_salary INTEGER');
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_job_order_routes (
      id BIGSERIAL PRIMARY KEY, order_agency_id BIGINT NOT NULL REFERENCES hr_job_order_agencies(id) ON DELETE CASCADE,
      philippines_agency_id BIGINT NOT NULL REFERENCES hr_agencies(id), notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(order_agency_id,philippines_agency_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_job_order_candidates (
      id BIGSERIAL PRIMARY KEY, route_id BIGINT NOT NULL REFERENCES hr_job_order_routes(id) ON DELETE CASCADE,
      worker_id BIGINT NOT NULL REFERENCES hr_workers(id), proposed_by BIGINT REFERENCES hr_members(id),
      status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','scheduled','passed','rejected')),
      interview_at TIMESTAMPTZ, notes TEXT NOT NULL DEFAULT '', case_id BIGINT UNIQUE REFERENCES hr_cases(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(route_id,worker_id)
    )`);
    await ensureCertificationSchema(pool);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_chat_rooms (
      id BIGSERIAL PRIMARY KEY, room_type TEXT NOT NULL CHECK(room_type IN ('agency','case')),
      agency_id BIGINT REFERENCES hr_agencies(id) ON DELETE CASCADE,
      case_id BIGINT REFERENCES hr_cases(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK((room_type='agency' AND agency_id IS NOT NULL AND case_id IS NULL) OR (room_type='case' AND case_id IS NOT NULL AND agency_id IS NULL))
    )`);
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS hr_chat_rooms_agency_unique ON hr_chat_rooms(agency_id) WHERE room_type='agency'");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS hr_chat_rooms_case_unique ON hr_chat_rooms(case_id) WHERE room_type='case'");
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_chat_messages (
      id BIGSERIAL PRIMARY KEY, room_id BIGINT NOT NULL REFERENCES hr_chat_rooms(id) ON DELETE CASCADE,
      member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL,
      sender_name TEXT NOT NULL, sender_role TEXT NOT NULL, body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 3000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_chat_messages_room_created ON hr_chat_messages(room_id,created_at DESC,id DESC)');
    await pool.query("ALTER TABLE hr_cases ADD COLUMN IF NOT EXISTS medical_status TEXT NOT NULL DEFAULT 'not_scheduled'");
    await pool.query("ALTER TABLE hr_cases ADD COLUMN IF NOT EXISTS training_status TEXT NOT NULL DEFAULT 'not_scheduled'");
    // 必要文件屬於工人（hr_worker_documents），案件只有專屬的必備證照（hr_case_certifications）。舊的案件層資料會在這裡自動搬移。
    const documentMigration = await migrateWorkerDocuments(pool);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_document_submissions (
      id BIGSERIAL PRIMARY KEY, requirement_id BIGINT NOT NULL REFERENCES hr_worker_documents(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL, filename TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', submitted_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(requirement_id, version_number)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_document_files (
      submission_id BIGINT PRIMARY KEY REFERENCES hr_document_submissions(id) ON DELETE CASCADE,
      original_filename TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL, iv BYTEA NOT NULL, auth_tag BYTEA NOT NULL, encrypted_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_document_reviews (
      id BIGSERIAL PRIMARY KEY, submission_id BIGINT NOT NULL REFERENCES hr_document_submissions(id) ON DELETE CASCADE,
      decision TEXT NOT NULL CHECK (decision IN ('approved','returned')), reason TEXT NOT NULL DEFAULT '',
      reviewer TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(submission_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_case_tasks (
      id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('document','medical','training','other')),
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','blocked')),
      due_date DATE, notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_case_activity (
      id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,
      actor_email TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_application_steps (
      id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL, label TEXT NOT NULL, started_on DATE, completed_on DATE,
      note TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(case_id,step_key)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_case_acknowledgments (
      case_id BIGINT NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE, ack_key TEXT NOT NULL,
      confirmed_by TEXT NOT NULL DEFAULT '', confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(case_id,ack_key)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_worker_progress_steps (
      worker_id BIGINT NOT NULL REFERENCES hr_workers(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL, started_on DATE, completed_on DATE,
      note TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (worker_id, step_key)
    )`);
    // 簽證類型、OWWA 雇主、機票資訊等「日期以外的欄位」。
    await pool.query("ALTER TABLE hr_application_steps ADD COLUMN IF NOT EXISTS detail TEXT NOT NULL DEFAULT ''");
    await pool.query("ALTER TABLE hr_worker_progress_steps ADD COLUMN IF NOT EXISTS detail TEXT NOT NULL DEFAULT ''");
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_worker_health_training (
      worker_id BIGINT PRIMARY KEY REFERENCES hr_workers(id) ON DELETE CASCADE,
      medical_status TEXT NOT NULL DEFAULT 'not_scheduled',
      training_status TEXT NOT NULL DEFAULT 'not_scheduled',
      updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`INSERT INTO hr_application_steps(case_id,step_key,label)
      SELECT c.id,s.step_key,s.label FROM hr_cases c CROSS JOIN (VALUES ${APPLICATION_STEPS.map((_,index)=>`($${index*2+1},$${index*2+2})`).join(',')}) AS s(step_key,label)
      ON CONFLICT(case_id,step_key) DO UPDATE SET label=EXCLUDED.label`, APPLICATION_STEPS.flat());
    // 文件搬到工人層、或前置文件旗標被修正後，重算受影響案件的階段。
    const staleCases = documentMigration.migrated
      ? await pool.query("SELECT id FROM hr_cases WHERE status<>'closed'")
      : await pool.query('SELECT id FROM hr_cases WHERE worker_id=ANY($1::bigint[])', [documentMigration.affectedWorkerIds]);
    for (const row of staleCases.rows) await refreshStage((sql, params) => query(sql, params), row.id);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_cases_status_updated ON hr_cases(status, updated_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS hr_tasks_case_status ON hr_case_tasks(case_id, status, due_date)');
    await ensureHrIdentitySchema();
  });
}

// 聊天室資料表（建立在核心資料表之後）
export function ensureChatSchema() {
  return migrateOnce('hr-chat', async () => {
    await ensureSchema();
    await query("ALTER TABLE hr_chat_rooms DROP CONSTRAINT IF EXISTS hr_chat_rooms_room_type_check");
    await query("ALTER TABLE hr_chat_rooms DROP CONSTRAINT IF EXISTS hr_chat_rooms_check");
    await query("ALTER TABLE hr_chat_rooms ADD COLUMN IF NOT EXISTS direct_key TEXT");
    await query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='hr_chat_rooms_type_check') THEN ALTER TABLE hr_chat_rooms ADD CONSTRAINT hr_chat_rooms_type_check CHECK((room_type='agency' AND agency_id IS NOT NULL AND case_id IS NULL) OR (room_type='case' AND case_id IS NOT NULL AND agency_id IS NULL) OR (room_type='direct' AND agency_id IS NULL AND case_id IS NULL AND direct_key IS NOT NULL)); END IF; END $$`);
    await query("CREATE UNIQUE INDEX IF NOT EXISTS hr_chat_rooms_direct_unique ON hr_chat_rooms(direct_key) WHERE room_type='direct'");
    await query(`CREATE TABLE IF NOT EXISTS hr_chat_participants (room_id BIGINT NOT NULL REFERENCES hr_chat_rooms(id) ON DELETE CASCADE, participant_key TEXT NOT NULL, member_id BIGINT REFERENCES hr_members(id) ON DELETE CASCADE, display_name TEXT NOT NULL, PRIMARY KEY(room_id,participant_key))`);
    await query(`CREATE TABLE IF NOT EXISTS hr_chat_reads (
      reader_key TEXT NOT NULL,
      room_id BIGINT NOT NULL REFERENCES hr_chat_rooms(id) ON DELETE CASCADE,
      last_read_message_id BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(reader_key,room_id)
    )`);
    await query("INSERT INTO hr_chat_rooms(room_type,agency_id) SELECT 'agency',id FROM hr_agencies WHERE active=TRUE ON CONFLICT DO NOTHING");
    await query("INSERT INTO hr_chat_rooms(room_type,case_id) SELECT 'case',id FROM hr_cases ON CONFLICT DO NOTHING");
  });
}

// LINE 機器人資料表
export function ensureLineSchema() {
  return migrateOnce('line-bot', async () => {
    await ensureHrIdentitySchema();
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('processing','completed','failed')),
      attempts INTEGER NOT NULL DEFAULT 1,
      last_error TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_member_settings (
      line_user_id TEXT PRIMARY KEY,
      preferred_language TEXT NOT NULL CHECK (preferred_language IN ('zh','en','tl')),
      rich_menu_role TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('ALTER TABLE hr_line_member_settings ADD COLUMN IF NOT EXISTS rich_menu_role TEXT');
    // 只記錄圖文選單的會員不一定選過語言；語言欄位允許空值（CHECK 對空值不擋）。
    await pool.query('ALTER TABLE hr_line_member_settings ALTER COLUMN preferred_language DROP NOT NULL');
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_rich_menus (
      menu_key TEXT PRIMARY KEY,
      rich_menu_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_admin_sessions (
      line_user_id TEXT PRIMARY KEY,
      session_data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  });
}

// 工作者進度／健檢訓練資料表
export function ensureWorkerProgressSchema() {
  return migrateOnce('worker-progress', async () => {
    await ensureSchema(); // 先確保既有資料表（工作者、文件、案件…）已建立
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_worker_progress_steps (
      worker_id BIGINT NOT NULL REFERENCES hr_workers(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL, started_on DATE, completed_on DATE,
      note TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (worker_id, step_key)
    )`);
    await pool.query("ALTER TABLE hr_worker_progress_steps ADD COLUMN IF NOT EXISTS detail TEXT NOT NULL DEFAULT ''");
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_worker_health_training (
      worker_id BIGINT PRIMARY KEY REFERENCES hr_workers(id) ON DELETE CASCADE,
      medical_status TEXT NOT NULL DEFAULT 'not_scheduled',
      training_status TEXT NOT NULL DEFAULT 'not_scheduled',
      updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  });
}
