"use client";

import { useEffect } from 'react';

// 手機版的功能菜單固定在底部、可以左右滑動。
// 這個元件只做一件事：目前選到的分頁被切換時（點選單、或從頁面內的按鈕跳轉），
// 把它滑到選單可見範圍內，避免選到的分頁躲在螢幕外。畫面上不會顯示任何東西。
export default function HrMemberNavScroll() {
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    let lastActive = null;
    let frame = 0;

    const reveal = () => {
      frame = 0;
      if (!media.matches) return;
      const active = document.querySelector('.hr-member-shell nav.workspace-tabs button.active');
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

  return null;
}
