import pool, { query } from '@/lib/db';
import { migrateOnce } from './migrate-once.js';
import { AGENCY_AUDIT_PAGE_SIZE, shouldRecordAgencyAudit } from './hr-agency-audit-core.js';

// 仲介機構的操作紀錄（資料庫的部分）。誰能看、怎麼描述操作在 hr-agency-audit-core.js。
// 紀錄失敗只會寫 log，不會影響原本的操作；紀錄只新增、不提供修改或刪除的介面。
// agency_id 刻意不設外鍵：仲介機構被刪除後，紀錄仍然保留。

export function ensureAgencyAuditSchema() {
  return migrateOnce('agency-audit', async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_agency_audit_log (
      id BIGSERIAL PRIMARY KEY,
      agency_id BIGINT NOT NULL,
      agency_name TEXT NOT NULL DEFAULT '',
      actor_member_id BIGINT,
      actor_name TEXT NOT NULL,
      actor_email TEXT NOT NULL DEFAULT '',
      actor_is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id BIGINT,
      target_name TEXT NOT NULL DEFAULT '',
      summary_zh TEXT NOT NULL,
      summary_en TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_agency_audit_log_agency ON hr_agency_audit_log(agency_id, id DESC)');
    // 改之前／改之後（只存變動的欄位，見 hr-audit-snapshot.js）。舊紀錄維持 NULL。
    await pool.query('ALTER TABLE hr_agency_audit_log ADD COLUMN IF NOT EXISTS before_data JSONB, ADD COLUMN IF NOT EXISTS after_data JSONB');
  });
}

const idOf = value => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };

// 寫入一筆仲介操作紀錄。principal 必須是有所屬機構的仲介成員，否則直接略過。
export async function recordAgencyAction({ principal, session, action, type, id, name, zh, en, before = null, after = null }) {
  try {
    if (!shouldRecordAgencyAudit(principal) || !action || !zh) return;
    const actorName = String(principal.name || session?.user?.name || session?.user?.email || '仲介成員').slice(0, 160);
    await ensureAgencyAuditSchema();
    await pool.query(
      `INSERT INTO hr_agency_audit_log(agency_id,agency_name,actor_member_id,actor_name,actor_email,actor_is_admin,action,target_type,target_id,target_name,summary_zh,summary_en,before_data,after_data)
       VALUES($1,COALESCE((SELECT name FROM hr_agencies WHERE id=$1),''),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)`,
      [Number(principal.agency_id), idOf(principal.id), actorName, String(session?.user?.email || principal.email || '').slice(0, 254), !!principal.is_agency_admin,
        String(action).slice(0, 40), String(type || '').slice(0, 60), idOf(id), String(name || '').slice(0, 200), String(zh).slice(0, 500), String(en || '').slice(0, 500),
        before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null],
    );
  } catch (error) { console.error('hr_agency_audit_write_failed', error?.name || 'Error'); }
}

// 讀取某個仲介機構的操作紀錄（agencyId 一律由呼叫端用登入者的機構決定，不接受前端傳入）。
export async function readAgencyAudit(agencyId, { actorId = null, action = '', q = '', beforeId = null, limit = AGENCY_AUDIT_PAGE_SIZE } = {}) {
  await ensureAgencyAuditSchema();
  const params = [Number(agencyId)];
  const where = ['agency_id=$1'];
  if (actorId) { params.push(actorId); where.push(`actor_member_id=$${params.length}`); }
  if (action) { params.push(action); where.push(`action=$${params.length}`); }
  if (beforeId) { params.push(beforeId); where.push(`id<$${params.length}`); }
  if (q) { params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); where.push(`(summary_zh ILIKE $${params.length} OR summary_en ILIKE $${params.length} OR actor_name ILIKE $${params.length} OR target_name ILIKE $${params.length})`); }
  params.push(limit + 1);
  const rows = await query(
    `SELECT id,actor_member_id,actor_name,actor_email,actor_is_admin,action,target_type,target_name,summary_zh,summary_en,before_data,after_data,created_at
     FROM hr_agency_audit_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT $${params.length}`, params);
  const actors = await query(
    `SELECT actor_member_id AS id, (array_agg(actor_name ORDER BY id DESC))[1] AS name
     FROM hr_agency_audit_log WHERE agency_id=$1 AND actor_member_id IS NOT NULL GROUP BY actor_member_id ORDER BY 2`, [Number(agencyId)]);
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit, actors };
}
