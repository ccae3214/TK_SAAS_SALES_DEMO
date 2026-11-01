import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashPassword } from '../src/lib/passwords.js';
const pgModule = await import(process.env.PG_MODULE_PATH || 'pg');

const { Pool } = pgModule.default || pgModule;
let rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  const envText = await readFile(resolve(process.cwd(), '.env'), 'utf8');
  const databaseLine = envText.split(/\r?\n/).find(line => line.startsWith('DATABASE_URL='));
  if (!databaseLine) throw new Error('DATABASE_URL is missing from .env');
  rawDatabaseUrl = databaseLine.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
}
const databaseUrl = new URL(rawDatabaseUrl);
if (!process.env.DATABASE_URL && databaseUrl.hostname === 'postgres') databaseUrl.hostname = '127.0.0.1';
const pool = new Pool({ connectionString: databaseUrl.toString(), ssl: false });
const password = 'KlexTest@2026';
const passwordHash = await hashPassword(password);

const agencies = [
  { name: '克雷迅台灣仲介測試帳號', agencyType: 'taiwan', country: '台灣', email: 'test.agency.tw@example.com', role: 'agency' },
  { name: '克雷迅菲律賓仲介測試帳號', agencyType: 'philippines', country: '菲律賓', email: 'test.agency.ph@example.com', role: 'agency' },
];
const workers = Array.from({ length: 5 }, (_, index) => ({
  number: index + 1,
  email: `test.worker${String(index + 1).padStart(2, '0')}@example.com`,
  legacyEmail: index < 3 ? `hr-test-worker${String(index + 1).padStart(2, '0')}@example.com` : null,
  name: `菲律賓測試工人 ${String(index + 1).padStart(2, '0')}（虛構）`,
  jobPreference: ['家庭看護（測試）','家庭看護（測試）','工廠作業員（測試）','工廠作業員（測試）','家庭幫傭（測試）'][index],
}));
const employers = [
  { number: 1, email: 'test.employer01@example.com', name: '家庭看護測試雇主 01（虛構）', employerType: 'home_care' },
  { number: 2, email: 'test.employer02@example.com', name: '家庭看護測試雇主 02（虛構）', employerType: 'home_care' },
  { number: 3, email: 'test.employer03@example.com', name: '工廠測試雇主 01（虛構）', employerType: 'factory' },
  { number: 4, email: 'test.employer04@example.com', name: '工廠測試雇主 02（虛構）', employerType: 'factory' },
  { number: 5, email: 'test.employer05@example.com', name: '家庭幫傭測試雇主 01（虛構）', employerType: 'domestic_helper' },
];

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS hr_agencies (
    id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,agency_type TEXT NOT NULL CHECK (agency_type IN ('taiwan','philippines')),
    country TEXT NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(name,agency_type))`);
  await client.query('ALTER TABLE hr_workers ADD COLUMN IF NOT EXISTS agency_id BIGINT REFERENCES hr_agencies(id)');
  await client.query('ALTER TABLE hr_employers ADD COLUMN IF NOT EXISTS agency_id BIGINT REFERENCES hr_agencies(id)');
  await client.query("ALTER TABLE hr_employers ADD COLUMN IF NOT EXISTS employer_type TEXT NOT NULL DEFAULT 'other'");
  await client.query(`CREATE TABLE IF NOT EXISTS hr_members (
    id BIGSERIAL PRIMARY KEY,email TEXT NOT NULL UNIQUE,line_user_id TEXT UNIQUE,display_name TEXT NOT NULL,password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('worker','employer','agency')),worker_id BIGINT UNIQUE REFERENCES hr_workers(id) ON DELETE CASCADE,
    employer_id BIGINT UNIQUE REFERENCES hr_employers(id) ON DELETE CASCADE,agency_id BIGINT UNIQUE REFERENCES hr_agencies(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((role='worker' AND worker_id IS NOT NULL AND employer_id IS NULL AND agency_id IS NULL) OR
    (role='employer' AND employer_id IS NOT NULL AND worker_id IS NULL AND agency_id IS NULL) OR
    (role='agency' AND agency_id IS NOT NULL AND worker_id IS NULL AND employer_id IS NULL)))`);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS hr_case_requirements_case_name ON hr_case_requirements(case_id,name)');
  const agencyIds = {};
  for (const agency of agencies) {
    const row = await client.query(`INSERT INTO hr_agencies(name,agency_type,country,active)
      VALUES($1,$2,$3,TRUE) ON CONFLICT(name,agency_type) DO UPDATE SET country=EXCLUDED.country,active=TRUE,updated_at=NOW() RETURNING id`,
    [agency.name,agency.agencyType,agency.country]);
    agency.id = Number(row.rows[0].id);
    agencyIds[agency.agencyType] = agency.id;
  }

  const staff = await client.query("SELECT id FROM hr_staff WHERE email='hr-test-staff@example.com' ORDER BY id LIMIT 1");
  const staffId = staff.rows[0]?.id || null;
  const workerIds = [];
  for (const worker of workers) {
    const updated = await client.query(`UPDATE hr_workers SET name=$2,nationality='菲律賓',email=$1,job_preference=$3,
      notes='純測試虛構資料，不對應真實人員。',agency_id=$4,status='active',updated_at=NOW() WHERE email=$1 OR email=$5 RETURNING id`,
    [worker.email,worker.name,worker.jobPreference,agencyIds.philippines,worker.legacyEmail]);
    const result = updated.rowCount ? updated : await client.query(`INSERT INTO hr_workers(name,nationality,email,job_preference,notes,agency_id)
      VALUES($2,'菲律賓',$1,$3,'純測試虛構資料，不對應真實人員。',$4) RETURNING id`,
    [worker.email,worker.name,worker.jobPreference,agencyIds.philippines]);
    worker.id = Number(result.rows[0].id);
    workerIds.push(worker.id);
  }

  const employerIds = [];
  for (const employer of employers) {
    const updated = await client.query(`UPDATE hr_employers SET name=$2,email=$1,employer_type=$3,agency_id=$4,
      contact_name='虛構測試聯絡人',phone='',address='測試地址（非實際地址）',notes='純測試虛構資料。',status='active',updated_at=NOW()
      WHERE email=$1 OR email='hr-test-employer@example.com' RETURNING id`, [employer.email,employer.name,employer.employerType,agencyIds.taiwan]);
    const result = updated.rowCount ? updated : await client.query(`INSERT INTO hr_employers(name,email,employer_type,agency_id,contact_name,phone,address,notes)
      VALUES($2,$1,$3,$4,'虛構測試聯絡人','','測試地址（非實際地址）','純測試虛構資料。') RETURNING id`,
    [employer.email,employer.name,employer.employerType,agencyIds.taiwan]);
    employer.id = Number(result.rows[0].id);
    employerIds.push(employer.id);
  }

  const updatedFirst = await client.query(`UPDATE hr_cases SET employer_id=$1,worker_id=$2,assigned_staff_id=$3,job_type=$4,
    status='open',notes='純測試案件，資料均為虛構。',updated_at=NOW() WHERE case_number='HR-TEST-20261030-01' RETURNING id`,
  [employerIds[0],workerIds[0],staffId,workers[0].jobPreference]);
  if (!updatedFirst.rowCount) await client.query(`INSERT INTO hr_cases(case_number,employer_id,worker_id,assigned_staff_id,job_type,notes)
    VALUES('HR-TEST-ROLE-01',$1,$2,$3,$4,'純測試案件，資料均為虛構。')`, [employerIds[0],workerIds[0],staffId,workers[0].jobPreference]);

  const updatedSecond = await client.query(`UPDATE hr_cases SET employer_id=$1,worker_id=$2,assigned_staff_id=$3,job_type=$4,
    status='on_hold',notes='純測試暫停案件，資料均為虛構。',updated_at=NOW() WHERE case_number='HR-TEST-20261030-02' RETURNING id`,
  [employerIds[2],workerIds[1],staffId,workers[1].jobPreference]);
  if (!updatedSecond.rowCount) await client.query(`INSERT INTO hr_cases(case_number,employer_id,worker_id,assigned_staff_id,job_type,status,notes)
    VALUES('HR-TEST-ROLE-02',$1,$2,$3,$4,'on_hold','純測試暫停案件，資料均為虛構。')`, [employerIds[2],workerIds[1],staffId,workers[1].jobPreference]);

  for (let index = 2; index < 4; index++) {
    const caseNumber = `HR-TEST-ROLE-${String(index + 1).padStart(2,'0')}`;
    await client.query(`INSERT INTO hr_cases(case_number,employer_id,worker_id,assigned_staff_id,job_type,status,notes)
      VALUES($1,$2,$3,$4,$5,'open','純測試案件，資料均為虛構。') ON CONFLICT(case_number) DO UPDATE SET
      employer_id=EXCLUDED.employer_id,worker_id=EXCLUDED.worker_id,assigned_staff_id=EXCLUDED.assigned_staff_id,
      job_type=EXCLUDED.job_type,status='open',updated_at=NOW()`,
    [caseNumber,employerIds[index],workerIds[index],staffId,workers[index].jobPreference]);
  }

  await client.query(`INSERT INTO hr_case_requirements(case_id,name,required,entry_gate)
    SELECT c.id,req.name,TRUE,TRUE FROM hr_cases c CROSS JOIN (VALUES('護照資料頁'),('PSA 出生證明')) req(name)
    WHERE c.case_number LIKE 'HR-TEST-ROLE-%' OR c.case_number LIKE 'HR-TEST-20261030-%'
    ON CONFLICT(case_id,name) DO NOTHING`);
  await client.query(`INSERT INTO hr_case_activity(case_id,actor_email,action,detail)
    SELECT id,'test-run@example.com','建立測試案件',case_number FROM hr_cases
    WHERE case_number LIKE 'HR-TEST-ROLE-%' AND NOT EXISTS(SELECT 1 FROM hr_case_activity a WHERE a.case_id=hr_cases.id AND a.action='建立測試案件')`);

  for (const agency of agencies) {
    await client.query(`INSERT INTO hr_members(email,display_name,password_hash,role,agency_id,active)
      VALUES($1,$2,$3,'agency',$4,TRUE) ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name,
      password_hash=EXCLUDED.password_hash,role='agency',agency_id=EXCLUDED.agency_id,active=TRUE,updated_at=NOW()`,
    [agency.email,agency.name,passwordHash,agency.id]);
  }
  for (const worker of workers) {
    await client.query(`INSERT INTO hr_members(email,display_name,password_hash,role,worker_id,active)
      VALUES($1,$2,$3,'worker',$4,TRUE) ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name,
      password_hash=EXCLUDED.password_hash,role='worker',worker_id=EXCLUDED.worker_id,active=TRUE,updated_at=NOW()`,
    [worker.email,worker.name,passwordHash,worker.id]);
  }
  for (const employer of employers) {
    await client.query(`INSERT INTO hr_members(email,display_name,password_hash,role,employer_id,active)
      VALUES($1,$2,$3,'employer',$4,TRUE) ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name,
      password_hash=EXCLUDED.password_hash,role='employer',employer_id=EXCLUDED.employer_id,active=TRUE,updated_at=NOW()`,
    [employer.email,employer.name,passwordHash,employer.id]);
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ agencies: agencies.length, workers: workers.length, employers: employers.length, memberAccounts: agencies.length + workers.length + employers.length, cases: 4, password: 'KlexTest@2026' }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
