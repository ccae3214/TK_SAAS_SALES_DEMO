// 來電／通知連結：直接開到某個聊天室，並盡量用已安裝的 App 開啟。
// 這個檔案不 import '@/…'，node:test 可以直接測試；也可以在瀏覽器與 Service Worker 以外的前端程式使用。
//
//   /hr?chatRoom=<id>         開啟網站後直接選到該聊天室
//   openExternalBrowser=1     LINE 專用：不用 LINE 內建瀏覽器，改交給手機系統開啟
//                             （Android 已安裝 App 時會直接打開 App；iPhone 會用 Safari 開，iOS 不允許連結打開主畫面 App）

export const CHAT_ROOM_PARAM = 'chatRoom';
const LINE_EXTERNAL_PARAM = 'openExternalBrowser';

const roomNumber = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// 網站內的路徑（推播通知用）
export function chatRoomPath(roomId) {
  const id = roomNumber(roomId);
  return id ? `/hr?${CHAT_ROOM_PARAM}=${id}` : '/hr';
}

// 完整網址（LINE 訊息用），加上 openExternalBrowser=1
export function chatRoomLineUrl(origin, roomId) {
  const url = new URL(chatRoomPath(roomId), origin);
  url.searchParams.set(LINE_EXTERNAL_PARAM, '1');
  return url.href;
}

// 從網址讀出要開的聊天室編號；不是 /hr 頁面或沒有帶編號時回傳 null。
export function chatRoomFromUrl(href, base = 'https://kolecion.cc') {
  let url;
  try { url = new URL(String(href || ''), base); } catch { return null; }
  if (!url.pathname.startsWith('/hr')) return null;
  return roomNumber(url.searchParams.get(CHAT_ROOM_PARAM));
}

// 開好聊天室後把網址上的參數拿掉（重新整理不會一直跳回同一個聊天室）。回傳要改成的網址；不用改時回傳 null。
export function stripChatLinkParams(href) {
  let url;
  try { url = new URL(String(href || '')); } catch { return null; }
  if (!url.searchParams.has(CHAT_ROOM_PARAM) && !url.searchParams.has(LINE_EXTERNAL_PARAM)) return null;
  url.searchParams.delete(CHAT_ROOM_PARAM);
  url.searchParams.delete(LINE_EXTERNAL_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
