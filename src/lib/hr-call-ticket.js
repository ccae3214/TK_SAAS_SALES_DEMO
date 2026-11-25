import crypto from 'node:crypto';

// 通話用的短效簽章票證（HMAC-SHA256）。
// /api/hr/call 在確認登入與聊天室權限後簽發；server.js 的 WebSocket 信令伺服器只負責驗證簽章，
// 所以信令伺服器不需要連資料庫，也不需要解 NextAuth 的 session。

export function callSecret(env = process.env) {
  return env.HR_CALL_SECRET || env.NEXTAUTH_SECRET || env.AUTH_SECRET || '';
}

export function signTicket(payload, secret, ttlSeconds = 60, now = Date.now()) {
  if (!secret) throw new Error('call secret is missing');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSeconds })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyTicket(ticket, secret, now = Date.now()) {
  if (!secret || typeof ticket !== 'string' || ticket.length > 8192) return null;
  const parts = ticket.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest();
  const given = Buffer.from(parts[1], 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || typeof payload !== 'object' || typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
  return payload;
}

// 給瀏覽器的 ICE 設定：預設只有 STUN；設定 TURN 網址與密鑰後會多一組限時的 TURN 帳密
// （coturn 的 use-auth-secret 格式：使用者名稱是「到期時間:識別碼」，密碼是 HMAC-SHA1(secret, 使用者名稱) 的 base64）。
export function buildIceServers(env, identity, now = Date.now()) {
  const stunUrls = (env.HR_CALL_STUN_URLS ?? 'stun:stun.l.google.com:19302').split(',').map(item => item.trim()).filter(Boolean);
  const servers = stunUrls.length ? [{ urls: stunUrls }] : [];
  const turnUrls = (env.HR_CALL_TURN_URLS || '').split(',').map(item => item.trim()).filter(Boolean);
  const turnSecret = env.HR_CALL_TURN_SECRET || '';
  if (turnUrls.length && turnSecret) {
    const anonymous = crypto.createHash('sha256').update(String(identity)).digest('hex').slice(0, 12);
    const username = `${Math.floor(now / 1000) + 6 * 3600}:${anonymous}`;
    const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
    servers.push({ urls: turnUrls, username, credential });
  }
  return servers;
}
