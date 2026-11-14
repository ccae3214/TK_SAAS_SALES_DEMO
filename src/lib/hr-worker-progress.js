// 工作者層級的進度（不需要案件）。
// 文件審核沿用 hr_worker_documents；進度日期與訓練／抵台體檢狀態存放於 hr_worker_progress_steps、
// hr_worker_health_training。此檔只放常數與純函式，前端與後端都可以匯入。

export const WORKER_PROGRESS_STEPS = [
  ['match_date', '配工／雇主面試日期'], ['passport', '護照確認'], ['document_arrival', '文件到達 D/C'],
  ['personal_documents', '個人文件和證件 P/D'], ['pdos', 'PDOS 台灣文化講習（1 日）'], ['medical', '體檢 MED'], ['medical_expiry', '體檢過期日'],
  ['accr_in', 'ACCR 引進權入件'], ['accr_out', 'ACCR 引進權出件'],
  ['contract_arrival', '合約到達菲律賓'], ['contract_issue', '核准函（合約）發函日'], ['wage_attestation', '來華工資切結書認證'],
  ['umid', 'UMID'], ['training', '訓練（60 日；中文 A1 共 240 小時）'],
  ['owwa', 'OWWA（7 日）'], ['visa', 'VISA（7 日）'], ['oec', 'OEC（當日可領）'], ['ticket', '機票／出境'],
  ['expected_entry', '預定入境'], ['actual_entry', '實際入境'],
  ['entry_notification', '入國通報（3 日內）'], ['insurance', '勞健保加保（3 日內）'], ['arc', '居留證 ARC'],
];

// 申請程序依「簽證（VISA）」與「OEC（出境許可）」兩條路線分組；前面有共同的前置作業，最後是入境後的在台文件。
// 兩條路線可以同時進行；沒有列在任何路線的項目（例如管理者自訂）歸到 fallback 的前置作業。
export const PROCESS_ROUTES = [
  { key: 'prep', badge: '前置', title: '前置作業', summary: '配工、護照與個人文件、體檢；簽證與 OEC 兩條路線都會用到。', fallback: true,
    steps: ['match_date', 'passport', 'document_arrival', 'personal_documents', 'medical', 'medical_expiry', 'umid'] },
  { key: 'visa', badge: 'VISA', title: 'VISA 路線（簽證）', summary: 'ACCR 引進權、核准函與合約、工資切結書認證，以及簽證。',
    steps: ['accr_in', 'accr_out', 'contract_arrival', 'contract_issue', 'wage_attestation', 'visa'] },
  { key: 'oec', badge: 'OEC', title: 'OEC 路線（出境許可）', summary: 'OEC 路線的項目：訓練、PDOS、OWWA、OEC，以及機票與出境。',
    steps: ['training', 'pdos', 'owwa', 'oec', 'ticket'] },
  { key: 'arrival', badge: '入境', title: '入境與在台文件', summary: '預定與實際入境日期，以及入國通報、勞健保加保與居留證。',
    steps: ['expected_entry', 'actual_entry', 'entry_notification', 'insurance', 'arc'] },
];
const ROUTE_OF_STEP = new Map(PROCESS_ROUTES.flatMap(route => route.steps.map(key => [key, route.key])));
export const routeOfStep = stepKey => ROUTE_OF_STEP.get(stepKey) || PROCESS_ROUTES.find(route => route.fallback).key;

// 只需要一個日期的項目；其餘項目有「開始日／完成日」兩個日期。
export const SINGLE_DATE_STEPS = new Set([
  'match_date', 'passport', 'document_arrival', 'personal_documents', 'pdos', 'medical', 'medical_expiry',
  'accr_in', 'accr_out', 'contract_arrival', 'contract_issue', 'wage_attestation', 'umid', 'ticket', 'expected_entry', 'actual_entry',
  'entry_notification', 'insurance', 'arc',
]);

export const STEP_DATE_LABELS = {
  match_date: '配工／面試日期', passport: '護照確認日期', document_arrival: '文件到達日期',
  personal_documents: '個人文件確認日期', pdos: 'PDOS 講習日', medical: '體檢日期', medical_expiry: '體檢過期日期', accr_in: '入件日期',
  accr_out: '出件日期', contract_arrival: '到達菲律賓日期', contract_issue: '核准函發函日期', wage_attestation: '認證領出日期',
  ticket: '實際出境日期', expected_entry: '預定入境日期', actual_entry: '實際入境日期',
  entry_notification: '入國通報日期', insurance: '加保日期', arc: '居留證核發日期',
};

// 有「開始日／完成日」兩個日期的項目，各自的日期名稱。
export const STEP_PAIR_LABELS = {
  visa: ['送件日期', '取得日期'], owwa: ['開課日期', '結業日期'],
};

// 部分項目除了日期，還要記一個欄位（資料庫 detail 欄）：簽證要分一般件／加急件、OWWA 要記雇主（雇主可能更換）、機票記航班資訊。
export const STEP_DETAILS = {
  visa: { label: '簽證類型', type: 'select', options: [['regular', '一般件（5 個工作天）'], ['expedite', '加急件（3 個工作天）']] },
  owwa: { label: '雇主', type: 'text', maxLength: 160 },
  ticket: { label: '機票資訊（航班／備註）', type: 'text', maxLength: 300 },
};

// 顯示用：選單欄位轉成選項名稱（例如 regular → 一般件（5 個工作天）），文字欄位原樣回傳。
export function stepDetailLabel(stepKey, value) {
  const definition = STEP_DETAILS[stepKey];
  if (!definition || !value) return '';
  return definition.type === 'select' ? (definition.options.find(([key]) => key === value)?.[1] || '') : value;
}

// 回傳 { ok, value }：沒有額外欄位的項目一律存空字串；選單欄位只接受清單內的值。
export function cleanStepDetail(stepKey, value) {
  const definition = STEP_DETAILS[stepKey];
  const text = typeof value === 'string' ? value.trim() : '';
  if (!definition) return { ok: true, value: '' };
  if (definition.type === 'select') return !text || definition.options.some(([key]) => key === text) ? { ok: true, value: text } : { ok: false, value: '' };
  return { ok: true, value: text.slice(0, definition.maxLength) };
}

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
