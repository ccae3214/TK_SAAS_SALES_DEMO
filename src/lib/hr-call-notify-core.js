// 來電通知（核心邏輯，不碰資料庫與網路）：有人撥號時，通知「不在線上」的被叫者。
// 通知管道：1) 網頁推播（Web Push，加到桌面後鎖屏也收得到）；2) LINE 推播（沒開網頁推播、或推播失敗時的備援）。
// 這個檔案不 import '@/…'，所以 node:test 可以直接測試；資料庫與實際送出在 hr-call-notify-store.js。

import { chatRoomLineUrl, chatRoomPath } from './hr-chat-link.js';
import { translateChatSystemMessage } from './hr-translations-chat.js';

export const RING_WINDOW_SECONDS = 45; // 與信令伺服器的響鈴時間一致；推播過了這段時間就沒有意義，所以 TTL 也用這個值
export const MAX_NOTIFY_KEYS = 300;

// 只接受主流瀏覽器的推播服務網址。訂閱網址是使用者提供、由伺服器去連線的，不限制的話會變成讓伺服器連任意網址。
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
const PUSH_SUFFIXES = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];

export function isAllowedPushEndpoint(endpoint) {
  let url;
  try { url = new URL(String(endpoint)); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_SUFFIXES.some(suffix => host.endsWith(suffix));
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

// 瀏覽器的 PushSubscription.toJSON() → { endpoint, p256dh, auth }；格式不對回傳 null。
export function normalizeSubscription(input) {
  const endpoint = typeof input?.endpoint === 'string' ? input.endpoint.trim() : '';
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (!endpoint || endpoint.length > 1000 || !isAllowedPushEndpoint(endpoint)) return null;
  if (typeof p256dh !== 'string' || p256dh.length < 40 || p256dh.length > 200 || !BASE64URL.test(p256dh)) return null;
  if (typeof auth !== 'string' || auth.length < 8 || auth.length > 100 || !BASE64URL.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export function normalizeLanguage(value, fallback = 'zh') {
  return ['zh', 'en', 'tl'].includes(value) ? value : fallback;
}

// 網頁推播的 VAPID 聯絡資訊：必須是 mailto: 或 https 網址。
export function vapidSubject(env = {}) {
  const explicit = String(env.HR_PUSH_SUBJECT || '').trim();
  if (/^(mailto:|https:\/\/)/i.test(explicit)) return explicit;
  for (const value of [env.APP_ORIGIN, env.NEXTAUTH_URL]) {
    try { const url = new URL(value); if (url.protocol === 'https:' && !/localhost|127\.0\.0\.1/i.test(url.hostname)) return url.origin; } catch { /* 沒設定或格式不對 */ }
  }
  return 'https://kolecion.cc';
}

export function publicOrigin(env = {}) {
  for (const value of [env.APP_ORIGIN, env.NEXTAUTH_URL]) {
    try { const url = new URL(value); if (!/localhost|127\.0\.0\.1/i.test(url.hostname)) return url.origin; } catch { /* 沒設定或格式不對 */ }
  }
  return 'https://kolecion.cc';
}

// HR_CALL_LINE_NOTIFY：fallback（預設，網頁推播沒送到才用 LINE，省 LINE 的每月推播額度）／always（兩種都送）／off（不用 LINE）
export function lineModeFrom(env = {}) {
  const value = String(env.HR_CALL_LINE_NOTIFY || 'fallback').trim().toLowerCase();
  return ['always', 'off'].includes(value) ? value : 'fallback';
}

// 系統管理員（用 ADMIN_EMAILS／HR_ADMIN_EMAILS／HR_ADMIN_LINE_USER_IDS 設定、不在會員表裡的）在通話裡的 key 是
// admin:<email> 或 admin:<LINE userId>（見 /api/hr/call 的 getReaderKey）。這裡把它拆成要用 email 查 LINE 綁定、
// 或直接用 LINE userId 推播的兩組。LINE userId 只接受 HR_ADMIN_LINE_USER_IDS 裡有的，避免推播到不認識的帳號。
export function adminLineLookups(keys = [], env = {}) {
  const allowedLineIds = new Set(String(env.HR_ADMIN_LINE_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean));
  const byEmail = new Map();
  const byLineId = new Map();
  for (const key of keys) {
    const value = /^admin:(.+)$/.exec(String(key || ''))?.[1]?.trim();
    if (!value || value === 'unknown') continue;
    if (value.includes('@')) byEmail.set(key, value.toLowerCase());
    else if (allowedLineIds.has(value)) byLineId.set(key, value);
  }
  return { byEmail, byLineId };
}

const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

const COPY = {
  zh: {
    title: from => (from ? `📞 ${from} 來電` : '📞 有人來電'),
    kind: video => (video ? '視訊通話' : '語音通話'),
    body: (kind, room) => `${kind}${room ? ` · ${room}` : ''}，點開接聽`,
    line: (title, kind, room, url) => `${title}\n${kind}${room ? ` · ${room}` : ''}\n請開啟網站接聽（響鈴約 ${RING_WINDOW_SECONDS} 秒，逾時請回撥）：\n${url}`,
    test: { title: '🔔 來電通知測試', body: '看到這則通知，代表來電時也會這樣通知你。' },
  },
  en: {
    title: from => (from ? `📞 Incoming call from ${from}` : '📞 Incoming call'),
    kind: video => (video ? 'Video call' : 'Voice call'),
    body: (kind, room) => `${kind}${room ? ` · ${room}` : ''}. Tap to answer.`,
    line: (title, kind, room, url) => `${title}\n${kind}${room ? ` · ${room}` : ''}\nOpen the site to answer (it rings for about ${RING_WINDOW_SECONDS} seconds; call back if you miss it):\n${url}`,
    test: { title: '🔔 Call notification test', body: 'If you can see this, you will be notified like this when a call comes in.' },
  },
  tl: {
    title: from => (from ? `📞 May tawag mula kay ${from}` : '📞 May tumatawag'),
    kind: video => (video ? 'Video call' : 'Voice call'),
    body: (kind, room) => `${kind}${room ? ` · ${room}` : ''}. I-tap para sagutin.`,
    line: (title, kind, room, url) => `${title}\n${kind}${room ? ` · ${room}` : ''}\nBuksan ang site para sumagot (mga ${RING_WINDOW_SECONDS} segundo ang ring; tawagan pabalik kung hindi nasagot):\n${url}`,
    test: { title: '🔔 Pagsubok ng notification ng tawag', body: 'Kung nakikita mo ito, ganito ka rin aabisuhan kapag may tumawag.' },
  },
};

// 一則來電通知的文字。from 是撥號的人；title 是聊天室名稱（私訊時與 from 相同，不重複顯示）。
export function buildCallNotice({ lang = 'zh', from = '', title = '', video = false, roomId = 0, callId = '', origin = 'https://kolecion.cc' } = {}) {
  const copy = COPY[normalizeLanguage(lang)];
  const caller = clean(from, 60);
  const room = clean(title, 80) === caller ? '' : clean(title, 80);
  const kind = copy.kind(!!video);
  const heading = copy.title(caller);
  // LINE 連結直接開到該聊天室，並加上 openExternalBrowser=1（不用 LINE 內建瀏覽器，Android 已安裝 App 時會直接打開 App）
  const url = chatRoomLineUrl(origin, roomId);
  return {
    push: { title: heading, body: copy.body(kind, room), tag: `hr-call-${Number(roomId) || 0}`, url: chatRoomPath(roomId), roomId: Number(roomId) || 0, callId: String(callId || ''), ts: Date.now() },
    line: copy.line(heading, kind, room, url),
  };
}

// 聊天室新訊息通知的文字。與來電通知共用推播與 LINE 管道，但不會一直響、也不要求一定要點掉。
export const CHAT_NOTICE_TTL_SECONDS = 3600; // 訊息不像來電，晚一點收到仍然有用；超過一小時就不再補送
const CHAT_PREVIEW_LENGTH = 90;
const CHAT_COPY = {
  zh: {
    title: from => (from ? `💬 ${from} 傳來新訊息` : '💬 聊天室有新訊息'),
    body: (room, preview) => `${room ? `${room}：` : ''}${preview}`,
    line: (title, room, preview, url) => `${title}\n${room ? `${room}\n` : ''}${preview}\n開啟網站查看並回覆：\n${url}`,
  },
  en: {
    title: from => (from ? `💬 New message from ${from}` : '💬 New chat message'),
    body: (room, preview) => `${room ? `${room}: ` : ''}${preview}`,
    line: (title, room, preview, url) => `${title}\n${room ? `${room}\n` : ''}${preview}\nOpen the site to read and reply:\n${url}`,
  },
  tl: {
    title: from => (from ? `💬 Bagong mensahe mula kay ${from}` : '💬 Bagong mensahe sa chat'),
    body: (room, preview) => `${room ? `${room}: ` : ''}${preview}`,
    line: (title, room, preview, url) => `${title}\n${room ? `${room}\n` : ''}${preview}\nBuksan ang site para basahin at sumagot:\n${url}`,
  },
};

// 一則聊天訊息通知。from 是傳訊息的人；title 是聊天室名稱（私訊時與 from 相同，不重複顯示）；body 是訊息內容（只取前面一段）。
// 系統訊息（指派、挑選工作者）由伺服器用中文存入，英文／菲律賓語的收件人看到的預覽也會翻譯。
export function buildChatNotice({ lang = 'zh', from = '', title = '', body = '', roomId = 0, origin = 'https://kolecion.cc' } = {}) {
  const language = normalizeLanguage(lang);
  const copy = CHAT_COPY[language];
  const sender = clean(from, 60);
  const room = clean(title, 80) === sender ? '' : clean(title, 80);
  const preview = clean(translateChatSystemMessage(String(body || ''), language), CHAT_PREVIEW_LENGTH);
  const heading = copy.title(sender);
  const url = chatRoomLineUrl(origin, roomId);
  return {
    push: { kind: 'chat', title: heading, body: copy.body(room, preview), tag: `hr-chat-${Number(roomId) || 0}`, url: chatRoomPath(roomId), roomId: Number(roomId) || 0, callId: '', ts: Date.now() },
    line: copy.line(heading, room, preview, url),
  };
}

export function buildTestNotice(lang = 'zh') {
  const copy = COPY[normalizeLanguage(lang)];
  return { title: copy.test.title, body: copy.test.body, tag: 'hr-call-test', url: '/hr', roomId: 0, callId: '', ts: Date.now() };
}

// 每個收件人在一段時間內最多收到幾則來電通知（避免有人反覆撥號洗版）。
export function createRateLimiter({ windowMs = 60000, max = 3, now = () => Date.now(), maxEntries = 5000 } = {}) {
  const hits = new Map();
  return {
    allow(id) {
      const time = now();
      const recent = (hits.get(id) || []).filter(stamp => time - stamp < windowMs);
      if (recent.length >= max) { hits.set(id, recent); return false; }
      recent.push(time);
      hits.set(id, recent);
      if (hits.size > maxEntries) for (const [key, stamps] of hits) if (!stamps.some(stamp => time - stamp < windowMs)) hits.delete(key);
      return true;
    },
  };
}

async function mapLimit(items, limit, run) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) { const item = items[index]; index += 1; await run(item); }
  });
  await Promise.all(workers);
}

// 送出通知。deps 由 store 提供（測試用假的）：
//   subscriptionsFor(keys) → Map(key → [{endpoint,p256dh,auth,lang}])
//   lineTargetsFor(keys)   → Map(key → {lineUserId, language})
//   sendPush(subscription, payloadString, options)  失敗時丟出帶 statusCode 的錯誤（404／410 代表訂閱已失效）
//   pushLine(lineUserId, text)
//   removeSubscription(endpoint)
// build：產生通知文字的函式（預設是來電通知；聊天訊息用 buildChatNotice）。pushOptions：Web Push 的 TTL 與優先順序。
// deps.lineAllowed(key, call)（可省略）：回傳 false 時這個人這次不送 LINE（用來避免聊天訊息洗掉 LINE 的每月額度）。
export async function dispatchCallNotifications({ keys, call, deps, lineMode = 'fallback', origin, pushEnabled = true, build = buildCallNotice, pushOptions = { TTL: RING_WINDOW_SECONDS, urgency: 'high' } }) {
  const result = { push: 0, line: 0, failed: 0, removed: 0, recipients: 0 };
  const unique = [...new Set((keys || []).filter(key => typeof key === 'string' && key))].slice(0, MAX_NOTIFY_KEYS);
  if (!unique.length) return result;
  const subscriptions = pushEnabled ? await deps.subscriptionsFor(unique) : new Map();
  const lineTargets = lineMode === 'off' ? new Map() : await deps.lineTargetsFor(unique);
  await mapLimit(unique, 8, async key => {
    const subs = subscriptions.get(key) || [];
    const line = lineTargets.get(key);
    if (!subs.length && !line) return;
    result.recipients += 1;
    let pushed = 0;
    for (const sub of subs) {
      const notice = build({ ...call, lang: normalizeLanguage(sub.lang), origin });
      try {
        await deps.sendPush(sub, JSON.stringify(notice.push), pushOptions);
        pushed += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          result.removed += 1;
          try { await deps.removeSubscription(sub.endpoint); } catch { /* 下次再清 */ }
        } else result.failed += 1;
      }
    }
    result.push += pushed;
    if (line && (lineMode === 'always' || pushed === 0) && (!deps.lineAllowed || deps.lineAllowed(key, call))) {
      try {
        await deps.pushLine(line.lineUserId, build({ ...call, lang: normalizeLanguage(line.language), origin }).line);
        result.line += 1;
      } catch { result.failed += 1; }
    }
  });
  return result;
}

// 聊天室新訊息：通知聊天室裡其他人（網頁推播，沒開網頁通知的人視設定改收 LINE）。call 的欄位見 buildChatNotice。
export function dispatchChatNotifications(options) {
  return dispatchCallNotifications({ ...options, build: buildChatNotice, pushOptions: { TTL: CHAT_NOTICE_TTL_SECONDS, urgency: 'normal' } });
}
