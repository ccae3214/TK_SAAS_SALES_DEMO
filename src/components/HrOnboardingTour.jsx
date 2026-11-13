"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useHrDialog } from '@/lib/use-hr-dialog';
import { ONBOARDING_VERSION, TOURS } from '@/lib/hr-onboarding';
import styles from './HrOnboardingTour.module.css';

// 新手導覽：第一次進入時自動開始，之後可按右下角「使用導覽」重看。
// 看過的紀錄存在會員資料（跨裝置）；沒有會員資料的帳號則存在這個瀏覽器。

const COPY = {
  zh: { skip: '略過導覽', back: '上一步', next: '下一步', done: '完成', help: '使用導覽', dialog: '新手導覽' },
  en: { skip: 'Skip tour', back: 'Back', next: 'Next', done: 'Done', help: 'Quick tour', dialog: 'Quick tour' },
};

const findTarget = selector => {
  if (!selector || typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? el : null;
};
// 目標元素不存在時：標為 optional 的步驟直接略過，其餘以置中卡片顯示。
const availableSteps = tourId => (TOURS[tourId] || []).filter(step => !(step.optional && !findTarget(step.target)));

export default function HrOnboardingTour({ tourId }) {
  const { lang } = useLanguage();
  const text = COPY[lang === 'en' ? 'en' : 'zh'];
  const key = lang === 'en' ? 'en' : 'zh';
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });
  const storageKey = `hr-onboarding:${tourId}:v${ONBOARDING_VERSION}`;

  const markSeen = useCallback(() => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* 無痕模式等情況：略過 */ }
    void fetch('/api/hr/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tour: tourId, version: ONBOARDING_VERSION }) }).catch(() => {});
  }, [storageKey, tourId]);

  const start = useCallback(() => {
    const list = availableSteps(tourId);
    if (!list.length) return;
    setSteps(list); setIndex(0); setOpen(true);
  }, [tourId]);

  const finish = useCallback(() => { setOpen(false); markSeen(); }, [markSeen]);

  // 第一次進入時自動開始（沒看過目前版本才會開）。
  useEffect(() => {
    let live = true, timer;
    (async () => {
      let seen = false;
      try { seen = localStorage.getItem(storageKey) === '1'; } catch { /* ignore */ }
      if (!seen) {
        try {
          const response = await fetch('/api/hr/onboarding', { cache: 'no-store' });
          const json = await response.json().catch(() => ({}));
          if (response.ok && json.seen && Number(json.seen[tourId]) >= ONBOARDING_VERSION) seen = true;
        } catch { /* 讀不到就當作沒看過 */ }
      }
      if (live && !seen) timer = setTimeout(() => { if (live) start(); }, 700);
    })();
    return () => { live = false; clearTimeout(timer); };
  }, [storageKey, tourId, start]);

  const step = open ? steps[index] : null;

  // 捲到目標、量位置；視窗大小或捲動時跟著更新。
  useLayoutEffect(() => {
    if (!step) return undefined;
    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const el = findTarget(step.target);
      if (!el) { setRect(null); return; }
      const box = el.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };
    const el = findTarget(step.target);
    if (el) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    }
    update();
    const timer = setTimeout(update, 350);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { clearTimeout(timer); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [step]);

  if (!open || !step) {
    return <button type="button" className={styles.help} onClick={start}><CircleHelp size={17} aria-hidden="true" />{text.help}</button>;
  }

  return <TourDialog step={step} steps={steps} index={index} setIndex={setIndex} finish={finish} text={text} copyKey={key} rect={rect} viewport={viewport} />;
}

// 對話框只在導覽開啟時才存在，這樣 useHrDialog 才能在開啟時把焦點移進來。
function TourDialog({ step, steps, index, setIndex, finish, text, copyKey, rect, viewport }) {
  const cardRef = useRef(null);
  const primaryRef = useRef(null);
  const handleKeyDown = useHrDialog(cardRef, finish);
  const onKeyDown = event => {
    if (event.key === 'ArrowRight' && index < steps.length - 1) { event.preventDefault(); setIndex(index + 1); }
    else if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); setIndex(index - 1); }
    else handleKeyDown(event);
  };
  // 換步驟後讓焦點回到主要按鈕，鍵盤使用者可以直接按 Enter 下一步。
  useEffect(() => { primaryRef.current?.focus({ preventScroll: true }); }, [index]);

  const last = index === steps.length - 1;
  const mobile = viewport.width < 640;
  const cardWidth = Math.min(360, viewport.width - 24);
  let cardStyle;
  if (rect && !mobile) {
    const below = viewport.height - (rect.top + rect.height);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - cardWidth / 2, viewport.width - cardWidth - 12));
    if (below >= 250) cardStyle = { top: rect.top + rect.height + 14, left };
    else if (rect.top >= 250) cardStyle = { bottom: viewport.height - rect.top + 14, left };
  }
  const pad = 6;

  return <>
    <div className={`${styles.backdrop} ${rect ? '' : styles.dim}`} onMouseDown={event => event.stopPropagation()} />
    {rect && <div className={styles.spot} style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />}
    <section ref={cardRef} tabIndex={-1} onKeyDown={onKeyDown} className={`${styles.card} ${cardStyle || mobile ? '' : styles.center}`} style={cardStyle} role="dialog" aria-modal="true" aria-label={text.dialog} aria-describedby="hr-tour-body">
      <h2>{step.title[copyKey]}</h2>
      <p id="hr-tour-body">{step.body[copyKey]}</p>
      <div className={styles.foot}>
        <div className={styles.dots} aria-hidden="true">{steps.map((item, i) => <span key={i} className={`${styles.dot} ${i === index ? styles.dotOn : ''}`} />)}</div>
        <div className={styles.actions}>
          {index > 0 && <button type="button" className={styles.btn} onClick={() => setIndex(index - 1)}>{text.back}</button>}
          <button ref={primaryRef} type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => (last ? finish() : setIndex(index + 1))}>{last ? text.done : text.next}</button>
        </div>
      </div>
      {!last && <button type="button" className={styles.skip} onClick={finish}>{text.skip}</button>}
    </section>
  </>;
}
