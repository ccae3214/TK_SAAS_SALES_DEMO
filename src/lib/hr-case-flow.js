// 「訓練與來台文件」流程（依「菲律賓移工來台工作：五方實務指南」）。純函式，不碰資料庫，方便單獨測試。
//
//   1. 初步文件審核通過（LCR Form 1-A、PSA 出生證明、護照三取二）→ 由「訓練中心」安排訓練；其他文件可同時繼續備齊
//   2. 訓練完成後           → 由「菲律賓仲介」辦理 OEC 與簽證
//   3. 抵台後               → 由「台灣仲介」安排入國後體檢，並辦理在台文件
//                              （入國通報、勞健保加保、居留證 ARC）
// 管理者可處理所有環節。

export const TRAINING_STATUSES = ['not_scheduled', 'scheduled', 'in_progress', 'completed'];
export const MEDICAL_STATUSES = ['not_scheduled', 'scheduled', 'in_progress', 'passed', 'retest', 'failed'];

// 這些申請程序有固定的負責單位；其他程序（配工日期、護照、文件到達…）維持兩種仲介都能編輯。
export const STEP_OWNERS = {
  visa: 'philippines',
  oec: 'philippines',
  actual_entry: 'taiwan',
  entry_notification: 'taiwan',
  insurance: 'taiwan',
  arc: 'taiwan',
};

// 抵台後由台灣仲介辦理的「在台文件」
export const TAIWAN_ARRIVAL_STEPS = ['entry_notification', 'insurance', 'arc'];
// 菲律賓仲介負責的出境前辦理
export const PHILIPPINES_DEPARTURE_STEPS = ['oec', 'visa'];

export const OWNER_LABELS = { training_center: '訓練中心', philippines: '菲律賓仲介', taiwan: '台灣仲介' };

// 誰可以編輯某個申請程序。role / agencyType 取自登入者（principal）。
export function canManageStep(role, agencyType, stepKey) {
  if (role === 'admin') return true;
  if (role !== 'agency') return false;
  const owner = STEP_OWNERS[stepKey];
  return owner ? owner === agencyType : true;
}

// 誰可以更新「訓練」或「抵台體檢」狀態。
export function canUpdateWorkflow(role, agencyType, workflowType) {
  if (workflowType !== 'training' && workflowType !== 'medical') return false;
  if (role === 'admin') return true;
  if (workflowType === 'training') return role === 'training_center';
  if (workflowType === 'medical') return role === 'agency' && agencyType === 'taiwan';
  return false;
}

export const WORKFLOW_DENIED_MESSAGES = {
  training: '訓練狀態由訓練中心或管理者管理。',
  medical: '抵台體檢狀態由台灣仲介或管理者管理。',
};

// 訓練需要「初步文件審核通過」（不必等全部文件核准）；抵台體檢需要已登錄實際入境日期。
// 回傳 null 代表可以安排，否則回傳不能安排的原因。documentsOpen 保留給舊呼叫端，訓練不再使用它。
export const TRAINING_GATE_MESSAGE = '初步文件審核（LCR Form 1-A、PSA 出生證明、護照三項中有兩項核准）通過後，才能安排訓練。';
export function workflowBlockReason(workflowType, { gateClosed, arrived }) {
  if (workflowType === 'training' && gateClosed) return TRAINING_GATE_MESSAGE;
  if (workflowType === 'medical' && !arrived) return '請先由台灣仲介登錄實際入境日期，才能安排抵台體檢。';
  return null;
}

export const WORKFLOW_TRANSITIONS = {
  medical: { not_scheduled: ['scheduled'], scheduled: ['in_progress', 'passed', 'retest', 'failed'], in_progress: ['passed', 'retest', 'failed'], retest: ['scheduled', 'passed', 'failed'], failed: ['retest'], passed: ['retest'] },
  training: { not_scheduled: ['scheduled'], scheduled: ['in_progress', 'completed'], in_progress: ['completed'], completed: [] },
};

export function canTransition(workflowType, from, to) {
  if (from === to) return true;
  return (WORKFLOW_TRANSITIONS[workflowType]?.[from] || []).includes(to);
}

// 由申請程序列（{step_key, completed_on}）整理出階段需要的旗標。
export function summarizeSteps(steps) {
  const done = new Set((steps || []).filter(step => step.completed_on).map(step => step.step_key));
  return {
    oecDone: done.has('oec'),
    visaDone: done.has('visa'),
    arrived: done.has('actual_entry'),
    arrivalDocsDone: TAIWAN_ARRIVAL_STEPS.every(key => done.has(key)),
  };
}

// 案件階段：
//   intake → documents → medical_training（訓練）→ application（OEC 與簽證）→ arrangement（抵台體檢與在台文件）→ completed
// 階段代碼沿用資料庫既有值（medical_training 的顯示名稱改為「訓練」），避免改動資料表限制。
export function computeCaseStage({ gateClosed, documentsOpen, trainingStatus, certificationOpen, medicalStatus, oecDone, visaDone, arrived, arrivalDocsDone }) {
  if (gateClosed) return 'intake';
  if (documentsOpen) return 'documents';
  if (trainingStatus !== 'completed' || certificationOpen) return 'medical_training';
  if (!oecDone || !visaDone) return 'application';
  if (!arrived || medicalStatus !== 'passed' || !arrivalDocsDone) return 'arrangement';
  return 'completed';
}

// 下一步要由誰做什麼（給案件工作區與總覽顯示）。
export function nextActionForStage(stage) {
  switch (stage) {
    case 'medical_training': return `由${OWNER_LABELS.training_center}安排訓練`;
    case 'application': return `由${OWNER_LABELS.philippines}辦理 OEC 與簽證`;
    case 'arrangement': return `由${OWNER_LABELS.taiwan}安排抵台體檢並辦理在台文件`;
    default: return '';
  }
}
