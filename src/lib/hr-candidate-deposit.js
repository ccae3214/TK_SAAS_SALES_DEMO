// 雇主錄用後的「訂金」與「結單」（純函式與訊息，不碰資料庫，方便測試）。
//
// 流程：雇主錄用人選（status=passed）→ 雇主付完訂金，由台灣仲介（或管理者）登記金額 → 此人選視為「已結單」。
// 「已結單」不是新的資料庫狀態：status 仍是 passed（建立案件、人數計算、撤回等既有判斷都不受影響），
// 以「有登記付款時間」判斷，取消登記就回到「已錄用」。

export const MAX_DEPOSIT_AMOUNT = 10000000;

export const DEPOSIT_MESSAGES = {
  forbidden: '僅台灣仲介或管理者可登記雇主訂金。',
  badId: '人選編號不正確。',
  badAmount: '訂金金額不正確，請輸入 1 到 10,000,000 的整數（新臺幣）。',
  notFound: '找不到此人選，或不屬於你的機構。',
  notHired: '雇主錄用後才能登記訂金。',
  failed: '登記訂金失敗',
};

// 回傳 1 到 MAX_DEPOSIT_AMOUNT 的整數（新臺幣）；不合法回傳 null。允許千分位逗號。
export function parseDepositAmount(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!/^\d{1,8}$/.test(text)) return null;
  const amount = Number(text);
  return amount >= 1 && amount <= MAX_DEPOSIT_AMOUNT ? amount : null;
}

export function isCandidateClosed(candidate) {
  return candidate?.status === 'passed' && !!candidate.deposit_paid_at;
}

export function formatDeposit(amount) {
  return `NT$ ${Number(amount).toLocaleString('en-US')}`;
}

// 付款登記日期，以台灣時間顯示（YYYY-MM-DD）。
export function depositDateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}
