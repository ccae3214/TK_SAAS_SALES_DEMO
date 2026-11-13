import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../../src/lib/passwords.js';

export function reviewPool() {
  const url = new URL(process.env.DATABASE_URL);
  if (process.env.LOCAL_REVIEW_ONLY !== '1' || url.pathname !== '/tk_saas_review' || url.hostname !== 'review-postgres') {
    throw new Error('Fixtures refuse non-review databases');
  }
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
}
export async function fixtures(pool) {
  const suffix = randomUUID().replaceAll('-', '');
  const password = process.env.REVIEW_LOGIN_PASSWORD;
  if (!password) throw new Error('Review login password is required locally');
  const hash = await hashPassword(password);
  const ids = [];
  async function member(kind, fields = {}) {
    const result = await pool.query(`INSERT INTO hr_members(email,display_name,password_hash,role,admin_scope,line_user_id,active,agency_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [`review-${kind}-${suffix}-${ids.length}@example.invalid`, `DEMO ${kind} ${suffix.slice(0,8)}`, hash,
      fields.role || null, fields.adminScope || 'none', fields.line || null, fields.active !== false, fields.agencyId || null]);
    ids.push(result.rows[0].id);
    return result.rows[0];
  }
  async function close() {
    // Preserve evidence/history; do not reset passwords, delete rows or touch previous fixtures.
    await pool.query("UPDATE hr_notification_outbox SET status='cancelled',last_error_code='recipient_or_request_changed',updated_at=NOW() WHERE subject_member_id=ANY($1::bigint[]) AND status IN ('pending','retry')",[ids]);
    await pool.query("UPDATE hr_members SET active=FALSE,admin_scope='none' WHERE id=ANY($1::bigint[])",[ids]);
  }
  return { member, close, suffix, password, ids };
}
