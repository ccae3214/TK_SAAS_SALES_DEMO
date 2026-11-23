// 工人會員的「活動紀錄」：記錄每一位工人會員自己做了什麼、以及別人（仲介、管理者、雇主、訓練中心）對這位工人做了什麼。
// 不 import '@/…'，所以 node:test 可以直接測試（資料庫的讀寫在 hr-worker-log.js）。
//
// 誰能看：
//   工人本人 → 只看得到自己的紀錄（看不到其他人的姓名，只看到身分，例如「仲介」「系統管理員」）。
//   系統管理者 → 看得到所有工人的紀錄與操作人員姓名。
//   仲介（菲律賓、台灣）、雇主、訓練中心 → 看不到（仲介對工人的操作仍會被記錄，但只有系統管理者看得到）。
// 紀錄只新增、不提供修改或刪除的介面；工人資料被刪除後紀錄仍保留（worker_id 不設外鍵）。

export const WORKER_LOG_PAGE_SIZE = 50;

const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;

// action 存代碼，畫面再依語言顯示。
export const WORKER_LOG_ACTIONS = {
  login: { zh: '登入', en: 'Signed in' },
  create: { zh: '建立', en: 'Created' },
  edit: { zh: '編輯', en: 'Edited' },
  update: { zh: '更新', en: 'Updated' },
  delete: { zh: '刪除', en: 'Deleted' },
  enable: { zh: '啟用', en: 'Enabled' },
  disable: { zh: '停用', en: 'Disabled' },
  change_type: { zh: '變更類型', en: 'Type changed' },
  upload: { zh: '上傳', en: 'Uploaded' },
  approve: { zh: '核准', en: 'Approved' },
  return: { zh: '退回', en: 'Returned' },
  acknowledge: { zh: '確認', en: 'Confirmed' },
  unacknowledge: { zh: '取消確認', en: 'Unconfirmed' },
  learn: { zh: '學習', en: 'Learning' },
  quiz: { zh: '小測驗', en: 'Quiz' },
  recommend: { zh: '推薦', en: 'Recommended' },
  withdraw: { zh: '撤回', en: 'Withdrawn' },
  interview: { zh: '面試', en: 'Interview' },
};

// 操作人員的身分（actor_role）。
export const WORKER_LOG_ACTOR_ROLES = {
  worker: { zh: '工人本人', en: 'Worker' },
  agency: { zh: '仲介', en: 'Agency' },
  admin: { zh: '系統管理員', en: 'Administrator' },
  employer: { zh: '雇主', en: 'Employer' },
  training_center: { zh: '訓練中心', en: 'Training center' },
  system: { zh: '系統', en: 'System' },
};

const CASE_STATUS = { open: ['進行中', 'In progress'], on_hold: ['暫停', 'On hold'], closed: ['結案', 'Closed'] };
const MEDICAL_STATUS = {
  not_scheduled: ['尚未安排', 'Not scheduled'], scheduled: ['已安排', 'Scheduled'], in_progress: ['進行中', 'In progress'],
  passed: ['通過', 'Passed'], retest: ['需複檢', 'Retest needed'], failed: ['未通過', 'Failed'],
};
const TRAINING_STATUS = {
  not_scheduled: ['尚未安排', 'Not scheduled'], scheduled: ['已安排', 'Scheduled'], in_progress: ['進行中', 'In progress'],
  completed: ['已完成', 'Completed'], certified: ['已取得證照', 'Certified'],
};
const INTERVIEW_STATUS = { scheduled: ['安排了面試', 'scheduled an interview'], passed: ['錄用了這位工人', 'hired the worker'], rejected: ['未錄用這位工人', 'did not hire the worker'] };
const MEMBER_ROLE = { worker: ['工作者', 'worker'], employer: ['雇主', 'employer'], agency: ['仲介機構員工', 'agency staff'], training_center: ['訓練中心', 'training center'], system_admin: ['系統管理者', 'system administrator'] };

const pick = (map, key, index) => (map[key] || [key || '', key || ''])[index];
const label = value => String(value ?? '').trim();
const q = value => `「${value}」`;
const e = value => `"${value}"`;
const result = (action, zh, en) => ({ action, zh, en });

// 這個 type 的操作是否可能跟某位工人有關（先用它快速略過不相關的操作，避免多餘的資料庫查詢）。
const WORKER_RELATED_TYPES = new Set([
  'worker', 'worker-resume', 'worker-acknowledge', 'review', 'requirement-applicability', 'workflow', 'application-step', 'case',
  'certification', 'member', 'member-profile', 'member-admin-scope', 'member-restore', 'job-order-candidate',
  'job-order-candidate-interview', 'job-order-candidate-withdraw',
]);
export const isWorkerRelatedType = type => WORKER_RELATED_TYPES.has(type);

// 依操作內容產生「做了什麼」的中英文敘述（主詞是操作人員，不含主詞）；回傳 null 代表不需要記錄。
// input: { method, type, body, name（文件或項目名稱）, isSelf（工人本人操作） }
export function describeWorkerOperation({ method, type, body = {}, name = '', isSelf = false } = {}) {
  const n = label(name);
  if (method === 'POST') {
    if (type === 'worker') return result('create', '建立了工作者資料', 'Created the worker profile');
    if (type === 'job-order-candidate') return result('recommend', '被推薦到雇主的工作需求', 'Was recommended for an employer job order');
    return null;
  }
  if (method === 'DELETE') {
    if (type === 'worker') return result('delete', '刪除了工作者資料', 'Deleted the worker profile');
    if (type === 'member') return body.purge
      ? result('delete', '永久刪除了會員帳號', 'Permanently deleted the member account')
      : result('delete', '將會員帳號移到「已刪除帳號」（可還原）', 'Moved the member account to Deleted accounts (can be restored)');
    return null;
  }
  switch (type) {
    case 'worker':
      if (body.name !== undefined) {
        return isSelf
          ? result('edit', '更新了自己的基本資料與履歷', 'Updated their own profile and resume')
          : result('edit', '編輯了工作者的基本資料', "Edited the worker's profile");
      }
      return body.status === 'inactive' || body.active === false
        ? result('disable', '停用了工作者', 'Deactivated the worker')
        : result('enable', '啟用了工作者', 'Activated the worker');
    case 'worker-resume':
      return body.clear === true
        ? result('edit', '清除了工作者的履歷', "Cleared the worker's resume")
        : result('edit', '更新了工作者的履歷', "Updated the worker's resume");
    case 'worker-acknowledge':
      return body.confirmed === false
        ? result('unacknowledge', '取消確認了案件事項', 'Withdrew a confirmation on a case item')
        : result('acknowledge', '確認了案件事項', 'Confirmed a case item');
    case 'review':
      if (!n) return body.decision === 'approved'
        ? result('approve', '核准了一份文件', 'Approved a document')
        : result('return', '退回了一份文件', 'Returned a document');
      return body.decision === 'approved'
        ? result('approve', `核准了文件${q(n)}`, `Approved document ${e(n)}`)
        : result('return', `退回了文件${q(n)}`, `Returned document ${e(n)}`);
    case 'requirement-applicability':
      return n
        ? result('update', `將文件${q(n)}標示為${body.applicable ? '適用' : '不適用'}`, `Marked document ${e(n)} as ${body.applicable ? 'applicable' : 'not applicable'}`)
        : result('update', '調整了文件的適用設定', 'Changed the applicability of a document');
    case 'workflow': {
      const medical = body.workflowType === 'medical';
      const map = medical ? MEDICAL_STATUS : TRAINING_STATUS;
      return result('update', `將${medical ? '抵台體檢' : '訓練'}狀態更新為${pick(map, body.status, 0)}`, `Changed the ${medical ? 'medical exam' : 'training'} status to ${pick(map, body.status, 1)}`);
    }
    case 'application-step':
      return result('update', '更新了來台申請程序', 'Updated the application steps');
    case 'case':
      return result('update', `將案件狀態變更為${pick(CASE_STATUS, body.status, 0)}`, `Changed the case status to ${pick(CASE_STATUS, body.status, 1)}`);
    case 'certification':
      return result('update', '更新了證照取證進度', 'Updated the certification progress');
    case 'member':
      if (body.role !== undefined) {
        return result('change_type', `將會員類型變更為${pick(MEMBER_ROLE, body.role, 0)}`, `Changed the member type to ${pick(MEMBER_ROLE, body.role, 1)}`);
      }
      return body.active === false
        ? result('disable', '停用了會員帳號', 'Deactivated the member account')
        : result('enable', '啟用了會員帳號', 'Activated the member account');
    case 'member-profile':
      return result('edit', '編輯了會員帳號資料', 'Edited the member account details');
    case 'member-admin-scope':
      return result('update', '調整了管理者權限', 'Changed the administrator scope');
    case 'member-restore':
      return result('enable', '還原了會員帳號', 'Restored the member account');
    case 'job-order-candidate-interview':
      return INTERVIEW_STATUS[body.status]
        ? result('interview', `雇主${INTERVIEW_STATUS[body.status][0]}`, `The employer ${INTERVIEW_STATUS[body.status][1]}`)
        : null;
    case 'job-order-candidate-withdraw':
      return result('withdraw', '推薦已被撤回', 'The recommendation was withdrawn');
    default:
      return null;
  }
}

// 工人自己的學習與文件操作（不是經過 /api/hr 的那一類）的敘述。
export function describeLearningUnit({ completed, name, nameEn }) {
  const zhName = label(name), enName = label(nameEn) || zhName;
  return completed
    ? result('learn', `讀完了學習單元${q(zhName)}`, `Finished reading learning unit ${e(enName)}`)
    : result('learn', `取消了學習單元${q(zhName)}的已讀標記`, `Unmarked learning unit ${e(enName)} as read`);
}

export function describeQuiz({ name, nameEn, correct, total, passed }) {
  const zhName = label(name), enName = label(nameEn) || zhName;
  const score = `${Number(correct) || 0}/${Number(total) || 0}`;
  return result('quiz', `完成單元小測驗${q(zhName)}：答對 ${score} 題（${passed ? '通過' : '未通過'}）`,
    `Took the quiz for unit ${e(enName)}: ${score} correct (${passed ? 'passed' : 'not passed'})`);
}

export function describeDocumentUpload({ name, version, filename }) {
  const n = label(name), f = label(filename);
  return result('upload', `上傳了文件${q(n)}第 ${version} 版${f ? `（${f}）` : ''}`, `Uploaded document ${e(n)} v${version}${f ? ` (${f})` : ''}`);
}

export function describeLogin() {
  return result('login', '登入了系統', 'Signed in');
}

// 看得到哪位工人的紀錄：回傳 'self'（工人本人）、'staff'（系統管理者）或 null（不能看）。
// worker: { id }
export function workerLogAudience(principal, worker) {
  if (!principal?.role || !worker) return null;
  if (principal.role === 'worker') return validId(principal.worker_id) && Number(principal.worker_id) === Number(worker.id) ? 'self' : null;
  if (principal.role === 'admin') return 'staff';
  return null;
}

// 是否看得到「操作人員姓名」：只有系統管理者看得到；工人本人只看身分。
export function canSeeActorName(viewerRole) {
  return viewerRole === 'admin';
}

// 把資料庫的列整理成要回傳給畫面的樣子（依檢視者隱藏不該看的資料）。
export function shapeWorkerLogRow(row, viewerRole) {
  const showName = canSeeActorName(viewerRole);
  return {
    id: row.id,
    worker_id: row.worker_id,
    worker_name: row.worker_name,
    actor_role: row.actor_role,
    actor_name: showName ? row.actor_name : '',
    action: row.action,
    summary_zh: row.summary_zh,
    summary_en: row.summary_en,
    created_at: row.created_at,
  };
}

// 篩選條件整理：worker 是工人編號、q 是關鍵字、before 是上一頁最後一筆的編號。
export function normalizeWorkerLogFilters(params) {
  const get = key => (typeof params?.get === 'function' ? params.get(key) : params?.[key]) ?? '';
  const worker = String(get('workerId')).trim();
  const keyword = String(get('q')).trim().slice(0, 80);
  const before = String(get('before')).trim();
  return {
    workerId: validId(worker) ? Number(worker) : null,
    q: keyword,
    beforeId: validId(before) ? Number(before) : null,
  };
}
