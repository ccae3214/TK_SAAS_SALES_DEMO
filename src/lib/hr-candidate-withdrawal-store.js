import { WITHDRAWAL_MARKER, isWithdrawnRecommendation, canWithdrawRecommendation } from './hr-candidate-withdrawal.js';

// Only the route may construct this principal after the existing auth / Origin checks.
export async function withdrawRecommendation(pool, principal, candidateId, now = () => new Date()) {
  if (principal?.role !== 'agency' || principal.agency_type !== 'philippines') {
    return { status: 403, body: { error: '僅所屬菲律賓仲介可撤回推薦。' } };
  }
  if (!/^\d+$/.test(String(candidateId ?? '')) || Number(candidateId) <= 0) {
    return { status: 400, body: { error: '推薦紀錄編號不正確。' } };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT c.*,o.status AS order_status,
        (c.proposed_by IS NULL OR EXISTS(SELECT 1 FROM hr_members proposer
          WHERE proposer.id=c.proposed_by AND proposer.role='agency' AND proposer.agency_id=r.philippines_agency_id)) AS agency_recommendation
      FROM hr_job_order_candidates c
      JOIN hr_job_order_routes r ON r.id=c.route_id
      JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id
      JOIN hr_job_orders o ON o.id=oa.job_order_id
      JOIN hr_workers w ON w.id=c.worker_id
      WHERE c.id=$1 AND r.philippines_agency_id=$2 AND w.agency_id=$2
      FOR UPDATE OF c,o`, [candidateId, principal.agency_id]);
    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return { status: 404, body: { error: '找不到所屬機構的推薦紀錄。' } };
    }
    const candidate = found.rows[0];
    if (isWithdrawnRecommendation(candidate)) {
      await client.query('COMMIT');
      return { status: 200, body: { ok: true, id: candidate.id, status: candidate.status, withdrawn: true, alreadyWithdrawn: true } };
    }
    if (!canWithdrawRecommendation(candidate) || candidate.order_status !== 'open') {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: '只能撤回仲介推薦且尚未安排面試的人選；已安排面試、錄用或結束的需求不可撤回。' } };
    }
    const entry = WITHDRAWAL_MARKER + JSON.stringify({ at: now().toISOString(), memberId: principal.id });
    const updated = await client.query(`UPDATE hr_job_order_candidates
      SET status='rejected',notes=notes || $2,updated_at=NOW() WHERE id=$1 RETURNING id,status`, [candidateId, entry]);
    await client.query('COMMIT');
    return { status: 200, body: { ok: true, ...updated.rows[0], withdrawn: true, alreadyWithdrawn: false } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
