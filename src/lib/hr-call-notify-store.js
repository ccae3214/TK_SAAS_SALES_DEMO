import pool, { query } from '@/lib/db';
import { migrateOnce } from './migrate-once.js';
import {
  RING_WINDOW_SECONDS, adminLineLookups, createRateLimiter, dispatchCallNotifications, lineModeFrom, normalizeLanguage, publicOrigin, vapidSubject,
} from './hr-call-notify-core.js';
import { normalizeVapidPrivateKey, normalizeVapidPublicKey } from './vapid-key.js';

// 來電通知（資料庫與實際送出的部分）。誰會被通知、文字怎麼寫在 hr-call-notify-core.js。
// 信令伺服器（server.js）在有人撥號時呼叫 globalThis.__hrCallNotifyHook（由 registerCallNotifyHook 在伺服器啟動時登記），
// 通知失敗只會記 log，不會影響通話本身。

export function ensurePushSchema() {
  return migrateOnce('push-subscriptions', async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      member_key TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'zh',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_push_subscriptions_key ON hr_push_subscriptions(member_key)');
  });
}

export function pushConfigured(env = process.env) {
  return !!(env.HR_PUSH_VAPID_PUBLIC_KEY && env.HR_PUSH_VAPID_PRIVATE_KEY);
}

const MAX_SUBSCRIPTIONS_PER_KEY = 5; // 同一個人最多登記 5 台裝置，超過時保留最近使用的

export async function saveSubscription(memberKey, subscription, { lang = 'zh', userAgent = '' } = {}) {
  await ensurePushSchema();
  // 同一個瀏覽器換人登入時，訂閱會改記到新的使用者名下（舊使用者不會再收到這台裝置的通知）
  await query(`INSERT INTO hr_push_subscriptions(member_key,endpoint,p256dh,auth,lang,user_agent) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT (endpoint) DO UPDATE SET member_key=EXCLUDED.member_key,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,
      lang=EXCLUDED.lang,user_agent=EXCLUDED.user_agent,last_seen_at=NOW()`,
  [memberKey, subscription.endpoint, subscription.p256dh, subscription.auth, normalizeLanguage(lang), String(userAgent).slice(0, 300)]);
  await query(`DELETE FROM hr_push_subscriptions WHERE member_key=$1 AND id NOT IN (
    SELECT id FROM hr_push_subscriptions WHERE member_key=$1 ORDER BY last_seen_at DESC, id DESC LIMIT ${MAX_SUBSCRIPTIONS_PER_KEY})`, [memberKey]);
}

export async function deleteSubscription(memberKey, endpoint) {
  await ensurePushSchema();
  await query('DELETE FROM hr_push_subscriptions WHERE endpoint=$1 AND member_key=$2', [String(endpoint || ''), memberKey]);
}

export async function removeSubscription(endpoint) {
  await query('DELETE FROM hr_push_subscriptions WHERE endpoint=$1', [String(endpoint || '')]);
}

export async function subscriptionsFor(keys) {
  await ensurePushSchema();
  const rows = await query('SELECT member_key, endpoint, p256dh, auth, lang FROM hr_push_subscriptions WHERE member_key = ANY($1::text[])', [keys]);
  const map = new Map();
  for (const row of rows) map.set(row.member_key, [...(map.get(row.member_key) || []), row]);
  return map;
}

// 有綁定 LINE 的人：
//   member:<id>   → 會員表的 line_user_id（含會員表裡的系統管理員）
//   admin:<LINE>  → 用 LINE 登入、設定在 HR_ADMIN_LINE_USER_IDS 的系統管理員，直接推播到該 LINE
//   admin:<email> → 用 email 登入的系統管理員，用 email 找會員表裡綁定的 LINE（沒綁定就收不到 LINE 通知）
// 語言用 LINE 個人設定，沒有就工人用英文、其他用中文。
export async function lineTargetsFor(keys, env = process.env) {
  const targets = new Map(); // key → { lineUserId, role }
  const ids = keys.map(key => /^member:(\d+)$/.exec(key)?.[1]).filter(Boolean);
  if (ids.length) {
    const members = await query(`SELECT id, line_user_id, role FROM hr_members
      WHERE active=TRUE AND id = ANY($1::bigint[]) AND COALESCE(line_user_id,'')<>''`, [ids]);
    for (const row of members) targets.set(`member:${row.id}`, { lineUserId: row.line_user_id, role: row.role });
  }
  const admins = adminLineLookups(keys, env);
  for (const [key, lineUserId] of admins.byLineId) targets.set(key, { lineUserId, role: 'admin' });
  if (admins.byEmail.size) {
    const rows = await query(`SELECT DISTINCT ON (lower(email)) lower(email) AS email, line_user_id FROM hr_members
      WHERE active=TRUE AND lower(email) = ANY($1::text[]) AND COALESCE(line_user_id,'')<>''
      ORDER BY lower(email), id`, [[...new Set(admins.byEmail.values())]]);
    const lineByEmail = new Map(rows.map(row => [row.email, row.line_user_id]));
    for (const [key, email] of admins.byEmail) {
      if (lineByEmail.has(email)) targets.set(key, { lineUserId: lineByEmail.get(email), role: 'admin' });
    }
  }
  if (!targets.size) return new Map();
  let languages = new Map();
  try {
    const settings = await query('SELECT line_user_id, preferred_language FROM hr_line_member_settings WHERE line_user_id = ANY($1::text[])', [[...new Set([...targets.values()].map(row => row.lineUserId))]]);
    languages = new Map(settings.map(row => [row.line_user_id, row.preferred_language]));
  } catch { /* 還沒有語言設定表就用預設語言 */ }
  return new Map([...targets].map(([key, row]) => [key, {
    lineUserId: row.lineUserId,
    language: normalizeLanguage(languages.get(row.lineUserId), row.role === 'worker' ? 'en' : 'zh'),
  }]));
}

let webPush = null;
export async function sendWebPush(subscription, payload, options = {}, env = process.env) {
  if (!pushConfigured(env)) throw new Error('web_push_not_configured');
  if (!webPush) { const mod = await import('web-push'); webPush = mod.default || mod; }
  return webPush.sendNotification(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    payload,
    { ...options, timeout: 8000, vapidDetails: { subject: vapidSubject(env), publicKey: normalizeVapidPublicKey(env.HR_PUSH_VAPID_PUBLIC_KEY) || env.HR_PUSH_VAPID_PUBLIC_KEY, privateKey: normalizeVapidPrivateKey(env.HR_PUSH_VAPID_PRIVATE_KEY) || env.HR_PUSH_VAPID_PRIVATE_KEY } },
  );
}

async function pushLine(lineUserId, text) {
  const { pushLineMessage } = await import('@/lib/hr-line-bot');
  return pushLineMessage(lineUserId, text);
}

const limiter = createRateLimiter({ windowMs: 60000, max: 3 });

// call：{ roomId, callId, title, video, from, keys }（keys 是要通知的人）。
export async function notifyCall(call, env = process.env) {
  const pushEnabled = pushConfigured(env);
  const lineMode = env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ? lineModeFrom(env) : 'off';
  if (!pushEnabled && lineMode === 'off') return null;
  const keys = (call.keys || []).filter(key => limiter.allow(key));
  return dispatchCallNotifications({
    keys, call, lineMode, pushEnabled, origin: publicOrigin(env),
    deps: { subscriptionsFor, lineTargetsFor: targetKeys => lineTargetsFor(targetKeys, env), sendPush: (sub, payload, options) => sendWebPush(sub, payload, options, env), pushLine, removeSubscription },
  });
}

// 伺服器啟動時登記（instrumentation-node.js）。信令伺服器每次有人撥號就呼叫它，不等結果。
export function registerCallNotifyHook() {
  if (globalThis.__hrCallNotifyHook) return;
  globalThis.__hrCallNotifyHook = call => {
    notifyCall(call).catch(error => console.error('hr_call_notify_failed', error?.name || 'Error', error?.message || ''));
  };
}

export { RING_WINDOW_SECONDS };
