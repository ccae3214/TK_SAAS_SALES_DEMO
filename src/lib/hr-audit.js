import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';

// 系統管理員操作紀錄：記錄「哪一位系統管理員做了什麼操作」。
// 紀錄失敗只會寫 log，不會影響原本的操作。

let schemaPromise;
export function ensureAuditSchema() {
  schemaPromise ||= (async () => {
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
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

const ROLE_NAMES = { worker: '工作者', employer: '雇主', agency: '仲介機構員工', training_center: '訓練中心', system_admin: '系統管理者' };
const SCOPE_NAMES = { none: '一般會員', agency: '仲介管理者', system: '系統管理者' };
const CASE_STATUS_NAMES = { open: '進行中', on_hold: '暫停', closed: '結案' };
const TASK_STATUS_NAMES = { todo: '待處理', in_progress: '進行中', done: '完成', blocked: '卡關' };
const ORDER_STATUS_NAMES = { open: '開放中', filled: '已滿額', cancelled: '已取消' };
const TYPE_LABELS = { employer: '雇主', worker: '工作者', agency: '仲介機構', member: '會員帳號' };

const idOf = value => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };
const one = async (sql, params) => (await query(sql, params))[0] || null;

// 取得操作對象目前的名稱與狀態（刪除或變更前先查，才記得到名字）。
async function lookupTarget(type, id) {
  if (!id) return null;
  try {
    switch (type) {
      case 'employer': return await one('SELECT name, status FROM hr_employers WHERE id=$1', [id]);
      case 'worker': case 'worker-resume': return await one('SELECT name, status FROM hr_workers WHERE id=$1', [id]);
      case 'agency': return await one('SELECT name, CASE WHEN active THEN \'active\' ELSE \'inactive\' END AS status FROM hr_agencies WHERE id=$1', [id]);
      case 'member': case 'member-profile': case 'member-admin-scope':
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

// 各操作對象的編號放在 body 的不同欄位。
function targetIdOf(type, body) {
  if (type === 'review') return idOf(body.submissionId);
  if (type === 'requirement-applicability') return idOf(body.requirementId);
  if (type === 'workflow' || type === 'application-step') return idOf(body.caseId);
  return idOf(body.id);
}

const quoted = (type, name) => type === 'case' ? `案件 ${name}` : type === 'task' ? `待辦「${name}」` : type === 'requirement' ? `文件項目「${name}」` : name;

// 依操作內容產生「做了什麼」的敘述；回傳 null 代表不需要記錄。
function describe(method, type, body, name, before, created) {
  const label = TYPE_LABELS[type] || '';
  if (method === 'POST') {
    const n = created?.name || created?.display_name || created?.case_number || created?.title || body.name || body.title || name;
    if (!n && type !== 'case') return null;
    if (['employer', 'worker', 'agency', 'member'].includes(type)) return { action: '新增', name: n, phrase: `新增了${n}${label}` };
    if (type === 'case') return { action: '新增', name: n, phrase: `新增了案件 ${n || ''}`.trim() };
    if (type === 'requirement' || type === 'task') return { action: '新增', name: n, phrase: `新增了${quoted(type, n)}` };
    return null;
  }
  if (method === 'DELETE') {
    if (type === 'member') return { action: '刪除', name, phrase: `刪除了${name}會員帳號` };
    if (type === 'employer' || type === 'worker') return { action: '刪除', name, phrase: `刪除了${name}${label}` };
    if (type === 'case') return { action: '刪除', name, phrase: `刪除了案件 ${name}` };
    return null;
  }
  switch (type) {
    case 'employer': case 'worker':
      if (body.name !== undefined) return { action: '編輯', name, phrase: `編輯了${name}${label}的資料` };
      return body.status === 'inactive'
        ? { action: '停用', name, phrase: `停用了${name}${label}` }
        : { action: '啟用', name, phrase: `啟用了${name}${label}` };
    case 'agency':
      if (body.name !== undefined) return { action: '編輯', name, phrase: `編輯了${name}${label}的資料` };
      return body.active === false
        ? { action: '停用', name, phrase: `停用了${name}${label}` }
        : { action: '啟用', name, phrase: `啟用了${name}${label}` };
    case 'member':
      if (body.role !== undefined) return { action: '變更類型', name, phrase: `將${name}的會員類型變更為${ROLE_NAMES[body.role] || body.role}` };
      return body.active === false
        ? { action: '停用', name, phrase: `停用了${name}會員帳號` }
        : { action: '啟用', name, phrase: `啟用了${name}會員帳號` };
    case 'member-profile': return { action: '編輯', name, phrase: `編輯了${name}會員帳號的資料` };
    case 'member-admin-scope': return { action: '調整權限', name, phrase: `將${name}的管理者權限調整為${SCOPE_NAMES[body.adminScope] || body.adminScope}` };
    case 'case': return { action: '更新', name, phrase: `將案件 ${name} 的狀態變更為${CASE_STATUS_NAMES[body.status] || body.status}` };
    case 'task': return { action: '更新', name, phrase: `將待辦「${name}」的狀態更新為${TASK_STATUS_NAMES[body.status] || body.status}` };
    case 'review': return { action: body.decision === 'approved' ? '核准' : '退回', name, phrase: `${body.decision === 'approved' ? '核准' : '退回'}了${name}` };
    case 'workflow': return { action: '更新', name, phrase: `更新了案件 ${name} 的${body.workflowType === 'medical' ? '體檢' : '訓練'}狀態` };
    case 'certification': return { action: '更新', name, phrase: `更新了案件 ${name} 的證照取證進度` };
    case 'application-step': return { action: '更新', name, phrase: `更新了案件 ${name} 的申請程序` };
    case 'requirement-applicability': return { action: '更新', name, phrase: `調整了${name}的適用設定` };
    case 'worker-resume': return { action: '編輯', name, phrase: `更新了${name}工作者的履歷` };
    case 'job-order-admin-status': return { action: '更新', name, phrase: `將媒合需求單 ${name} 的狀態變更為${ORDER_STATUS_NAMES[body.status] || body.status}` };
    default: return null;
  }
}

async function prepare(request, method) {
  const session = await auth();
  if (!session?.user) return null;
  const principal = await getHrPrincipal(session);
  if (principal?.role !== 'admin') return null;
  let body = {}, type = '', id = null;
  if (method === 'DELETE') {
    const url = new URL(request.url);
    type = url.searchParams.get('type') || '';
    id = idOf(url.searchParams.get('id'));
  } else {
    try { body = (await request.clone().json()) || {}; } catch { return null; }
    type = typeof body.type === 'string' ? body.type : '';
    id = method === 'POST' ? null : targetIdOf(type, body);
  }
  const before = await lookupTarget(type, id);
  return { principal, session, method, type, body, id, before };
}

async function write(ctx, response) {
  let created = null;
  if (ctx.method === 'POST') { try { created = await response.clone().json(); } catch { created = null; } }
  const targetName = ctx.before?.name || '';
  const entry = describe(ctx.method, ctx.type, ctx.body, targetName || (ctx.id ? `#${ctx.id}` : ''), ctx.before, created);
  if (!entry) return;
  const actorName = String(ctx.principal.name || ctx.session.user.name || ctx.session.user.email || '系統管理員').slice(0, 160);
  await ensureAuditSchema();
  await pool.query(
    `INSERT INTO hr_admin_audit_log(actor_member_id,actor_name,actor_email,action,target_type,target_id,target_name,summary)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ctx.principal.id || null, actorName, String(ctx.session.user.email || '').slice(0, 254), entry.action, ctx.type,
      ctx.id || idOf(created?.id), String(entry.name || '').slice(0, 200), `${actorName}系統管理員${entry.phrase}`.slice(0, 500)]
  );
}

// 給不走 withAdminAudit 的管理 API 直接寫入一筆操作紀錄（例如訓練中心工作區）；失敗只記 log。
export async function recordAdminAction({ principal, session, action, type, id, name, phrase }) {
  try {
    const actorName = String(principal?.name || session?.user?.name || session?.user?.email || '系統管理員').slice(0, 160);
    await ensureAuditSchema();
    await pool.query(
      `INSERT INTO hr_admin_audit_log(actor_member_id,actor_name,actor_email,action,target_type,target_id,target_name,summary)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [principal?.id || null, actorName, String(session?.user?.email || '').slice(0, 254), action, type || '', idOf(id), String(name || '').slice(0, 200), `${actorName}系統管理員${phrase}`.slice(0, 500)]
    );
  } catch (error) { console.error('hr_audit_write_failed', error?.name || 'Error'); }
}

// 包住 route handler：只在系統管理員操作成功（2xx）後記錄，記錄失敗不影響操作結果。
export function withAdminAudit(method, handler) {
  return async function auditedHandler(request) {
    let ctx = null;
    try { ctx = await prepare(request, method); } catch (error) { console.error('hr_audit_prepare_failed', error?.name || 'Error'); }
    const response = await handler(request);
    if (ctx && response.status >= 200 && response.status < 300) {
      try { await write(ctx, response); } catch (error) { console.error('hr_audit_write_failed', error?.name || 'Error'); }
    }
    return response;
  };
}
