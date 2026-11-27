// 通話中的文字聊天：純函式（方便單獨測試）。
// 通話視窗的聊天就是這個聊天室本身的訊息（同一個 /api/hr/chat），所以通話中打的字在聊天室裡也看得到。

// 通話中多久向伺服器拿一次新訊息（聊天室頁面平常是 8 秒，通話中要即時一點）
export const CALL_CHAT_POLL_MS = 3000;
// 和聊天室一樣最多保留最近 200 則
export const CALL_CHAT_MAX_MESSAGES = 200;

// 合併新舊訊息：以 id 去重、依 id 排序，只留最近 200 則
export function mergeMessages(current, incoming) {
  const byId = new Map();
  for (const message of [...(current || []), ...(incoming || [])]) {
    const id = Number(message?.id);
    if (Number.isSafeInteger(id) && id > 0) byId.set(id, message);
  }
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id)).slice(-CALL_CHAT_MAX_MESSAGES);
}

export function latestMessageId(messages) {
  return (messages || []).reduce((max, message) => Math.max(max, Number(message?.id) || 0), 0);
}

// 未讀：比「已看過的最後一則」新、而且不是自己在這次通話送出的訊息
export function countUnread(messages, seenId, mineIds = new Set()) {
  return (messages || []).filter(message => Number(message.id) > seenId && !mineIds.has(Number(message.id))).length;
}

// Enter 送出、Shift+Enter 換行；輸入法選字（中文注音／拼音）時按 Enter 不送出
export function shouldSendOnKey(event) {
  if (!event || event.key !== 'Enter' || event.shiftKey) return false;
  if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return false;
  return true;
}
