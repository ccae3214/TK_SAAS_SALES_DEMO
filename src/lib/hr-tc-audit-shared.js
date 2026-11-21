// 訓練中心操作紀錄的共用定義：不依賴資料庫，後端、畫面與測試都可以直接引用。

export const TC_AUDIT_ACTIONS = ['create', 'update', 'status', 'activate', 'deactivate', 'delete', 'register', 'enroll', 'unenroll'];
export const TC_AUDIT_ACTOR_KINDS = ['system_admin', 'training_center'];

export const TC_AUDIT_ACTION_ZH = {
  create: '新增', update: '編輯', status: '更新狀態', activate: '啟用', deactivate: '停用',
  delete: '刪除', register: '登記', enroll: '報名', unenroll: '取消報名',
};
export const TC_AUDIT_ACTION_EN = {
  create: 'Added', update: 'Edited', status: 'Status updated', activate: 'Activated', deactivate: 'Deactivated',
  delete: 'Deleted', register: 'Registered', enroll: 'Enrolled', unenroll: 'Enrollment cancelled',
};
export const TC_AUDIT_TYPE_ZH = {
  certification: '證照', teacher: '老師', course: '課程', unit: '課程單元', class: '班別', batch: '證照批次',
  'teacher-certification': '老師證照', enrollment: '學員報名',
};
export const TC_AUDIT_TYPE_EN = {
  certification: 'Certification', teacher: 'Teacher', course: 'Course', unit: 'Course unit', class: 'Class', batch: 'Certification batch',
  'teacher-certification': 'Teacher certification', enrollment: 'Enrollment',
};
const BATCH_STATUS_EN = { preparing: 'Preparing', submitted: 'Submitted', issued: 'Issued' };

// 誰可以查看某個訓練中心的操作紀錄：
//   - 系統管理者（principal.role === 'admin'，包含 .env 設定的管理者與 admin_scope = 'system' 的會員）：所有訓練中心。
//   - 訓練中心自己的帳號（role === 'training_center'）：只有自己那一份，看別的訓練中心不行。
// 仲介、雇主、工作者一律不能看。要放寬或改規則，只需要改這一個函式。
export const canViewTrainingCenterAudit = (principal, centerId) =>
  principal?.role === 'admin'
  || (principal?.role === 'training_center' && Number(principal.id) > 0 && Number(principal.id) === Number(centerId));

// 中文敘述：「王小明系統管理員新增了…」或「A 訓練中心（訓練中心）新增了…」，與全站系統管理員操作紀錄的寫法一致。
export function tcAuditSummary(actorName, actorKind, phrase) {
  return `${actorName}${actorKind === 'training_center' ? '（訓練中心）' : '系統管理員'}${phrase}`.slice(0, 500);
}

// 英文敘述：用紀錄的欄位組出來，不需要翻譯儲存的中文文字（對象名稱維持使用者輸入的原樣）。
// detail 依類型存不同內容：證照批次是狀態代碼、學員報名是班別名稱、老師證照是證照名稱。
export function tcAuditSummaryEn(row) {
  const who = `${row.actor_name} (${row.actor_kind === 'training_center' ? 'training center' : 'system administrator'})`;
  const name = row.target_name ? `"${row.target_name}"` : '';
  const type = (TC_AUDIT_TYPE_EN[row.target_type] || row.target_type || 'item').toLowerCase();
  const detail = row.detail || '';
  if (row.target_type === 'enrollment') {
    const cls = detail ? ` ${row.action === 'unenroll' ? 'from' : 'in'} class "${detail}"` : '';
    return `${who} ${row.action === 'unenroll' ? 'cancelled the enrollment of' : 'enrolled'} worker ${name}${cls}`.trim();
  }
  if (row.target_type === 'teacher-certification') {
    const cert = detail ? ` "${detail}"` : '';
    return row.action === 'delete'
      ? `${who} removed certification${cert} from teacher ${name}`.trim()
      : `${who} registered certification${cert} for teacher ${name}`.trim();
  }
  if (row.target_type === 'batch' && row.action === 'status') {
    return `${who} set the status of certification batch ${name} to ${BATCH_STATUS_EN[detail] || detail}`.trim();
  }
  const verb = { create: 'added', update: 'edited', status: 'updated', activate: 'activated', deactivate: 'deactivated', delete: 'deleted', register: 'registered', enroll: 'enrolled', unenroll: 'cancelled the enrollment of' }[row.action] || row.action;
  return `${who} ${verb} ${type} ${name}`.trim();
}
