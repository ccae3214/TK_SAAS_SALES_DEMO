"use client";

import { useEffect } from 'react';
import { createSessionGuard } from '@/lib/session-guard-core';

// 換帳號後，從左右滑／上一頁回到舊頁面時，不要顯示上一個帳號的內容（原因與做法見 session-guard-core.js）。
// 頁面從往返快取復原（pageshow）或切回前景時，向伺服器確認目前登入的是不是同一個帳號；
// 不是就先藏起畫面、整頁重新載入。畫面上不會顯示任何東西。
export default function HrSessionGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const guard = createSessionGuard({
      readSession: async () => {
        const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error('session unavailable');
        return response.json();
      },
      reload: () => window.location.reload(),
      setHidden: hidden => { root.style.visibility = hidden ? 'hidden' : ''; },
    });
    guard.start();
    const onPageShow = event => { if (event.persisted) guard.check({ restored: true }); };
    const onVisible = () => { if (document.visibilityState === 'visible') guard.check(); };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
      root.style.visibility = '';
    };
  }, []);

  return null;
}
