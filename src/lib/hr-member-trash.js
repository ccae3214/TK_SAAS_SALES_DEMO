// 會員帳號的「已刪除帳號」（資源回收區）。
//
// 管理者按「刪除帳號」時，不會立刻把資料刪掉，而是：
//   1. 把會員標記為已刪除（deleted_at）並停用（active=FALSE，停止登入）。
//   2. 資料庫 trigger（hr_sync_member_active_status）會同步停用綁定的工作者／雇主資料，
//      還原時再一起啟用，所以履歷、文件、進度都原封不動。
// 只有在「已刪除帳號」裡按「永久刪除」，才會真的刪除資料（見 /api/hr 的 DELETE ?purge=1）。

// 加在 hr_members 的欄位；ensureHrIdentitySchema 會執行這一句。
export const MEMBER_TRASH_COLUMN_SQL = 'ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ';

// 把會員移到「已刪除帳號」。會員不存在、或已經在已刪除帳號時回傳 null。
// 呼叫端需要自己開 transaction（client 是 pool.connect() 取得的連線）。
export async function trashMember(client, id) {
  const result = await client.query(
    `UPDATE hr_members SET active=FALSE, deleted_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND deleted_at IS NULL
     RETURNING id,role,worker_id,employer_id`,
    [id],
  );
  if (!result.rowCount) return null;
  // 與「停用帳號」一致：被停用的仲介業務不再掛在需求單上。
  await client.query('UPDATE hr_job_order_agencies SET broker_member_id=NULL WHERE broker_member_id=$1', [id]);
  return result.rows[0];
}

// 從「已刪除帳號」還原。會員不存在、或不在已刪除帳號時回傳 null。
export async function restoreTrashedMember(client, id) {
  const result = await client.query(
    `UPDATE hr_members SET active=TRUE, deleted_at=NULL, updated_at=NOW()
     WHERE id=$1 AND deleted_at IS NOT NULL
     RETURNING id,email,display_name,role,admin_scope,worker_id,employer_id,agency_id,active`,
    [id],
  );
  return result.rows[0] || null;
}
