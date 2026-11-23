// 登入失敗次數限制（依 email）。在記憶體內計算，伺服器重啟就歸零；
// nginx 另外有依 IP 的限速，兩者搭配：一個擋單一來源大量嘗試，一個擋換 IP 輪流猜同一個帳號。
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 10000;

const failures = new Map();

const normalize = key => String(key || '').trim().toLowerCase();

function recent(key, now) {
  const list = (failures.get(key) || []).filter(time => now - time < WINDOW_MS);
  if (list.length) failures.set(key, list); else failures.delete(key);
  return list;
}

export function isLoginLocked(key, now = Date.now()) {
  const id = normalize(key);
  return Boolean(id) && recent(id, now).length >= MAX_FAILURES;
}

export function recordLoginFailure(key, now = Date.now()) {
  const id = normalize(key);
  if (!id) return;
  const list = recent(id, now);
  list.push(now);
  failures.set(id, list);
  if (failures.size > MAX_KEYS) failures.delete(failures.keys().next().value);
}

export function clearLoginFailures(key) {
  failures.delete(normalize(key));
}

export const LOGIN_LOCK_MINUTES = WINDOW_MS / 60000;
export function resetLoginRateLimitForTests() {
  failures.clear();
}
