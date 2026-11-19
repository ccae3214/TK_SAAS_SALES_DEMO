import { DEPOSIT_MESSAGES as M, parseDepositAmount } from './hr-candidate-deposit.js';

// 登記（或取消登記）雇主已付訂金。只有該需求單所屬的台灣仲介與管理者可以操作；
// route 在既有的登入與同源檢查之後才會呼叫，principal 由 route 建立。
export async function recordCandidateDeposit(pool, principal, body, actor = '') {
  const isAdmin = principal?.role === 'admin';
  const isTaiwanAgency = principal?.role === 'agency' && principal.agency_type === 'taiwan';
  if (!isAdmin && !isTaiwanAgency) return { status: 403, body: { error: M.forbidden } };
  const candidateId = body?.candidateId;
  if (!/^\d+$/.test(String(candidateId ?? '')) || Number(candidateId) <= 0) {
    return { status: 400, body: { error: M.badId } };
  }
  const paid = body?.paid !== false;
  const amount = paid ? parseDepositAmount(body?.amount) : null;
  if (paid && amount === null) return { status: 400, body: { error: M.badAmount } };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT c.id,c.status,c.case_id
      FROM hr_job_order_candidates c
      JOIN hr_job_order_routes r ON r.id=c.route_id
      JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id
      WHERE c.id=$1 AND ($2::bigint IS NULL OR oa.taiwan_agency_id=$2)
      FOR UPDATE OF c`, [candidateId, isAdmin ? null : principal.agency_id]);
    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return { status: 404, body: { error: M.notFound } };
    }
    const candidate = found.rows[0];
    if (candidate.status !== 'passed') {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: M.notHired } };
    }
    const updated = paid
      ? await client.query(`UPDATE hr_job_order_candidates
          SET deposit_amount=$2,deposit_paid_at=COALESCE(deposit_paid_at,NOW()),deposit_recorded_by=$3,updated_at=NOW()
          WHERE id=$1 RETURNING id,status,deposit_amount,deposit_paid_at`, [candidateId, amount, principal.id || null])
      : await client.query(`UPDATE hr_job_order_candidates
          SET deposit_amount=NULL,deposit_paid_at=NULL,deposit_recorded_by=NULL,updated_at=NOW()
          WHERE id=$1 RETURNING id,status,deposit_amount,deposit_paid_at`, [candidateId]);
    if (candidate.case_id) {
      await client.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) VALUES($1,$2,$3,$4)',
        [candidate.case_id, actor, paid ? '登記雇主已付訂金（結單）' : '取消雇主訂金登記', paid ? `NT$ ${amount.toLocaleString('en-US')}` : '']);
    }
    await client.query('COMMIT');
    return { status: 200, body: { ok: true, ...updated.rows[0], closed: paid } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
