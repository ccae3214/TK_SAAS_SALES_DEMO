// 仲介機構自己的「基本資料」與「仲介證書」。
// 不 import '@/…'，所以 node:test 可以直接測試；db 只需要有 query(sql, params)，寫入用的 pool 需要 connect()。
// 為什麼放在獨立資料表：hr_agencies 會回傳給工人、雇主與其他仲介（只有名稱與國家），電話、Email、地址、許可字號不應該跟著公開。
// 誰可以看：系統管理者、該仲介機構的所有成員。誰可以改：系統管理者、該機構的「仲介管理者」（與相互認證相同的規則）。

export const AGENCY_CERTIFICATE_TYPES = {
  license: { zh: '仲介許可證', en: 'Agency license' },
  registration: { zh: '公司／營業登記證', en: 'Business registration certificate' },
  other: { zh: '其他證書', en: 'Other certificate' },
};
export const AGENCY_CERTIFICATE_MAX_SIZE = 10 * 1024 * 1024;
export const AGENCY_CERTIFICATE_LIMIT = 30;

export const AGENCY_PROFILE_LIMITS = { name: 160, country: 80, contactPerson: 80, phone: 40, email: 254, address: 300, licenseNumber: 80 };

// 錯誤用代碼回傳，畫面依目前語言顯示中文或英文；error 欄位是中文備用說明。
export const AGENCY_PROFILE_ERRORS = {
  name_required: '請填寫仲介機構名稱。',
  phone_invalid: '電話只能包含數字、空格與 + - ( ) # . 符號。',
  email_invalid: 'Email 格式不正確。',
  name_taken: '已經有同類型、同名稱的仲介機構，請換一個名稱。',
  forbidden: '只有仲介管理者可以編輯機構資料與證書。',
  not_found: '找不到仲介機構。',
  agency_required: '請指定仲介機構。',
};

const text = (value, max) => (typeof value === 'string' ? value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '');
const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
export const isValidAgencyId = validId;

// 回傳 { error: code } 或 { value }。agencyType 用來決定「國家／地區」留白時的預設值。
export function normalizeAgencyProfileInput(input = {}, agencyType = 'taiwan') {
  const L = AGENCY_PROFILE_LIMITS;
  const name = text(input.name, L.name);
  if (!name) return { error: 'name_required' };
  const phone = text(input.phone, L.phone);
  if (phone && !/^[0-9+()\-#.\s]+$/.test(phone)) return { error: 'phone_invalid' };
  const email = text(input.email, L.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'email_invalid' };
  return {
    value: {
      name,
      country: text(input.country, L.country) || (agencyType === 'philippines' ? '菲律賓' : '台灣'),
      contact_person: text(input.contactPerson, L.contactPerson),
      phone,
      email,
      address: text(input.address, L.address),
      license_number: text(input.licenseNumber, L.licenseNumber),
    },
  };
}

// 證書到期日：空白代表沒有期限；格式錯誤回傳 undefined。
export function normalizeExpiry(value) {
  const raw = text(value, 10);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? undefined : raw;
}

export function isCertificateExpired(expiresOn, today = new Date()) {
  const raw = text(String(expiresOn || ''), 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw < today.toISOString().slice(0, 10);
}

// ---- 權限 ----
export function canViewAgencyProfile(principal, agencyId) {
  if (!principal || !validId(agencyId)) return false;
  if (principal.role === 'admin') return true;
  return principal.role === 'agency' && Number(principal.agency_id) === Number(agencyId);
}
export function canManageAgencyProfile(principal, agencyId) {
  if (!canViewAgencyProfile(principal, agencyId)) return false;
  return principal.role === 'admin' || !!principal.is_agency_admin;
}
// 系統管理者要指定 agencyId；仲介一律只能用自己所屬的機構（忽略傳入值）。
export function resolveAgencyId(principal, requested) {
  if (principal?.role === 'admin') return validId(requested) ? Number(requested) : null;
  if (principal?.role === 'agency' && validId(principal.agency_id)) return Number(principal.agency_id);
  return null;
}

// ---- 資料表 ----
export async function ensureAgencyProfileSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hr_agency_profiles (
    agency_id BIGINT PRIMARY KEY REFERENCES hr_agencies(id) ON DELETE CASCADE,
    contact_person TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    license_number TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS hr_agency_certificates (
    id BIGSERIAL PRIMARY KEY,
    agency_id BIGINT NOT NULL REFERENCES hr_agencies(id) ON DELETE CASCADE,
    cert_type TEXT NOT NULL DEFAULT 'license',
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    iv BYTEA NOT NULL,
    auth_tag BYTEA NOT NULL,
    encrypted_data BYTEA NOT NULL,
    expires_on DATE,
    note TEXT NOT NULL DEFAULT '',
    uploaded_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS hr_agency_certificates_agency ON hr_agency_certificates(agency_id, created_at DESC)');
}

// ---- 讀取 ----
export async function readAgencyProfile(db, agencyId) {
  const agency = (await db.query('SELECT id,name,agency_type,country FROM hr_agencies WHERE id=$1', [agencyId])).rows?.[0];
  if (!agency) return null;
  const profile = (await db.query('SELECT contact_person,phone,email,address,license_number,updated_by,updated_at FROM hr_agency_profiles WHERE agency_id=$1', [agencyId])).rows?.[0]
    || { contact_person: '', phone: '', email: '', address: '', license_number: '', updated_by: '', updated_at: null };
  const certificates = (await db.query(`SELECT id,cert_type,original_filename,content_type,size_bytes,to_char(expires_on,'YYYY-MM-DD') AS expires_on,note,uploaded_by,created_at
    FROM hr_agency_certificates WHERE agency_id=$1 ORDER BY created_at DESC,id DESC`, [agencyId])).rows || [];
  return { agency, profile, certificates };
}

// ---- 寫入（單一交易）----
// 回傳 { ok:true } 或 { error: code }。名稱重複（hr_agencies 的 UNIQUE(name, agency_type)）轉成 name_taken。
export async function saveAgencyProfile(pool, agencyId, value, actor = '') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query('UPDATE hr_agencies SET name=$2,country=$3,updated_at=NOW() WHERE id=$1 RETURNING id', [agencyId, value.name, value.country]);
    if (!(updated.rows?.length ?? updated.rowCount)) { await client.query('ROLLBACK'); return { error: 'not_found' }; }
    await client.query(`INSERT INTO hr_agency_profiles(agency_id,contact_person,phone,email,address,license_number,updated_by,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT(agency_id) DO UPDATE SET contact_person=EXCLUDED.contact_person,phone=EXCLUDED.phone,email=EXCLUDED.email,
        address=EXCLUDED.address,license_number=EXCLUDED.license_number,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
    [agencyId, value.contact_person, value.phone, value.email, value.address, value.license_number, String(actor || '').slice(0, 254)]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error?.code === '23505') return { error: 'name_taken' };
    throw error;
  } finally {
    client.release();
  }
}
