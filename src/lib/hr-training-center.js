import pool from '@/lib/db';
import { ensureHrIdentitySchema } from '@/lib/hr-access';
import { migrateOnce } from './migrate-once.js';

// 訓練中心工作區：老師與證照、課程、開班（訓練／考證／取證日期）、證照批次。
// 訓練中心本身是 hr_members 裡 role='training_center' 的會員，所有資料以 center_id 區分。

export function ensureTrainingCenterSchema() {
  return migrateOnce('training-center', async () => {
    await ensureHrIdentitySchema();
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_certifications (
      id BIGSERIAL PRIMARY KEY,
      center_id BIGINT NOT NULL REFERENCES hr_members(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(center_id, name)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_teachers (
      id BIGSERIAL PRIMARY KEY,
      center_id BIGINT NOT NULL REFERENCES hr_members(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(center_id, name)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_teacher_certifications (
      id BIGSERIAL PRIMARY KEY,
      teacher_id BIGINT NOT NULL REFERENCES hr_tc_teachers(id) ON DELETE CASCADE,
      certification_id BIGINT NOT NULL REFERENCES hr_tc_certifications(id) ON DELETE CASCADE,
      certificate_no TEXT NOT NULL DEFAULT '',
      issued_date DATE,
      expires_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(teacher_id, certification_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_courses (
      id BIGSERIAL PRIMARY KEY,
      center_id BIGINT NOT NULL REFERENCES hr_members(id) ON DELETE CASCADE,
      certification_id BIGINT NOT NULL REFERENCES hr_tc_certifications(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      hours INTEGER,
      description TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(center_id, certification_id, name)
    )`);
    // 課程費用（原幣金額）與幣別；舊資料沒有費用就是 NULL，畫面顯示「—」。
    await pool.query('ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS fee NUMERIC(12,2)');
    await pool.query("ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PHP'");
    // 課程單元（課程內容大綱）：每門課程由多個單元組成；name 是中文單元名稱，name_en／topics_en 供英文介面顯示。
    // examples 每行一句，格式「中文 | 拼音 | 英文」。
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_course_units (
      id BIGSERIAL PRIMARY KEY,
      center_id BIGINT NOT NULL REFERENCES hr_members(id) ON DELETE CASCADE,
      course_id BIGINT NOT NULL REFERENCES hr_tc_courses(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '',
      hours INTEGER,
      topics TEXT NOT NULL DEFAULT '',
      topics_en TEXT NOT NULL DEFAULT '',
      examples TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(course_id, name)
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_tc_course_units_course ON hr_tc_course_units(course_id, position)');
    // 學習內容：詞彙與對話（每行「中文 | 拼音 | 英文」，對話行首可加 A：／B：）。
    await pool.query("ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS vocabulary TEXT NOT NULL DEFAULT ''");
    await pool.query("ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS dialogue TEXT NOT NULL DEFAULT ''");
    // 工人的學習進度：讀完（標記）的單元；單元或工人刪除時一併刪除。
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_unit_progress (
      id BIGSERIAL PRIMARY KEY,
      worker_id BIGINT NOT NULL REFERENCES hr_workers(id) ON DELETE CASCADE,
      unit_id BIGINT NOT NULL REFERENCES hr_tc_course_units(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(worker_id, unit_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_classes (
      id BIGSERIAL PRIMARY KEY,
      center_id BIGINT NOT NULL REFERENCES hr_members(id) ON DELETE CASCADE,
      certification_id BIGINT NOT NULL REFERENCES hr_tc_certifications(id) ON DELETE RESTRICT,
      course_id BIGINT NOT NULL REFERENCES hr_tc_courses(id) ON DELETE RESTRICT,
      teacher_id BIGINT REFERENCES hr_tc_teachers(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      training_start_date DATE NOT NULL,
      training_end_date DATE NOT NULL,
      exam_date DATE,
      exam_location TEXT NOT NULL DEFAULT '',
      certificate_issue_date DATE,
      capacity INTEGER,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(center_id, name)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_batches (
      id BIGSERIAL PRIMARY KEY,
      class_id BIGINT NOT NULL REFERENCES hr_tc_classes(id) ON DELETE CASCADE,
      batch_no TEXT NOT NULL,
      applied_date DATE,
      student_count INTEGER,
      status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','submitted','issued')),
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(class_id, batch_no)
    )`);
    // 工人報名班別：工人頁面的訓練課程與日期提醒由此關聯產生。
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_enrollments (
      id BIGSERIAL PRIMARY KEY,
      class_id BIGINT NOT NULL REFERENCES hr_tc_classes(id) ON DELETE CASCADE,
      worker_id BIGINT NOT NULL REFERENCES hr_workers(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(class_id, worker_id)
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_tc_enrollments_worker ON hr_tc_enrollments(worker_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS hr_tc_classes_center ON hr_tc_classes(center_id, training_start_date)');
  });
}
