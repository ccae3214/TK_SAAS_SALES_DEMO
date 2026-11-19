// 「打包下載已核准文件」按鈕與 API 錯誤訊息的英文翻譯。
// 與 hr-worker-progress-text.js 分開放，找不到時再退回共用字典（translateHrText）。
import { translateHrText } from '@/lib/hr-translations';

export const ZIP_TEXT_EN = {
  '打包下載已核准文件': 'Download approved documents (ZIP)',
  '打包中…': 'Preparing ZIP…',
  '無法產生文件壓縮檔，請稍後再試。': 'Unable to create the document ZIP. Please try again later.',
  '無法產生文件壓縮檔，請確認文件加密金鑰正確後再試。': 'Unable to create the document ZIP. Please check that the document encryption key is correct and try again.',
  '這位工作者尚未配對到雇主，無法打包下載文件。': 'This worker has not been matched to an employer yet, so the documents cannot be downloaded as a ZIP.',
  '此帳號無權下載這位工作者的文件。': 'This account is not allowed to download this worker\'s documents.',
  '這位工作者目前沒有已審核通過的文件可以下載。': 'This worker has no approved documents to download yet.',
  '已核准文件的總大小超過打包上限，請改為逐份下載。': 'The approved documents are too large to package together. Please download them one by one.',
  '文件加密金鑰尚未設定。': 'The document encryption key has not been configured.',
  '找不到工作者資料。': 'Worker record not found.',
  '工作者編號不正確。': 'The worker ID is invalid.',
  'Authentication required': 'Please sign in again.',
  'HR membership required': 'An HR membership is required.',
};

export function zipText(text, lang) {
  if (lang !== 'en' || typeof text !== 'string') return text;
  const key = text.trim();
  return Object.prototype.hasOwnProperty.call(ZIP_TEXT_EN, key) ? ZIP_TEXT_EN[key] : translateHrText(text, lang);
}
