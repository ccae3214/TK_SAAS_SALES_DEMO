// 同源檢查（CSRF 防護）：所有會改資料的 API 路由共用這一支，Origin 規則只在這裡維護。
// 允許的來源：請求網址本身、APP_ORIGIN／NEXTAUTH_URL，以及反向代理轉送的 Host（含 x-forwarded-proto）。
// 沒有 Origin 標頭一律拒絕。
export function requestIsSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) {
      if (value) allowed.add(new URL(value).origin);
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1);
    if (host) allowed.add(`${protocol.split(',')[0].trim()}://${host}`);
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}
