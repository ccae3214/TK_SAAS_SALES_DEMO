import { DEPOSIT_MESSAGES as M, parseDepositAmount } from './hr-candidate-deposit.js';

const fail = (status, error) => ({ status, body: { error } });

// 只有管理者與台灣仲介可以登記；回傳 null 代表沒有權限。
function depositActor(principal) {
  if (principal?.role === 'admin') return { agencyId: null };
  if (principal?.role === 'agency' && principal.agency_type === 'taiwan') return { agencyId: principal.agency_id };
  return null;
}

// 檢查請求內容：{ error } 或 { candidateId, paid, amount }。取消登記（paid: false）不需要金額。
function parseDepositRequest(body) {
  const candidateId = body?.candidateId;
  if (!/^\d+$/.test(String(candidateId ?? '')) || Number(candidateId) <= 0) return { error: fail(400, M.badId) };
  const paid = body?.paid !== false;
  const amount = paid ? parseDepositAmount(body?.amount) : null;
  if (paid && amount === null) return { error: fail(400, M.badAmount) };
  return { candidateId, paid, amount };
}

// 鎖定候選人並確認已錄用；台灣仲介只能動自己需求單上的候選人。
async function lockHiredCandidate(client, candidateId, agencyId) {
  const found = await client.query(`SELECT c.id,c.status,c.case_id
      FROM hr_job_order_candidates c
      JOIN hr_job_order_routes r ON r.id=c.route_id
      JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id
      WHERE c.id=$1 AND ($2::bigint IS NULL OR oa.taiwan_agency_id=$2)
      FOR UPDATE OF c`, [candidateId, agencyId]);
  if (!found.rowCount) return { error: fail(404, M.notFound) };
  if (found.rows[0].status !== 'passed') return { error: fail(409, M.notHired) };
  return { candidate: found.rows[0] };
}

function writeDeposit(client, { candidateId, paid, amount }, recordedBy) {
  return paid
    ? client.query(`UPDATE hr_job_order_candidates
          SET deposit_amount=$2,deposit_paid_at=COALESCE(deposit_paid_at,NOW()),deposit_recorded_by=$3,updated_at=NOW()
          WHERE id=$1 RETURNING id,status,deposit_amount,deposit_paid_at`, [candidateId, amount, recordedBy])
    : client.query(`UPDATE hr_job_order_candidates
          SET deposit_amount=NULL,deposit_paid_at=NULL,deposit_recorded_by=NULL,updated_at=NOW()
          WHERE id=$1 RETURNING id,status,deposit_amount,deposit_paid_at`, [candidateId]);
}

async function logDepositActivity(client, caseId, actor, { paid, amount }) {
  if (!caseId) return;
  await client.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) VALUES($1,$2,$3,$4)',
    [caseId, actor, paid ? '登記雇主已付訂金（結單）' : '取消雇主訂金登記', paid ? `NT$ ${amount.toLocaleString('en-US')}` : '']);
}

// 登記（或取消登記）雇主已付訂金。只有該需求單所屬的台灣仲介與管理者可以操作；
// route 在既有的登入與同源檢查之後才會呼叫，principal 由 route 建立。
export async function recordCandidateDeposit(pool, principal, body, actor = '') {
  const access = depositActor(principal);
  if (!access) return fail(403, M.forbidden);
  const request = parseDepositRequest(body);
  if (request.error) return request.error;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await lockHiredCandidate(client, request.candidateId, access.agencyId);
    if (locked.error) {
      await client.query('ROLLBACK');
      return locked.error;
    }
    const updated = await writeDeposit(client, request, principal.id || null);
    await logDepositActivity(client, locked.candidate.case_id, actor, request);
    await client.query('COMMIT');
    return { status: 200, body: { ok: true, ...updated.rows[0], closed: request.paid } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
