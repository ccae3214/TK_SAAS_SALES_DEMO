// 「來電通知」按鈕的瀏覽器環境判斷與中英文文字（不 import '@/…'，node:test 可以直接測試；畫面在 HrCallNotify.jsx）。
//
// 環境代碼：
//   insecure     網址不是 https，瀏覽器不開放推播
//   inapp        LINE、Facebook 等 App 內建瀏覽器：要改用 Safari／Chrome
//   ios-install  iPhone／iPad 的一般瀏覽器：必須先「加入主畫面」，從桌面圖示開啟後才能開啟通知（iOS 16.4 以上）
//   unsupported  瀏覽器沒有推播功能
//   denied       使用者在瀏覽器或系統設定封鎖了通知
//   available    可以開啟通知

export { normalizeVapidPublicKey } from './vapid-key.js';

const IN_APP = /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|KAKAOTALK|Messenger|; wv\)/i;

// iPadOS 的 Safari 會假裝是 Mac，要用觸控點數分辨。
const isIos = (ua, maxTouchPoints) => /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(maxTouchPoints) > 1);

// 沒提供（undefined）的瀏覽器能力一律當作「有」。
const hasPushSupport = env => [env.hasServiceWorker, env.hasPushManager, env.hasNotification]
  .every(value => value === undefined || Boolean(value));

export function detectNotifyEnvironment(env = {}) {
  const ua = String(env.userAgent || '');
  if (env.isSecureContext === false) return 'insecure';
  if (IN_APP.test(ua)) return 'inapp';
  if (isIos(ua, env.maxTouchPoints ?? 0) && !env.standalone) return 'ios-install';
  if (!hasPushSupport(env)) return 'unsupported';
  return env.permission === 'denied' ? 'denied' : 'available';
}

// 瀏覽器訂閱推播要用 Uint8Array 的公開金鑰。
export function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

const LINE_NOTE = {
  zh: '已綁定 LINE 的會員，沒開啟網頁通知時，離線來電會改用 LINE 通知。',
  en: 'Members who have linked LINE will get a LINE message for calls they miss while offline if web notifications are off.',
  tl: 'Ang mga miyembrong naka-link ang LINE ay makakatanggap ng mensahe sa LINE tungkol sa mga tawag habang offline sila, kung hindi naka-on ang web notifications.',
};

export const NOTIFY_COPY = {
  zh: {
    button: '來電通知', close: '關閉', title: '來電通知',
    intro: '開啟後，即使網站沒有開著或手機鎖屏，有人撥號給你時也會收到通知，點開就能接聽。',
    enable: '開啟來電通知', disable: '關閉來電通知', test: '傳送測試通知', working: '處理中…',
    stateOn: '開啟', stateOff: '關閉',
    on: '這台裝置已開啟來電通知。', testSent: '已傳送測試通知，請看看是否收到。',
    lineNote: LINE_NOTE.zh,
    insecure: '目前的網址不是安全連線（https），瀏覽器不開放通知。請改用 https 網址開啟本網站。',
    inapp: '應用程式內建的瀏覽器（例如 LINE）不支援通知。請從選單選擇用 Safari 或 Chrome 開啟本網站，再開啟來電通知。',
    iosInstall: { title: 'iPhone 要先加到主畫面', steps: ['先按頁面上的「加到手機桌面」，依說明把網站加入主畫面', '回到手機桌面，點「克雷迅」圖示開啟網站', '登入後回到這裡，按「開啟來電通知」並選擇「允許」'], note: 'iPhone 需要 iOS 16.4 以上；在 Safari 一般分頁無法開啟通知。' },
    unsupported: '這個瀏覽器不支援通知。請改用最新版的 Chrome（Android／電腦）或 Safari（iPhone，需先加入主畫面）。',
    denied: { title: '通知已被封鎖', steps: ['在瀏覽器網址列旁的鎖頭（或設定）找到本網站的「通知」，改成「允許」', 'iPhone／Android 另外請到手機的「設定 → 通知」，確認本網站（或「克雷迅」App）允許通知', '回到這裡重新整理頁面，再按「開啟來電通知」'] },
    errors: { permission: '沒有取得通知權限，請在跳出的視窗按「允許」。', server: '無法開啟，請稍後再試。', subscribe: '這台裝置無法訂閱通知，請稍後再試或換一個瀏覽器。', test: '測試通知送不出去，請關閉後重新開啟來電通知。', config: '無法取得伺服器的通知設定，請重新整理頁面後再試。', badKey: '伺服器上的推播公開金鑰格式不正確，請管理員重新產生金鑰，並更新 HR_PUSH_VAPID_PUBLIC_KEY 與 HR_PUSH_VAPID_PRIVATE_KEY。', permissionTimeout: '沒有收到通知權限的回覆。請看網址列左邊是否有通知圖示，點它並選「允許」，再按一次開關。' },
    permissionHint: '如果沒看到詢問視窗，請看網址列左邊的通知圖示（Firefox）或網址列下方（Safari），選「允許」。',
  },
  en: {
    button: 'Call alerts', close: 'Close', title: 'Call notifications',
    intro: 'Once on, you get a notification when someone calls you, even if the site is closed or your phone is locked. Tap it to answer.',
    enable: 'Turn on call notifications', disable: 'Turn off call notifications', test: 'Send a test notification', working: 'Working…',
    stateOn: 'On', stateOff: 'Off',
    on: 'Call notifications are on for this device.', testSent: 'A test notification was sent. Check whether it arrived.',
    lineNote: LINE_NOTE.en,
    insecure: 'This page is not on a secure (https) connection, so the browser does not allow notifications. Open the site with its https address.',
    inapp: 'In-app browsers such as LINE do not support notifications. Open this site in Safari or Chrome from the menu, then turn on call notifications.',
    iosInstall: { title: 'On iPhone, add the site to your Home Screen first', steps: ['Tap "Add to Home Screen" on this page and follow the steps to add the site', 'Go to your home screen and open the site from the "Kolecion" icon', 'Sign in, come back here, tap "Turn on call notifications" and choose "Allow"'], note: 'Requires iOS 16.4 or later. Notifications cannot be turned on in a normal Safari tab.' },
    unsupported: 'This browser does not support notifications. Use the latest Chrome (Android / computer) or Safari (iPhone, after adding the site to your Home Screen).',
    denied: { title: 'Notifications are blocked', steps: ['Tap the lock icon (or settings) next to the address bar, find "Notifications" for this site and set it to "Allow"', 'On iPhone / Android, also open Settings → Notifications and make sure this site (or the "Kolecion" app) is allowed', 'Come back here, refresh the page and tap "Turn on call notifications"'] },
    errors: { permission: 'Notification permission was not granted. Tap "Allow" in the pop-up.', server: 'Could not turn it on. Please try again later.', subscribe: 'This device could not subscribe to notifications. Try again later or use another browser.', test: 'The test notification could not be sent. Turn call notifications off and on again.', config: 'Could not load the notification settings from the server. Refresh the page and try again.', badKey: 'The push public key set on the server is not valid. An administrator needs to generate new keys and update HR_PUSH_VAPID_PUBLIC_KEY and HR_PUSH_VAPID_PRIVATE_KEY.', permissionTimeout: 'No answer to the notification permission request. Look for a notification icon at the left of the address bar, click it, choose "Allow", then tap the switch again.' },
    permissionHint: 'If you do not see a pop-up, look for the notification icon at the left of the address bar (Firefox) or below the address bar (Safari) and choose "Allow".',
  },
  tl: {
    button: 'Abiso sa tawag', close: 'Isara', title: 'Mga abiso sa tawag',
    intro: 'Kapag naka-on, makakatanggap ka ng abiso kapag may tumawag sa iyo, kahit sarado ang site o naka-lock ang telepono mo. I-tap ito para sagutin.',
    enable: 'I-on ang mga abiso sa tawag', disable: 'I-off ang mga abiso sa tawag', test: 'Magpadala ng test na abiso', working: 'Pinoproseso…',
    stateOn: 'Naka-on', stateOff: 'Naka-off',
    on: 'Naka-on ang mga abiso sa tawag sa device na ito.', testSent: 'Naipadala na ang test na abiso. Tingnan kung dumating.',
    lineNote: LINE_NOTE.tl,
    insecure: 'Hindi secure (https) ang koneksyon ng page na ito, kaya hindi pinapayagan ng browser ang mga abiso. Buksan ang site gamit ang https address nito.',
    inapp: 'Hindi sinusuportahan ng mga in-app browser (tulad ng LINE) ang mga abiso. Buksan ang site na ito sa Safari o Chrome mula sa menu, saka i-on ang mga abiso sa tawag.',
    iosInstall: { title: 'Sa iPhone, idagdag muna ang site sa Home Screen', steps: ['I-tap ang "Add to Home Screen" sa page na ito at sundin ang mga hakbang para idagdag ang site', 'Pumunta sa home screen at buksan ang site mula sa icon na "Kolecion"', 'Mag-sign in, bumalik dito, i-tap ang "I-on ang mga abiso sa tawag" at piliin ang "Allow"'], note: 'Kailangan ng iOS 16.4 o mas bago. Hindi maaaring i-on ang mga abiso sa karaniwang Safari tab.' },
    unsupported: 'Hindi sinusuportahan ng browser na ito ang mga abiso. Gamitin ang pinakabagong Chrome (Android / computer) o Safari (iPhone, pagkatapos idagdag ang site sa Home Screen).',
    denied: { title: 'Naka-block ang mga abiso', steps: ['I-tap ang lock icon (o settings) sa tabi ng address bar, hanapin ang "Notifications" para sa site na ito at gawing "Allow"', 'Sa iPhone / Android, buksan din ang Settings → Notifications at tiyaking pinapayagan ang site na ito (o ang app na "Kolecion")', 'Bumalik dito, i-refresh ang page at i-tap ang "I-on ang mga abiso sa tawag"'] },
    errors: { permission: 'Hindi naibigay ang pahintulot sa abiso. I-tap ang "Allow" sa lumabas na pop-up.', server: 'Hindi ma-on. Pakisubukan ulit mamaya.', subscribe: 'Hindi makapag-subscribe sa mga abiso ang device na ito. Subukan ulit mamaya o gumamit ng ibang browser.', test: 'Hindi naipadala ang test na abiso. I-off at i-on ulit ang mga abiso sa tawag.', config: 'Hindi makuha ang notification settings mula sa server. I-refresh ang page at subukan ulit.', badKey: 'Hindi valid ang push public key na nakatakda sa server. Kailangang gumawa ng bagong keys ang administrator at i-update ang HR_PUSH_VAPID_PUBLIC_KEY at HR_PUSH_VAPID_PRIVATE_KEY.', permissionTimeout: 'Walang sagot sa hiling na pahintulot sa abiso. Hanapin ang notification icon sa kaliwa ng address bar, i-click ito, piliin ang "Allow", saka i-tap ulit ang switch.' },
    permissionHint: 'Kung walang lumabas na pop-up, hanapin ang notification icon sa kaliwa ng address bar (Firefox) o sa ilalim ng address bar (Safari) at piliin ang "Allow".',
  },
};
