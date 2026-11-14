// 讀取 fetch 回應的 JSON。伺服器重啟、更新，或前面的 nginx／Cloudflare 回傳 HTML 錯誤頁（502、503、504、404…）時，
// 直接呼叫 response.json() 會丟出「Unexpected token '<'」這種看不懂的訊息；這裡改成丟出有中英文說明的錯誤。
// 回傳的錯誤帶有 .en（英文訊息）與 .status；畫面依目前語言選用 message（中文）或 en。
export async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch {
    const status = response.status;
    const error = new Error(`伺服器暫時沒有回應（HTTP ${status}），可能正在更新或重新啟動，請稍後再試。`);
    error.en = `The server is temporarily unavailable (HTTP ${status}); it may be updating or restarting. Please try again shortly.`;
    error.status = status;
    throw error;
  }
}
