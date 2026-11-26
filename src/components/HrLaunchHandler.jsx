"use client";

import { useEffect } from 'react';
import { chatRoomFromUrl } from '@/lib/hr-chat-link';

// 已安裝的 App（電腦版 Chrome／Edge）被連結打開時：manifest 的 launch_handler 設成 focus-existing，
// 瀏覽器會切回已經開著的 App 視窗，不重新載入（不會打斷進行中的通話），再由這裡打開連結指定的聊天室。
// 也接收來電推播被點擊時 Service Worker 傳來的「打開聊天室」訊息。
function openChatRoom(roomId) {
  window.dispatchEvent(new CustomEvent('hr:open-chat-room', { detail: { roomId } }));
  document.getElementById('hr-chat-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function HrLaunchHandler() {
  useEffect(() => {
    if ('launchQueue' in window && typeof window.launchQueue?.setConsumer === 'function') {
      window.launchQueue.setConsumer(params => {
        if (!params?.targetURL) return;
        let target;
        try { target = new URL(params.targetURL); } catch { return; }
        if (target.origin !== window.location.origin) return;
        const roomId = chatRoomFromUrl(target.href);
        // 已經在 /hr：不重新載入，直接切到聊天室（第一次開啟時聊天室元件自己會讀網址）
        if (window.location.pathname.startsWith('/hr') && target.pathname.startsWith('/hr')) { if (roomId) openChatRoom(roomId); return; }
        if (target.pathname !== window.location.pathname) window.location.assign(target.href);
      });
    }
    const container = navigator.serviceWorker;
    if (!container) return undefined;
    const onMessage = event => {
      if (event.origin && event.origin !== window.location.origin) return;
      if (event.data?.type !== 'hr:open-chat-room') return;
      const roomId = Number(event.data.roomId);
      if (Number.isSafeInteger(roomId) && roomId > 0 && window.location.pathname.startsWith('/hr')) openChatRoom(roomId);
    };
    container.addEventListener('message', onMessage);
    try { container.startMessages?.(); } catch { /* 舊瀏覽器 */ }
    return () => container.removeEventListener('message', onMessage);
  }, []);
  return null;
}
