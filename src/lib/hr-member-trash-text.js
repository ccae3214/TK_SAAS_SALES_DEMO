// 「已刪除帳號」功能的中英文文字。
// - MEMBER_TRASH_EN：畫面上固定文字與後端錯誤訊息的 中文→英文 對照（接進 translateHrText）。
// - memberTrashText：帶有會員名稱的確認視窗與提示訊息，依語言直接回傳對應文字。

export const MEMBER_TRASH_EN = {
  '已刪除帳號': 'Deleted accounts',
  '這些帳號已停止登入，資料（履歷、文件、進度）都還保留。可以還原，或永久刪除；永久刪除後無法復原。': 'These accounts can no longer sign in, but their data (resume, documents, progress) is still kept. You can restore them or delete them permanently; permanent deletion cannot be undone.',
  '刪除時間': 'Deleted on',
  '還原': 'Restore',
  '永久刪除': 'Delete permanently',
  '此會員帳號已在「已刪除帳號」。': 'This member account is already in "Deleted accounts".',
  '請先將會員帳號移到「已刪除帳號」，再從那裡永久刪除。': 'Move the member account to "Deleted accounts" first, then delete it permanently from there.',
  '只有系統管理者可以還原已刪除的會員帳號。': 'Only system administrators can restore deleted member accounts.',
  '只有 ENV 綁定的 LINE 最高管理者可以還原系統管理者帳號。': 'Only the root LINE administrator bound in ENV can restore system administrator accounts.',
  '此會員帳號不在「已刪除帳號」。': 'This member account is not in "Deleted accounts".',
};

const TEXT = {
  confirmTrash: {
    zh: ({ name }) => `確定刪除會員帳號「${name}」？帳號會先移到「已刪除帳號」並停止登入，資料不會消失，之後可以隨時還原。`,
    en: ({ name }) => `Delete member account "${name}"? It will be moved to "Deleted accounts" and sign-in will be blocked. No data is lost, and you can restore it at any time.`,
  },
  confirmDeletePending: {
    zh: ({ name }) => `確定刪除申請中的會員「${name}」？此操作無法復原。`,
    en: ({ name }) => `Delete pending member "${name}"? This cannot be undone.`,
  },
  trashed: {
    zh: () => '會員帳號已移到「已刪除帳號」，可隨時還原。',
    en: () => 'Member account moved to "Deleted accounts". You can restore it at any time.',
  },
  deletedPending: {
    zh: () => '會員帳號已刪除',
    en: () => 'Member account deleted',
  },
  failDelete: {
    zh: () => '刪除會員帳號失敗',
    en: () => 'Failed to delete the member account',
  },
  restored: {
    zh: () => '會員帳號已還原。',
    en: () => 'Member account restored.',
  },
  failRestore: {
    zh: () => '還原會員帳號失敗',
    en: () => 'Failed to restore the member account',
  },
  purgeWarnWorker: {
    zh: () => '這位工作者的履歷、已上傳的文件與審核紀錄、進度與體檢訓練狀態都會一併刪除。',
    en: () => "This worker's resume, uploaded documents and review history, and progress and medical/training status will be deleted too.",
  },
  purgeWarnEmployer: {
    zh: () => '這位雇主的資料會一併刪除。',
    en: () => "This employer's record will be deleted too.",
  },
  purgePrompt: {
    zh: ({ name, warning }) => `永久刪除「${name}」後無法復原。${warning ? `\n${warning}` : ''}\n\n請輸入會員名稱「${name}」以確認永久刪除：`,
    en: ({ name, warning }) => `Permanently deleting "${name}" cannot be undone.${warning ? `\n${warning}` : ''}\n\nType the member name "${name}" to confirm permanent deletion:`,
  },
  purgeMismatch: {
    zh: () => '輸入的名稱不符，沒有刪除任何資料。',
    en: () => 'The name you typed does not match. Nothing was deleted.',
  },
  purged: {
    zh: () => '會員帳號已永久刪除。',
    en: () => 'Member account permanently deleted.',
  },
};

export const MEMBER_TRASH_TEXT_KEYS = Object.keys(TEXT);

export function memberTrashText(key, lang = 'zh', params = {}) {
  const entry = TEXT[key];
  if (!entry) throw new Error(`Unknown member trash text key: ${key}`);
  return (lang === 'en' ? entry.en : entry.zh)(params);
}
