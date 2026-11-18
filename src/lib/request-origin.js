<<<<<<< HEAD
// 同源檢查（CSRF 防護）：所有會改資料的 API 路由共用這一支，Origin 規則只在這裡維護。
// 允許的來源：請求網址本身、APP_ORIGIN／NEXTAUTH_URL，以及反向代理轉送的 Host（含 x-forwarded-proto）。
// 沒有 Origin 標頭一律拒絕。
=======
// CSRF guard for state-changing HR API routes: the request's Origin header must match this site.
// Allowed origins are only: the origin of request.url, APP_ORIGIN and NEXTAUTH_URL.
// Forwarding headers (X-Forwarded-Host / X-Forwarded-Proto / Host) are client-controlled when the
// app port is reachable without nginx, so they are never added to the allow list.
// Behind a TLS-terminating proxy request.url is http://, so set APP_ORIGIN / NEXTAUTH_URL to the public https origin.
>>>>>>> fix/security-perf-review
export function requestIsSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
<<<<<<< HEAD
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) {
      if (value) allowed.add(new URL(value).origin);
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1);
    if (host) allowed.add(`${protocol.split(',')[0].trim()}://${host}`);
=======
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) { if (value) allowed.add(new URL(value).origin); }
>>>>>>> fix/security-perf-review
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}
