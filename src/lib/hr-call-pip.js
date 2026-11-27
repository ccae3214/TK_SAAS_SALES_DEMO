// 電腦版通話視窗「彈出到桌面」：移到瀏覽器外面、永遠在最上層的小視窗，可以放在桌面任何地方。
// - Chrome／Edge／Firefox 151 以上：Document Picture-in-Picture，整個通話視窗（畫面、按鈕、文字聊天）都搬過去
// - Safari：只支援把單一個影像彈出（<video> 子母畫面），沒有按鈕與聊天
// - 其他瀏覽器、手機：不顯示按鈕

export function pictureInPictureMode(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return null;
  try {
    if (typeof win.documentPictureInPicture?.requestWindow === 'function') return 'document';
    if (win.document?.pictureInPictureEnabled) return 'video';
  } catch { /* 不支援 */ }
  return null;
}

// 彈出視窗的大小：沿用目前通話視窗大小，限制在合理範圍（瀏覽器還會自己再限制）
export function pipWindowSize(rect) {
  const width = Math.round(Math.min(Math.max(Number(rect?.width) || 720, 320), 1200));
  const height = Math.round(Math.min(Math.max(Number(rect?.height) || 520, 240), 900));
  return { width, height };
}

// 彈出的視窗是空白頁面，要把網站的樣式複製過去，通話視窗才會長得一樣
export function copyStylesTo(sourceDocument, targetDocument) {
  for (const sheet of [...sourceDocument.styleSheets]) {
    try {
      const style = targetDocument.createElement('style');
      style.textContent = [...sheet.cssRules].map(rule => rule.cssText).join('\n');
      targetDocument.head.appendChild(style);
    } catch {
      // 跨網域的樣式表讀不到內容，改用 <link> 載入
      if (!sheet.href) continue;
      const link = targetDocument.createElement('link');
      link.rel = 'stylesheet'; link.href = sheet.href;
      if (sheet.media?.mediaText) link.media = sheet.media.mediaText;
      targetDocument.head.appendChild(link);
    }
  }
}

// Safari：要彈出的影像。優先放大中的人，其次第一個有影像的對方
export function pickPipVideo(root) {
  if (!root) return null;
  return root.querySelector('.hr-call-tile.is-focused:not(.no-video) video')
    || root.querySelector('.hr-call-tile:not(.is-local):not(.no-video) video')
    || null;
}
