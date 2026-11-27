// 仲介機構的「操作紀錄」：記錄仲介機構的成員在系統裡做了什麼操作。
// 不 import '@/…'，所以 node:test 可以直接測試（資料庫的讀寫在 hr-agency-audit.js）。
//
// 誰能看：只有「該仲介機構自己的仲介管理者」（會員類型 agency、管理者權限 agency、且屬於同一個機構）。
//   一般仲介成員、其他仲介、雇主、工作者、訓練中心都不能看；系統管理者也不在這個畫面看（系統管理者另有「系統管理員操作紀錄」）。
// 誰會被記錄：仲介機構的所有成員（管理者與一般成員）。系統管理者的操作仍然記在原本的系統管理員操作紀錄。

export const AGENCY_AUDIT_PAGE_SIZE = 100;

const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;

// 看得到操作紀錄：必須是仲介管理者，而且有所屬機構。
export function canViewAgencyAudit(principal) {
  return principal?.role === 'agency' && !!principal.is_agency_admin && validId(principal.agency_id);
}

// 會被寫入操作紀錄：任何有所屬機構的仲介成員。
export function shouldRecordAgencyAudit(principal) {
  return principal?.role === 'agency' && validId(principal.agency_id);
}

// action 存代碼，畫面再依語言顯示。
export const AGENCY_AUDIT_ACTIONS = {
  create: { zh: '新增', en: 'Created' },
  edit: { zh: '編輯', en: 'Edited' },
  update: { zh: '更新', en: 'Updated' },
  delete: { zh: '刪除', en: 'Deleted' },
  remove: { zh: '移除', en: 'Removed' },
  enable: { zh: '啟用', en: 'Enabled' },
  disable: { zh: '停用', en: 'Disabled' },
  approve: { zh: '核准', en: 'Approved' },
  return: { zh: '退回', en: 'Returned' },
  recommend: { zh: '推薦', en: 'Recommended' },
  withdraw: { zh: '撤回', en: 'Withdrawn' },
  upload: { zh: '上傳', en: 'Uploaded' },
  certify: { zh: '相互認證', en: 'Mutual certification' },
  request: { zh: '申請', en: 'Requested' },
};

const CASE_STATUS = { open: ['進行中', 'In progress'], on_hold: ['暫停', 'On hold'], closed: ['結案', 'Closed'] };
const TASK_STATUS = { todo: ['待處理', 'To do'], in_progress: ['進行中', 'In progress'], done: ['完成', 'Done'], blocked: ['卡關', 'Blocked'] };

const pickStatus = (map, status, index) => (map[status] || [status || '', status || ''])[index];
const label = (name, fallback) => String(name || fallback || '').trim();

const q = value => `「${value}」`;
const e = value => `"${value}"`;
const result = (action, targetName, zh, en) => ({ action, name: targetName, zh, en });
// 需要有名稱才記錄的操作：沒有名稱就回傳 null。
const named = describe => (n, body) => (n ? describe(n, body) : null);
const toggle = (n, active, zhNoun, enNoun) => (active === false
  ? result('disable', n, `停用了${zhNoun}${q(n)}`, `Deactivated ${enNoun} ${e(n)}`)
  : result('enable', n, `啟用了${zhNoun}${q(n)}`, `Activated ${enNoun} ${e(n)}`));

const POST_DESCRIBERS = {
  worker: (n, body, created) => {
    const createdName = label(created?.name, body.name);
    return createdName ? result('create', createdName, `新增了工作者${q(createdName)}`, `Added worker ${e(createdName)}`) : null;
  },
  'job-order-candidate': named(n => result('recommend', n, `推薦了工作者${q(n)}給雇主的工作需求`, `Recommended worker ${e(n)} for an employer job order`)),
};

const DELETE_DESCRIBERS = {
  worker: named(n => result('remove', n, `將工作者${q(n)}從本仲介機構移除`, `Removed worker ${e(n)} from this agency`)),
};

const workflowLabel = body => (body.workflowType === 'medical' ? ['體檢', 'medical exam'] : ['訓練', 'training']);

const PATCH_DESCRIBERS = {
  worker: named((n, body) => (body.name !== undefined
    ? result('edit', n, `編輯了工作者${q(n)}的資料`, `Edited the details of worker ${e(n)}`)
    : toggle(n, body.active, '工作者', 'worker'))),
  'worker-resume': named(n => result('edit', n, `更新了工作者${q(n)}的履歷`, `Updated the resume of worker ${e(n)}`)),
  employer: named(n => result('edit', n, `編輯了雇主${q(n)}的資料`, `Edited the details of employer ${e(n)}`)),
  member: named((n, body) => toggle(n, body.active, '會員帳號', 'member account')),
  'member-profile': named(n => result('edit', n, `編輯了會員帳號${q(n)}的資料`, `Edited the details of member account ${e(n)}`)),
  case: named((n, body) => result('update', n, `將案件 ${n} 的狀態變更為${pickStatus(CASE_STATUS, body.status, 0)}`, `Changed the status of case ${n} to ${pickStatus(CASE_STATUS, body.status, 1)}`)),
  task: named((n, body) => result('update', n, `將待辦${q(n)}的狀態更新為${pickStatus(TASK_STATUS, body.status, 0)}`, `Changed the status of task ${e(n)} to ${pickStatus(TASK_STATUS, body.status, 1)}`)),
  review: named((n, body) => (body.decision === 'approved'
    ? result('approve', n, `核准了${q(n)}`, `Approved ${e(n)}`)
    : result('return', n, `退回了${q(n)}`, `Returned ${e(n)}`))),
  workflow: named((n, body) => {
    const [zh, en] = workflowLabel(body);
    return result('update', n, `更新了案件 ${n} 的${zh}狀態`, `Updated the ${en} status of case ${n}`);
  }),
  certification: named(n => result('update', n, `更新了案件 ${n} 的證照取證進度`, `Updated the certification progress of case ${n}`)),
  'application-step': named(n => result('update', n, `更新了案件 ${n} 的申請程序`, `Updated the application steps of case ${n}`)),
  'requirement-applicability': named(n => result('update', n, `調整了${q(n)}的適用設定`, `Changed the applicability of ${e(n)}`)),
  'job-order-candidate-deposit': (n, body) => (body.paid === false
    ? result('update', n, '取消了雇主已付訂金的登記', 'Cancelled the recorded employer deposit')
    : result('update', n, '登記了雇主已付訂金', 'Recorded an employer deposit as paid')),
  'job-order-candidate-withdraw': n => result('withdraw', n, '撤回了推薦的工作者', 'Withdrew a recommended worker'),
};

const DESCRIBERS_BY_METHOD = { POST: POST_DESCRIBERS, DELETE: DELETE_DESCRIBERS };

// 依操作內容產生「做了什麼」的中英文敘述；回傳 null 代表不需要記錄。
// input: { method, type, body, name, before, created }
export function describeAgencyOperation({ method, type, body = {}, name = '', before = null, created = null }) {
  const describers = DESCRIBERS_BY_METHOD[method] || PATCH_DESCRIBERS;
  const describe = Object.hasOwn(describers, type) ? describers[type] : null;
  return describe ? describe(label(name, before?.name), body, created) : null;
}

// 篩選條件整理：actor 是會員編號、q 是關鍵字、before 是上一頁最後一筆的編號。
export function normalizeAgencyAuditFilters(params) {
  const get = key => (typeof params?.get === 'function' ? params.get(key) : params?.[key]) ?? '';
  const actor = String(get('actor')).trim();
  const q = String(get('q')).trim().slice(0, 80);
  const before = String(get('before')).trim();
  const action = String(get('action')).trim();
  return {
    actorId: validId(actor) ? Number(actor) : null,
    action: Object.prototype.hasOwnProperty.call(AGENCY_AUDIT_ACTIONS, action) ? action : '',
    q,
    beforeId: validId(before) ? Number(before) : null,
  };
}
