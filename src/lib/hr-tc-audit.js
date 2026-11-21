import pool, { query } from '@/lib/db';
import { migrateOnce } from './migrate-once.js';
import { TC_AUDIT_ACTIONS, tcAuditSummary } from './hr-tc-audit-shared.js';

// 訓練中心操作紀錄：記錄「誰在哪個訓練中心做了什麼操作」。系統管理者與訓練中心會員自己的操作都會記。
// 系統管理者與該訓練中心自己可以查看（canViewTrainingCenterAudit）；這裡只提供新增與查詢，不提供修改或刪除。
// 資料表刻意不設外鍵：訓練中心帳號被刪除後，過去的紀錄仍然保留。
// 寫入失敗只會寫 log，不會影響原本的操作。

export function ensureTrainingCenterAuditSchema() {
  return migrateOnce('tc-audit', async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_tc_audit_log (
      id BIGSERIAL PRIMARY KEY,
      center_id BIGINT NOT NULL,
      center_name TEXT NOT NULL DEFAULT '',
      actor_member_id BIGINT,
      actor_name TEXT NOT NULL,
      actor_email TEXT NOT NULL DEFAULT '',
      actor_kind TEXT NOT NULL CHECK (actor_kind IN ('system_admin','training_center')),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id BIGINT,
      target_name TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_tc_audit_log_center_id ON hr_tc_audit_log(center_id, id DESC)');
  });
}

const idOf = value => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };

// ctx 是訓練中心 API 的存取資訊：{ session, principal, self }；self 為 true 代表訓練中心會員操作自己的資料。
export async function recordTrainingCenterAction({ ctx, centerId, action, type, id, name, phrase, detail = '' }) {
  try {
    const center = idOf(centerId);
    if (!center || !TC_AUDIT_ACTIONS.includes(action)) return;
    const actorKind = ctx.self ? 'training_center' : 'system_admin';
    const actorName = String(ctx.principal?.name || ctx.session?.user?.name || ctx.session?.user?.email || (ctx.self ? '訓練中心' : '系統管理員')).slice(0, 160);
    const centerRow = (await query('SELECT display_name FROM hr_members WHERE id=$1', [center]))[0];
    await ensureTrainingCenterAuditSchema();
    await pool.query(
      `INSERT INTO hr_tc_audit_log(center_id,center_name,actor_member_id,actor_name,actor_email,actor_kind,action,target_type,target_id,target_name,detail,summary)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [center, String(centerRow?.display_name || '').slice(0, 160), idOf(ctx.principal?.id), actorName, String(ctx.session?.user?.email || '').slice(0, 254), actorKind,
        action, String(type || '').slice(0, 60), idOf(id), String(name || '').slice(0, 200), String(detail || '').slice(0, 200), tcAuditSummary(actorName, actorKind, phrase)]
    );
  } catch (error) { console.error('hr_tc_audit_write_failed', error?.name || 'Error'); }
}

// 讀取某個訓練中心的操作紀錄（新的在前）。before 是上一頁最後一筆的 id，用來載入更早的紀錄。
export async function listTrainingCenterAudit(centerId, { limit = 100, before = null } = {}) {
  await ensureTrainingCenterAuditSchema();
  const size = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const rows = await query(
    `SELECT id, center_id, center_name, actor_name, actor_email, actor_kind, action, target_type, target_name, detail, summary, created_at
       FROM hr_tc_audit_log
      WHERE center_id=$1 AND ($2::bigint IS NULL OR id < $2::bigint)
      ORDER BY id DESC LIMIT $3`,
    [centerId, before, size + 1]
  );
  const page = rows.slice(0, size);
  return { rows: page, nextBefore: rows.length > size ? page[page.length - 1].id : null };
}
