import pool, { get } from '@/lib/db';

export const HR_ROLES = new Set(['worker', 'employer', 'agency']);

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminLineUserIds() {
  return (process.env.HR_ADMIN_LINE_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

export function isHrAdminSession(session) {
  const email = session?.user?.email?.trim().toLowerCase();
  const lineUserId = session?.user?.lineUserId;
  return (!!email && getAdminEmails().includes(email)) || (!!lineUserId && getAdminLineUserIds().includes(lineUserId));
}

export async function ensureHrIdentitySchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS hr_agencies (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    agency_type TEXT NOT NULL CHECK (agency_type IN ('taiwan','philippines')),
    country TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, agency_type)
  )`);
  await pool.query('ALTER TABLE hr_workers ADD COLUMN IF NOT EXISTS agency_id BIGINT REFERENCES hr_agencies(id)');
  await pool.query('ALTER TABLE hr_employers ADD COLUMN IF NOT EXISTS agency_id BIGINT REFERENCES hr_agencies(id)');
  await pool.query("ALTER TABLE hr_employers ADD COLUMN IF NOT EXISTS employer_type TEXT NOT NULL DEFAULT 'other'");
  await pool.query(`CREATE TABLE IF NOT EXISTS hr_members (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE,
    line_user_id TEXT UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    role TEXT CHECK (role IS NULL OR role IN ('worker','employer','agency')),
    requested_role TEXT CHECK (requested_role IS NULL OR requested_role IN ('worker','employer','agency')),
    worker_id BIGINT UNIQUE REFERENCES hr_workers(id) ON DELETE CASCADE,
    employer_id BIGINT UNIQUE REFERENCES hr_employers(id) ON DELETE CASCADE,
    agency_id BIGINT REFERENCES hr_agencies(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
      (role IS NULL AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL) OR
      (role='worker' AND worker_id IS NOT NULL AND employer_id IS NULL AND agency_id IS NULL) OR
      (role='employer' AND employer_id IS NOT NULL AND worker_id IS NULL AND agency_id IS NULL) OR
      (role='agency' AND agency_id IS NOT NULL AND worker_id IS NULL AND employer_id IS NULL)
    ),
    CHECK (email IS NOT NULL OR line_user_id IS NOT NULL)
  )`);
  await pool.query('ALTER TABLE hr_members ALTER COLUMN email DROP NOT NULL');
  await pool.query('ALTER TABLE hr_members ALTER COLUMN role DROP NOT NULL');
  await pool.query('ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS requested_role TEXT');
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_role_check');
  await pool.query("ALTER TABLE hr_members ADD CONSTRAINT hr_members_role_check CHECK (role IS NULL OR role IN ('worker','employer','agency'))");
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_check');
  await pool.query(`ALTER TABLE hr_members ADD CONSTRAINT hr_members_check CHECK (
    (role IS NULL AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL) OR
    (role='worker' AND worker_id IS NOT NULL AND employer_id IS NULL AND agency_id IS NULL) OR
    (role='employer' AND employer_id IS NOT NULL AND worker_id IS NULL AND agency_id IS NULL) OR
    (role='agency' AND agency_id IS NOT NULL AND worker_id IS NULL AND employer_id IS NULL)
  )`);
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_check1');
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_identity_check');
  await pool.query('ALTER TABLE hr_members ADD CONSTRAINT hr_members_identity_check CHECK (email IS NOT NULL OR line_user_id IS NOT NULL)');
  await pool.query("ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_requested_role_check");
  await pool.query("ALTER TABLE hr_members ADD CONSTRAINT hr_members_requested_role_check CHECK (requested_role IS NULL OR requested_role IN ('worker','employer','agency'))");
  await pool.query('CREATE INDEX IF NOT EXISTS hr_members_active_role ON hr_members(role, active)');
  // One agency can have multiple member logins; worker and employer links stay unique.
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_agency_id_key');
  await pool.query('CREATE INDEX IF NOT EXISTS hr_members_agency_id_idx ON hr_members(agency_id) WHERE agency_id IS NOT NULL');
}

export async function getHrPrincipal(session) {
  const email = session?.user?.email?.trim().toLowerCase() || '';
  const lineUserId = session?.user?.lineUserId || '';
  if (!email && !lineUserId) return null;
  if ((email && getAdminEmails().includes(email)) || (lineUserId && getAdminLineUserIds().includes(lineUserId))) {
    return { role: 'admin', email: email || null, name: session.user.name || email || '管理者' };
  }

  const member = await get(`SELECT m.id, m.email, m.line_user_id, m.display_name, m.role, m.requested_role,
      m.worker_id, m.employer_id, m.agency_id, m.active, a.agency_type
    FROM hr_members m LEFT JOIN hr_agencies a ON a.id=m.agency_id
    WHERE m.active=TRUE AND (($1 <> '' AND lower(m.email)=lower($1)) OR ($2 <> '' AND m.line_user_id=$2))`, [email, lineUserId]);
  return member ? { ...member, role: member.role, name: member.display_name } : null;
}

