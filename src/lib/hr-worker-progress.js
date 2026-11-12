// 工作者層級的進度（不需要案件）。
// 文件審核沿用 hr_worker_documents；進度日期與訓練／抵台體檢狀態存放於 hr_worker_progress_steps、
// hr_worker_health_training。此檔只放常數與純函式，前端與後端都可以匯入。

export const WORKER_PROGRESS_STEPS = [
  ['match_date', '配工／雇主面試日期'], ['passport', '護照確認'], ['document_arrival', '文件到達 D/C'],
  ['personal_documents', '個人文件和證件 P/D'], ['pdos', 'PDOS 簽立文件'], ['medical', '體檢 MED'],
  ['accr_in', 'ACCR 引進權入件'], ['accr_out', 'ACCR 引進權出件'], ['umid', 'UMID'], ['training', '訓練（60 日）'],
  ['owwa', 'OWWA（7 日）'], ['visa', 'VISA（7 日）'], ['oec', 'OEC（4 日）'], ['expected_entry', '預定入境'], ['actual_entry', '實際入境'],
  ['entry_notification', '入國通報（3 日內）'], ['insurance', '勞健保加保（3 日內）'], ['arc', '居留證 ARC'],
];

// 只需要一個日期的項目；其餘項目有「開始日／完成日」兩個日期。
export const SINGLE_DATE_STEPS = new Set([
  'match_date', 'passport', 'document_arrival', 'personal_documents', 'pdos', 'medical',
  'accr_in', 'accr_out', 'umid', 'expected_entry', 'actual_entry',
  'entry_notification', 'insurance', 'arc',
]);

export const STEP_DATE_LABELS = {
  match_date: '配工／面試日期', passport: '護照確認日期', document_arrival: '文件到達日期',
  personal_documents: '個人文件確認日期', pdos: 'PDOS 日期', medical: '體檢日期', accr_in: '入件日期',
  accr_out: '出件日期', expected_entry: '預定入境日期', actual_entry: '實際入境日期',
  entry_notification: '入國通報日期', insurance: '加保日期', arc: '居留證核發日期',
};

// 訓練與抵台體檢在「進度安排」上方用狀態卡片呈現，不重複列在下方的程序清單。
export const HEALTH_TRAINING_STEP_KEYS = new Set(['training']);

export const MEDICAL_STATUSES = ['not_scheduled', 'scheduled', 'in_progress', 'passed', 'retest', 'failed'];
export const TRAINING_STATUSES = ['not_scheduled', 'scheduled', 'in_progress', 'completed'];

// 與案件層級（/api/hr 的 workflow）相同的狀態轉換規則。
export const MEDICAL_TRANSITIONS = {
  not_scheduled: ['scheduled'], scheduled: ['in_progress', 'passed', 'retest', 'failed'],
  in_progress: ['passed', 'retest', 'failed'], retest: ['scheduled', 'passed', 'failed'],
  failed: ['retest'], passed: ['retest'],
};
export const TRAINING_TRANSITIONS = {
  not_scheduled: ['scheduled'], scheduled: ['in_progress', 'completed'], in_progress: ['completed'], completed: [],
};

export const STATUS_LABELS = {
  medical: { not_scheduled: '尚未安排', scheduled: '已安排', in_progress: '進行中', passed: '已通過', retest: '需複檢', failed: '未通過' },
  training: { not_scheduled: '尚未安排', scheduled: '已安排', in_progress: '訓練中', completed: '已完成' },
};

export const DOCUMENT_STATUS_LABELS = { missing: '待收件', submitted: '待審核', approved: '已合格', returned: '退件待修正' };

export const CASE_STAGE_LABELS = {
  intake: '建檔中', matching: '媒合中', documents: '文件準備', medical_training: '訓練',
  application: 'OEC 與簽證', arrangement: '抵台體檢與在台文件', completed: '已完成',
};

export function statusSetFor(kind) {
  return new Set(kind === 'medical' ? MEDICAL_STATUSES : kind === 'training' ? TRAINING_STATUSES : []);
}

export function allowedNextStatuses(kind, current) {
  const map = kind === 'medical' ? MEDICAL_TRANSITIONS : kind === 'training' ? TRAINING_TRANSITIONS : {};
  return map[current] || [];
}

export function isValidDateText(value) {
  if (!value) return true;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// 同一個項目同時有工作者層級與案件層級的資料時，採用最近更新的那一筆。
export function pickLatestStep(workerRow, caseRow) {
  if (workerRow && caseRow) {
    return new Date(caseRow.updated_at).getTime() > new Date(workerRow.updated_at).getTime()
      ? { ...caseRow, source: 'case' } : { ...workerRow, source: 'worker' };
  }
  if (workerRow) return { ...workerRow, source: 'worker' };
  if (caseRow) return { ...caseRow, source: 'case' };
  return null;
}
