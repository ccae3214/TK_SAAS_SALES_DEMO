// 雇主核准函的「核准日期」與「文號」驗證（純函式，不碰資料庫，方便單獨測試；前後端共用）。
// 兩個欄位都是必填：上傳核准函時一定要填。
import { isValidDateText } from './hr-worker-progress.js';

export const APPROVAL_NUMBER_MAX = 60;

// 錯誤代碼 → 中英文訊息。API 回傳 code，畫面依目前語言顯示。
export const APPROVAL_MESSAGES = {
  approval_date_required: { zh: '請填寫核准日期。', en: 'Please enter the approval date.' },
  approval_date_invalid: { zh: '核准日期格式不正確。', en: 'The approval date is not valid.' },
  approval_number_required: { zh: '請填寫核准文號。', en: 'Please enter the approval document number.' },
  approval_number_too_long: { zh: `核准文號不能超過 ${APPROVAL_NUMBER_MAX} 個字。`, en: `The document number cannot exceed ${APPROVAL_NUMBER_MAX} characters.` },
};

// 回傳 { ok: true, date, number } 或 { ok: false, code }。
export function validateApprovalFields({ approvalDate, approvalNumber } = {}) {
  const date = typeof approvalDate === 'string' ? approvalDate.trim() : '';
  const number = typeof approvalNumber === 'string' ? approvalNumber.trim().replace(/\s+/g, ' ') : '';
  if (!date) return { ok: false, code: 'approval_date_required' };
  if (!isValidDateText(date)) return { ok: false, code: 'approval_date_invalid' };
  if (!number) return { ok: false, code: 'approval_number_required' };
  if (number.length > APPROVAL_NUMBER_MAX) return { ok: false, code: 'approval_number_too_long' };
  return { ok: true, date, number };
}
