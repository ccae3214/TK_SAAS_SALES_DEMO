// 系統管理員操作紀錄的純函式：產生「做了什麼」的敘述與寫入資料表的欄位。
// 不 import '@/…'、不碰資料庫，node:test 可以直接測試（資料庫的讀寫在 hr-audit.js）。

const ROLE_NAMES = { worker: '工作者', employer: '雇主', agency: '仲介機構員工', training_center: '訓練中心', system_admin: '系統管理者' };
const SCOPE_NAMES = { none: '一般會員', agency: '仲介管理者', system: '系統管理者' };
const CASE_STATUS_NAMES = { open: '進行中', on_hold: '暫停', closed: '結案' };
const TASK_STATUS_NAMES = { todo: '待處理', in_progress: '進行中', done: '完成', blocked: '卡關' };
const ORDER_STATUS_NAMES = { open: '開放中', filled: '已滿額', cancelled: '已取消' };
const TYPE_LABELS = { employer: '雇主', worker: '工作者', agency: '仲介機構', member: '會員帳號' };

export const idOf = value => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };

// 各操作對象的編號放在 body 的不同欄位。
const TARGET_ID_FIELD = { review: 'submissionId', 'requirement-applicability': 'requirementId', workflow: 'caseId', 'application-step': 'caseId' };
export const targetIdOf = (type, body) => idOf(body[Object.hasOwn(TARGET_ID_FIELD, type) ? TARGET_ID_FIELD[type] : 'id']);

const entry = (action, name, phrase) => ({ action, name, phrase });
const own = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined);
const statusName = (table, status) => own(table, status) || status;
const quoted = (type, name) => (type === 'task' ? `待辦「${name}」` : type === 'requirement' ? `文件項目「${name}」` : name);

// ---- 新增 ----
const createdName = (body, name, created) => created?.name || created?.display_name || created?.case_number || created?.title || body.name || body.title || name;
const createEntity = (type, n) => entry('新增', n, `新增了${n}${TYPE_LABELS[type]}`);
const CREATE = {
  employer: createEntity, worker: createEntity, agency: createEntity, member: createEntity,
  case: (type, n) => entry('新增', n, `新增了案件 ${n || ''}`.trim()),
  requirement: (type, n) => entry('新增', n, `新增了${quoted(type, n)}`),
  task: (type, n) => entry('新增', n, `新增了${quoted(type, n)}`),
};

function describeCreate(type, body, name, created) {
  const n = createdName(body, name, created);
  const describe = own(CREATE, type);
  // 案件編號由資料庫產生，回應裡可能沒有名稱也照樣記錄；其他沒有名稱的不記錄。
  if (!describe || (!n && type !== 'case')) return null;
  return describe(type, n);
}

// ---- 刪除 ----
const deleteEntity = (type, name) => entry('刪除', name, `刪除了${name}${TYPE_LABELS[type]}`);
const DELETE = {
  employer: deleteEntity, worker: deleteEntity, agency: deleteEntity,
  case: (type, name) => entry('刪除', name, `刪除了案件 ${name}`),
  // 已核准的會員只移到「已刪除帳號」（可還原）；待審核的申請或指定永久刪除才真的刪掉。
  member: (type, name, body, before) => (before?.role && !body.purge
    ? entry('移到已刪除帳號', name, `將${name}會員帳號移到「已刪除帳號」（可還原）`)
    : entry('刪除', name, `${body.purge ? '永久' : ''}刪除了${name}會員帳號`)),
};

// ---- 更新 ----
const toggle = (disabled, name, noun) => (disabled ? entry('停用', name, `停用了${name}${noun}`) : entry('啟用', name, `啟用了${name}${noun}`));
const editOr = (body, name, label, disabled) => (body.name !== undefined ? entry('編輯', name, `編輯了${name}${label}的資料`) : toggle(disabled, name, label));
const UPDATE = {
  employer: (name, body) => editOr(body, name, TYPE_LABELS.employer, body.status === 'inactive'),
  worker: (name, body) => editOr(body, name, TYPE_LABELS.worker, body.status === 'inactive'),
  agency: (name, body) => editOr(body, name, TYPE_LABELS.agency, body.active === false),
  member: (name, body) => (body.role !== undefined
    ? entry('變更類型', name, `將${name}的會員類型變更為${statusName(ROLE_NAMES, body.role)}`)
    : toggle(body.active === false, name, '會員帳號')),
  'member-restore': name => entry('還原', name, `還原了${name}會員帳號`),
  'member-profile': name => entry('編輯', name, `編輯了${name}會員帳號的資料`),
  'member-admin-scope': (name, body) => entry('調整權限', name, `將${name}的管理者權限調整為${statusName(SCOPE_NAMES, body.adminScope)}`),
  case: (name, body) => entry('更新', name, `將案件 ${name} 的狀態變更為${statusName(CASE_STATUS_NAMES, body.status)}`),
  task: (name, body) => entry('更新', name, `將待辦「${name}」的狀態更新為${statusName(TASK_STATUS_NAMES, body.status)}`),
  review: (name, body) => {
    const action = body.decision === 'approved' ? '核准' : '退回';
    return entry(action, name, `${action}了${name}`);
  },
  workflow: (name, body) => entry('更新', name, `更新了案件 ${name} 的${body.workflowType === 'medical' ? '體檢' : '訓練'}狀態`),
  certification: name => entry('更新', name, `更新了案件 ${name} 的證照取證進度`),
  'application-step': name => entry('更新', name, `更新了案件 ${name} 的申請程序`),
  'requirement-applicability': name => entry('更新', name, `調整了${name}的適用設定`),
  'worker-resume': name => entry('編輯', name, `更新了${name}工作者的履歷`),
  'job-order-admin-status': (name, body) => entry('更新', name, `將媒合需求單 ${name} 的狀態變更為${statusName(ORDER_STATUS_NAMES, body.status)}`),
};

// 依操作內容產生「做了什麼」的敘述 { action, name, phrase }；回傳 null 代表不需要記錄。
// name：操作前查到的對象名稱（沒有時是 #編號）；before：操作前的資料；created：新增成功時的回應內容。
export function describeAdminOperation(method, type, body, name, before, created) {
  if (method === 'POST') return describeCreate(type, body, name, created);
  if (method === 'DELETE') return own(DELETE, type)?.(type, name, body, before) ?? null;
  return own(UPDATE, type)?.(name, body) ?? null;
}

// ---- 寫入 hr_admin_audit_log 的欄位 ----
export const ADMIN_AUDIT_INSERT_SQL = `INSERT INTO hr_admin_audit_log(actor_member_id,actor_name,actor_email,action,target_type,target_id,target_name,summary)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`;

// 網頁操作經過 withAdminAudit 時，另外記下改之前／改之後（$9、$10，只含變動的欄位）。
export const ADMIN_AUDIT_INSERT_WITH_CHANGES_SQL = `INSERT INTO hr_admin_audit_log(actor_member_id,actor_name,actor_email,action,target_type,target_id,target_name,summary,before_data,after_data)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`;

export const adminActorName = (principal, session) => String(principal?.name || session?.user?.name || session?.user?.email || '系統管理員').slice(0, 160);

// 依序對應 ADMIN_AUDIT_INSERT_SQL 的 $1～$8；所有文字欄位都截到資料表允許的長度。
export function adminAuditParams({ memberId, actorName, email, action, type, id, name, summary }) {
  return [memberId || null, actorName, String(email || '').slice(0, 254), action, type || '', idOf(id), String(name || '').slice(0, 200), String(summary).slice(0, 500)];
}

// 網頁上的管理操作：摘要是「{操作者}系統管理員{做了什麼}」。
export function adminActionParams({ principal, session, action, type, id, name, phrase }) {
  const actorName = adminActorName(principal, session);
  return adminAuditParams({ memberId: principal?.id, actorName, email: session?.user?.email, action, type, id, name, summary: `${actorName}系統管理員${phrase}` });
}

// LINE 機器人上的管理操作。以 LINE 身分操作的管理者不一定有會員資料列（例如 .env 設定的管理者），
// 沒有時記成「LINE 管理者」並附上 LINE User ID 方便追查。
export function lineAdminActionParams({ principal, lineUserId, action, type, id, name, phrase }) {
  const actorName = String((principal?.id && principal?.name) || 'LINE 管理者').slice(0, 160);
  const lineSuffix = principal?.id ? '' : `（LINE ID：${String(lineUserId || '').slice(0, 64)}）`;
  return adminAuditParams({ memberId: principal?.id, actorName, email: principal?.email, action, type, id, name, summary: `${actorName}系統管理員透過 LINE 機器人${phrase}${lineSuffix}` });
}
