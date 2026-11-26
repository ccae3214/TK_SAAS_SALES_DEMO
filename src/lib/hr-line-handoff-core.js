// 「桌面 App（PWA）裡的 LINE 登入」交接流程的純函式。
// 為什麼需要：iPhone 從主畫面圖示開啟的網站，和 LINE App 之後開出來的瀏覽器（Safari／Chrome）
// 是兩個互相獨立的 cookie 空間，Auth.js 登入前存的 state／PKCE cookie 在外部瀏覽器找不到，登入就會失敗。
// 解法：登入前的狀態改存在資料庫（state），外部瀏覽器完成 LINE 驗證後顯示 6 位數確認碼，
// 回到 App 輸入確認碼，才由 App 自己換成登入憑證。
// 主要登入方式是「LINE 聊天室傳驗證碼」：App 產生一組驗證碼，開啟官方帳號聊天室並預填訊息，
// 使用者按傳送，LINE webhook 收到後（LINE 保證寄件者身分）把這張交接單標記完成，App 自動登入。
// 沒有加官方帳號好友的人，改走外部瀏覽器驗證 + 6 位數確認碼。
// 這個檔案不引用 '@/…'，方便 node --test 直接載入測試。
import crypto from 'node:crypto';

export const HANDOFF_TTL_MS = 10 * 60 * 1000;
export const HANDOFF_MAX_ATTEMPTS = 5;
export const HANDOFF_MAX_PENDING = 2000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const isToken = value => typeof value === 'string' && TOKEN_PATTERN.test(value);
export const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');
export const newConfirmCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
export const normalizeConfirmCode = value => String(value ?? '').replace(/\s+/g, '');
export const isConfirmCode = value => /^\d{6}$/.test(normalizeConfirmCode(value));
// 確認碼綁定 state：同一組數字在不同交接單上的雜湊不同。
export const hashConfirmCode = (state, code) => crypto.createHash('sha256').update(`${state}:${normalizeConfirmCode(code)}`).digest('hex');

// 聊天室驗證碼：10 碼，去掉容易看錯的字（0/O、1/I/L），約 8×10^14 種。
// 不能用 6 位數：別人可能用自己的 LINE 帳號亂傳驗證碼，去撞別人正在等待的交接單（登入到攻擊者的帳號）。
const CHAT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newChatCode = () => Array.from({ length: 10 }, () => CHAT_CODE_ALPHABET[crypto.randomInt(CHAT_CODE_ALPHABET.length)]).join('');
export const hashChatCode = code => crypto.createHash('sha256').update(`chat:${String(code).toUpperCase()}`).digest('hex');
const LOGIN_MESSAGE_PATTERN = /^(?:登入驗證碼|login code)\s*[:：]?\s*([ABCDEFGHJKMNPQRSTUVWXYZ2-9]{10})$/i;
// 從 LINE 訊息文字取出驗證碼；不是登入訊息就回傳 null（其他訊息照原本的機器人流程處理）。
export function extractLoginCode(text) {
  const match = LOGIN_MESSAGE_PATTERN.exec(String(text ?? '').trim());
  return match ? match[1].toUpperCase() : null;
}
export const loginMessageText = (lang, code) => (lang === 'zh' ? `登入驗證碼 ${code}` : `Login code ${code}`);

// LINE 官方帳號聊天室連結：開啟聊天室並預填訊息（basicId 含開頭的 @）。
export function officialAccountMessageUrl(basicId, text) {
  if (!/^@[\w.-]+$/.test(String(basicId || ''))) return null;
  return `https://line.me/R/oaMessage/${basicId}/?${encodeURIComponent(text)}`;
}

// 機器人收到登入驗證碼後回覆的文字（中／英／菲律賓語並列）。
export const LOGIN_CODE_REPLY = {
  ok: '✅ 驗證完成，「克雷迅」App 會自動登入。\n不是你本人要登入的話，請不要理會，也不要把驗證碼告訴任何人。\n\n✅ Verified. The Kolecion app will sign you in automatically. If this was not you, ignore this message and never share the code.\n\n✅ Na-verify na. Awtomatikong mag-sa-sign in ang Kolecion app. Kung hindi ikaw ito, huwag pansinin at huwag ibigay ang code kaninuman.',
  invalid: '驗證碼無效或已過期，請回到「克雷迅」App 重新按 LINE 登入。\n\nThe code is invalid or has expired. Return to the Kolecion app and tap LINE sign-in again.\n\nHindi valid o nag-expire na ang code. Bumalik sa Kolecion app at pindutin muli ang LINE sign-in.',
};

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function handoffRedirectUri(env, requestUrl) {
  const base = env.APP_ORIGIN || env.NEXTAUTH_URL || env.AUTH_URL || requestUrl;
  return `${new URL(base).origin}/api/hr/line-handoff/callback`;
}

export function buildLineAuthorizeUrl({ channelId, redirectUri, state, nonce }) {
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile',
    nonce,
  }).toString();
  return url.toString();
}

const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const PAGE_COPY = {
  success: {
    title: ['LINE 驗證完成', 'LINE verification complete', 'Tapos na ang pag-verify sa LINE'],
    body: ['請回到「克雷迅」App，輸入下方 6 位數確認碼。', 'Return to the Kolecion app and enter the 6-digit code below.', 'Bumalik sa Kolecion app at ilagay ang 6-digit na code sa ibaba.'],
    hint: ['確認碼 10 分鐘內有效。不是你本人操作的話，請不要把確認碼告訴任何人。', 'The code is valid for 10 minutes. If this was not you, do not share the code with anyone.', 'Valid ang code sa loob ng 10 minuto. Kung hindi ikaw ito, huwag ibigay ang code kaninuman.'],
  },
  failure: {
    title: ['LINE 登入沒有完成', 'LINE sign-in was not completed', 'Hindi natapos ang pag-sign in sa LINE'],
    body: ['登入連結已過期或驗證失敗。請回到「克雷迅」App，重新按一次 LINE 登入。', 'The sign-in link has expired or verification failed. Return to the Kolecion app and tap LINE sign-in again.', 'Nag-expire ang link o nabigo ang pag-verify. Bumalik sa Kolecion app at pindutin muli ang LINE sign-in.'],
    hint: ['', '', ''],
  },
};

// 外部瀏覽器看到的結果頁（中／英／菲律賓語並列，因為這個瀏覽器讀不到 App 裡選的語言）。
export function renderHandoffPage({ ok, code = '' }) {
  const copy = PAGE_COPY[ok ? 'success' : 'failure'];
  const block = index => `<section lang="${['zh-Hant', 'en', 'fil'][index]}"><h1>${escapeHtml(copy.title[index])}</h1><p>${escapeHtml(copy.body[index])}</p>${copy.hint[index] ? `<p class="hint">${escapeHtml(copy.hint[index])}</p>` : ''}</section>`;
  const codeBlock = ok ? `<div class="code" aria-label="code">${escapeHtml(code)}</div>` : '';
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Kolecion</title><style>body{margin:0;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f1f5f9;color:#0f172a}main{max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 24px rgba(15,23,42,.08)}h1{font-size:1.2rem;margin:0 0 8px}p{line-height:1.6;margin:0 0 8px}section+section{border-top:1px solid #e2e8f0;margin-top:16px;padding-top:16px}.code{font-size:2.4rem;font-weight:800;letter-spacing:.3em;text-align:center;margin:16px 0;color:#2563eb;font-variant-numeric:tabular-nums}.hint{font-size:.85rem;color:#64748b}</style></head><body><main>${codeBlock}${block(0)}${block(1)}${block(2)}</main></body></html>`;
}
