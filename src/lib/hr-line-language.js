// LINE 機器人的回覆語言備援規則（純函式，不碰資料庫，方便測試）。
//
// 語言的決定順序：使用者自己選的偏好 → LINE 個人資料的語言 → 這裡的備援。
// 備援不能只看「使用者傳來的文字」：圖文選單送出的指令全是中文（例如「文件」「待辦」），
// 那不代表使用者說中文。以前一律把含中文字的訊息判成中文，
// 所以沒有存偏好、LINE 也沒給語言的菲律賓會員，一點選單就收到中文。

export function detectedLanguage(text) {
  return /[㐀-鿿]/.test(String(text || '')) ? 'zh' : 'en';
}

// 沒有任何語言線索時，依會員身分給預設語言（與首次登入歡迎訊息、核准通知的規則一致）：
// 工作者與菲律賓仲介用英文，其餘用中文。使用者隨時可輸入「language」自行切換。
export function roleDefaultLanguage(principal) {
  if (principal?.role === 'worker') return 'en';
  if (principal?.role === 'agency' && principal.agency_type === 'philippines') return 'en';
  return 'zh';
}

// menuCommands：圖文選單會送出的指令文字集合。
export function fallbackReplyLanguage(text, principal, menuCommands) {
  const command = String(text || '').trim().replace(/\s+/g, ' ');
  return menuCommands?.has(command) ? roleDefaultLanguage(principal) : detectedLanguage(command);
}
