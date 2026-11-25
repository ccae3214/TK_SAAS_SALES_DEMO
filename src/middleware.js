import { NextResponse } from "next/server";

export function middleware(request) {
  const nonce = btoa(crypto.randomUUID());
  // 通話的 WebSocket（/api/hr/call/ws）。多數瀏覽器的 'self' 已包含同源 ws/wss，這裡明確寫出來相容較舊的 Safari。
  const host = request.headers.get("host") || "";
  const callSocket = /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? ` wss://${host} ws://${host}` : "";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src 'self'${callSocket}`,
    "font-src 'self' data:",
    "worker-src 'self'", // 來電通知的 Service Worker（/hr-push-sw.js）。script-src 有 strict-dynamic 時 'self' 會被忽略，要在這裡明確允許。
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
