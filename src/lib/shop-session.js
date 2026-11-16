// 商店示範帳號（users 表）的登入憑證。
//
// 這些帳號不走 NextAuth，以前登入後只有瀏覽器的 localStorage 記得是誰，
// 伺服器分不出誰在呼叫 API，所以訂單／購物車／願望清單只能對任何人開放。
// 現在登入或註冊成功時多發一個簽章過的 HttpOnly cookie，API 用它確認「本人」。
// 純函式、不依賴資料庫，方便測試。

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SHOP_SESSION_COOKIE = 'shop-session';
export const SHOP_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

const secretFromEnv = () => process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
const encode = value => Buffer.from(value).toString('base64url');
const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

// 沒設定密鑰時不發憑證（寧可無法登入 API，也不發可被偽造的憑證）。
export function createShopSessionToken(email, { now = Date.now(), secret = secretFromEnv() } = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!secret || !normalized) return null;
  const payload = encode(JSON.stringify({ e: normalized, x: Math.floor(now / 1000) + SHOP_SESSION_MAX_AGE }));
  return `${payload}.${sign(payload, secret)}`;
}

// 回傳 email（小寫）；憑證不存在、被改過、過期、或伺服器沒有密鑰時回傳 null。
export function verifyShopSessionToken(token, { now = Date.now(), secret = secretFromEnv() } = {}) {
  if (!secret || typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof e !== 'string' || !e || !Number.isFinite(x) || x * 1000 <= now) return null;
    return e;
  } catch {
    return null;
  }
}

export function shopSessionCookie(token, { secure = false } = {}) {
  return { name: SHOP_SESSION_COOKIE, value: token, httpOnly: true, sameSite: 'lax', path: '/', maxAge: SHOP_SESSION_MAX_AGE, secure };
}

export function clearedShopSessionCookie({ secure = false } = {}) {
  return { ...shopSessionCookie('', { secure }), maxAge: 0 };
}

export function isHttpsRequest(request) {
  return request.headers.get('x-forwarded-proto') === 'https'
    || request.nextUrl?.protocol === 'https:'
    || String(process.env.NEXTAUTH_URL || '').startsWith('https://');
}
