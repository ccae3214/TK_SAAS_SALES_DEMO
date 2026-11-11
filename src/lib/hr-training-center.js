import pool from '@/lib/db';
import { ensureHrIdentitySchema } from '@/lib/hr-access';

// 訓練中心工作區：老師與證照、課程、開班（訓練／考證／取證日期）、證照批次。
// 訓練中心本身是 hr_members 裡 role='training_center' 的會員，所有資料以 center_id 區分。

let schemaPromise;
export function ensureTrainingCenterSchema() {
  schemaPromise ||= (async () => {
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
    await pool.query('CREATE INDEX IF NOT EXISTS hr_tc_classes_center ON hr_tc_classes(center_id, training_start_date)');
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}
