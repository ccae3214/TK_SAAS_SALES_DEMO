import { randomUUID } from 'node:crypto';

// No provider calls inside business transactions. Only this new table is added.
const schemaJobs = new WeakMap();
export function ensureNotificationSchema(pool) {
  if (!schemaJobs.has(pool)) {
    const job = initializeNotificationSchema(pool).catch(error => { schemaJobs.delete(pool); throw error; });
    schemaJobs.set(pool, job);
  }
  return schemaJobs.get(pool);
}
async function initializeNotificationSchema(pool) {
  const db = await pool.connect();
  try {
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(729103)');
  await db.query(`CREATE TABLE IF NOT EXISTS hr_notification_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_key TEXT NOT NULL,
    subject_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL,
    recipient_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL,
    recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('member','environment')),
    recipient_line_id TEXT NOT NULL,
    delivery_key UUID NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','sent','failed','cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_until TIMESTAMPTZ,
    lease_key UUID,
    last_error_code TEXT,
    attempt_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    UNIQUE(event_key,recipient_line_id)
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS hr_notification_outbox_due ON hr_notification_outbox(next_attempt_at)
    WHERE status IN ('pending','retry','processing')`);
  await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK').catch(() => {}); throw error; }
  finally { db.release(); }
}

export const notificationAuthority = (env = process.env) => ({
  adminEmails: [env.ADMIN_EMAILS, env.HR_ADMIN_EMAILS].filter(Boolean).join(',').split(',').map(x => x.trim().toLowerCase()).filter(Boolean),
  rootLineIds: (env.HR_ADMIN_LINE_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean),
});

export function isNotificationAdmin(member, authority) {
  return !!member && (authority.rootLineIds.includes(member.line_user_id)
    || authority.adminEmails.includes(String(member.email || '').trim().toLowerCase())
    || (member.active === true && member.admin_scope === 'system'));
}

export async function enqueueMemberRequest(client, memberId, authority) {
  const rows = await client.query(`SELECT id,email,line_user_id,active,admin_scope FROM hr_members
    WHERE line_user_id IS NOT NULL AND line_user_id<>''
      AND ((active=TRUE AND admin_scope='system') OR lower(email)=ANY($1::text[]) OR line_user_id=ANY($2::text[]))`,
  [authority.adminEmails, authority.rootLineIds]);
  const recipients = new Map(authority.rootLineIds.map(line => [line, { kind: 'environment', id: null }]));
  for (const member of rows.rows) {
    if (isNotificationAdmin(member, authority) && !recipients.has(member.line_user_id)) {
      recipients.set(member.line_user_id, { kind: 'member', id: member.id });
    }
  }
  const ids = [];
  for (const [line, recipient] of recipients) {
    const saved = await client.query(`INSERT INTO hr_notification_outbox(event_key,subject_member_id,recipient_member_id,recipient_kind,recipient_line_id,delivery_key)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key,recipient_line_id) DO NOTHING RETURNING id`,
    [`member-request:${memberId}`, memberId, recipient.id, recipient.kind, line, randomUUID()]);
    ids.push(...saved.rows.map(row => row.id));
  }
  return ids;
}

export class MemberRequestConflict extends Error {}

export async function submitMemberRequest(pool, { email, lineUserId, displayName, requestedRole, requestedAgencyId }, authority) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializes same-identity submissions before an unbound member exists, without merging identities.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,729102))', [lineUserId || email]);
    const found = await client.query(`SELECT id,role,active,requested_role FROM hr_members
      WHERE ($1::text IS NOT NULL AND lower(email)=lower($1)) OR ($2::text IS NOT NULL AND line_user_id=$2) FOR UPDATE`, [email, lineUserId]);
    if (found.rowCount > 1 || found.rows.some(row => row.role || !row.active)) throw new MemberRequestConflict();
    const previous = found.rows[0];
    if (requestedAgencyId) {
      const agency = await client.query(`SELECT id FROM hr_agencies WHERE id=$1 AND active=TRUE
        AND ($2::text IS NULL OR agency_type=$2) FOR SHARE`, [requestedAgencyId, requestedRole === 'worker' ? 'philippines' : requestedRole === 'employer' ? 'taiwan' : null]);
      if (!agency.rowCount) throw new MemberRequestConflict();
    }
    const saved = previous
      ? await client.query(`UPDATE hr_members SET requested_role=$2,requested_agency_id=$3,updated_at=NOW()
          WHERE id=$1 AND role IS NULL RETURNING id,requested_role,requested_agency_id`, [previous.id, requestedRole, requestedAgencyId])
      : await client.query(`INSERT INTO hr_members(email,line_user_id,display_name,role,requested_role,requested_agency_id,active)
          VALUES($1,$2,$3,NULL,$4,$5,TRUE) RETURNING id,requested_role,requested_agency_id`, [email, lineUserId, displayName, requestedRole, requestedAgencyId]);
    if (!saved.rowCount) throw new MemberRequestConflict();
    const notificationIds = previous?.requested_role ? [] : await enqueueMemberRequest(client, saved.rows[0].id, authority);
    await client.query('COMMIT');
    return { member: saved.rows[0], notificationIds };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export function renderRequestNotification(baseUrl, memberId, language = 'zh') {
  const url = new URL('/hr', baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('notification_configuration');
  url.searchParams.set('memberRequest', String(memberId));
  const labels = {
    zh: '有新的會員申請等待審核。請登入管理系統查看。',
    en: 'A new membership request needs review. Sign in to the administration site.',
    tl: 'May bagong aplikasyon sa membership na kailangang suriin. Mag-sign in sa administration site.',
  };
  return [{ type: 'text', text: `${labels[language] || labels.zh}\n${url.href}` }];
}

export function lineOutcome(status, acceptedRequestId = null) {
  if ((status >= 200 && status < 300) || (status === 409 && acceptedRequestId)) return { status: 'sent', code: null };
  if (status === 429 || status >= 500) return { status: 'retry', code: `line_http_${status}` };
  return { status: 'failed', code: `line_http_${status}` };
}

export async function pushNotification(row, messages, { token, fetchImpl = fetch }) {
  const response = await fetchImpl('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Line-Retry-Key': row.delivery_key },
    body: JSON.stringify({ to: row.recipient_line_id, messages }),
    signal: AbortSignal.timeout(8000),
  });
  return lineOutcome(response.status, response.headers.get('x-line-accepted-request-id'));
}

async function validateDelivery(db, row, authority) {
  const subject = await db.query('SELECT role,active,requested_role FROM hr_members WHERE id=$1', [row.subject_member_id]);
  if (!subject.rows[0]?.active || subject.rows[0].role || !subject.rows[0].requested_role) return false;
  if (row.recipient_kind === 'environment') return authority.rootLineIds.includes(row.recipient_line_id);
  const target = await db.query('SELECT email,line_user_id,active,admin_scope FROM hr_members WHERE id=$1', [row.recipient_member_id]);
  return target.rows[0]?.line_user_id === row.recipient_line_id && isNotificationAdmin(target.rows[0], authority);
}

async function recipientLanguage(db, line) {
  const present = await db.query("SELECT to_regclass('public.hr_line_member_settings') AS name");
  if (!present.rows[0]?.name) return 'zh';
  const result = await db.query('SELECT preferred_language FROM hr_line_member_settings WHERE line_user_id=$1', [line]);
  return result.rows[0]?.preferred_language || 'zh';
}

// Dependency injection is for deterministic tests; production never accepts a browser-supplied transport/recipient.
export async function dispatchNotifications(pool, {
  authority = notificationAuthority(), baseUrl = process.env.APP_ORIGIN || process.env.NEXTAUTH_URL,
  token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN, send = null, ids = null, limit = 5,
} = {}) {
  const counts = { claimed: 0, sent: 0, retry: 0, failed: 0, cancelled: 0, configurationMissing: false };
  if ((!token && !send) || !baseUrl) { counts.configurationMissing = true; return counts; }
  // Validate configuration before claiming: do not burn retries while the environment is unconfigured.
  try { renderRequestNotification(baseUrl, 1); } catch { counts.configurationMissing = true; return counts; }
  const client = await pool.connect();
  let claimed;
  const batchLimit = Math.max(1, Math.min(20, Math.floor(Number(limit)) || 5));
  const lease = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE hr_notification_outbox SET status='failed',last_error_code='attempts_exhausted',updated_at=NOW(),
      attempt_history=attempt_history || jsonb_build_array(jsonb_build_object('at',NOW(),'status','failed','code','attempts_exhausted'))
      WHERE status='processing' AND lease_until<NOW() AND attempts>=5 AND ($1::bigint[] IS NULL OR id=ANY($1::bigint[]))`, [ids]);
    claimed = (await client.query(`WITH due AS (
      SELECT id FROM hr_notification_outbox WHERE attempts<5 AND ($1::bigint[] IS NULL OR id=ANY($1::bigint[]))
        AND ((status IN ('pending','retry') AND next_attempt_at<=NOW()) OR (status='processing' AND lease_until<NOW()))
      ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $2
    ) UPDATE hr_notification_outbox n SET status='processing',attempts=n.attempts+1,lease_key=$3,
      lease_until=NOW()+($4::integer*INTERVAL '1 second'),updated_at=NOW() FROM due WHERE n.id=due.id RETURNING n.*`,
    [ids, batchLimit, lease, Math.max(30, batchLimit * 10 + 5)])).rows;
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
  counts.claimed = claimed.length;
  for (const row of claimed) {
    let outcome;
    try {
      if (!(await validateDelivery(pool, row, authority))) outcome = { status: 'cancelled', code: 'recipient_or_request_changed' };
      else {
        const messages = renderRequestNotification(baseUrl, row.subject_member_id, await recipientLanguage(pool, row.recipient_line_id));
        outcome = send ? await send(row, messages) : await pushNotification(row, messages, { token });
        if (!['sent', 'retry', 'failed'].includes(outcome?.status)) outcome = { status: 'failed', code: 'invalid_transport_result' };
      }
    } catch { outcome = { status: 'retry', code: 'transport_or_store_error' }; }
    if (outcome.status === 'retry' && row.attempts >= 5) outcome = { status: 'failed', code: 'attempts_exhausted' };
    // Only fixed safe codes are persisted; never serialize provider exceptions or message payloads.
    const safeCode = /^(line_http_\d{3}|recipient_or_request_changed|transport_or_store_error|attempts_exhausted|invalid_transport_result)$/.test(outcome.code || '') ? outcome.code : null;
    const saved = await pool.query(`UPDATE hr_notification_outbox SET status=$3,last_error_code=$4,
      next_attempt_at=NOW()+($5::integer*INTERVAL '1 second'),lease_until=NULL,lease_key=NULL,
      sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END,updated_at=NOW(),
      attempt_history=attempt_history || jsonb_build_array(jsonb_build_object('at',NOW(),'status',$3::text,'code',$4::text,'attempt',attempts))
      WHERE id=$1 AND status='processing' AND lease_key=$2 RETURNING id`,
    [row.id, lease, outcome.status, safeCode, Math.min(300, 5 * (2 ** (row.attempts - 1)))]);
    if (saved.rowCount) counts[outcome.status]++;
  }
  return counts;
}
