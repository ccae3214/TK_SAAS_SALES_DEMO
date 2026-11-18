// CSRF guard for state-changing HR API routes: the request's Origin header must match this site.
// Allowed origins are only: the origin of request.url, APP_ORIGIN and NEXTAUTH_URL.
// Forwarding headers (X-Forwarded-Host / X-Forwarded-Proto / Host) are client-controlled when the
// app port is reachable without nginx, so they are never added to the allow list.
// Behind a TLS-terminating proxy request.url is http://, so set APP_ORIGIN / NEXTAUTH_URL to the public https origin.
export function requestIsSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) { if (value) allowed.add(new URL(value).origin); }
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}
