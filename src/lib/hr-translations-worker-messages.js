// 工人頁面「系統提示」的英文對照：
// 伺服器（API）回傳的錯誤訊息、送出申請／上傳文件／儲存資料時的提示，以及學習測驗結果。
// 這些訊息是中文字串，畫面在英文模式時由 hr-translations.jsx 的 translateHrText 逐字比對翻譯。
// 這個檔案不引用 '@/…'，方便 node --test 直接載入測試。

export const WORKER_MESSAGES_EN = {
  // 會員申請（/api/hr/member-request）
  '請先登入。': 'Please sign in first.',
  '請從本站提交資料。': 'Please submit your details from this website.',
  '請選擇工作者、雇主、仲介或訓練中心類型。': 'Please choose a member type: worker, employer, agency, or training center.',
  '請選擇所屬仲介。': 'Please choose your agency.',
  '所屬仲介不存在、已停用或與申請身分不符。': 'The agency does not exist, is inactive, or does not match the member type you applied for.',
  '管理者不需申請會員類型。': 'Administrators do not need to apply for a member type.',
  '此帳號已有會員類型。': 'This account already has a member type.',
  '登入服務未提供可識別的帳號資料。': 'The sign-in service did not provide identifiable account details.',
  '會員或機構狀態已變更，請重新確認申請。': 'The member or agency status has changed. Please review your application again.',
  '申請資料格式不正確。': 'The application details are not in the correct format.',
  '此 Email 或 LINE 帳號已綁定其他會員。': 'This email or LINE account is already linked to another member.',
  '送出申請失敗，請稍後再試。': 'Could not submit your application. Please try again later.',
  '送出失敗': 'Submission failed',
  '履歷 PDF 產生失敗。': 'Could not create the resume PDF.',

  // 文件上傳與下載（/api/hr/documents）
  '請從本站提交文件。': 'Please submit documents from this website.',
  '上傳資料格式不正確。': 'The upload details are not in the correct format.',
  '請選擇案件文件並重新提交。': 'Please choose a case document and submit again.',
  '文件大小需介於 1 byte 到 10 MB。': 'The file size must be between 1 byte and 10 MB.',
  '目前只接受 PDF、JPG 與 PNG 文件。': 'Only PDF, JPG, and PNG files are accepted.',
  '找不到文件要求。': 'The document requirement could not be found.',
  '此文件已標示為不適用，無法上傳。': 'This document is marked as not applicable and cannot be uploaded.',
  '此帳號無權為這位工作者上傳文件。': 'This account is not allowed to upload documents for this worker.',
  '文件儲存失敗，請稍後再試。': 'Could not save the document. Please try again later.',
  '文件加密尚未設定，請在伺服器設定 HR_DOCUMENT_ENCRYPTION_KEY（32 bytes Base64）後重啟。': 'Document encryption is not set up yet. Please contact the administrator.',
  '文件加密金鑰尚未設定。': 'The document encryption key is not set up yet. Please contact the administrator.',
  '文件編號不正確。': 'The document number is not valid.',
  '找不到文件。': 'The document could not be found.',
  '此帳號無權下載這份文件。': 'This account is not allowed to download this document.',
  '無法解密或讀取文件，請確認文件加密金鑰正確。': 'The document could not be decrypted or read. Please contact the administrator.',
  '這位工作者目前沒有已審核通過的文件可以下載。': 'This worker has no approved documents to download yet.',
  '已核准文件的總大小超過打包上限，請改為逐份下載。': 'The approved documents are too large to package together. Please download them one by one.',
  '無法產生文件壓縮檔，請確認文件加密金鑰正確後再試。': 'Could not create the document ZIP file. Please contact the administrator and try again.',
  '此帳號無權下載這位工作者的文件。': 'This account is not allowed to download this worker\u2019s documents.',
  '這位工作者尚未配對到雇主，無法打包下載文件。': 'This worker has not been matched with an employer yet, so the documents cannot be downloaded as a package.',

  // 工作者資料與案件（/api/hr）
  '只能編輯自己的工作者資料。': 'You can only edit your own worker profile.',
  '請填寫工作者姓名。': 'Please enter the worker\u2019s name.',
  '履歷資料格式不正確。': 'The resume details are not in the correct format.',
  '找不到你的案件。': 'Your case could not be found.',
  '確認項目不正確。': 'The confirmation item is not valid.',
  '欄位內容不正確。': 'A field has an invalid value.',
  '資料已存在，請檢查 Email。': 'This record already exists. Please check the email address.',
  '關聯資料不存在，請重新整理後再選擇。': 'The related record no longer exists. Please refresh the page and choose again.',
  '新增失敗，請稍後再試。': 'Could not add the record. Please try again later.',
  '更新失敗，請稍後再試。': 'Could not update the record. Please try again later.',
  '無法讀取人力仲介資料。請確認 PostgreSQL 已啟動。': 'Could not load the data. Please contact the administrator.',
  '找不到會員綁定的工作者資料。': 'No worker profile is linked to this member.',

  // 聊天室與導覽
  '會員或聊天室資料不正確。': 'The member or chat room details are not valid.',
  '無法從此聊天室建立私訊。': 'A private chat cannot be started from this chat room.',
  '只能私訊此群組內的其他會員。': 'You can only message other members of this group.',
  '導覽資料不正確。': 'The tour details are not valid.',
};

const hasCjk = text => /[\u3400-\u9fff]/.test(text);

// 含數字的句型（申請成功、測驗結果等句子原本就有翻譯，這裡只補缺的）。
export function translateWorkerMessagePattern(text) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();

  const server = trimmed.match(/^伺服器暫時沒有回應（HTTP (\d+)），可能正在更新或重新啟動，請稍後再試。$/);
  if (server) return `The server is not responding (HTTP ${server[1]}). It may be updating or restarting. Please try again shortly.`;

  // 課程時數，例如「· 40 小時」「3 / 12 · 2.5 小時」。換完之後不能還有中文，避免翻一半。
  if (/\d+(?:\.\d+)? 小時/.test(trimmed)) {
    const replaced = trimmed.replace(/(\d+(?:\.\d+)?) 小時/g, (_, hours) => `${hours} ${hours === '1' ? 'hour' : 'hours'}`);
    if (!hasCjk(replaced)) return replaced;
  }
  return '';
}
