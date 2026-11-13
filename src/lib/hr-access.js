import pool, { get } from '@/lib/db';

export const HR_ROLES = new Set(['worker', 'employer', 'agency', 'training_center']);
export const HR_MEMBER_ROLES = new Set([...HR_ROLES, 'system_admin']);

export function getAdminEmails() {
  return [process.env.ADMIN_EMAILS, process.env.HR_ADMIN_EMAILS]
    .filter(Boolean)
    .join(',')
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

export function isHrRootAdminSession(session) {
  const lineUserId = session?.user?.lineUserId;
  return !!lineUserId && getAdminLineUserIds().includes(lineUserId);
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
    role TEXT CHECK (role IS NULL OR role IN ('worker','employer','agency','training_center','system_admin')),
    requested_role TEXT CHECK (requested_role IS NULL OR requested_role IN ('worker','employer','agency','training_center')),
    requested_agency_id BIGINT REFERENCES hr_agencies(id) ON DELETE SET NULL,
    worker_id BIGINT UNIQUE REFERENCES hr_workers(id) ON DELETE CASCADE,
    employer_id BIGINT UNIQUE REFERENCES hr_employers(id) ON DELETE CASCADE,
    agency_id BIGINT REFERENCES hr_agencies(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    admin_scope TEXT NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
      (role IS NULL AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL) OR
      (role='worker' AND worker_id IS NOT NULL AND employer_id IS NULL AND agency_id IS NULL) OR
      (role='employer' AND employer_id IS NOT NULL AND worker_id IS NULL AND agency_id IS NULL) OR
      (role='agency' AND agency_id IS NOT NULL AND worker_id IS NULL AND employer_id IS NULL) OR
      (role='training_center' AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL) OR
      (role='system_admin' AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL)
    ),
    CHECK (email IS NOT NULL OR line_user_id IS NOT NULL)
  )`);
  await pool.query('ALTER TABLE hr_members ALTER COLUMN email DROP NOT NULL');
  await pool.query('ALTER TABLE hr_members ALTER COLUMN role DROP NOT NULL');
  await pool.query("ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS admin_scope TEXT NOT NULL DEFAULT 'none'");
  await pool.query("ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_admin_scope_check");
  await pool.query("ALTER TABLE hr_members ADD CONSTRAINT hr_members_admin_scope_check CHECK (admin_scope IN ('none','agency','system'))");
  await pool.query('ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS requested_role TEXT');
  await pool.query('ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS requested_agency_id BIGINT REFERENCES hr_agencies(id) ON DELETE SET NULL');
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_role_check');
  await pool.query("ALTER TABLE hr_members ADD CONSTRAINT hr_members_role_check CHECK (role IS NULL OR role IN ('worker','employer','agency','training_center','system_admin'))");
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_check');
  await pool.query(`ALTER TABLE hr_members ADD CONSTRAINT hr_members_check CHECK (
    (role IS NULL AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL) OR
    (role='worker' AND worker_id IS NOT NULL AND employer_id IS NULL AND agency_id IS NULL) OR
    (role='employer' AND employer_id IS NOT NULL AND worker_id IS NULL AND agency_id IS NULL) OR
    (role='agency' AND agency_id IS NOT NULL AND worker_id IS NULL AND employer_id IS NULL) OR
    (role='training_center' AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL) OR
    (role='system_admin' AND worker_id IS NULL AND employer_id IS NULL AND agency_id IS NULL)
  )`);
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_check1');
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_identity_check');
  await pool.query('ALTER TABLE hr_members ADD CONSTRAINT hr_members_identity_check CHECK (email IS NOT NULL OR line_user_id IS NOT NULL)');
  await pool.query("ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_requested_role_check");
  await pool.query("ALTER TABLE hr_members ADD CONSTRAINT hr_members_requested_role_check CHECK (requested_role IS NULL OR requested_role IN ('worker','employer','agency','training_center'))");
  await pool.query('CREATE INDEX IF NOT EXISTS hr_members_active_role ON hr_members(role, active)');
  // 會員離開工作者／雇主類型時，記住原本綁定的資料列，之後切換回來就重用同一筆，避免產生重複的工作者／雇主。
  await pool.query('ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS last_worker_id BIGINT REFERENCES hr_workers(id) ON DELETE SET NULL');
  await pool.query('ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS last_employer_id BIGINT REFERENCES hr_employers(id) ON DELETE SET NULL');
  // 新手導覽看過的紀錄：{ 導覽名稱: 版本 }
  await pool.query("ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS onboarding_seen JSONB NOT NULL DEFAULT '{}'::jsonb");
  // One agency can have multiple member logins; worker and employer links stay unique.
  await pool.query('ALTER TABLE hr_members DROP CONSTRAINT IF EXISTS hr_members_agency_id_key');
  await pool.query('CREATE INDEX IF NOT EXISTS hr_members_agency_id_idx ON hr_members(agency_id) WHERE agency_id IS NOT NULL');
  await syncMemberActiveStatus();
}

// 會員的啟用狀態是唯一來源：停用／啟用會員時，綁定的工作者／雇主資料會同步更新。
// 用資料庫 trigger 處理，網頁管理員、仲介管理者、LINE bot 都走同一套規則。
async function syncMemberActiveStatus() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 避免多個請求同時建立 function / trigger 而互相衝突。
    await client.query('SELECT pg_advisory_xact_lock(727401)');
    await client.query(`CREATE OR REPLACE FUNCTION hr_sync_member_active_status() RETURNS trigger AS $$
    BEGIN
      IF NEW.active IS DISTINCT FROM OLD.active THEN
        IF NEW.worker_id IS NOT NULL THEN
          UPDATE hr_workers
            SET status = CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END, updated_at = NOW()
            WHERE id = NEW.worker_id
              AND status <> CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END;
        END IF;
        IF NEW.employer_id IS NOT NULL THEN
          UPDATE hr_employers
            SET status = CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END, updated_at = NOW()
            WHERE id = NEW.employer_id
              AND status <> CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END;
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql`);
    await client.query('DROP TRIGGER IF EXISTS hr_members_sync_active_status ON hr_members');
    await client.query(`CREATE TRIGGER hr_members_sync_active_status
      AFTER UPDATE OF active ON hr_members
      FOR EACH ROW EXECUTE PROCEDURE hr_sync_member_active_status()`);
    // 修正既有資料：會員已停用，但綁定的工作者／雇主還是啟用。
    await client.query(`UPDATE hr_workers w SET status='inactive', updated_at=NOW()
      FROM hr_members m WHERE m.worker_id=w.id AND m.active=FALSE AND w.status='active'`);
    await client.query(`UPDATE hr_employers e SET status='inactive', updated_at=NOW()
      FROM hr_members m WHERE m.employer_id=e.id AND m.active=FALSE AND e.status='active'`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function getHrPrincipal(session) {
  const email = session?.user?.email?.trim().toLowerCase() || '';
  const lineUserId = session?.user?.lineUserId || '';
  if (!email && !lineUserId) return null;
  if ((email && getAdminEmails().includes(email)) || (lineUserId && getAdminLineUserIds().includes(lineUserId))) {
    return { role: 'admin', email: email || null, name: session.user.name || email || '管理者' };
  }

  const member = await get(`SELECT m.id, m.email, m.line_user_id, m.display_name, m.role, m.requested_role, m.requested_agency_id,
      requested_agency.name AS requested_agency_name,requested_agency.agency_type AS requested_agency_type,m.admin_scope,
      m.worker_id, m.employer_id, m.agency_id, m.active, a.agency_type
    FROM hr_members m LEFT JOIN hr_agencies a ON a.id=m.agency_id
    LEFT JOIN hr_agencies requested_agency ON requested_agency.id=m.requested_agency_id
    WHERE m.active=TRUE AND (($1 <> '' AND lower(m.email)=lower($1)) OR ($2 <> '' AND m.line_user_id=$2))`, [email, lineUserId]);
  if (member?.admin_scope === 'system') return { ...member, role: 'admin', admin_scope: 'system', name: member.display_name };
  return member ? { ...member, role: member.role, is_agency_admin: member.admin_scope === 'agency', name: member.display_name } : null;
}
