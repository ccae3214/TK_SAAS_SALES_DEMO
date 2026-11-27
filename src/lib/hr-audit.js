import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { migrateOnce } from './migrate-once.js';
import { describeAgencyOperation, shouldRecordAgencyAudit } from './hr-agency-audit-core.js';
import { recordAgencyAction } from './hr-agency-audit.js';
import { prepareWorkerLog, writeWorkerLog } from './hr-worker-log.js';
import {
  ADMIN_AUDIT_INSERT_SQL, ADMIN_AUDIT_INSERT_WITH_CHANGES_SQL, adminActionParams, adminActorName, adminAuditParams, describeAdminOperation, idOf, lineAdminActionParams, targetIdOf,
} from './hr-admin-audit-core.js';
import { diffSnapshots, snapshotKindOf, takeSnapshot } from './hr-audit-snapshot.js';

// 系統管理員操作紀錄：記錄「哪一位系統管理員做了什麼操作」。
// 紀錄失敗只會寫 log，不會影響原本的操作。

export function ensureAuditSchema() {
  return migrateOnce('audit', async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_member_id BIGINT,
      actor_name TEXT NOT NULL,
      actor_email TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id BIGINT,
      target_name TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_admin_audit_log_created ON hr_admin_audit_log(created_at DESC, id DESC)');
    // 改之前／改之後（只存變動的欄位，見 hr-audit-snapshot.js）。舊紀錄維持 NULL。
    await pool.query('ALTER TABLE hr_admin_audit_log ADD COLUMN IF NOT EXISTS before_data JSONB, ADD COLUMN IF NOT EXISTS after_data JSONB');
  });
}

const runQuery = (sql, params) => query(sql, params);

const one = async (sql, params) => (await query(sql, params))[0] || null;

// 取得操作對象目前的名稱與狀態（刪除或變更前先查，才記得到名字）。
async function lookupTarget(type, id) {
  if (!id) return null;
  try {
    switch (type) {
      case 'employer': return await one('SELECT name, status FROM hr_employers WHERE id=$1', [id]);
      case 'worker': case 'worker-resume': return await one('SELECT name, status FROM hr_workers WHERE id=$1', [id]);
      case 'agency': return await one('SELECT name, CASE WHEN active THEN \'active\' ELSE \'inactive\' END AS status FROM hr_agencies WHERE id=$1', [id]);
      case 'member': case 'member-profile': case 'member-admin-scope': case 'member-restore':
        return await one('SELECT display_name AS name, role, admin_scope, CASE WHEN active THEN \'active\' ELSE \'inactive\' END AS status FROM hr_members WHERE id=$1', [id]);
      case 'case': case 'workflow': case 'application-step': return await one('SELECT case_number AS name, status FROM hr_cases WHERE id=$1', [id]);
      case 'task': return await one('SELECT t.title AS name, c.case_number FROM hr_case_tasks t JOIN hr_cases c ON c.id=t.case_id WHERE t.id=$1', [id]);
      case 'certification': return await one('SELECT c.case_number AS name FROM hr_case_certifications k JOIN hr_cases c ON c.id=k.case_id WHERE k.id=$1', [id]);
      case 'job-order-admin-status': return await one('SELECT e.name || \'的\' || o.job_type AS name, o.status FROM hr_job_orders o JOIN hr_employers e ON e.id=o.employer_id WHERE o.id=$1', [id]);
      case 'review': return await one('SELECT w.name || \'的\' || r.name AS name FROM hr_document_submissions s JOIN hr_worker_documents r ON r.id=s.requirement_id JOIN hr_workers w ON w.id=r.worker_id WHERE s.id=$1', [id]);
      case 'requirement-applicability': return await one('SELECT w.name || \'的\' || r.name AS name FROM hr_worker_documents r JOIN hr_workers w ON w.id=r.worker_id WHERE r.id=$1', [id]);
      default: return null;
    }
  } catch { return null; }
}

async function prepare(request, method) {
  const session = await auth();
  if (!session?.user) return null;
  const principal = await getHrPrincipal(session);
  // 系統管理員寫入「系統管理員操作紀錄」；仲介機構的成員寫入「仲介機構操作紀錄」（只有該仲介的仲介管理者看得到）。
  const kind = principal?.role === 'admin' ? 'admin' : shouldRecordAgencyAudit(principal) ? 'agency' : null;
  if (!kind) return null;
  let body = {}, type = '', id = null;
  if (method === 'DELETE') {
    const url = new URL(request.url);
    type = url.searchParams.get('type') || '';
    id = idOf(url.searchParams.get('id'));
    body = { purge: url.searchParams.get('purge') === '1' };
  } else {
    try { body = (await request.clone().json()) || {}; } catch { return null; }
    type = typeof body.type === 'string' ? body.type : '';
    id = method === 'POST' ? null : targetIdOf(type, body);
  }
  // 推薦工作者：操作對象是工作者（編號在 workerId），先查名字才記得到。
  const before = await lookupTarget(type === 'job-order-candidate' ? 'worker' : type, type === 'job-order-candidate' ? idOf(body.workerId) : id);
  // 操作前的完整快照（只有人與機構這類資料才有，其餘為 null）。
  const snapshot = method === 'POST' ? null : await takeSnapshot(runQuery, type, id);
  return { principal, session, method, type, body, id, before, snapshot, kind };
}

// 操作成功後再拍一次，算出變動的欄位。
async function changesOf(ctx, created) {
  const targetId = ctx.id || idOf(created?.id);
  if (!snapshotKindOf(ctx.type) || !targetId) return { before: null, after: null };
  const after = await takeSnapshot(runQuery, ctx.type, targetId);
  return diffSnapshots(ctx.snapshot, after);
}

const jsonOrNull = value => value ? JSON.stringify(value) : null;

async function write(ctx, response) {
  let created = null;
  if (ctx.method === 'POST') { try { created = await response.clone().json(); } catch { created = null; } }
  const targetName = ctx.before?.name || '';
  const changes = await changesOf(ctx, created);
  if (ctx.kind === 'agency') {
    const agencyEntry = describeAgencyOperation({ method: ctx.method, type: ctx.type, body: ctx.body, name: targetName, before: ctx.before, created });
    if (!agencyEntry) return;
    await recordAgencyAction({ principal: ctx.principal, session: ctx.session, action: agencyEntry.action, type: ctx.type, id: ctx.id || idOf(created?.id), name: agencyEntry.name, zh: agencyEntry.zh, en: agencyEntry.en, before: changes.before, after: changes.after });
    return;
  }
  const entry = describeAdminOperation(ctx.method, ctx.type, ctx.body, targetName || (ctx.id ? `#${ctx.id}` : ''), ctx.before, created);
  if (!entry) return;
  const actorName = adminActorName(ctx.principal, ctx.session);
  await ensureAuditSchema();
  await pool.query(ADMIN_AUDIT_INSERT_WITH_CHANGES_SQL, [
    ...adminAuditParams({
      memberId: ctx.principal.id, actorName, email: ctx.session.user.email, action: entry.action, type: ctx.type,
      id: ctx.id || idOf(created?.id), name: entry.name, summary: `${actorName}系統管理員${entry.phrase}`,
    }),
    jsonOrNull(changes.before), jsonOrNull(changes.after),
  ]);
}

// 給不走 withAdminAudit 的管理 API 直接寫入一筆操作紀錄（例如訓練中心工作區）；失敗只記 log。
export async function recordAdminAction(input) {
  try {
    await ensureAuditSchema();
    await pool.query(ADMIN_AUDIT_INSERT_SQL, adminActionParams(input));
  } catch (error) { console.error('hr_audit_write_failed', error?.name || 'Error'); }
}

// LINE 機器人上的系統管理員資料操作（新增／編輯／停用）也寫入同一份操作紀錄，網頁的「操作紀錄」看得到。
// 以 LINE 身分操作的管理者不一定有會員資料列（例如 .env 設定的管理者），沒有時改記 LINE User ID 方便追查。
// 失敗只記 log，不影響原本的操作。
export async function recordLineAdminAction(input) {
  try {
    await ensureAuditSchema();
    await pool.query(ADMIN_AUDIT_INSERT_SQL, lineAdminActionParams(input));
  } catch (error) { console.error('hr_audit_write_failed', error?.name || 'Error'); }
}

// 包住 route handler：只在系統管理員或仲介成員操作成功（2xx）後記錄（另外工人相關的操作也會記到工人活動紀錄），記錄失敗不影響操作結果。
export function withAdminAudit(method, handler) {
  return async function auditedHandler(request) {
    let ctx = null;
    let workerCtx = null;
    try { ctx = await prepare(request, method); } catch (error) { console.error('hr_audit_prepare_failed', error?.name || 'Error'); }
    // 工人會員的活動紀錄：不論是誰操作（工人本人、仲介、管理者、雇主），只要對象是某位工人就記一筆。
    try { workerCtx = await prepareWorkerLog(request, method); } catch (error) { console.error('hr_worker_log_prepare_failed', error?.name || 'Error'); }
    const response = await handler(request);
    if (ctx && response.status >= 200 && response.status < 300) {
      try { await write(ctx, response); } catch (error) { console.error('hr_audit_write_failed', error?.name || 'Error'); }
    }
    if (workerCtx && response.status >= 200 && response.status < 300) {
      try { await writeWorkerLog(workerCtx, response); } catch (error) { console.error('hr_worker_log_write_failed', error?.name || 'Error'); }
    }
    return response;
  };
}
