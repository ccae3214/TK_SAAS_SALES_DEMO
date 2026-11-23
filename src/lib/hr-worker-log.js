import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { migrateOnce } from './migrate-once.js';
import {
  WORKER_LOG_PAGE_SIZE, describeLogin, describeWorkerOperation, isWorkerRelatedType, shapeWorkerLogRow,
} from './hr-worker-log-core.js';

// 工人會員的活動紀錄（資料庫的部分）。誰能看、怎麼描述操作在 hr-worker-log-core.js。
// 紀錄失敗只會寫 log，不會影響原本的操作；紀錄只新增、不提供修改或刪除的介面。
// worker_id 刻意不設外鍵：工人資料被刪除後，紀錄仍然保留。

export function ensureWorkerLogSchema() {
  return migrateOnce('worker-log', async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_worker_activity_log (
      id BIGSERIAL PRIMARY KEY,
      worker_id BIGINT NOT NULL,
      worker_name TEXT NOT NULL DEFAULT '',
      actor_member_id BIGINT,
      actor_name TEXT NOT NULL DEFAULT '',
      actor_role TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_name TEXT NOT NULL DEFAULT '',
      summary_zh TEXT NOT NULL,
      summary_en TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_worker_activity_log_worker ON hr_worker_activity_log(worker_id, id DESC)');
  });
}

const ACTOR_ROLES = new Set(['worker', 'agency', 'admin', 'employer', 'training_center']);
const idOf = value => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };
const one = async (sql, params) => (await query(sql, params))[0] || null;

// 寫入一筆工人活動紀錄。entry: { action, zh, en }；失敗只記 log。
export async function recordWorkerLog({ workerId, workerName = '', principal = null, session = null, entry, targetType = '', targetName = '' }) {
  try {
    const id = idOf(workerId);
    if (!id || !entry?.action || !entry?.zh) return;
    const role = ACTOR_ROLES.has(principal?.role) ? principal.role : 'system';
    const actorName = role === 'system' ? '' : String(principal?.name || session?.user?.name || session?.user?.email || '').slice(0, 160);
    await ensureWorkerLogSchema();
    await pool.query(
      `INSERT INTO hr_worker_activity_log(worker_id,worker_name,actor_member_id,actor_name,actor_role,action,target_type,target_name,summary_zh,summary_en)
       VALUES($1,COALESCE(NULLIF($2::text,''),(SELECT name FROM hr_workers WHERE id=$1),''),$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, String(workerName || '').slice(0, 160), role === 'system' ? null : idOf(principal?.id), actorName, role, String(entry.action).slice(0, 40),
        String(targetType || '').slice(0, 60), String(targetName || '').slice(0, 200), String(entry.zh).slice(0, 500), String(entry.en || '').slice(0, 500)],
    );
  } catch (error) { console.error('hr_worker_log_write_failed', error?.name || 'Error'); }
}

// 工人登入時記一筆（只記有綁定工人資料、且啟用中的工作者會員）；失敗只記 log。
export async function recordWorkerLogin({ lineUserId = null, email = null } = {}) {
  try {
    const mail = String(email || '').trim().toLowerCase();
    const line = String(lineUserId || '');
    if (!mail && !line) return;
    const member = await one(`SELECT m.id, m.display_name, m.worker_id FROM hr_members m
      WHERE m.active=TRUE AND m.role='worker' AND m.worker_id IS NOT NULL
        AND (($1 <> '' AND lower(m.email)=$1) OR ($2 <> '' AND m.line_user_id=$2)) LIMIT 1`, [mail, line]);
    if (!member) return;
    await recordWorkerLog({ workerId: member.worker_id, principal: { role: 'worker', id: member.id, name: member.display_name }, entry: describeLogin(), targetType: 'login' });
  } catch (error) { console.error('hr_worker_log_login_failed', error?.name || 'Error'); }
}

// 找出「這個操作是針對哪一位工人」。要在 handler 執行前先查（刪除後就查不到名字了）。
async function resolveWorkerTarget({ method, type, body, id, principal }) {
  try {
    switch (type) {
      case 'worker': case 'worker-resume':
        return id ? await one('SELECT id AS worker_id, name AS worker_name FROM hr_workers WHERE id=$1', [id]) : null;
      case 'worker-acknowledge': {
        const own = idOf(principal?.worker_id);
        return own ? await one('SELECT id AS worker_id, name AS worker_name FROM hr_workers WHERE id=$1', [own]) : null;
      }
      case 'member': case 'member-profile': case 'member-admin-scope': case 'member-restore':
        return id ? await one('SELECT m.worker_id, w.name AS worker_name FROM hr_members m JOIN hr_workers w ON w.id=m.worker_id WHERE m.id=$1', [id]) : null;
      case 'review': {
        const submissionId = idOf(body.submissionId);
        return submissionId ? await one(`SELECT r.worker_id, w.name AS worker_name, r.name AS item_name FROM hr_document_submissions s
          JOIN hr_worker_documents r ON r.id=s.requirement_id JOIN hr_workers w ON w.id=r.worker_id WHERE s.id=$1`, [submissionId]) : null;
      }
      case 'requirement-applicability': {
        const requirementId = idOf(body.requirementId);
        return requirementId ? await one(`SELECT r.worker_id, w.name AS worker_name, r.name AS item_name FROM hr_worker_documents r
          JOIN hr_workers w ON w.id=r.worker_id WHERE r.id=$1`, [requirementId]) : null;
      }
      case 'workflow': case 'application-step': case 'case': {
        const caseId = type === 'case' ? idOf(body.id) : idOf(body.caseId);
        return caseId ? await one(`SELECT c.worker_id, w.name AS worker_name, c.case_number AS item_name FROM hr_cases c
          JOIN hr_workers w ON w.id=c.worker_id WHERE c.id=$1`, [caseId]) : null;
      }
      case 'certification': {
        const certificationId = idOf(body.id);
        return certificationId ? await one(`SELECT c.worker_id, w.name AS worker_name FROM hr_case_certifications k
          JOIN hr_cases c ON c.id=k.case_id JOIN hr_workers w ON w.id=c.worker_id WHERE k.id=$1`, [certificationId]) : null;
      }
      case 'job-order-candidate': {
        if (method !== 'POST') return null;
        const workerId = idOf(body.workerId);
        return workerId ? await one('SELECT id AS worker_id, name AS worker_name FROM hr_workers WHERE id=$1', [workerId]) : null;
      }
      case 'job-order-candidate-interview': case 'job-order-candidate-withdraw': {
        const candidateId = idOf(body.candidateId);
        return candidateId ? await one(`SELECT jc.worker_id, w.name AS worker_name FROM hr_job_order_candidates jc
          JOIN hr_workers w ON w.id=jc.worker_id WHERE jc.id=$1`, [candidateId]) : null;
      }
      default: return null;
    }
  } catch { return null; }
}

// 在 handler 執行前呼叫：判斷這個請求是不是工人相關的操作，是的話先查好對象。不相關或查不到就回傳 null。
export async function prepareWorkerLog(request, method) {
  let body = {}, type = '', id = null;
  if (method === 'DELETE') {
    const url = new URL(request.url);
    type = url.searchParams.get('type') || '';
    id = idOf(url.searchParams.get('id'));
    body = { purge: url.searchParams.get('purge') === '1' };
  } else {
    try { body = (await request.clone().json()) || {}; } catch { return null; }
    type = typeof body.type === 'string' ? body.type : '';
    id = method === 'POST' ? null : idOf(body.id);
  }
  if (!isWorkerRelatedType(type)) return null;
  const session = await auth();
  if (!session?.user) return null;
  const principal = await getHrPrincipal(session);
  if (!principal?.role) return null;
  const target = await resolveWorkerTarget({ method, type, body, id, principal });
  return { session, principal, method, type, body, id, target };
}

// handler 成功（2xx）之後呼叫：寫入紀錄。
export async function writeWorkerLog(ctx, response) {
  let target = ctx.target;
  let created = null;
  if (ctx.method === 'POST' && ctx.type === 'worker') {
    try { created = await response.clone().json(); } catch { created = null; }
    const createdId = idOf(created?.id);
    if (createdId) target = { worker_id: createdId, worker_name: String(created?.name || '') };
  }
  // 會員變更成工作者類型時，工人資料是這次操作才建立的，所以操作後再查一次。
  if (!target && ctx.type === 'member' && ctx.id) target = await resolveWorkerTarget({ method: ctx.method, type: ctx.type, body: ctx.body, id: ctx.id, principal: ctx.principal });
  if (!target?.worker_id) return;
  const isSelf = ctx.principal.role === 'worker' && Number(ctx.principal.worker_id) === Number(target.worker_id);
  // 工人只能編輯自己的資料與確認自己的案件事項；其餘由管理端操作。
  const entry = describeWorkerOperation({ method: ctx.method, type: ctx.type, body: ctx.body, name: target.item_name || '', isSelf });
  if (!entry) return;
  await recordWorkerLog({ workerId: target.worker_id, workerName: target.worker_name || '', principal: ctx.principal, session: ctx.session, entry, targetType: ctx.type, targetName: target.item_name || '' });
}

// 讀取活動紀錄。scope: { workerId }：
//   workerId 有值 → 只看這位工人；沒有 → 全部（系統管理者）。
// 範圍一律由呼叫端依登入者決定，不直接接受前端傳入。
export async function readWorkerLog({ workerId = null, q = '', beforeId = null, limit = WORKER_LOG_PAGE_SIZE, viewerRole }) {
  await ensureWorkerLogSchema();
  const params = [];
  const where = [];
  if (workerId) { params.push(workerId); where.push(`worker_id=$${params.length}`); }
  if (beforeId) { params.push(beforeId); where.push(`id<$${params.length}`); }
  if (q) { params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); where.push(`(summary_zh ILIKE $${params.length} OR summary_en ILIKE $${params.length} OR worker_name ILIKE $${params.length} OR actor_name ILIKE $${params.length})`); }
  params.push(limit + 1);
  const rows = await query(
    `SELECT id,worker_id,worker_name,actor_role,actor_name,action,summary_zh,summary_en,created_at
     FROM hr_worker_activity_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT $${params.length}`, params);
  return { rows: rows.slice(0, limit).map(row => shapeWorkerLogRow(row, viewerRole)), hasMore: rows.length > limit };
}

// 系統管理者在畫面上可選的工人清單。
export async function listLoggableWorkers() {
  return query('SELECT id, name FROM hr_workers ORDER BY name LIMIT 1000');
}
