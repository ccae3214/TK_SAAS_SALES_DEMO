// Shared transaction boundary for worker/employer records and their login member.
// No schema changes. Callers retain role/tenant authorization; scope is rechecked under lock.
const RECORDS = { worker: ['hr_workers', 'worker_id'], employer: ['hr_employers', 'employer_id'] };
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export class LinkedRecordError extends Error {
  constructor(message, status) { super(message); this.name = 'LinkedRecordError'; this.status = status; }
}

export function normalizeRecordEmail(value, { member = null, reservedEmails = [], allowEmpty = true } = {}) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if ((!email && !allowEmpty) || (email && (email.length > 254 || !EMAIL_PATTERN.test(email)))) {
    throw new LinkedRecordError('請填寫有效的登入 Email；已綁定 Email 登入的會員不可清空。', 400);
  }
  const current = String(member?.email || '').trim().toLowerCase();
  if (email && email !== current && reservedEmails.some(item => String(item).trim().toLowerCase() === email)) {
    throw new LinkedRecordError('此 Email 為受保護的管理者登入帳號，不能透過工作者或雇主資料建立或變更。', 403);
  }
  return email;
}

async function assertEmailFree(client, email, member) {
  if (!email) return;
  const duplicate = await client.query('SELECT 1 FROM hr_members WHERE lower(email)=lower($1) AND ($2::bigint IS NULL OR id<>$2) LIMIT 1', [email, member?.id || null]);
  if (duplicate.rowCount) throw new LinkedRecordError('這個 Email 已屬於另一個會員，請改用不同的 Email。', 409);
}

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function updateLinkedRecord(pool, { kind, id, agencyId, fields, reservedEmails = [], update }) {
  const config = Object.hasOwn(RECORDS, kind) ? RECORDS[kind] : null;
  if (!config) throw new LinkedRecordError('更新項目不正確。', 400);
  const [table, column] = config;
  return transaction(pool, async client => {
    // Member first: its active-status trigger also writes the linked record.
    const linked = await client.query(`SELECT id,email,line_user_id FROM hr_members WHERE ${column}=$1 FOR UPDATE`, [id]);
    const member = linked.rows[0] || null;
    const record = await client.query(`SELECT id FROM ${table} WHERE id=$1${agencyId === undefined ? '' : ' AND agency_id=$2'} FOR UPDATE`, agencyId === undefined ? [id] : [id, agencyId]);
    if (!record.rowCount) throw new LinkedRecordError('找不到可管理的所屬資料。', 404);
    const normalized = { ...fields };
    if (Object.hasOwn(fields, 'email')) {
      normalized.email = normalizeRecordEmail(fields.email, { member, reservedEmails, allowEmpty: !member || (!member.email && !!member.line_user_id) });
      await assertEmailFree(client, normalized.email, member);
    }
    const saved = await update(client, normalized);
    if (!saved || String(saved.id) !== String(id)) throw new LinkedRecordError('找不到可管理的所屬資料。', 404);
    if (member) {
      // NULL means "not part of this edit"; blank contact email is only allowed for LINE-only accounts.
      const email = Object.hasOwn(normalized, 'email') ? normalized.email || null : null;
      if (Object.hasOwn(normalized, 'email')) {
        await client.query(`UPDATE hr_members SET display_name=COALESCE($2,display_name),email=$3,
          active=COALESCE($4,active),updated_at=NOW() WHERE id=$1`, [member.id, normalized.name || null, email, typeof normalized.active === 'boolean' ? normalized.active : null]);
      } else {
        await client.query(`UPDATE hr_members SET display_name=COALESCE($2,display_name),
          active=COALESCE($3,active),updated_at=NOW() WHERE id=$1`, [member.id, normalized.name || null, typeof normalized.active === 'boolean' ? normalized.active : null]);
      }
    }
    return saved;
  });
}

export async function updateLinkedMemberProfile(pool, { id, fields, reservedEmails = [], authorize, update }) {
  return transaction(pool, async client => {
    const found = await client.query('SELECT id,email,line_user_id,role,admin_scope,worker_id,employer_id FROM hr_members WHERE id=$1 FOR UPDATE', [id]);
    const member = found.rows[0];
    if (!member) throw new LinkedRecordError('找不到會員帳號。', 404);
    authorize(member);
    const normalized = { ...fields };
    const kind = member.worker_id ? 'worker' : member.employer_id ? 'employer' : null;
    if (kind) {
      normalized.email = normalizeRecordEmail(fields.email, { member, reservedEmails, allowEmpty: !!fields.lineUserId });
      const [table, column] = RECORDS[kind];
      await client.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [member[column]]);
    }
    await assertEmailFree(client, normalized.email, member);
    const saved = await update(client, normalized);
    if (!saved || String(saved.id) !== String(id)) throw new LinkedRecordError('找不到會員帳號。', 404);
    if (kind) {
      const [table, column] = RECORDS[kind];
      await client.query(`UPDATE ${table} SET name=$2,email=$3,updated_at=NOW() WHERE id=$1`, [member[column], fields.displayName, normalized.email || '']);
    }
    return saved;
  });
}
