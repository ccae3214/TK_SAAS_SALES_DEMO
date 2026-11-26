// 登入頁判斷 LINE 登入要走哪一種流程（不引用 '@/…'，node:test 可以直接測試）。
//   handoff  手機從桌面圖示（standalone）開啟的 App：LINE 驗證會在另一個瀏覽器完成、cookie 不互通，
//            所以走「交接單 + LINE 聊天室驗證碼」（見 /api/hr/line-handoff/*）。這個流程要靠手機的 LINE App。
//   web      其他情況，包含電腦的瀏覽器與電腦的桌面 App：直接在同一個視窗做 LINE 網頁登入。
//            電腦的桌面 App 與瀏覽器共用 cookie，不需要交接單；電腦也沒有手機版 LINE App 可以自動認證，
//            所以要關閉 LINE 自動登入（disable_auto_login），才會顯示網頁登入畫面（掃 QR Code 或輸入 LINE 帳號密碼）。
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i;

export function isMobileDevice({ userAgent = '', maxTouchPoints = 0 } = {}) {
  const ua = String(userAgent || '');
  // iPadOS 的 Safari 會假裝成 Mac，用觸控點數分辨
  return MOBILE_UA.test(ua) || (/Macintosh/i.test(ua) && Number(maxTouchPoints) > 1);
}

export function lineLoginMode({ standalone = false, userAgent = '', maxTouchPoints = 0 } = {}) {
  return standalone && isMobileDevice({ userAgent, maxTouchPoints }) ? 'handoff' : 'web';
}
