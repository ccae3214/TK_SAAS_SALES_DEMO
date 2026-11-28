// 來電與聊天訊息通知的 Service Worker：只負責顯示推播通知與點擊後開啟網站。
// 不攔截任何網路請求、不做快取，所以不會影響網站的載入或更新；
// 註冊範圍刻意放在沒有頁面的 /hr-push/（推播不需要控制頁面），也不會和網站既有的 /sw.js 衝突。

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// 使用者正看著（畫面在前景且有焦點）網站時，聊天訊息不必再跳通知（網頁自己會更新）。
// 只有 Chrome／Edge 允許這樣略過；Safari 與 Firefox 要求每則推播都顯示通知，否則會停用訂閱，所以那兩種一律顯示。
const MAY_SKIP_WHEN_VISIBLE = /Chrome|Chromium|Edg\//i.test(self.navigator.userAgent) && !/iPhone|iPad|iPod|Firefox/i.test(self.navigator.userAgent);

async function userIsLooking() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.some(client => client.visibilityState === 'visible' && client.focused && new URL(client.url).pathname.startsWith('/hr'));
}

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const url = typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url : '/hr';
  const isChat = data.kind === 'chat';
  const options = {
    body: String(data.body || ''),
    tag: String(data.tag || 'hr-call'), // 同一個聊天室的來電（或訊息）只留一則，重撥／再來訊息時用 renotify 再提醒一次
    renotify: true,
    requireInteraction: true,
    icon: '/icons/icon-192.png',
    vibrate: [300, 150, 300, 150, 300],
    timestamp: Number(data.ts) || Date.now(),
    data: { url, roomId: Number(data.roomId) || 0 },
  };
  // 聊天訊息比來電不緊急：不要求一定要點掉、震動短一點
  if (isChat) { options.requireInteraction = false; options.vibrate = [200, 100, 200]; }
  event.waitUntil((async () => {
    if (isChat && MAY_SKIP_WHEN_VISIBLE && await userIsLooking()) return;
    await self.registration.showNotification(String(data.title || (isChat ? '💬' : '📞')), options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/hr', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus();
      // 已經開著網站就切回去（網頁會重新連線並顯示還在響鈴的來電）；不在 /hr 頁面時帶過去
      if (!new URL(client.url).pathname.startsWith('/hr') && 'navigate' in client) { try { await client.navigate(target); } catch { /* 不能導覽就維持原頁 */ } }
      // 已經在 /hr：不重新載入，請頁面直接打開來電的聊天室（HrLaunchHandler 接收）
      else { const roomId = Number(event.notification.data && event.notification.data.roomId) || 0; if (roomId > 0) client.postMessage({ type: 'hr:open-chat-room', roomId }); }
      return;
    }
    await self.clients.openWindow(target);
  })());
});
