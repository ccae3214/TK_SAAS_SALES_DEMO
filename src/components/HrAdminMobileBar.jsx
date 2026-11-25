"use client";

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { HrLanguageToggle } from '@/lib/hr-translations';
import { pickLang, copyFor } from '@/lib/language';

// 系統管理員頁面手機版：功能菜單固定在畫面最底部（樣式在 hr-admin-mobile-nav.css）。
// 原本放在側邊欄的「中英文切換」與「登出」在手機版移到頁首右側，由這個元件提供。
// 另外在選中的分頁改變時，把它滑到底部選單的可見範圍內。桌機版不會顯示這些按鈕。

const COPY = {
  zh: { signOut: '登出' },
  en: { signOut: 'Sign out' },
};
const ACTIVE_NAV_BUTTON = 'div[data-hr-translatable-root] > aside > nav > button[class*="navActive"]';
const LANGUAGE_BUTTON_STYLE = { height: 36, minWidth: 44, padding: '0 10px', borderRadius: 11, border: '1px solid #e1e9e4', fontSize: 13 };

export default function HrAdminMobileBar() {
  const { lang } = useLanguage();
  const text = copyFor(COPY, lang);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    let lastActive = null;
    let frame = 0;

    const reveal = () => {
      frame = 0;
      if (!media.matches) return;
      const active = document.querySelector(ACTIVE_NAV_BUTTON);
      if (!active || active === lastActive) return;
      lastActive = active;
      // block: 'nearest' 只調整選單本身的橫向捲動，不會讓整頁跟著上下跳。
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(reveal); };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    schedule();
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="hr-admin-mobile-actions">
    <HrLanguageToggle style={LANGUAGE_BUTTON_STYLE} />
    <button type="button" className="hr-admin-mobile-signout" aria-label={text.signOut} title={text.signOut} onClick={() => signOut({ callbackUrl: '/' })}>
      <LogOut size={18} aria-hidden="true" />
    </button>
  </div>;
}
