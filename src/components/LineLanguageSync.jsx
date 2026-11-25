"use client";
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

// 登入後向伺服器詢問「要不要依 LINE 語言設定強制切換一次」。
// 伺服器每個 LINE 帳號只會回答 applied:true 一次；同一個瀏覽器分頁也只問一次，避免每頁都打 API。
const SESSION_KEY = 'line-language-sync-v1';

export default function LineLanguageSync() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated') return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch { /* 無痕模式等情況：照樣詢問，伺服器仍只會套用一次 */ }

    fetch('/api/hr/line-language', { method: 'POST', credentials: 'same-origin' })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (!data?.applied || (data.language !== 'zh' && data.language !== 'en' && data.language !== 'tl')) return;
        // 菲律賓仲介的工作區另外記一份語言偏好，一起更新才不會被舊偏好蓋回去。
        try { localStorage.setItem('hr-language:philippines-agency', data.language); } catch { /* 略過 */ }
        window.dispatchEvent(new CustomEvent('kolecion:set-language', { detail: data.language }));
      })
      .catch(() => {});
  }, [status]);

  return null;
}
