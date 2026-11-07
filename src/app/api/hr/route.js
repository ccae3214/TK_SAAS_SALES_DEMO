import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { ensureHrIdentitySchema, getAdminEmails, getAdminLineUserIds, getHrPrincipal, HR_ROLES } from '@/lib/hr-access';
import { hashPassword } from '@/lib/passwords';
import { WORKER_DOCUMENT_NAMES, ENTRY_GATE_DOCUMENTS, insertCaseRequirements, syncAutoRequirements } from '@/lib/hr-requirements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CASE_STATUSES = new Set(['open', 'on_hold', 'closed']);
const EMPLOYER_TYPES = new Set(['home_care', 'factory', 'domestic_helper', 'other']);
const TASK_CATEGORIES = new Set(['document', 'medical', 'training', 'other']);
const TASK_STATUSES = new Set(['todo', 'in_progress', 'done', 'blocked']);
const MEDICAL_STATUSES = new Set(['not_scheduled', 'scheduled', 'in_progress', 'passed', 'retest', 'failed']);
const TRAINING_STATUSES = new Set(['not_scheduled', 'scheduled', 'in_progress', 'completed']);
const APPLICATION_STEPS = [
  ['match_date','配工／雇主面試日期'],['passport','護照確認'],['document_arrival','文件到達 D/C'],
  ['personal_documents','個人文件和證件 P/D'],['pdos','PDOS 簽立文件'],['medical','體檢 MED'],
  ['accr_in','ACCR 引進權入件'],['accr_out','ACCR 引進權出件'],['umid','UMID'],['training','訓練（60 日）'],
  ['owwa','OWWA（7 日）'],['visa','VISA（7 日）'],['oec','OEC（4 日）'],['expected_entry','預定入境'],['actual_entry','實際入境'],
];
let schemaPromise;

export async function ensureSchema() {
  if (!schemaPromise) schemaPromise = (async () => {
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
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_case_requirements (
      id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,
      name TEXT NOT NULL, required BOOLEAN NOT NULL DEFAULT TRUE, entry_gate BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing','submitted','approved','returned')),
      review_reason TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query("ALTER TABLE hr_case_requirements ADD COLUMN IF NOT EXISTS applicability TEXT NOT NULL DEFAULT ''");
    await pool.query('ALTER TABLE hr_case_requirements ADD COLUMN IF NOT EXISTS applicable BOOLEAN NOT NULL DEFAULT TRUE');
    // auto = 依履歷自動判斷（履歷更新時會重新套用）；manual = 仲介手動調整過，之後不覆寫。既有資料一律視為 manual。
    await pool.query("ALTER TABLE hr_case_requirements ADD COLUMN IF NOT EXISTS applicability_source TEXT NOT NULL DEFAULT 'manual'");
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_document_submissions (
      id BIGSERIAL PRIMARY KEY, requirement_id BIGINT NOT NULL REFERENCES hr_case_requirements(id) ON DELETE CASCADE,
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
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS hr_case_requirements_case_name ON hr_case_requirements(case_id,name)');
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
    await pool.query("UPDATE hr_case_requirements SET name='新護照' WHERE name='護照資料頁' AND NOT EXISTS (SELECT 1 FROM hr_case_requirements other WHERE other.case_id=hr_case_requirements.case_id AND other.name='新護照')");
    await pool.query("UPDATE hr_case_requirements SET name='PSA出生證明（附收據）' WHERE name='PSA 出生證明' AND NOT EXISTS (SELECT 1 FROM hr_case_requirements other WHERE other.case_id=hr_case_requirements.case_id AND other.name='PSA出生證明（附收據）')");
    // 補齊缺少的文件列（例如之後新增了文件種類）；新列依該工作者履歷自動判斷適用性。
    const incompleteCases = await pool.query(`SELECT c.id,w.resume_profile FROM hr_cases c JOIN hr_workers w ON w.id=c.worker_id
      WHERE (SELECT count(*) FROM hr_case_requirements r WHERE r.case_id=c.id AND r.name=ANY($1::text[]))<$2`, [WORKER_DOCUMENT_NAMES, WORKER_DOCUMENT_NAMES.length]);
    for (const row of incompleteCases.rows) await insertCaseRequirements(pool, row.id, row.resume_profile);
    // 修正前置文件：只有「新護照」與「PSA出生證明（附收據）」是前置文件。
    // 舊版把所有無條件文件（含「體檢 Medical」）都設成前置，會造成要先核准體檢文件才能排體檢。
    const fixedGates = await pool.query(`UPDATE hr_case_requirements SET entry_gate=(required AND applicable AND name=ANY($1::text[])),updated_at=NOW()
      WHERE name=ANY($2::text[]) AND entry_gate IS DISTINCT FROM (required AND applicable AND name=ANY($1::text[])) RETURNING case_id`, [ENTRY_GATE_DOCUMENTS, WORKER_DOCUMENT_NAMES]);
    for (const caseId of new Set(fixedGates.rows.map(row => Number(row.case_id)))) await refreshCaseStage(caseId);
    await pool.query(`INSERT INTO hr_application_steps(case_id,step_key,label)
      SELECT c.id,s.step_key,s.label FROM hr_cases c CROSS JOIN (VALUES ${APPLICATION_STEPS.map((_,index)=>`($${index*2+1},$${index*2+2})`).join(',')}) AS s(step_key,label)
      ON CONFLICT(case_id,step_key) DO UPDATE SET label=EXCLUDED.label`, APPLICATION_STEPS.flat());
    await pool.query('CREATE INDEX IF NOT EXISTS hr_cases_status_updated ON hr_cases(status, updated_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS hr_tasks_case_status ON hr_case_tasks(case_id, status, due_date)');
    await ensureHrIdentitySchema();
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const WORKER_JOB_PREFERENCES = new Set(['家庭幫傭','家庭看護','工廠技術工','農工','機構看護工']);
const WORKER_RESUME_FIELDS = {
  referenceNo: 80, birthDate: 30, gender: 40, birthplace: 120, address: 300, height: 20, weight: 20,
  skinComplexion: 80, maritalStatus: 50, religion: 80, hobby: 300,
  spouseName: 120, spouseOccupation: 120, spouseAge: 20, numberOfChildren: 20, childrenAges: 100,
  fatherName: 120, fatherOccupation: 120, fatherBirthDate: 30, motherName: 120, motherOccupation: 120, motherBirthDate: 30,
  brotherCount: 20, brotherAges: 100, sisterCount: 20, sisterAges: 100, familyRank: 40, caregiverDuringOverseas: 200,
  educationLevels: 200, education: 2000, coursesCompleted: 1000, languageOptions: 200, languages: 2000, cookingSkills: 700, applianceOptions: 300, applianceSkills: 700, childcareSkills: 1000,
  experienceNewborn: 1500, experienceChildren: 1500, experienceElderly: 1500, experienceDisabled: 1500,
  hasTattoo: 20, smokes: 20, drinksAlcohol: 20, petExperience: 500, willingToWorkWithPets: 20, seriousIllness: 20,
  operationLast12Months: 20, allergies: 20, dayOffChores: 20, finishChoresBeforeOuting: 20, returnBy8PM: 20,
  makeupAtWork: 20, workOnDaysOff: 20, workedAbroad: 20, overseasWorkDetails: 1000, employmentHistory: 5000, remarks: 2000,
};
function cleanWorkerResumeProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const profile=Object.fromEntries(Object.entries(WORKER_RESUME_FIELDS).map(([field, limit]) => [field, clean(value[field], limit)]));
  for(const field of ['overseasExperiences','employmentExperiences'])profile[field]=Array.isArray(value[field])?value[field].slice(0,30).filter(row=>row&&typeof row==='object').map(row=>({workplace:clean(row.workplace,180),period:clean(row.period,100),title:clean(row.title,120),content:clean(row.content,4000)})):[];
  const photo=typeof value.photoDataUrl==='string'?value.photoDataUrl:'';
  if(Object.prototype.hasOwnProperty.call(value,'photoDataUrl')&&!photo)profile.photoDataUrl='';
  else if(photo.length<=2100000&&/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))profile.photoDataUrl=photo;
  return profile;
}
function workerGenderCode(value) {
  const gender=String(value||'').trim().toLowerCase();
  if(['male','m','男','男性'].includes(gender))return 'M';
  if(['female','f','女','女性'].includes(gender))return 'F';
  return '';
}
function workerReferenceCode(jobPreference, gender, workerId) {
  const category=jobPreference==='家庭看護'||jobPreference==='家庭幫傭'?'CT':jobPreference==='工廠技術工'?'SW':jobPreference==='農工'?'FM':jobPreference==='機構看護工'?'CG':'';
  const sex=workerGenderCode(gender);
  if(!category||!sex||!validId(workerId))return '';
  const sequence=String(workerId).padStart(3,'0');
  const number=category==='CT'?sequence:`${String(new Date().getFullYear()).slice(-2)}${sequence}`;
  return `${category}${sex}-${number}`;
}
function workerProfileWithReference(value, jobPreference, workerId) {
  const profile=cleanWorkerResumeProfile(value);
  const referenceNo=workerReferenceCode(jobPreference,profile.gender,workerId);
  if(referenceNo&&!profile.referenceNo)profile.referenceNo=referenceNo;
  return profile;
}
const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
const validDate = value => {
  if (!value) return true;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) {
      if (value) allowed.add(new URL(value).origin);
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1);
    if (host) allowed.add(`${protocol.split(',')[0].trim()}://${host}`);
    return allowed.has(new URL(origin).origin);
  }
  catch { return false; }
}

async function recordActivity(caseId, actor, action, detail) {
  await pool.query('INSERT INTO hr_case_activity(case_id, actor_email, action, detail) VALUES($1,$2,$3,$4)', [caseId, actor, action, detail]);
}

async function refreshCaseStage(caseId) {
  const [state] = await query(`SELECT c.medical_status,c.training_status,
    EXISTS(SELECT 1 FROM hr_case_requirements r WHERE r.case_id=c.id AND r.entry_gate AND r.applicable AND r.status<>'approved') AS gate_closed,
    EXISTS(SELECT 1 FROM hr_case_requirements r WHERE r.case_id=c.id AND r.required AND r.applicable AND r.status<>'approved') AS documents_open
    FROM hr_cases c WHERE c.id=$1`, [caseId]);
  if (!state) return;
  const stage = state.gate_closed ? 'intake'
    : state.documents_open ? 'documents'
    : state.medical_status !== 'passed' || state.training_status !== 'completed' ? 'medical_training'
    : 'completed';
  await query('UPDATE hr_cases SET stage=$2,updated_at=NOW() WHERE id=$1', [caseId, stage]);
}

// 履歷變更後，重新套用「自動判斷」的文件適用性（仲介手動調整過的不會被覆寫）。
async function resyncRequirements(workerId) {
  for (const caseId of await syncAutoRequirements(pool, workerId)) await refreshCaseStage(caseId);
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    await ensureSchema();
    const principal = await getHrPrincipal(session);
    if (!principal) {
      const agencies=await query('SELECT id,name,agency_type,country,active FROM hr_agencies WHERE active=TRUE ORDER BY agency_type,name');
      return NextResponse.json({ role: 'pending', pendingApproval: false, requestedRole: null, requestedAgencyId: null, agencies, actor: { name: session.user.name || session.user.email || 'LINE 會員', email: session.user.email || '' } });
    }
    if (!principal.role) {
      const agencies=await query('SELECT id,name,agency_type,country,active FROM hr_agencies WHERE active=TRUE ORDER BY agency_type,name');
      return NextResponse.json({ role: 'pending', pendingApproval: true, requestedRole: principal.requested_role || null, requestedAgencyId: principal.requested_agency_id || null, requestedAgencyName: principal.requested_agency_name || null, requestedAgencyType: principal.requested_agency_type || null, agencies, actor: { name: principal.name || session.user.name || '會員', email: principal.email || '' } });
    }
    const [allEmployers, allWorkers, allCases, allTasks, allRequirements, allSubmissions, allActivity, agencies, members, allApplicationSteps, allJobOrders, allOrderAgencies, allRoutes, allCandidates, allAgencyContacts] = await Promise.all([
      query('SELECT * FROM hr_employers ORDER BY status, name'),
      query('SELECT * FROM hr_workers ORDER BY status, name'),
      query(`SELECT c.*, e.name AS employer_name, e.agency_id AS employer_agency_id, e.employer_type,
        (SELECT m.display_name FROM hr_job_order_candidates jc JOIN hr_job_order_routes jr ON jr.id=jc.route_id JOIN hr_job_order_agencies ja ON ja.id=jr.order_agency_id JOIN hr_members m ON m.id=ja.broker_member_id WHERE jc.case_id=c.id ORDER BY jc.id LIMIT 1) AS broker_name,
        w.name AS worker_name, w.agency_id AS worker_agency_id, assigned_member.display_name AS assigned_member_name,
        COUNT(t.id)::int AS task_count, COUNT(t.id) FILTER (WHERE t.status <> 'done')::int AS open_task_count
        FROM hr_cases c JOIN hr_employers e ON e.id=c.employer_id JOIN hr_workers w ON w.id=c.worker_id
        LEFT JOIN hr_members assigned_member ON assigned_member.id=c.assigned_member_id LEFT JOIN hr_case_tasks t ON t.case_id=c.id
        GROUP BY c.id,e.name,e.agency_id,e.employer_type,w.name,w.agency_id,assigned_member.display_name ORDER BY c.updated_at DESC`),
      query(`SELECT t.*, c.case_number, w.name AS worker_name FROM hr_case_tasks t
        JOIN hr_cases c ON c.id=t.case_id JOIN hr_workers w ON w.id=c.worker_id
        ORDER BY CASE WHEN t.status='done' THEN 1 ELSE 0 END, t.due_date NULLS LAST, t.updated_at DESC`),
      query(`SELECT r.*, c.case_number, w.name AS worker_name, e.name AS employer_name,
        (SELECT s.id FROM hr_document_submissions s WHERE s.requirement_id=r.id ORDER BY s.version_number DESC LIMIT 1) AS latest_submission_id,
        (SELECT s.filename FROM hr_document_submissions s WHERE s.requirement_id=r.id ORDER BY s.version_number DESC LIMIT 1) AS latest_filename,
        (SELECT s.created_at FROM hr_document_submissions s WHERE s.requirement_id=r.id ORDER BY s.version_number DESC LIMIT 1) AS latest_submission_at
        FROM hr_case_requirements r JOIN hr_cases c ON c.id=r.case_id
        JOIN hr_workers w ON w.id=c.worker_id JOIN hr_employers e ON e.id=c.employer_id
        ORDER BY CASE r.status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 WHEN 'missing' THEN 2 ELSE 3 END, r.updated_at DESC`),
      query(`SELECT s.*, r.name AS requirement_name, r.case_id, c.case_number, w.name AS worker_name,
        v.decision, v.reason AS review_reason, v.reviewer, v.created_at AS reviewed_at,
        f.original_filename,f.size_bytes,f.content_type
        FROM hr_document_submissions s JOIN hr_case_requirements r ON r.id=s.requirement_id
        JOIN hr_cases c ON c.id=r.case_id JOIN hr_workers w ON w.id=c.worker_id
        LEFT JOIN hr_document_reviews v ON v.submission_id=s.id LEFT JOIN hr_document_files f ON f.submission_id=s.id
        ORDER BY s.created_at DESC LIMIT 200`),
      query(`SELECT a.*, c.case_number FROM hr_case_activity a JOIN hr_cases c ON c.id=a.case_id ORDER BY a.created_at DESC LIMIT 100`),
      query('SELECT * FROM hr_agencies ORDER BY agency_type,name'),
      query(`SELECT m.id,m.email,m.line_user_id,m.display_name,m.role,m.requested_role,m.requested_agency_id,requested_agency.name AS requested_agency_name,requested_agency.agency_type AS requested_agency_type,m.admin_scope,m.worker_id,m.employer_id,m.agency_id,m.active,m.created_at,
        a.name AS agency_name,a.agency_type,w.name AS worker_name,w.agency_id AS worker_agency_id,worker_agency.name AS worker_agency_name,
        e.name AS employer_name,e.agency_id AS employer_agency_id,employer_agency.name AS employer_agency_name,
        COALESCE((SELECT array_agg(DISTINCT case_taiwan_agency.name ORDER BY case_taiwan_agency.name)
          FROM hr_cases linked_case JOIN hr_workers case_worker ON case_worker.id=linked_case.worker_id
          JOIN hr_employers case_employer ON case_employer.id=linked_case.employer_id
          JOIN hr_agencies case_taiwan_agency ON case_taiwan_agency.id=case_employer.agency_id
          WHERE case_worker.agency_id=m.agency_id AND m.role='agency'),ARRAY[]::text[]) AS related_taiwan_agencies
        FROM hr_members m LEFT JOIN hr_agencies a ON a.id=m.agency_id
        LEFT JOIN hr_agencies requested_agency ON requested_agency.id=m.requested_agency_id
        LEFT JOIN hr_workers w ON w.id=m.worker_id LEFT JOIN hr_agencies worker_agency ON worker_agency.id=w.agency_id
        LEFT JOIN hr_employers e ON e.id=m.employer_id LEFT JOIN hr_agencies employer_agency ON employer_agency.id=e.agency_id
        ORDER BY m.role NULLS FIRST,m.created_at DESC,m.display_name`),
      query('SELECT * FROM hr_application_steps ORDER BY case_id,id'),
      query(`SELECT o.*,e.name employer_name,e.employer_type,e.agency_id employer_agency_id,ea.name employer_agency_name
        FROM hr_job_orders o JOIN hr_employers e ON e.id=o.employer_id LEFT JOIN hr_agencies ea ON ea.id=e.agency_id ORDER BY o.created_at DESC`),
      query(`SELECT oa.*,a.name taiwan_agency_name,m.id broker_id,m.display_name broker_name FROM hr_job_order_agencies oa JOIN hr_agencies a ON a.id=oa.taiwan_agency_id LEFT JOIN hr_members m ON m.id=oa.broker_member_id AND m.role='agency' AND m.agency_id=oa.taiwan_agency_id AND m.active=TRUE`),
      query(`SELECT r.*,a.name philippines_agency_name,oa.job_order_id,oa.taiwan_agency_id FROM hr_job_order_routes r JOIN hr_agencies a ON a.id=r.philippines_agency_id JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id`),
      query(`SELECT c.*,w.name worker_name,w.nationality,w.job_preference,w.agency_id worker_agency_id,r.philippines_agency_id,oa.job_order_id,oa.taiwan_agency_id,ca.name philippines_agency_name FROM hr_job_order_candidates c JOIN hr_workers w ON w.id=c.worker_id JOIN hr_job_order_routes r ON r.id=c.route_id JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id JOIN hr_agencies ca ON ca.id=r.philippines_agency_id`),
      query(`SELECT m.id,m.display_name,m.agency_id,a.name AS agency_name FROM hr_members m JOIN hr_agencies a ON a.id=m.agency_id WHERE m.role='agency' AND m.active=TRUE AND a.active=TRUE AND a.agency_type='taiwan' ORDER BY a.name,m.display_name`),
    ]);
    let employers = allEmployers;
    let workers = allWorkers;
    let cases = allCases;
    let visibleAgencies = agencies;
    let visibleMembers = members;
    let jobOrders = allJobOrders;
    let orderAgencies = allOrderAgencies;
    let orderRoutes = allRoutes;
    let orderCandidates = allCandidates;
    let agencyContacts = principal.role === 'admin' || principal.role === 'employer' ? allAgencyContacts : principal.role === 'agency' && principal.agency_type === 'taiwan' ? allAgencyContacts.filter(item=>Number(item.agency_id)===Number(principal.agency_id)) : [];
    let employerPrivateCaseIds = null;
    let employerAvailableWorkers = [];
    if (principal.role === 'worker') {
      cases = allCases.filter(item => Number(item.worker_id) === Number(principal.worker_id));
      const employerIds = new Set(cases.map(item => Number(item.employer_id)));
      workers = allWorkers.filter(item => Number(item.id) === Number(principal.worker_id));
      employers = allEmployers.filter(item => employerIds.has(Number(item.id)));
      visibleAgencies = agencies.filter(item => Number(item.id) === Number(workers[0]?.agency_id));
      visibleMembers = [];
      jobOrders = [];
      orderAgencies = [];
      orderRoutes = [];
      orderCandidates = [];
    } else if (principal.role === 'employer') {
      const ownCases = allCases.filter(item => Number(item.employer_id) === Number(principal.employer_id));
      const ownWorkerIds = new Set(ownCases.map(item => Number(item.worker_id)));
      const employerAgencyId = Number(allEmployers.find(item => Number(item.id) === Number(principal.employer_id))?.agency_id || 0);
      employerPrivateCaseIds = new Set(ownCases.map(item => Number(item.id)));
      cases = ownCases;
      const employerOrderIds = new Set(allJobOrders.filter(row => Number(row.employer_id)===Number(principal.employer_id)).map(row=>Number(row.id)));
      const employerCandidateWorkerIds = new Set(allCandidates.filter(row=>employerOrderIds.has(Number(row.job_order_id))).map(row=>Number(row.worker_id)));
      const activePhilippinesAgencyIds = new Set(agencies.filter(item=>item.active&&item.agency_type==='philippines').map(item=>Number(item.id)));
      const workersWithCases = new Set(allCases.map(item=>Number(item.worker_id)));
      employerAvailableWorkers = employerAgencyId ? allWorkers.filter(item=>item.status==='active'&&activePhilippinesAgencyIds.has(Number(item.agency_id))&&!workersWithCases.has(Number(item.id))) : [];
      workers = allWorkers.filter(item => ownWorkerIds.has(Number(item.id)) || employerCandidateWorkerIds.has(Number(item.id)));
      employers = allEmployers.filter(item => Number(item.id) === Number(principal.employer_id));
      const relatedAgencyIds = new Set(workers.map(item => Number(item.agency_id)).filter(Boolean));
      employerAvailableWorkers.forEach(item=>{if(item.agency_id)relatedAgencyIds.add(Number(item.agency_id));});
      if (employers[0]?.agency_id) relatedAgencyIds.add(Number(employers[0].agency_id));
      visibleAgencies = agencies.filter(item => (item.active && item.agency_type === 'taiwan') || relatedAgencyIds.has(Number(item.id)));
      visibleMembers = [];
      const orderIds = employerOrderIds;
      jobOrders = allJobOrders.filter(row => orderIds.has(Number(row.id)));
      orderAgencies = allOrderAgencies.filter(row => orderIds.has(Number(row.job_order_id)));
      const orderAgencyIds = new Set(orderAgencies.map(row => Number(row.id)));
      orderRoutes = allRoutes.filter(row => orderAgencyIds.has(Number(row.order_agency_id)));
      const routeIds = new Set(orderRoutes.map(row => Number(row.id)));
      orderCandidates = allCandidates.filter(row => routeIds.has(Number(row.route_id)));
    } else if (principal.role === 'agency') {
      const assignedWorkers = allWorkers.filter(item => Number(item.agency_id) === Number(principal.agency_id));
      const assignedWorkerIds = new Set(assignedWorkers.map(item => Number(item.id)));
      const assignedEmployerIds = new Set(allEmployers.filter(item => Number(item.agency_id) === Number(principal.agency_id)).map(item => Number(item.id)));
      const linkedCaseIds = new Set(allCandidates.filter(row => row.case_id && Number(row.taiwan_agency_id) === Number(principal.agency_id)).map(row => Number(row.case_id)));
      cases = allCases.filter(item => assignedWorkerIds.has(Number(item.worker_id)) || assignedEmployerIds.has(Number(item.employer_id)) || linkedCaseIds.has(Number(item.id)));
      const relatedWorkerIds = new Set([...assignedWorkerIds, ...cases.map(item => Number(item.worker_id)).filter(Boolean)]);
      const relatedEmployerIds = new Set([...assignedEmployerIds, ...cases.map(item => Number(item.employer_id)).filter(Boolean)]);
      workers = allWorkers.filter(item => relatedWorkerIds.has(Number(item.id)));
      employers = allEmployers.filter(item => relatedEmployerIds.has(Number(item.id)));
      const relatedAgencyIds = new Set([Number(principal.agency_id), ...cases.flatMap(item => [Number(item.employer_agency_id), Number(item.worker_agency_id)]).filter(Boolean)]);
      visibleAgencies = agencies.filter(item => relatedAgencyIds.has(Number(item.id)));
      visibleMembers = principal.is_agency_admin ? members.filter(item => Number(item.agency_id||item.worker_agency_id||item.employer_agency_id) === Number(principal.agency_id)) : [];
      if (principal.agency_type === 'taiwan') {
        const orderAgencyRows = allOrderAgencies.filter(row => Number(row.taiwan_agency_id) === Number(principal.agency_id));
        const dispatchIds = new Set(orderAgencyRows.map(row => Number(row.id)));
        const orderIds = new Set(orderAgencyRows.map(row => Number(row.job_order_id)));
        jobOrders = allJobOrders.filter(row => orderIds.has(Number(row.id)));
        orderAgencies = orderAgencyRows;
        orderRoutes = allRoutes.filter(row => dispatchIds.has(Number(row.order_agency_id)));
        const routeIds = new Set(orderRoutes.map(row => Number(row.id)));
        orderCandidates = allCandidates.filter(row => routeIds.has(Number(row.route_id)));
      } else {
        const routeIds = new Set(allRoutes.filter(row => Number(row.philippines_agency_id) === Number(principal.agency_id)).map(row => Number(row.id)));
        orderRoutes = allRoutes.filter(row => routeIds.has(Number(row.id)));
        const dispatchIds = new Set(orderRoutes.map(row => Number(row.order_agency_id)));
        orderAgencies = allOrderAgencies.filter(row => dispatchIds.has(Number(row.id)));
        const orderIds = new Set(orderAgencies.map(row => Number(row.job_order_id)));
        jobOrders = allJobOrders.filter(row => orderIds.has(Number(row.id)));
        orderCandidates = allCandidates.filter(row => routeIds.has(Number(row.route_id)));
      }
    } else if (principal.role === 'training_center') {
      employers = [];
      workers = [];
      cases = [];
      visibleAgencies = [];
      visibleMembers = [];
      jobOrders = [];
      orderAgencies = [];
      orderRoutes = [];
      orderCandidates = [];
      agencyContacts = [];
    }
    const caseIds = new Set(cases.map(item => Number(item.id)));
    const privateCaseIds = employerPrivateCaseIds || caseIds;
    const tasks = allTasks.filter(item => privateCaseIds.has(Number(item.case_id)));
    const requirements = allRequirements.filter(item => privateCaseIds.has(Number(item.case_id)));
    const submissions = allSubmissions.filter(item => privateCaseIds.has(Number(item.case_id)));
    const applicationSteps = allApplicationSteps.filter(item => caseIds.has(Number(item.case_id)));
    const relatedActivity = allActivity.filter(item => privateCaseIds.has(Number(item.case_id)));
    const activity = principal.role === 'admin' ? relatedActivity : relatedActivity.map(({ actor_email, ...item }) => item);
    const counts = {
      open_cases: cases.filter(item => item.status === 'open').length,
      on_hold_cases: cases.filter(item => item.status === 'on_hold').length,
      closed_cases: cases.filter(item => item.status === 'closed').length,
      employers: employers.length, workers: workers.length,
      pending_tasks: tasks.filter(item => item.status !== 'done').length,
      pending_documents: requirements.filter(item => item.status === 'submitted').length,
    };
    workers = workers.map(item=>({...item,resume_profile:Object.fromEntries(Object.entries(item.resume_profile||{}).filter(([key])=>key!=='photoDataUrl'))}));
    employerAvailableWorkers = employerAvailableWorkers.map(item=>({...item,resume_profile:Object.fromEntries(Object.entries(item.resume_profile||{}).filter(([key])=>key!=='photoDataUrl'))}));
    const protectedMembers=visibleMembers.map(member=>({...member,protected_admin:
      ['system','agency'].includes(member.admin_scope)
      ||getAdminEmails().includes(String(member.email||'').trim().toLowerCase())
      ||getAdminLineUserIds().includes(member.line_user_id)}));
    return NextResponse.json({ role: principal.role, adminScope: principal.admin_scope || (principal.is_agency_admin ? 'agency' : null), isAgencyAdmin: !!principal.is_agency_admin, agencyType: principal.agency_type || null, agencyId: principal.agency_id || null, roleName: principal.role === 'admin' ? '系統管理者' : principal.is_agency_admin ? '仲介管理者' : ({ worker:'工作者', employer:'雇主', agency:'仲介', training_center:'訓練中心' })[principal.role], employers, workers, availableWorkers: employerAvailableWorkers, agencies: visibleAgencies, members: protectedMembers, agencyContacts, cases, tasks, requirements, submissions, applicationSteps, jobOrders, orderAgencies, orderRoutes, orderCandidates, activity, counts, actor: { name: principal.name || session.user.name || session.user.email || 'LINE 帳號', email: session.user.email || 'LINE 登入' } });
  } catch (error) {
    console.error('hr_management_read_failed', error?.code || error?.name || 'Error', error?.message || '');
    return NextResponse.json({ error: '無法讀取人力仲介資料。請確認 PostgreSQL 已啟動。' }, { status: 503 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。' }, { status: 403 });
  try {
    await ensureSchema();
    const principal = await getHrPrincipal(session);
    if (!principal || !['admin','agency','employer'].includes(principal.role)) return NextResponse.json({ error: 'HR membership required' }, { status: 403 });
    const body = await request.json();
    const actor = clean(session.user?.email || session.user?.lineUserId || 'LINE 登入', 254);
    if (body.type === 'job-order' && principal.role === 'employer') {
      const employerId = Number(principal.employer_id);
      const agencyAssignments = Array.isArray(body.taiwanAgencyAssignments)
        ? body.taiwanAgencyAssignments.map(item => ({ agencyId:Number(item.agencyId), brokerMemberId:item.brokerMemberId ? Number(item.brokerMemberId) : null }))
        : (Array.isArray(body.taiwanAgencyIds) ? body.taiwanAgencyIds.map(id=>({agencyId:Number(id),brokerMemberId:null})) : []);
      const agencyIds = [...new Set(agencyAssignments.map(item=>item.agencyId))];
      const headcount = Number(body.headcount), jobType = clean(body.jobType,120);
      if (!validId(employerId) || agencyAssignments.length!==1 || !agencyIds.length || !agencyIds.every(validId) || !Number.isInteger(headcount) || headcount < 1 || headcount > 100 || !jobType || !validDate(body.expectedStartDate)) return NextResponse.json({error:'工作需求單只能指定一家所屬台灣仲介，並請填寫工作類型與需求人數。'},{status:400});
      if (agencyAssignments.some(item=>item.brokerMemberId!==null&&!validId(item.brokerMemberId))) return NextResponse.json({error:'業務資料格式不正確。'},{status:400});
      const employerRecord=await query('SELECT id,agency_id,status FROM hr_employers WHERE id=$1',[employerId]);
      if(!employerRecord.length)return NextResponse.json({error:'找不到雇主資料，請聯絡管理者確認會員指派。'},{status:404});
      if(employerRecord[0].status!=='active')return NextResponse.json({error:'雇主資料目前已停用，請聯絡管理者啟用後再建立工作需求單。'},{status:409});
      if(!employerRecord[0].agency_id)return NextResponse.json({error:'雇主資料尚未指派所屬台灣仲介，請聯絡管理者設定。'},{status:400});
      if(Number(employerRecord[0].agency_id)!==agencyIds[0])return NextResponse.json({error:'工作需求單只能送交雇主目前所屬的台灣仲介。'},{status:403});
      const validAgencies = await query("SELECT id FROM hr_agencies WHERE id=ANY($1::bigint[]) AND agency_type='taiwan' AND active=TRUE",[agencyIds]);
      if (validAgencies.length !== agencyIds.length) return NextResponse.json({error:'所選台灣仲介資料無效。'},{status:400});
      const brokerIds=agencyAssignments.map(item=>item.brokerMemberId).filter(Boolean);
      if(brokerIds.length){
        const brokers=await query("SELECT id,agency_id FROM hr_members WHERE id=ANY($1::bigint[]) AND role='agency' AND active=TRUE",[brokerIds]);
        if(brokers.length!==new Set(brokerIds).size||agencyAssignments.some(item=>item.brokerMemberId&&!brokers.some(broker=>Number(broker.id)===item.brokerMemberId&&Number(broker.agency_id)===item.agencyId))) return NextResponse.json({error:'所選業務必須是該台灣仲介機構底下的有效會員。'},{status:400});
      }
      const client=await pool.connect();
      try { await client.query('BEGIN');
        const employer=await client.query('SELECT id,agency_id,status FROM hr_employers WHERE id=$1 FOR UPDATE',[employerId]);
        if(!employer.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到雇主資料。'},{status:404});}
        if(employer.rows[0].status!=='active'){await client.query('ROLLBACK');return NextResponse.json({error:'雇主資料目前已停用，請聯絡管理者啟用後再建立工作需求單。'},{status:409});}
        if(Number(employer.rows[0].agency_id)!==agencyIds[0]){await client.query('ROLLBACK');return NextResponse.json({error:'雇主所屬仲介已變更，請重新整理後再建立需求單。'},{status:409});}
        const order=await client.query(`INSERT INTO hr_job_orders(employer_id,job_type,headcount,description,expected_start_date) VALUES($1,$2,$3,$4,$5) RETURNING *`,[employerId,jobType,headcount,clean(body.description,3000),body.expectedStartDate||null]);
        for(const assignment of agencyAssignments) await client.query('INSERT INTO hr_job_order_agencies(job_order_id,taiwan_agency_id,broker_member_id) VALUES($1,$2,$3)',[order.rows[0].id,assignment.agencyId,assignment.brokerMemberId]);
        await client.query('COMMIT'); return NextResponse.json(order.rows[0],{status:201});
      } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
    }
    if(body.type==='job-order-admin-assignment'&&principal.role==='admin'){
      const jobOrderId=Number(body.jobOrderId),agencyId=Number(body.taiwanAgencyId),brokerMemberId=body.brokerMemberId?Number(body.brokerMemberId):null;
      if(!validId(jobOrderId)||!validId(agencyId)||(brokerMemberId!==null&&!validId(brokerMemberId)))return NextResponse.json({error:'媒合需求或仲介資料不正確。'},{status:400});
      const employerAgency=await query(`SELECT e.agency_id FROM hr_job_orders o JOIN hr_employers e ON e.id=o.employer_id WHERE o.id=$1`,[jobOrderId]);
      if(!employerAgency.length)return NextResponse.json({error:'找不到媒合需求單。'},{status:404});
      if(!validId(employerAgency[0].agency_id)||Number(employerAgency[0].agency_id)!==agencyId)return NextResponse.json({error:'媒合需求只能指派給雇主所屬台灣仲介及其業務。'},{status:403});
      const agency=await query("SELECT id FROM hr_agencies WHERE id=$1 AND agency_type='taiwan' AND active=TRUE",[agencyId]);
      if(!agency.length)return NextResponse.json({error:'請選擇啟用中的台灣仲介。'},{status:400});
      if(brokerMemberId){const broker=await query("SELECT id FROM hr_members WHERE id=$1 AND role='agency' AND agency_id=$2 AND active=TRUE",[brokerMemberId,agencyId]);if(!broker.length)return NextResponse.json({error:'業務必須是該仲介機構底下的啟用會員。'},{status:400});}
      const assignment=await query(`INSERT INTO hr_job_order_agencies(job_order_id,taiwan_agency_id,broker_member_id) SELECT o.id,$2,$3 FROM hr_job_orders o WHERE o.id=$1 ON CONFLICT(job_order_id,taiwan_agency_id) DO UPDATE SET broker_member_id=EXCLUDED.broker_member_id RETURNING *`,[jobOrderId,agencyId,brokerMemberId]);
      if(!assignment.length)return NextResponse.json({error:'找不到媒合需求單。'},{status:404});
      return NextResponse.json(assignment[0],{status:201});
    }
    if(body.type==='job-order-admin-philippines-assignment'&&principal.role==='admin'){
      const orderAgencyId=Number(body.orderAgencyId),agencyIds=Array.isArray(body.philippinesAgencyIds)?[...new Set(body.philippinesAgencyIds.map(Number))]:[];
      if(!validId(orderAgencyId)||!Array.isArray(body.philippinesAgencyIds)||agencyIds.some(id=>!validId(id)))return NextResponse.json({error:'需求單或菲律賓仲介資料不正確。'},{status:400});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const dispatch=await client.query(`SELECT oa.id,oa.job_order_id,oa.taiwan_agency_id,o.employer_id,e.name AS employer_name,ta.name AS taiwan_agency_name
          FROM hr_job_order_agencies oa JOIN hr_job_orders o ON o.id=oa.job_order_id
          JOIN hr_employers e ON e.id=o.employer_id JOIN hr_agencies ta ON ta.id=oa.taiwan_agency_id
          WHERE oa.id=$1 FOR UPDATE OF oa,o`,[orderAgencyId]);
        if(!dispatch.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到需求單的台灣仲介指派資料。'},{status:404});}
        const philippines=await client.query("SELECT id,name FROM hr_agencies WHERE id=ANY($1::bigint[]) AND active=TRUE AND agency_type='philippines'",[agencyIds]);
        if(philippines.rowCount!==agencyIds.length){await client.query('ROLLBACK');return NextResponse.json({error:'請選擇有效且啟用中的菲律賓仲介。'},{status:400});}
        const removedRoutes=await client.query(`SELECT r.id FROM hr_job_order_routes r
          WHERE r.order_agency_id=$1 AND NOT (r.philippines_agency_id=ANY($2::bigint[]))
            AND EXISTS(SELECT 1 FROM hr_job_order_candidates c WHERE c.route_id=r.id)`,[orderAgencyId,agencyIds]);
        if(removedRoutes.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'已有人選推薦或面試紀錄的菲律賓仲介不可移除。'},{status:409});}
        await client.query('DELETE FROM hr_job_order_routes WHERE order_agency_id=$1 AND NOT (philippines_agency_id=ANY($2::bigint[]))',[orderAgencyId,agencyIds]);
        const newRoutes=[];
        for(const agency of philippines.rows){
          const route=await client.query(`INSERT INTO hr_job_order_routes(order_agency_id,philippines_agency_id,notes)
            VALUES($1,$2,'管理者直接指派') ON CONFLICT(order_agency_id,philippines_agency_id) DO NOTHING RETURNING id,order_agency_id,philippines_agency_id`,[orderAgencyId,agency.id]);
          if(route.rowCount)newRoutes.push({...route.rows[0],philippines_agency_name:agency.name});
        }
        for(const route of newRoutes){
          const message=`管理者已將媒合需求單 #${dispatch.rows[0].job_order_id}（${dispatch.rows[0].employer_name}）直接指派給台灣仲介 ${dispatch.rows[0].taiwan_agency_name} 與菲律賓仲介 ${route.philippines_agency_name}，請雙方直接聯繫媒合。`;
          for(const agencyId of [Number(dispatch.rows[0].taiwan_agency_id),Number(route.philippines_agency_id)]){
            const room=await client.query(`INSERT INTO hr_chat_rooms(room_type,agency_id) VALUES('agency',$1)
              ON CONFLICT(agency_id) WHERE room_type='agency' DO UPDATE SET agency_id=EXCLUDED.agency_id RETURNING id`,[agencyId]);
            await client.query(`INSERT INTO hr_chat_messages(room_id,member_id,sender_name,sender_role,body)
              VALUES($1,$2,$3,'admin',$4)`,[room.rows[0].id,principal.id||null,principal.name||session.user.name||'管理者',message]);
          }
        }
        const routes=await client.query(`SELECT r.id,r.order_agency_id,r.philippines_agency_id,a.name AS philippines_agency_name
          FROM hr_job_order_routes r JOIN hr_agencies a ON a.id=r.philippines_agency_id WHERE r.order_agency_id=$1 ORDER BY a.name`,[orderAgencyId]);
        await client.query('COMMIT');
        return NextResponse.json({routes:routes.rows},{status:201});
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    if (body.type === 'job-order-candidate' && principal.role === 'agency' && principal.agency_type === 'philippines') {
      const routeId=Number(body.routeId),workerId=Number(body.workerId);
      if(!validId(routeId)||!validId(workerId))return NextResponse.json({error:'請選擇工作需求與所屬工作者。'},{status:400});
      const result=await query(`INSERT INTO hr_job_order_candidates(route_id,worker_id,notes) SELECT r.id,w.id,$3 FROM hr_job_order_routes r JOIN hr_workers w ON w.id=$2 WHERE r.id=$1 AND r.philippines_agency_id=$4 AND w.agency_id=$4 AND NOT EXISTS(SELECT 1 FROM hr_cases c WHERE c.worker_id=w.id) ON CONFLICT(route_id,worker_id) DO UPDATE SET notes=EXCLUDED.notes,updated_at=NOW() RETURNING *`,[routeId,workerId,clean(body.notes,2000),principal.agency_id]);
      if(!result.length)return NextResponse.json({error:'只能推薦所屬菲律賓仲介且尚未建立任何案件的工作者。'},{status:403});return NextResponse.json(result[0],{status:201});
    }
    if (body.type === 'job-order-employer-candidate' && principal.role === 'employer') {
      const orderId=Number(body.orderId),workerId=Number(body.workerId);
      if(!validId(orderId)||!validId(workerId))return NextResponse.json({error:'工作需求或工作者資料不正確。'},{status:400});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const order=await client.query(`SELECT o.id,o.job_type,o.status,e.agency_id,e.name employer_name,
            oa.id order_agency_id,ta.name taiwan_agency_name
          FROM hr_job_orders o JOIN hr_employers e ON e.id=o.employer_id
          JOIN hr_job_order_agencies oa ON oa.job_order_id=o.id AND oa.taiwan_agency_id=e.agency_id
          JOIN hr_agencies ta ON ta.id=oa.taiwan_agency_id AND ta.active=TRUE AND ta.agency_type='taiwan'
          WHERE o.id=$1 AND o.employer_id=$2 FOR UPDATE OF o,e,oa`,[orderId,principal.employer_id]);
        if(!order.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到需求單或尚未指派台灣仲介。'},{status:404});}
        const orderItem=order.rows[0];
        if(orderItem.status!=='open'){await client.query('ROLLBACK');return NextResponse.json({error:'此需求單已額滿或取消，無法再挑選工作者。'},{status:409});}
        const worker=await client.query(`SELECT w.id,w.name,w.agency_id,a.name philippines_agency_name
          FROM hr_workers w JOIN hr_agencies a ON a.id=w.agency_id AND a.active=TRUE AND a.agency_type='philippines'
          WHERE w.id=$1 AND w.status='active' AND w.job_preference=$2
            AND NOT EXISTS(SELECT 1 FROM hr_cases c WHERE c.worker_id=w.id)
          FOR UPDATE OF w`,[workerId,orderItem.job_type]);
        if(!worker.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'此工作者不符合工作類型、已停用或已建立案件。'},{status:409});}
        const selectedRoute=await client.query(`INSERT INTO hr_job_order_routes(order_agency_id,philippines_agency_id,notes)
          VALUES($1,$2,'雇主直接挑選工作者') ON CONFLICT(order_agency_id,philippines_agency_id)
          DO UPDATE SET notes=hr_job_order_routes.notes RETURNING id`,
        [orderItem.order_agency_id,worker.rows[0].agency_id]);
        const selected=await client.query(`INSERT INTO hr_job_order_candidates(route_id,worker_id,proposed_by,notes)
          VALUES($1,$2,$3,'由雇主直接挑選') ON CONFLICT(route_id,worker_id) DO NOTHING RETURNING *`,
        [selectedRoute.rows[0].id,workerId,principal.id||null]);
        if(!selected.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'這位工作者已加入此需求單。'},{status:409});}

        const message=`雇主 ${orderItem.employer_name} 已從需求單 #${orderId} 挑選工作者 ${worker.rows[0].name}（${orderItem.job_type}）。請台灣仲介與菲律賓仲介聯繫安排後續面試。`;
        for(const agencyId of [Number(orderItem.agency_id),Number(worker.rows[0].agency_id)]){
          const room=await client.query(`INSERT INTO hr_chat_rooms(room_type,agency_id) VALUES('agency',$1)
            ON CONFLICT(agency_id) WHERE room_type='agency' DO UPDATE SET agency_id=EXCLUDED.agency_id RETURNING id`,[agencyId]);
          await client.query(`INSERT INTO hr_chat_messages(room_id,member_id,sender_name,sender_role,body)
            VALUES($1,$2,$3,'employer',$4)`,[room.rows[0].id,principal.id||null,principal.name||session.user.name||'雇主',message]);
        }
        await client.query('COMMIT');
        return NextResponse.json(selected.rows[0],{status:201});
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    if (body.type === 'worker' && principal.role === 'agency' && principal.agency_type === 'philippines') {
      const name = clean(body.name,160);
      if (!name) return NextResponse.json({ error: '請填寫工作者姓名。' }, { status: 400 });
      const workerProfile=cleanWorkerResumeProfile(body.resumeProfile),jobPreference=clean(body.jobPreference,120);
      if(!WORKER_JOB_PREFERENCES.has(jobPreference)||!workerGenderCode(workerProfile.gender))return NextResponse.json({error:'請選擇工作意向與性別，才能建立工作者編號。'},{status:400});
      const created = await query(`INSERT INTO hr_workers(name,nationality,phone,email,job_preference,notes,resume_profile,agency_id)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`, [name,clean(body.nationality,80),clean(body.phone,50),clean(body.email,254),jobPreference,clean(body.notes,2000),JSON.stringify(workerProfile),principal.agency_id]);
      const profile=workerProfileWithReference(workerProfile,jobPreference,created[0].id);
      const saved=await query('UPDATE hr_workers SET resume_profile=$2::jsonb WHERE id=$1 RETURNING *',[created[0].id,JSON.stringify(profile)]);
      return NextResponse.json(saved[0], { status: 201 });
    }
    if (principal.role !== 'admin') return NextResponse.json({ error: 'HR admin access required' }, { status: 403 });
    if (body.type === 'agency') {
      const name = clean(body.name, 160), agencyType = clean(body.agencyType, 30);
      if (!name || !['taiwan','philippines'].includes(agencyType)) return NextResponse.json({ error: '請填寫仲介名稱並選擇台灣或菲律賓仲介。' }, { status: 400 });
      const country = clean(body.country,80) || (agencyType === 'taiwan' ? '台灣' : '菲律賓');
      const result = await query('INSERT INTO hr_agencies(name,agency_type,country) VALUES($1,$2,$3) RETURNING *', [name,agencyType,country]);
      return NextResponse.json(result[0], { status: 201 });
    }
    if (body.type === 'member') {
      const email = clean(body.email,254).toLowerCase(), name = clean(body.name,160), role = clean(body.role,20);
      const lineUserId = clean(body.lineUserId,100) || null;
      const password = typeof body.password === 'string' ? body.password : '';
      const agencyId = Number(body.agencyId);
      if (!name || !/^\S+@\S+\.\S+$/.test(email) || !HR_ROLES.has(role)) return NextResponse.json({ error: '會員姓名、Email 與類型皆須正確填寫。' }, { status: 400 });
      if (password.length < 10) return NextResponse.json({ error: '測試登入密碼至少需要 10 個字元。' }, { status: 400 });
      if (role === 'worker' || role === 'employer') {
        const agencyType = role === 'worker' ? 'philippines' : 'taiwan';
        if (!validId(agencyId)) return NextResponse.json({ error: role === 'worker' ? '請選擇所屬菲律賓仲介。' : '請選擇所屬台灣仲介。' }, { status: 400 });
        const agency = await query('SELECT id FROM hr_agencies WHERE id=$1 AND active=TRUE AND agency_type=$2', [agencyId,agencyType]);
        if (!agency.length) return NextResponse.json({ error: '所屬仲介不存在、類型不符或已停用。' }, { status: 400 });
      }
      if (role === 'agency' && !validId(body.targetId)) return NextResponse.json({ error: '請選擇所屬仲介機構。' }, { status: 400 });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let workerId = null, employerId = null, memberAgencyId = null;
        if (role === 'worker') {
          const jobPreference = clean(body.jobPreference,120), gender = clean(body.gender,20);
          if (!WORKER_JOB_PREFERENCES.has(jobPreference) || !workerGenderCode(gender)) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: '請選擇工作意向與性別。' }, { status: 400 });
          }
          const profile = cleanWorkerResumeProfile({ gender });
          const created = await client.query(`INSERT INTO hr_workers(name,nationality,email,job_preference,resume_profile,agency_id)
            VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING id`,
          [name,clean(body.nationality,80)||'菲律賓',email,jobPreference,JSON.stringify(profile),agencyId]);
          workerId = created.rows[0].id;
          const resumeProfile = workerProfileWithReference(profile,jobPreference,workerId);
          await client.query('UPDATE hr_workers SET resume_profile=$2::jsonb WHERE id=$1', [workerId,JSON.stringify(resumeProfile)]);
        } else if (role === 'employer') {
          const employerType = ['home_care','factory','domestic_helper','other'].includes(body.employerType) ? body.employerType : '';
          if (!employerType) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: '請選擇雇主類型。' }, { status: 400 });
          }
          const created = await client.query(`INSERT INTO hr_employers(name,contact_name,email,employer_type,agency_id)
            VALUES($1,$1,$2,$3,$4) RETURNING id`, [name,email,employerType,agencyId]);
          employerId = created.rows[0].id;
        } else if (role === 'agency') {
          const agency = await client.query('SELECT id FROM hr_agencies WHERE id=$1 AND active=TRUE', [Number(body.targetId)]);
          if (!agency.rowCount) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: '所屬仲介不存在或已停用。' }, { status: 400 });
          }
          memberAgencyId = Number(body.targetId);
        }
        const createdMember = await client.query(`INSERT INTO hr_members(email,line_user_id,display_name,password_hash,role,worker_id,employer_id,agency_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,email,display_name,role,worker_id,employer_id,agency_id,active,created_at`,
        [email,lineUserId,name,await hashPassword(password),role,workerId,employerId,memberAgencyId]);
        await client.query('COMMIT');
        return NextResponse.json(createdMember.rows[0], { status: 201 });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    if (body.type === 'employer') {
      const name = clean(body.name, 160);
      if (!name) return NextResponse.json({ error: '請填寫雇主或客戶名稱。' }, { status: 400 });
      if (!EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });
      const employerType = body.employerType;
      const agencyId = body.agencyId && validId(body.agencyId) ? Number(body.agencyId) : null;
      const result = await query(`INSERT INTO hr_employers(name,contact_name,phone,email,address,notes,employer_type,agency_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [name, clean(body.contactName,120), clean(body.phone,50), clean(body.email,254), clean(body.address,300), clean(body.notes,2000), employerType, agencyId]);
      return NextResponse.json(result[0], { status: 201 });
    }
    if (body.type === 'worker') {
      const name = clean(body.name, 160);
      if (!name) return NextResponse.json({ error: '請填寫工作者姓名。' }, { status: 400 });
      const agencyId = body.agencyId && validId(body.agencyId) ? Number(body.agencyId) : null;
      const workerProfile=cleanWorkerResumeProfile(body.resumeProfile),jobPreference=clean(body.jobPreference,120);
      if(!WORKER_JOB_PREFERENCES.has(jobPreference)||!workerGenderCode(workerProfile.gender))return NextResponse.json({error:'請選擇工作意向與性別，才能建立工作者編號。'},{status:400});
      const result = await query(`INSERT INTO hr_workers(name,nationality,phone,email,job_preference,notes,resume_profile,agency_id)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`, [name, clean(body.nationality,80), clean(body.phone,50), clean(body.email,254), jobPreference, clean(body.notes,2000), JSON.stringify(workerProfile), agencyId]);
      const profile=workerProfileWithReference(workerProfile,jobPreference,result[0].id);
      const saved=await query('UPDATE hr_workers SET resume_profile=$2::jsonb WHERE id=$1 RETURNING *',[result[0].id,JSON.stringify(profile)]);
      return NextResponse.json(saved[0], { status: 201 });
    }
    if (body.type === 'case') {
      if (!validId(body.employerId) || !validId(body.workerId)) return NextResponse.json({ error: '請選擇雇主與工作者。' }, { status: 400 });
      if (principal.role === 'admin') {
        const workerMember = await query(`SELECT w.id FROM hr_workers w
          JOIN hr_members m ON m.worker_id=w.id
          WHERE w.id=$1 AND w.status='active' AND m.role='worker' AND m.active=TRUE
          LIMIT 1`, [Number(body.workerId)]);
        if (!workerMember.length) return NextResponse.json({ error: '工作者必須是啟用中的工作者類型會員。' }, { status: 400 });
      }
      if (body.assignedMemberId && !validId(body.assignedMemberId)) return NextResponse.json({ error: '所屬業務格式不正確。' }, { status: 400 });
      if (!validDate(body.expectedStartDate)) return NextResponse.json({ error: '預計日期格式不正確。' }, { status: 400 });
      const jobType=clean(body.jobType,120);
      if (jobType && !WORKER_JOB_PREFERENCES.has(jobType)) return NextResponse.json({ error: '請選擇有效的職類。' }, { status: 400 });
      const assignedMemberId=body.assignedMemberId?Number(body.assignedMemberId):null;
      if(assignedMemberId){
        const validAssignee=await query(`SELECT m.id FROM hr_members m JOIN hr_employers e ON e.agency_id=m.agency_id
          WHERE m.id=$1 AND m.role='agency' AND m.active=TRUE AND e.id=$2 AND ($3::text='admin' OR m.agency_id=$4)`,[assignedMemberId,Number(body.employerId),principal.role,principal.agency_id||null]);
        if(!validAssignee.length)return NextResponse.json({error:'請選擇該雇主所屬台灣仲介的有效會員。'},{status:400});
      }
      const caseNumber = `HR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomUUID().slice(0,6).toUpperCase()}`;
      const result = await query(`INSERT INTO hr_cases(case_number,employer_id,worker_id,assigned_member_id,job_type,expected_start_date,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [caseNumber,Number(body.employerId),Number(body.workerId),assignedMemberId,jobType,body.expectedStartDate || null,clean(body.notes,4000)]);
      const [caseWorker] = await query('SELECT resume_profile FROM hr_workers WHERE id=$1', [Number(body.workerId)]);
      await insertCaseRequirements(pool, result[0].id, caseWorker?.resume_profile);
      await query(`INSERT INTO hr_application_steps(case_id,step_key,label)
        VALUES ${APPLICATION_STEPS.map((_,index)=>`($1,$${index*2+2},$${index*2+3})`).join(',')}
        ON CONFLICT(case_id,step_key) DO NOTHING`, [result[0].id,...APPLICATION_STEPS.flat()]);
      await recordActivity(result[0].id, actor, '建立案件', caseNumber);
      return NextResponse.json(result[0], { status: 201 });
    }
    if (body.type === 'requirement') {
      if (!validId(body.caseId)) return NextResponse.json({ error: '請選擇案件。' }, { status: 400 });
      const name = clean(body.name, 160);
      if (!name) return NextResponse.json({ error: '請填寫文件名稱。' }, { status: 400 });
      const result = await query(`INSERT INTO hr_case_requirements(case_id,name,required,entry_gate)
        VALUES($1,$2,$3,$4) RETURNING *`, [Number(body.caseId), name, body.required !== false, body.entryGate === true]);
      await recordActivity(Number(body.caseId), actor, '新增文件要求', name);
      await refreshCaseStage(Number(body.caseId));
      return NextResponse.json(result[0], { status: 201 });
    }
    if (body.type === 'task') {
      if (!validId(body.caseId)) return NextResponse.json({ error: '請選擇案件。' }, { status: 400 });
      const title = clean(body.title,200), category = clean(body.category,30) || 'other';
      if (!title || !TASK_CATEGORIES.has(category) || !validDate(body.dueDate)) return NextResponse.json({ error: '待辦內容或日期不正確。' }, { status: 400 });
      const result = await query(`INSERT INTO hr_case_tasks(case_id,title,category,due_date,notes)
        VALUES($1,$2,$3,$4,$5) RETURNING *`, [Number(body.caseId),title,category,body.dueDate || null,clean(body.notes,2000)]);
      await recordActivity(Number(body.caseId), actor, '新增待辦', title);
      return NextResponse.json(result[0], { status: 201 });
    }
    return NextResponse.json({ error: '新增項目不正確。' }, { status: 400 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: '表單資料格式不正確。' }, { status: 400 });
    if (error?.code === '23505') return NextResponse.json({ error: '資料已存在，請檢查 Email。' }, { status: 409 });
    if (error?.code === '23503') return NextResponse.json({ error: '關聯資料不存在，請重新整理後再選擇。' }, { status: 400 });
    console.error('hr_management_create_failed', error?.name || 'Error');
    return NextResponse.json({ error: '新增失敗，請稍後再試。' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。' }, { status: 403 });
  try {
    await ensureSchema();
    const principal = await getHrPrincipal(session);
    if (!principal || !['admin','agency','employer','worker'].includes(principal.role)) return NextResponse.json({ error: 'HR membership required' }, { status: 403 });
    const body = await request.json();
    const id = Number(body.id), actor = clean(session.user?.email || session.user?.lineUserId || 'LINE 登入',254);
    if(body.type==='job-order-admin-status'&&principal.role==='admin'){
      if(!validId(id)||!['open','filled','cancelled'].includes(body.status))return NextResponse.json({error:'媒合需求狀態不正確。'},{status:400});
      const changed=await query('UPDATE hr_job_orders SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *',[id,body.status]);
      if(!changed.length)return NextResponse.json({error:'找不到媒合需求單。'},{status:404});
      return NextResponse.json(changed[0]);
    }
    if(body.type==='job-order-update'&&principal.role==='employer'){
      const orderId=Number(body.id),jobType=clean(body.jobType,120),headcount=Number(body.headcount),brokerMemberId=body.brokerMemberId?Number(body.brokerMemberId):null;
      if(!validId(orderId)||!jobType||!Number.isInteger(headcount)||headcount<1||headcount>100||!validDate(body.expectedStartDate)||(brokerMemberId!==null&&!validId(brokerMemberId)))return NextResponse.json({error:'工作類型、需求人數或日期格式不正確。'},{status:400});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const order=await client.query(`SELECT o.id,o.status,e.agency_id FROM hr_job_orders o JOIN hr_employers e ON e.id=o.employer_id WHERE o.id=$1 AND o.employer_id=$2 FOR UPDATE OF o`,[orderId,principal.employer_id]);
        if(!order.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到此需求單。'},{status:404});}
        if(order.rows[0].status!=='open'){await client.query('ROLLBACK');return NextResponse.json({error:'此需求單已確認或結束，無法修改。'},{status:409});}
        const activity=await client.query(`SELECT
          EXISTS(SELECT 1 FROM hr_job_order_routes r JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id WHERE oa.job_order_id=$1) AS has_routes,
          EXISTS(SELECT 1 FROM hr_job_order_candidates c JOIN hr_job_order_routes r ON r.id=c.route_id JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id WHERE oa.job_order_id=$1) AS has_candidates`,[orderId]);
        if(activity.rows[0].has_routes||activity.rows[0].has_candidates){await client.query('ROLLBACK');return NextResponse.json({error:'仲介已開始處理此需求單，無法再修改。'},{status:409});}
        if(brokerMemberId){
          const broker=await client.query("SELECT id FROM hr_members WHERE id=$1 AND role='agency' AND agency_id=$2 AND active=TRUE",[brokerMemberId,order.rows[0].agency_id]);
          if(!broker.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'指定業務必須是所屬仲介的有效會員。'},{status:400});}
        }
        const updated=await client.query(`UPDATE hr_job_orders SET job_type=$2,headcount=$3,description=$4,expected_start_date=$5,updated_at=NOW() WHERE id=$1 RETURNING *`,[orderId,jobType,headcount,clean(body.description,3000),body.expectedStartDate||null]);
        const assignment=await client.query('UPDATE hr_job_order_agencies SET broker_member_id=$3 WHERE job_order_id=$1 AND taiwan_agency_id=$2 RETURNING id',[orderId,order.rows[0].agency_id,brokerMemberId]);
        if(!assignment.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'需求單的仲介資料已變更，請重新整理後再試。'},{status:409});}
        await client.query('COMMIT');
        return NextResponse.json(updated.rows[0]);
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    if (body.type === 'job-order-candidate-interview' && principal.role === 'employer') {
      const candidateId=Number(body.candidateId),status=clean(body.status,20);
      if(!validId(candidateId)||!['scheduled','passed','rejected'].includes(status))return NextResponse.json({error:'面試結果不正確。'},{status:400});
      const client=await pool.connect();
      try { await client.query('BEGIN');
        const candidate=await client.query(`SELECT c.*,r.id route_id,oa.job_order_id,oa.taiwan_agency_id,o.employer_id,o.job_type,o.expected_start_date,o.headcount FROM hr_job_order_candidates c JOIN hr_job_order_routes r ON r.id=c.route_id JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id JOIN hr_job_orders o ON o.id=oa.job_order_id WHERE c.id=$1 AND o.employer_id=$2 FOR UPDATE OF c,o`,[candidateId,principal.employer_id]);
        if(!candidate.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到此工作需求的人選。'},{status:404});}
        const item=candidate.rows[0];let caseId=item.case_id;
        if(status==='passed'&&!caseId){
          const count=await client.query("SELECT count(*)::int n FROM hr_job_order_candidates WHERE status='passed' AND route_id IN (SELECT r.id FROM hr_job_order_routes r JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id WHERE oa.job_order_id=$1)",[item.job_order_id]);
          await client.query('SELECT id FROM hr_workers WHERE id=$1 FOR UPDATE',[item.worker_id]);
          const existing=await client.query("SELECT id FROM hr_cases WHERE worker_id=$1 AND status<>'closed' LIMIT 1",[item.worker_id]);
          if(existing.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'此工作者已有進行中的正式申辦案件，不能重複錄用。'},{status:409});}
          if(Number(count.rows[0].n)>=Number(item.headcount)&&!existing.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'此需求單的錄用人數已達需求人數。'},{status:409});}
          {
            const caseNumber=`HR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomUUID().slice(0,6).toUpperCase()}`;
            const assignment=await client.query(`SELECT broker_member_id FROM hr_job_order_agencies WHERE job_order_id=$1 AND taiwan_agency_id=$2`,[item.job_order_id,item.taiwan_agency_id]);
            const created=await client.query(`INSERT INTO hr_cases(case_number,employer_id,worker_id,assigned_member_id,job_type,expected_start_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[caseNumber,item.employer_id,item.worker_id,assignment.rows[0]?.broker_member_id||null,item.job_type,item.expected_start_date,`由需求單 #${item.job_order_id} 面試錄用`]);caseId=created.rows[0].id;
            const hiredWorker=await client.query('SELECT resume_profile FROM hr_workers WHERE id=$1',[item.worker_id]);
            await insertCaseRequirements(client,caseId,hiredWorker.rows[0]?.resume_profile);
            await client.query(`INSERT INTO hr_application_steps(case_id,step_key,label) VALUES ${APPLICATION_STEPS.map((_,index)=>`($1,$${index*2+2},$${index*2+3})`).join(',')} ON CONFLICT(case_id,step_key) DO NOTHING`,[caseId,...APPLICATION_STEPS.flat()]);
            await client.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) VALUES($1,$2,$3,$4)',[caseId,actor,'面試錄用並建立正式申辦案件',caseNumber]);
          }
        }
        const updated=await client.query('UPDATE hr_job_order_candidates SET status=$2,case_id=$3,interview_at=CASE WHEN $2=\'scheduled\' THEN $4::timestamptz ELSE interview_at END,updated_at=NOW() WHERE id=$1 RETURNING *',[candidateId,status,caseId||null,body.interviewAt||null]);
        if(status==='passed') await client.query("UPDATE hr_job_orders SET status=CASE WHEN (SELECT count(*) FROM hr_job_order_candidates c JOIN hr_job_order_routes r ON r.id=c.route_id JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id WHERE oa.job_order_id=$1 AND c.status='passed') >= headcount THEN 'filled' ELSE status END,updated_at=NOW() WHERE id=$1",[item.job_order_id]);
        await client.query('COMMIT');return NextResponse.json(updated.rows[0]);
      } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
    }
    if (principal.role === 'worker' && body.type === 'worker') {
      if (!validId(principal.worker_id) || id !== Number(principal.worker_id)) return NextResponse.json({ error: '只能編輯自己的工作者資料。' }, { status: 403 });
      const name = clean(body.name,160);
      if (!name) return NextResponse.json({ error: '請填寫工作者姓名。' }, { status: 400 });
      const resumeProfile=workerProfileWithReference(body.resumeProfile,clean(body.jobPreference,120),principal.worker_id);
      const edited = await query(`UPDATE hr_workers SET name=$2,nationality=$3,phone=$4,email=$5,job_preference=$6,resume_profile=resume_profile || $7::jsonb,updated_at=NOW()
        WHERE id=$1 RETURNING *`, [principal.worker_id,name,clean(body.nationality,80),clean(body.phone,50),clean(body.email,254),clean(body.jobPreference,120),JSON.stringify(resumeProfile)]);
      if (!edited.length) return NextResponse.json({ error: '找不到工作者資料。' }, { status: 404 });
      await resyncRequirements(principal.worker_id);
      return NextResponse.json(edited[0]);
    }
    if (body.type === 'employer' && principal.role === 'employer') {
      if (!validId(id) || id !== Number(principal.employer_id)) return NextResponse.json({ error: '只能編輯自己的雇主資料。' }, { status: 403 });
      const name = clean(body.name,160);
      if (!name || !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請填寫雇主／客戶名稱並選擇有效類型。' }, { status: 400 });
      const edited = await query(`UPDATE hr_employers SET name=$2,contact_name=$3,phone=$4,email=$5,address=$6,notes=$7,employer_type=$8,updated_at=NOW()
        WHERE id=$1 RETURNING *`,[id,name,clean(body.contactName,120),clean(body.phone,50),clean(body.email,254),clean(body.address,300),clean(body.notes,2000),body.employerType]);
      if (!edited.length) return NextResponse.json({ error: '找不到雇主資料。' }, { status: 404 });
      return NextResponse.json(edited[0]);
    }
    if (principal.role === 'employer') return NextResponse.json({ error: '雇主帳號無權執行此項更新。' }, { status: 403 });
    if (body.type === 'worker' && principal.role === 'agency' && principal.agency_type === 'philippines') {
      if (!validId(id)) return NextResponse.json({ error: '工作者編號不正確。' }, { status: 400 });
      const edited = body.active !== undefined
        ? await query("UPDATE hr_workers SET status=$3,updated_at=NOW() WHERE id=$1 AND agency_id=$2 RETURNING *", [id,principal.agency_id,body.active ? 'active' : 'inactive'])
        : await query(`UPDATE hr_workers SET name=$3,nationality=$4,phone=$5,email=$6,job_preference=$7,notes=$8,resume_profile=resume_profile || COALESCE($9::jsonb,'{}'::jsonb),updated_at=NOW()
            WHERE id=$1 AND agency_id=$2 RETURNING *`, [id,principal.agency_id,clean(body.name,160),clean(body.nationality,80),clean(body.phone,50),clean(body.email,254),clean(body.jobPreference,120),clean(body.notes,2000),body.resumeProfile===undefined?null:JSON.stringify(workerProfileWithReference(body.resumeProfile,clean(body.jobPreference,120),id))]);
      if (!edited.length) return NextResponse.json({ error: '找不到所屬仲介的工作者資料。' }, { status: 404 });
      await resyncRequirements(id);
      return NextResponse.json(edited[0]);
    }
    if (body.type === 'worker-resume' && principal.role === 'agency' && principal.agency_type === 'philippines') {
      if (!validId(id)) return NextResponse.json({ error: '工作者編號不正確。' }, { status: 400 });
      if (body.resumeProfile !== undefined && (!body.resumeProfile || typeof body.resumeProfile !== 'object' || Array.isArray(body.resumeProfile))) {
        return NextResponse.json({ error: '履歷資料格式不正確。' }, { status: 400 });
      }
      const resumeProfile = cleanWorkerResumeProfile(body.clear === true ? {} : body.resumeProfile);
      const result = await query('UPDATE hr_workers SET resume_profile=$3::jsonb,updated_at=NOW() WHERE id=$1 AND agency_id=$2 RETURNING id', [id,principal.agency_id,JSON.stringify(resumeProfile)]);
      if (!result.length) return NextResponse.json({ error: '找不到所屬仲介的工作者資料。' }, { status: 404 });
      await resyncRequirements(id);
      return NextResponse.json({ ok: true });
    }
    if (body.type === 'employer' && principal.role === 'agency' && principal.agency_type === 'taiwan') {
      if (!validId(id)) return NextResponse.json({ error: '雇主編號不正確。' }, { status: 400 });
      if (body.name === undefined || body.active !== undefined) return NextResponse.json({ error: '仲介只能編輯所屬雇主資料，無權新增或變更雇主啟用狀態。' }, { status: 403 });
      if (!EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });
      const edited = await query(`UPDATE hr_employers SET name=$3,contact_name=$4,phone=$5,email=$6,address=$7,notes=$8,employer_type=$9,updated_at=NOW()
          WHERE id=$1 AND agency_id=$2 RETURNING *`, [id,principal.agency_id,clean(body.name,160),clean(body.contactName,120),clean(body.phone,50),clean(body.email,254),clean(body.address,300),clean(body.notes,2000),body.employerType]);
      if (!edited.length) return NextResponse.json({ error: '找不到所屬台灣仲介的雇主資料。' }, { status: 404 });
      return NextResponse.json(edited[0]);
    }
    if (body.type === 'member-admin-scope') {
      if (principal.role !== 'admin') return NextResponse.json({ error: '只有系統管理者可以調整管理者權限。' }, { status: 403 });
      const memberId = Number(body.id);
      const scope = clean(body.adminScope,20);
      const agencyId = Number(body.agencyId);
      if (!validId(memberId) || !['none','agency','system'].includes(scope)) return NextResponse.json({ error: '管理者權限設定不正確。' }, { status: 400 });
      const target = await query('SELECT id,role,agency_id FROM hr_members WHERE id=$1',[memberId]);
      if (!target.length) return NextResponse.json({ error: '找不到會員帳號。' }, { status: 404 });
      if (scope === 'agency' && (target[0].role !== 'agency' || !validId(agencyId) || Number(target[0].agency_id)!==agencyId)) return NextResponse.json({ error: '仲介管理者必須是所屬機構的仲介會員，請先指派仲介機構。' }, { status: 400 });
      const saved = await query(`UPDATE hr_members SET admin_scope=$2,updated_at=NOW() WHERE id=$1
        RETURNING id,email,display_name,role,admin_scope,agency_id,active`,[memberId,scope]);
      return NextResponse.json(saved[0]);
    }
    if (body.type === 'member-profile' && principal.is_agency_admin) {
      const memberId=Number(body.id);
      const inAgency=await query(`SELECT m.id FROM hr_members m LEFT JOIN hr_workers w ON w.id=m.worker_id LEFT JOIN hr_employers e ON e.id=m.employer_id
        WHERE m.id=$1 AND (m.agency_id=$2 OR w.agency_id=$2 OR e.agency_id=$2)`,[memberId,principal.agency_id]);
      if (!inAgency.length) return NextResponse.json({error:'仲介管理者只能編輯所屬機構的會員。'},{status:403});
    }
    if (body.type === 'member' && principal.is_agency_admin) {
      const memberId=Number(body.id);
      const inAgency=await query(`SELECT m.id FROM hr_members m LEFT JOIN hr_workers w ON w.id=m.worker_id LEFT JOIN hr_employers e ON e.id=m.employer_id
        WHERE m.id=$1 AND (m.agency_id=$2 OR w.agency_id=$2 OR e.agency_id=$2)`,[memberId,principal.agency_id]);
      if (!inAgency.length || body.role !== undefined) return NextResponse.json({error:'仲介管理者只能管理所屬機構會員的啟用狀態。'},{status:403});
      const result=await query(`UPDATE hr_members m SET active=$3,updated_at=NOW()
        WHERE m.id=$1 AND (m.agency_id=$2 OR EXISTS(SELECT 1 FROM hr_workers w WHERE w.id=m.worker_id AND w.agency_id=$2)
          OR EXISTS(SELECT 1 FROM hr_employers e WHERE e.id=m.employer_id AND e.agency_id=$2))
        RETURNING m.id,m.email,m.display_name,m.role,m.active`,[memberId,principal.agency_id,body.active!==false]);
      return NextResponse.json(result[0]);
    }
    if (principal.role !== 'admin' && !principal.is_agency_admin && !['requirement-applicability','application-step','review','workflow','case'].includes(body.type)) return NextResponse.json({ error: 'HR admin access required' }, { status: 403 });
    if (principal.is_agency_admin && !['member-profile','member','requirement-applicability','application-step','review','workflow','case'].includes(body.type)) return NextResponse.json({ error: '仲介管理者無權執行此操作。' }, { status: 403 });
    if (body.type === 'requirement-applicability') {
      if (principal.role === 'agency' && principal.agency_type !== 'philippines') return NextResponse.json({error:'此申請流程僅開放菲律賓仲介會員。'},{status:403});
      const requirementId=Number(body.requirementId);
      if (!validId(requirementId)) return NextResponse.json({error:'文件項目編號不正確。'},{status:400});
      const changed=await query(`UPDATE hr_case_requirements r SET applicable=$3,applicability_source='manual',
          entry_gate=CASE WHEN r.name=ANY($6::text[]) THEN (r.required AND $3 AND r.name=ANY($5::text[])) ELSE r.entry_gate END,updated_at=NOW()
        FROM hr_cases c JOIN hr_workers w ON w.id=c.worker_id
        WHERE r.id=$1 AND c.id=r.case_id AND r.status<>'submitted' AND (r.applicability<>'' OR $2::text='admin') AND ($2::text='admin' OR w.agency_id=$4)
        RETURNING r.id,r.case_id,r.required,r.entry_gate,r.applicable`,[requirementId,principal.role,body.applicable===true,principal.agency_id||null,ENTRY_GATE_DOCUMENTS,WORKER_DOCUMENT_NAMES]);
      if (!changed.length) return NextResponse.json({error:'找不到可管理的文件項目。'},{status:404});
      await recordActivity(changed[0].case_id,actor,body.applicable?'確認文件適用':'標示文件不適用',String(requirementId));
      await refreshCaseStage(changed[0].case_id);
      return NextResponse.json(changed[0]);
    }
    if (body.type === 'application-step') {
      const caseId=Number(body.caseId), stepKey=clean(body.stepKey,60), step=APPLICATION_STEPS.find(([key])=>key===stepKey);
      if (!validId(caseId)||!step||!validDate(body.startedOn)||!validDate(body.completedOn)) return NextResponse.json({error:'申請程序日期或項目不正確。'},{status:400});
      const saved=await query(`INSERT INTO hr_application_steps(case_id,step_key,label,started_on,completed_on,note,updated_by,updated_at)
        SELECT c.id,$2,$3,$4,$5,$6,$7,NOW() FROM hr_cases c JOIN hr_workers w ON w.id=c.worker_id
        JOIN hr_employers e ON e.id=c.employer_id
        WHERE c.id=$1 AND ($8::text='admin' OR ($8::text='agency' AND (($10::text='philippines' AND w.agency_id=$9) OR ($10::text='taiwan' AND (e.agency_id=$9 OR EXISTS(SELECT 1 FROM hr_job_order_candidates jc JOIN hr_job_order_routes jr ON jr.id=jc.route_id JOIN hr_job_order_agencies ja ON ja.id=jr.order_agency_id WHERE jc.case_id=c.id AND ja.taiwan_agency_id=$9))))))
        ON CONFLICT(case_id,step_key) DO UPDATE SET started_on=EXCLUDED.started_on,completed_on=EXCLUDED.completed_on,
          note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING *`,
        [caseId,stepKey,step[1],body.startedOn||null,body.completedOn||null,clean(body.note,1000),actor,principal.role,principal.agency_id||null,principal.agency_type||null]);
      if (!saved.length) return NextResponse.json({error:'找不到可管理的所屬工作者案件。'},{status:404});
      await recordActivity(caseId,actor,'更新申請程序',`${step[1]} · ${body.completedOn||body.startedOn||'更新備註'}`);
      return NextResponse.json(saved[0]);
    }
    if (body.type === 'agency') {
      if (!validId(body.id)) return NextResponse.json({ error: '資料編號不正確。' }, { status: 400 });
      if (body.name !== undefined) {
        const name = clean(body.name,160), agencyType = clean(body.agencyType,30);
        if (!name || !['taiwan','philippines'].includes(agencyType)) return NextResponse.json({ error: '請填寫仲介名稱並選擇有效類型。' }, { status: 400 });
        const country = clean(body.country,80) || (agencyType === 'taiwan' ? '台灣' : '菲律賓');
        const edited = await query('UPDATE hr_agencies SET name=$2,agency_type=$3,country=$4,updated_at=NOW() WHERE id=$1 RETURNING *', [id,name,agencyType,country]);
        if (!edited.length) return NextResponse.json({ error: '找不到仲介資料。' }, { status: 404 });
        return NextResponse.json(edited[0]);
      }
      const result = await query('UPDATE hr_agencies SET active=$2,updated_at=NOW() WHERE id=$1 RETURNING *', [id,body.active !== false]);
      if (!result.length) return NextResponse.json({ error: '找不到仲介資料。' }, { status: 404 });
      return NextResponse.json(result[0]);
    }
    if (body.type === 'member-profile') {
      if (!validId(body.id)) return NextResponse.json({ error: '會員編號不正確。' }, { status: 400 });
      const displayName = clean(body.displayName,160);
      const email = clean(body.email,254).toLowerCase() || null;
      const lineUserId = clean(body.lineUserId,100) || null;
      const password = typeof body.password === 'string' ? body.password : '';
      if (!displayName || (email && !/^\S+@\S+\.\S+$/.test(email))) return NextResponse.json({ error: '請填寫會員名稱與有效 Email。' }, { status: 400 });
      if (lineUserId && lineUserId.includes('@')) return NextResponse.json({ error: 'LINE User ID 不能填寫 Email；如未使用 LINE 登入，請清除此欄位。' }, { status: 400 });
      if (!email && !lineUserId) return NextResponse.json({ error: 'Email 或 LINE User ID 至少要保留一項。' }, { status: 400 });
      if (password && password.length < 10) return NextResponse.json({ error: '新密碼至少需要 10 個字元。' }, { status: 400 });
      if (email && (await query('SELECT id FROM hr_members WHERE lower(email)=lower($1) AND id<>$2 LIMIT 1', [email,id])).length) {
        return NextResponse.json({ error: '這個 Email 已屬於另一個會員，請改用不同的 Email。' }, { status: 409 });
      }
      if (lineUserId && (await query('SELECT id FROM hr_members WHERE line_user_id=$1 AND id<>$2 LIMIT 1', [lineUserId,id])).length) {
        return NextResponse.json({ error: '這個 LINE User ID 已屬於另一個會員，請確認是否為重複帳號。' }, { status: 409 });
      }
      const passwordHash = password ? await hashPassword(password) : null;
      const edited = await query(`UPDATE hr_members SET display_name=$2,email=$3,line_user_id=$4,
        password_hash=COALESCE($5,password_hash),updated_at=NOW() WHERE id=$1
        RETURNING id,email,line_user_id,display_name,role,requested_role,worker_id,employer_id,agency_id,active`,
      [id,displayName,email,lineUserId,passwordHash]);
      if (!edited.length) return NextResponse.json({ error: '找不到會員帳號。' }, { status: 404 });
      return NextResponse.json(edited[0]);
    }
    if (body.type === 'member') {
      if (!validId(body.id)) return NextResponse.json({ error: '會員編號不正確。' }, { status: 400 });
      if (body.role !== undefined) {
        const role = clean(body.role,20), agencyId = Number(body.agencyId);
        const requiresAgency = role !== 'training_center';
        if (!HR_ROLES.has(role) || (requiresAgency && !validId(agencyId))) return NextResponse.json({ error: '請指定有效的會員類型與所屬仲介。' }, { status: 400 });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          if (requiresAgency) {
            const agency = await client.query('SELECT id,agency_type FROM hr_agencies WHERE id=$1 AND active=TRUE FOR SHARE', [agencyId]);
            const expectedAgencyType = role === 'worker' ? 'philippines' : role === 'employer' ? 'taiwan' : null;
            if (!agency.rowCount || (expectedAgencyType && agency.rows[0].agency_type !== expectedAgencyType)) {
              await client.query('ROLLBACK');
              return NextResponse.json({ error: '所屬仲介不存在、已停用或類型不符合會員身分。' }, { status: 400 });
            }
          }
          const member = await client.query('SELECT id,role,worker_id,employer_id,agency_id,display_name FROM hr_members WHERE id=$1 FOR UPDATE', [id]);
          if (!member.rowCount) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: '找不到會員帳號。' }, { status: 404 });
          }
          const current = member.rows[0];
          let workerId = null, employerId = null, memberAgencyId = null;
          if (role === 'worker') {
            if (current.role === 'worker' && current.worker_id) {
              const updated = await client.query('UPDATE hr_workers SET agency_id=$2,updated_at=NOW() WHERE id=$1 RETURNING id', [current.worker_id,agencyId]);
              workerId = updated.rows[0]?.id || null;
            }
            if (!workerId) {
              const created = await client.query('INSERT INTO hr_workers(name,nationality,agency_id) VALUES($1,$2,$3) RETURNING id', [clean(current.display_name,160)||'會員工作者','菲律賓',agencyId]);
              workerId = created.rows[0].id;
            }
          } else if (role === 'employer') {
            if (current.role === 'employer' && current.employer_id) {
              const updated = await client.query('UPDATE hr_employers SET agency_id=$2,updated_at=NOW() WHERE id=$1 RETURNING id', [current.employer_id,agencyId]);
              employerId = updated.rows[0]?.id || null;
            }
            if (!employerId) {
              const created = await client.query('INSERT INTO hr_employers(name,contact_name,agency_id) VALUES($1,$1,$2) RETURNING id', [clean(current.display_name,160)||'會員雇主',agencyId]);
              employerId = created.rows[0].id;
            }
          } else if (role === 'agency') {
            memberAgencyId = agencyId;
          }
          if (current.agency_id && (role !== 'agency' || Number(current.agency_id)!==agencyId)) {
            await client.query('UPDATE hr_job_order_agencies SET broker_member_id=NULL WHERE broker_member_id=$1',[id]);
          }
          const assigned = await client.query(`UPDATE hr_members SET role=$2,requested_role=NULL,requested_agency_id=NULL,worker_id=$3,employer_id=$4,agency_id=$5,active=TRUE,updated_at=NOW()
            WHERE id=$1 RETURNING id,email,display_name,role,worker_id,employer_id,agency_id,requested_role,active`, [id,role,workerId,employerId,memberAgencyId]);
          await client.query('COMMIT');
          return NextResponse.json(assigned.rows[0]);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      }
      if (body.active === false) await query('UPDATE hr_job_order_agencies SET broker_member_id=NULL WHERE broker_member_id=$1',[id]);
      const result = await query('UPDATE hr_members SET active=$2,updated_at=NOW() WHERE id=$1 RETURNING id,email,display_name,role,active', [id,body.active !== false]);
      if (!result.length) return NextResponse.json({ error: '找不到會員帳號。' }, { status: 404 });
      return NextResponse.json(result[0]);
    }
    if (body.type === 'review') {
      if (principal.role === 'agency' && principal.agency_type !== 'philippines') return NextResponse.json({error:'此文件審核流程僅開放菲律賓仲介會員。'},{status:403});
      const submissionId = Number(body.submissionId);
      const decision = clean(body.decision, 20);
      const reason = clean(body.reason, 1000);
      if (!validId(submissionId) || !['approved','returned'].includes(decision) || (decision === 'returned' && !reason)) {
        return NextResponse.json({ error: '請選擇核准或退回，退回時需填寫原因。' }, { status: 400 });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const target = await client.query(`SELECT s.id,s.requirement_id,r.case_id,s.version_number,w.agency_id,
          (SELECT MAX(latest.version_number) FROM hr_document_submissions latest WHERE latest.requirement_id=r.id) AS latest_version
          FROM hr_document_submissions s JOIN hr_case_requirements r ON r.id=s.requirement_id
          JOIN hr_cases c ON c.id=r.case_id JOIN hr_workers w ON w.id=c.worker_id
          WHERE s.id=$1 AND r.status='submitted' FOR UPDATE OF r`, [submissionId]);
        if (principal.role === 'agency' && target.rowCount && Number(target.rows[0].agency_id)!==Number(principal.agency_id)) {
          await client.query('ROLLBACK');
          return NextResponse.json({error:'無權審核其他仲介的文件。'},{status:403});
        }
        if (!target.rowCount || Number(target.rows[0].version_number) !== Number(target.rows[0].latest_version)) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: '此文件已更新或不在待審狀態，請重新整理。' }, { status: 409 });
        }
        const item = target.rows[0];
        await client.query('INSERT INTO hr_document_reviews(submission_id,decision,reason,reviewer) VALUES($1,$2,$3,$4)', [submissionId,decision,decision==='returned'?reason:'',actor]);
        await client.query('UPDATE hr_case_requirements SET status=$2,review_reason=$3,updated_at=NOW() WHERE id=$1', [item.requirement_id,decision,decision==='returned'?reason:'']);
        await client.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) VALUES($1,$2,$3,$4)', [item.case_id,actor,decision==='approved'?'核准文件':'退回文件',decision==='returned'?reason:`文件版本 ${item.version_number}`]);
        await client.query('COMMIT');
        await refreshCaseStage(item.case_id);
        return NextResponse.json({ ok: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
    if (body.type === 'workflow') {
      if (principal.role !== 'admin' && (principal.role !== 'agency' || principal.agency_type !== 'taiwan')) return NextResponse.json({ error: '體檢與訓練狀態由台灣仲介或管理者管理。' }, { status: 403 });
      const caseId = Number(body.caseId);
      const workflowType = clean(body.workflowType, 20);
      const status = clean(body.status, 30);
      const statuses = workflowType === 'medical' ? MEDICAL_STATUSES : workflowType === 'training' ? TRAINING_STATUSES : null;
      if (!validId(caseId) || !statuses?.has(status)) return NextResponse.json({ error: '體檢或訓練狀態不正確。' }, { status: 400 });
      const column = workflowType === 'medical' ? 'medical_status' : 'training_status';
      const previous = await query(`SELECT c.${column} AS current_status,e.agency_id AS employer_agency_id,
        (e.agency_id=$2 OR EXISTS(SELECT 1 FROM hr_job_order_candidates jc JOIN hr_job_order_routes jr ON jr.id=jc.route_id JOIN hr_job_order_agencies ja ON ja.id=jr.order_agency_id WHERE jc.case_id=c.id AND ja.taiwan_agency_id=$2)) AS agency_can_manage,
        EXISTS(SELECT 1 FROM hr_case_requirements r WHERE r.case_id=c.id AND r.entry_gate AND r.applicable AND r.status<>'approved') AS gate_closed
        FROM hr_cases c JOIN hr_employers e ON e.id=c.employer_id WHERE c.id=$1`, [caseId,principal.agency_id||null]);
      if (!previous.length) return NextResponse.json({ error: '找不到案件。' }, { status: 404 });
      if (principal.role === 'agency' && !previous[0].agency_can_manage) return NextResponse.json({ error: '無權管理其他台灣仲介的案件。' }, { status: 403 });
      if (previous[0].gate_closed && status !== 'not_scheduled') return NextResponse.json({ error: '護照資料頁與 PSA 出生證明核准後，才能安排體檢及訓練。' }, { status: 409 });
      const transitions = workflowType === 'medical'
        ? { not_scheduled:['scheduled'], scheduled:['in_progress','passed','retest','failed'], in_progress:['passed','retest','failed'], retest:['scheduled','passed','failed'], failed:['retest'], passed:['retest'] }
        : { not_scheduled:['scheduled'], scheduled:['in_progress','completed'], in_progress:['completed'], completed:[] };
      if (!(transitions[previous[0].current_status] || []).includes(status) && previous[0].current_status !== status) {
        return NextResponse.json({ error: '此狀態不能直接跳轉，請依流程逐步更新。' }, { status: 409 });
      }
      await query(`UPDATE hr_cases SET ${column}=$2,updated_at=NOW() WHERE id=$1`, [caseId,status]);
      await recordActivity(caseId,actor,workflowType==='medical'?'更新體檢進度':'更新訓練進度',status);
      await refreshCaseStage(caseId);
      return NextResponse.json({ ok: true });
    }
    if (!validId(body.id)) return NextResponse.json({ error: '資料編號不正確。' }, { status: 400 });
    if (body.type === 'case') {
      if (principal.role !== 'admin' && (principal.role !== 'agency' || principal.agency_type !== 'taiwan')) return NextResponse.json({ error: '案件狀態由台灣仲介或管理者管理。' }, { status: 403 });
      const status = clean(body.status,40);
      if (!CASE_STATUSES.has(status)) return NextResponse.json({ error: '案件狀態不正確。' }, { status: 400 });
      const assignedMemberProvided = Object.prototype.hasOwnProperty.call(body,'assignedMemberId');
      const assignedMemberId = body.assignedMemberId ? Number(body.assignedMemberId) : null;
      if (body.assignedMemberId && !validId(body.assignedMemberId)) return NextResponse.json({ error: '所屬業務格式不正確。' }, { status: 400 });
      if (!validDate(body.expectedStartDate)) return NextResponse.json({ error: '預計日期格式不正確。' }, { status: 400 });
      if(assignedMemberId){
        const validAssignee=await query(`SELECT m.id FROM hr_members m JOIN hr_cases c ON c.id=$2 JOIN hr_employers e ON e.id=c.employer_id AND e.agency_id=m.agency_id
          WHERE m.id=$1 AND m.role='agency' AND m.active=TRUE AND ($3::text='admin' OR m.agency_id=$4)`,[assignedMemberId,id,principal.role,principal.agency_id||null]);
        if(!validAssignee.length)return NextResponse.json({error:'請選擇該雇主所屬台灣仲介的有效會員。'},{status:400});
      }
      const result = principal.role === 'admin'
        ? await query(`UPDATE hr_cases SET status=$2,assigned_member_id=CASE WHEN $3 THEN $4 ELSE assigned_member_id END,expected_start_date=$5,notes=$6,updated_at=NOW() WHERE id=$1 RETURNING id`, [id,status,assignedMemberProvided,assignedMemberId,body.expectedStartDate || null,clean(body.notes,4000)])
        : await query(`UPDATE hr_cases c SET status=$2,assigned_member_id=CASE WHEN $3 THEN $4 ELSE c.assigned_member_id END,expected_start_date=$5,notes=$6,updated_at=NOW()
            FROM hr_employers e WHERE c.id=$1 AND e.id=c.employer_id AND (e.agency_id=$7 OR EXISTS(SELECT 1 FROM hr_job_order_candidates jc JOIN hr_job_order_routes jr ON jr.id=jc.route_id JOIN hr_job_order_agencies ja ON ja.id=jr.order_agency_id WHERE jc.case_id=c.id AND ja.taiwan_agency_id=$7)) RETURNING c.id`, [id,status,assignedMemberProvided,assignedMemberId,body.expectedStartDate || null,clean(body.notes,4000),principal.agency_id]);
      if (!result.length) return NextResponse.json({ error: '找不到案件。' }, { status: 404 });
      await recordActivity(id, actor, '更新案件', `狀態：${status}`);
      await refreshCaseStage(id);
      return NextResponse.json((await query('SELECT * FROM hr_cases WHERE id=$1',[id]))[0]);
    }
    if (body.type === 'task') {
      const status = clean(body.status,30);
      if (!TASK_STATUSES.has(status)) return NextResponse.json({ error: '待辦狀態不正確。' }, { status: 400 });
      const result = await query('UPDATE hr_case_tasks SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *', [id,status]);
      if (!result.length) return NextResponse.json({ error: '找不到待辦。' }, { status: 404 });
      await recordActivity(result[0].case_id, actor, '更新待辦', `${result[0].title}：${status}`);
      return NextResponse.json(result[0]);
    }
    if (body.type === 'worker-resume') {
      if (principal.role !== 'admin') return NextResponse.json({ error: '只有系統管理者可以管理工作者履歷。' }, { status: 403 });
      if (!validId(id)) return NextResponse.json({ error: '工作者編號不正確。' }, { status: 400 });
      if (body.resumeProfile !== undefined && (!body.resumeProfile || typeof body.resumeProfile !== 'object' || Array.isArray(body.resumeProfile))) {
        return NextResponse.json({ error: '履歷資料格式不正確。' }, { status: 400 });
      }
      const resumeProfile = cleanWorkerResumeProfile(body.clear === true ? {} : body.resumeProfile);
      const result = await query('UPDATE hr_workers SET resume_profile=$2::jsonb,updated_at=NOW() WHERE id=$1 RETURNING id', [id,JSON.stringify(resumeProfile)]);
      if (!result.length) return NextResponse.json({ error: '找不到工作者資料。' }, { status: 404 });
      await resyncRequirements(id);
      return NextResponse.json({ ok: true });
    }
    if (body.type === 'employer' || body.type === 'worker') {
      const table = body.type === 'employer' ? 'hr_employers' : 'hr_workers';
      let result;
      if (body.name !== undefined) {
        if (!clean(body.name,160)) return NextResponse.json({ error: '名稱不能空白。' }, { status: 400 });
        if (body.type === 'employer' && !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });
        result = body.type === 'employer'
          ? await query('UPDATE hr_employers SET name=$2,contact_name=$3,phone=$4,email=$5,address=$6,notes=$7,employer_type=$8,agency_id=$9,updated_at=NOW() WHERE id=$1 RETURNING *', [id,clean(body.name,160),clean(body.contactName,120),clean(body.phone,50),clean(body.email,254),clean(body.address,300),clean(body.notes,2000),body.employerType,body.agencyId&&validId(body.agencyId)?Number(body.agencyId):null])
          : await query('UPDATE hr_workers SET name=$2,nationality=$3,phone=$4,email=$5,job_preference=$6,notes=$7,resume_profile=resume_profile || COALESCE($8::jsonb,\'{}\'::jsonb),agency_id=$9,updated_at=NOW() WHERE id=$1 RETURNING *', [id,clean(body.name,160),clean(body.nationality,80),clean(body.phone,50),clean(body.email,254),clean(body.jobPreference,120),clean(body.notes,2000),body.resumeProfile===undefined?null:JSON.stringify(workerProfileWithReference(body.resumeProfile,clean(body.jobPreference,120),id)),body.agencyId&&validId(body.agencyId)?Number(body.agencyId):null]);
      } else {
        const status = body.status === 'inactive' ? 'inactive' : 'active';
        result = await query(`UPDATE ${table} SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *`, [id,status]);
      }
      if (!result.length) return NextResponse.json({ error: '找不到資料。' }, { status: 404 });
      if (body.type === 'worker') await resyncRequirements(id);
      return NextResponse.json(result[0]);
    }
    return NextResponse.json({ error: '更新項目不正確。' }, { status: 400 });
  } catch (error) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Email、LINE User ID 或所屬資料已由其他會員使用，請確認後再試。' }, { status: 409 });
    if (error?.code === '23503') return NextResponse.json({ error: '關聯資料不存在，請重新整理後再選擇。' }, { status: 400 });
    console.error('hr_management_update_failed', error?.name || 'Error');
    return NextResponse.json({ error: '更新失敗，請稍後再試。' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。' }, { status: 403 });
  const deleteType=new URL(request.url).searchParams.get('type');
  try {
    await ensureSchema();
    const principal = await getHrPrincipal(session);
    if (!principal) return NextResponse.json({ error: 'HR membership required' }, { status: 403 });
    const url=new URL(request.url),id=Number(url.searchParams.get('id'));
    if(deleteType==='member'){
      if(principal.role!=='admin')return NextResponse.json({error:'僅系統管理者可刪除會員帳號。'},{status:403});
      if(!validId(id))return NextResponse.json({error:'會員編號不正確。'},{status:400});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const member=await client.query('SELECT id,email,line_user_id,admin_scope FROM hr_members WHERE id=$1 FOR UPDATE',[id]);
        if(!member.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到會員帳號。'},{status:404});}
        const target=member.rows[0];
        if(target.admin_scope==='system'||target.admin_scope==='agency'||getAdminEmails().includes(String(target.email||'').trim().toLowerCase())||getAdminLineUserIds().includes(target.line_user_id)){
          await client.query('ROLLBACK');return NextResponse.json({error:'管理者帳號受保護，不能從會員管理刪除。'},{status:403});
        }
        const sameEmail=target.email&&session.user.email&&target.email.toLowerCase()===session.user.email.trim().toLowerCase();
        const sameLineUser=target.line_user_id&&session.user.lineUserId&&target.line_user_id===session.user.lineUserId;
        if(sameEmail||sameLineUser){await client.query('ROLLBACK');return NextResponse.json({error:'無法刪除目前登入中的管理者帳號。'},{status:400});}
        await client.query('UPDATE hr_job_order_candidates SET proposed_by=NULL WHERE proposed_by=$1',[id]);
        await client.query('DELETE FROM hr_members WHERE id=$1',[id]);
        await client.query('COMMIT');
        return NextResponse.json({ok:true});
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    if(url.searchParams.get('type')==='job-order'){
      if(principal.role!=='employer')return NextResponse.json({error:'僅雇主可刪除自己的需求單。'},{status:403});
      if(!validId(id))return NextResponse.json({error:'需求單編號不正確。'},{status:400});
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const order=await client.query('SELECT id,status FROM hr_job_orders WHERE id=$1 AND employer_id=$2 FOR UPDATE',[id,principal.employer_id]);
        if(!order.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到此需求單。'},{status:404});}
        if(order.rows[0].status!=='open'){await client.query('ROLLBACK');return NextResponse.json({error:'此需求單已確認或結束，無法刪除。'},{status:409});}
        const activity=await client.query(`SELECT
          EXISTS(SELECT 1 FROM hr_job_order_routes r JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id WHERE oa.job_order_id=$1) AS has_routes,
          EXISTS(SELECT 1 FROM hr_job_order_candidates c JOIN hr_job_order_routes r ON r.id=c.route_id JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id WHERE oa.job_order_id=$1) AS has_candidates`,[id]);
        if(activity.rows[0].has_routes||activity.rows[0].has_candidates){await client.query('ROLLBACK');return NextResponse.json({error:'仲介已開始處理此需求單，無法再刪除。'},{status:409});}
        await client.query('DELETE FROM hr_job_orders WHERE id=$1',[id]);
        await client.query('COMMIT');
        return NextResponse.json({ok:true});
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    if (principal.role !== 'agency' || principal.agency_type !== 'philippines') return NextResponse.json({ error: '僅菲律賓仲介可管理工作者資料。' }, { status: 403 });
    if (!validId(id)) return NextResponse.json({ error: '工作者編號不正確。' }, { status: 400 });
    const removed = await query('UPDATE hr_workers SET agency_id=NULL,updated_at=NOW() WHERE id=$1 AND agency_id=$2 RETURNING id', [id,principal.agency_id]);
    if (removed.length) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: '找不到所屬仲介的工作者資料。' }, { status: 404 });
  } catch (error) {
    console.error(deleteType==='member'?'hr_member_delete_failed':'hr_agency_worker_unlink_failed', error?.name || 'Error');
    return NextResponse.json({ error: deleteType==='member'?'刪除會員帳號失敗，請稍後再試。':'移除工作者所屬仲介失敗。' }, { status: 500 });
  }
}
