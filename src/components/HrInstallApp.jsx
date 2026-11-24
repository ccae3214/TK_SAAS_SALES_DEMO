"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { INSTALL_COPY, detectInstallEnvironment, installGuideKey, shouldShowInstallButton } from '@/lib/hr-install-app-core';
import styles from './HrInstallApp.module.css';

// 「加到手機桌面」按鈕。
//   Android Chrome 等支援一鍵安裝的瀏覽器：按下去直接跳出安裝視窗。
//   iPhone 與其他瀏覽器：跳出圖文步驟說明（LINE 等內建瀏覽器會先提醒用瀏覽器開啟）。
//   已經從桌面圖示開啟、或是不支援的電腦瀏覽器：不顯示按鈕。
export default function HrInstallApp() {
  const { lang } = useLanguage();
  const t = INSTALL_COPY[lang === 'en' ? 'en' : 'zh'];
  const [environment, setEnvironment] = useState(null);
  const [open, setOpen] = useState(false);
  const deferred = useRef(null);

  const detect = useCallback(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setEnvironment(detectInstallEnvironment({
      userAgent: window.navigator.userAgent,
      maxTouchPoints: window.navigator.maxTouchPoints,
      standalone,
      canPrompt: !!deferred.current,
    }));
  }, []);

  useEffect(() => {
    const onPrompt = event => { event.preventDefault(); deferred.current = event; detect(); };
    const onInstalled = () => { deferred.current = null; setOpen(false); detect(); };
    detect();
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [detect]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!environment || !shouldShowInstallButton(environment)) return null;

  const start = async () => {
    const promptEvent = deferred.current;
    if (promptEvent) {
      deferred.current = null;
      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch { /* 使用者取消或瀏覽器拒絕時，不需要處理 */ }
      detect();
      return;
    }
    setOpen(true);
  };

  const guide = t[installGuideKey(environment)];

  return <>
    <button type="button" className={styles.button} onClick={start} aria-label={t.button} title={t.button} data-tour="install-app">
      <Smartphone size={16} aria-hidden="true" /><span className={styles.label}>{t.button}</span>
    </button>
    {open && guide && <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="hr-install-title" onClick={event => event.stopPropagation()}>
        <div className={styles.head}>
          <h2 id="hr-install-title">{guide.title}</h2>
          <button type="button" className={styles.close} aria-label={t.close} onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button>
        </div>
        <ol className={styles.steps}>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <p className={styles.note}>{guide.note}</p>
        <p className={styles.note}>{t.done}</p>
        <button type="button" className={styles.ok} onClick={() => setOpen(false)}>{t.close}</button>
      </div>
    </div>}
  </>;
}
