// 防止「換帳號後，滑回上一頁看到上一個帳號的頁面」。
//
// 手機瀏覽器（尤其是 iPhone 的 Safari 與已安裝的 PWA）有「往返快取」（bfcache）：左右滑回上一頁時，
// 不會重新向伺服器要資料，而是直接把凍結的舊頁面拿出來。所以 A 帳號登出、B 帳號登入後，滑回去就會看到 A 的頁面。
// 網頁沒有辦法關閉瀏覽器的滑動返回手勢，能做的是：頁面復原或切回前景時，向伺服器確認目前登入的是不是同一個帳號，
// 不是的話就先把畫面藏起來、再整頁重新載入（載入後由伺服器依目前的登入狀態決定顯示哪個帳號的頁面，或導回登入頁）。
//
// 這個檔案只有純邏輯（不碰瀏覽器 API），node:test 可以直接測試；接上瀏覽器事件的是 HrSessionGuard.jsx。

// 把 /api/auth/session 的回應變成「這是誰」的字串。沒登入＝空字串。
export function identityOf(session) {
  const user = session && typeof session === 'object' ? session.user : null;
  if (!user || typeof user !== 'object') return '';
  const parts = [user.id, user.lineUserId, user.email, user.name].map(value => String(value ?? '').trim().toLowerCase());
  return parts.some(Boolean) ? parts.join('|') : 'signed-in';
}

// readSession：回傳 /api/auth/session 的內容（失敗要丟錯）。reload：整頁重新載入。
// setHidden(true/false)：頁面從快取復原的瞬間先藏起來，避免閃過上一個帳號的內容。
export function createSessionGuard({ readSession, reload, setHidden = () => {}, now = () => Date.now(), minGapMs = 1500 }) {
  let baseline = null; // null＝還不知道；''＝一開始就沒登入；其他＝一開始登入的帳號
  let lastCheck = -Infinity;
  let running = false;

  const read = async () => identityOf(await readSession());

  return {
    // 頁面載入時記下「現在是誰」。讀不到（例如沒網路）就維持未知，之後第一次成功檢查時再補上。
    async start() {
      try { baseline = await read(); } catch { baseline = null; }
      return baseline;
    },

    // restored＝頁面是從往返快取復原的（pageshow 的 persisted）。這種情況一定要檢查，而且先藏起來再檢查。
    async check({ restored = false } = {}) {
      if (restored) setHidden(true);
      else {
        const time = now();
        if (running || time - lastCheck < minGapMs) return 'skipped';
        lastCheck = time;
      }
      running = true;
      try {
        let current;
        try { current = await read(); } catch { if (restored) setHidden(false); return 'unknown'; }
        if (baseline === null) { baseline = current; if (restored) setHidden(false); return 'baseline'; }
        // 一開始是登入狀態、現在換了人或已登出 → 這個頁面的內容不屬於現在的登入者，重新載入。
        if (baseline !== '' && current !== baseline) { reload(); return 'reload'; }
        if (restored) setHidden(false);
        return 'same';
      } finally { running = false; }
    },
  };
}
