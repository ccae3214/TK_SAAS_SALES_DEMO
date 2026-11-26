"use client";

import { useEffect } from 'react';

// 手機版的功能菜單固定在底部、可以左右滑動。
// 這個元件只做一件事：目前選到的分頁被切換時（點選單、或從頁面內的按鈕跳轉），
// 把它滑到選單可見範圍內，避免選到的分頁躲在螢幕外。畫面上不會顯示任何東西。
export default function HrMemberNavScroll() {
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    let nav, active, width, frame = 0;
    const resize = new ResizeObserver(() => schedule());
    const reveal = () => {
      frame = 0;
      const next = document.querySelector('.hr-member-shell:not(.hr-embedded) nav.workspace-tabs');
      if (next !== nav) {
        nav?.closest('.hr-member-shell')?.style.removeProperty('--member-nav-height');
        resize.disconnect();
        nav = next;
        active = null;
        if (nav) resize.observe(nav);
      }
      if (!nav) return;
      const shell = nav.closest('.hr-member-shell');
      if (!media.matches) {
        shell.style.removeProperty('--member-nav-height');
        active = null;
        return;
      }
      shell.style.setProperty('--member-nav-height', `${nav.offsetHeight}px`);
      const selected = nav.querySelector('button.active');
      if (!selected || (selected === active && width === nav.clientWidth)) return;
      active = selected;
      width = nav.clientWidth;
      const item = active.getBoundingClientRect();
      const bar = nav.getBoundingClientRect();
      nav.scrollLeft += item.left + item.width / 2 - bar.left - bar.width / 2;
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(reveal); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    media.addEventListener('change', schedule);
    schedule();
    return () => {
      observer.disconnect();
      resize.disconnect();
      media.removeEventListener('change', schedule);
      nav?.closest('.hr-member-shell')?.style.removeProperty('--member-nav-height');
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
