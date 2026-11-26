// LINE 官方帳號的 Basic ID（例如 @123abcde），用來組「開啟聊天室並預填訊息」的連結。
// 優先用環境變數 LINE_OFFICIAL_ACCOUNT_ID；沒設定就向 LINE 查（需要 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN），結果快取 1 小時。
const cache = (globalThis.__lineOfficialBasicId ||= { value: null, until: 0 });
const BASIC_ID = /^@[\w.-]+$/;

export async function getOfficialBasicId(env = process.env, fetchImpl = fetch) {
  const configured = String(env.LINE_OFFICIAL_ACCOUNT_ID || '').trim();
  if (BASIC_ID.test(configured)) return configured;
  const token = env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  if (cache.until > Date.now()) return cache.value;
  let value = null;
  try {
    const response = await fetchImpl('https://api.line.me/v2/bot/info', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const info = await response.json();
      if (BASIC_ID.test(String(info?.basicId || ''))) value = info.basicId;
    }
  } catch { /* 查不到就不提供聊天室登入，改用瀏覽器驗證 */ }
  cache.value = value;
  cache.until = Date.now() + (value ? 60 * 60 * 1000 : 60 * 1000);
  return value;
}
