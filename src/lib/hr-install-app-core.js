// 「加到手機桌面」：判斷目前的瀏覽器環境，並提供中英文說明文字。
// 不 import '@/…'，所以 node:test 可以直接測試（畫面在 HrInstallApp.jsx）。
//
// 環境代碼：
//   installed     已經從桌面圖示開啟（不用再顯示按鈕）
//   prompt        瀏覽器支援一鍵安裝（Android Chrome、桌機 Chrome／Edge）
//   ios           iPhone／iPad 的一般瀏覽器：用「分享 → 加入主畫面」
//   ios-inapp     iPhone 的 LINE、Facebook 等內建瀏覽器：要先用 Safari 開啟
//   android       Android 一般瀏覽器：用選單的「加入主畫面」
//   android-inapp Android 的 LINE、Facebook 等內建瀏覽器：要先用 Chrome 開啟
//   desktop       電腦且瀏覽器不支援安裝：不顯示按鈕

const IN_APP = /Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|KAKAOTALK|Messenger/i;

export function detectInstallEnvironment({ userAgent = '', maxTouchPoints = 0, standalone = false, canPrompt = false } = {}) {
  if (standalone) return 'installed';
  const ua = String(userAgent || '');
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(maxTouchPoints) > 1);
  const android = /Android/i.test(ua);
  if (ios || android) {
    const inApp = IN_APP.test(ua) || (android && /; wv\)/.test(ua));
    if (inApp) return ios ? 'ios-inapp' : 'android-inapp';
  }
  if (canPrompt) return 'prompt';
  if (ios) return 'ios';
  if (android) return 'android';
  return 'desktop';
}

export const INSTALL_COPY = {
  zh: {
    button: '加到手機桌面', close: '關閉', done: '完成後，桌面會多一個「克雷迅」圖示，之後點圖示就能直接開啟，不用再輸入網址。',
    ios: { title: '加到 iPhone 主畫面', steps: ['點瀏覽器下方（或上方）的「分享」按鈕', '往下滑，選「加入主畫面」', '按右上角的「新增」'], note: '如果找不到「加入主畫面」，請改用 Safari 開啟這個網頁。' },
    android: { title: '加到 Android 桌面', steps: ['點瀏覽器右上角的「⋮」選單', '選「加入主畫面」或「安裝應用程式」', '按「新增」或「安裝」'], note: '建議使用 Chrome 瀏覽器。' },
    inapp: { title: '請先用瀏覽器開啟', steps: ['點畫面右上角（或右下角）的「⋯」或分享按鈕', 'iPhone 選「在 Safari 中開啟」，Android 選「用其他瀏覽器開啟」或「用 Chrome 開啟」', '開啟後，再按一次「加到手機桌面」'], note: 'LINE、Facebook 等 App 內建的瀏覽器無法加到桌面。' },
  },
  en: {
    button: 'Add to Home Screen', close: 'Close', done: 'Afterwards a "Kolecion" icon appears on your home screen. Tap it to open the site directly, with no need to type the address.',
    ios: { title: 'Add to your iPhone Home Screen', steps: ['Tap the Share button at the bottom (or top) of the browser', 'Scroll down and tap "Add to Home Screen"', 'Tap "Add" in the top-right corner'], note: 'If you cannot find "Add to Home Screen", open this page in Safari instead.' },
    android: { title: 'Add to your Android Home Screen', steps: ['Tap the "⋮" menu at the top-right of the browser', 'Tap "Add to Home screen" or "Install app"', 'Tap "Add" or "Install"'], note: 'Chrome is recommended.' },
    inapp: { title: 'Open in your browser first', steps: ['Tap the "⋯" or Share button at the top-right (or bottom-right) of the screen', 'On iPhone choose "Open in Safari"; on Android choose "Open in browser" or "Open in Chrome"', 'Once it opens, tap "Add to Home Screen" again'], note: 'The built-in browser inside LINE, Facebook and similar apps cannot add sites to the home screen.' },
  },
};

// 依環境挑出要顯示的說明（prompt 與 installed、desktop 不需要說明）。
export function installGuideKey(environment) {
  if (environment === 'ios') return 'ios';
  if (environment === 'android') return 'android';
  if (environment === 'ios-inapp' || environment === 'android-inapp') return 'inapp';
  return null;
}

// 這個環境要不要顯示「加到手機桌面」按鈕。
export function shouldShowInstallButton(environment) {
  return environment === 'prompt' || installGuideKey(environment) !== null;
}
