// 雇主訂金與結單的英文對照。由 hr-translations.jsx 的 translateHrText 串接使用（已有的翻譯優先）。
import { DEPOSIT_MESSAGES } from '@/lib/hr-candidate-deposit';

export const DEPOSIT_EN = {
  '已結單': 'Order closed',
  '雇主訂金：': 'Employer deposit: ',
  '已付': 'Paid',
  '尚未付款': 'Not paid yet',
  '訂金金額：': 'Deposit amount: ',
  '付款日期：': 'Paid on: ',
  '訂金金額（新臺幣）': 'Deposit amount (NTD)',
  '登記已付訂金並結單': 'Record deposit paid and close order',
  '取消訂金登記': 'Undo deposit record',
  '儲存中…': 'Saving…',
  [DEPOSIT_MESSAGES.forbidden]: 'Only the Taiwan agency or an administrator can record the employer’s deposit.',
  [DEPOSIT_MESSAGES.badId]: 'The candidate ID is not valid.',
  [DEPOSIT_MESSAGES.badAmount]: 'The deposit amount is not valid. Enter a whole number from 1 to 10,000,000 (NTD).',
  [DEPOSIT_MESSAGES.notFound]: 'Candidate not found, or it does not belong to your agency.',
  [DEPOSIT_MESSAGES.notHired]: 'A deposit can only be recorded after the employer has hired the candidate.',
  [DEPOSIT_MESSAGES.failed]: 'Failed to record the deposit',
};

// 確認視窗的組合字串（含人名與金額）。
export function translateDepositPattern(text) {
  const record = text.match(/^確定登記「(.+)」的雇主已付訂金 (.+)？登記後此人選狀態會設為「已結單」。$/);
  if (record) return `Record that the employer has paid the deposit of ${record[2]} for “${record[1]}”? The candidate’s status will be set to “Order closed”.`;
  const undo = text.match(/^確定取消「(.+)」的訂金登記？取消後此人選會回到「已錄用」狀態。$/);
  if (undo) return `Undo the deposit record for “${undo[1]}”? The candidate will go back to “Hired”.`;
  return '';
}
