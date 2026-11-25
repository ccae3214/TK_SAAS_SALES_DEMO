"use client";

import { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { NOTIFY_COPY, detectNotifyEnvironment, urlBase64ToUint8Array } from '@/lib/hr-call-notify-client-core';
import { copyFor, isSupportedLanguage } from '@/lib/language';
import styles from './HrCallNotify.module.css';

// 「來電通知」：讓這台裝置在網站沒開著（甚至鎖屏）時也能收到來電通知（Web Push）。
// 伺服器端沒有設定推播金鑰時整個按鈕不顯示；沒開網頁通知但綁定 LINE 的人，離線來電會改收 LINE 通知（伺服器端處理）。
const SW_URL = '/hr-push-sw.js';
const SW_SCOPE = '/hr-push/'; // 推播不需要控制頁面，放在沒有頁面的範圍，不影響網站既有的 Service Worker

async function callApi(method, body) {
  const response = await fetch('/api/hr/push', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let data = {};
  try { data = await response.json(); } catch { /* 沒有內容 */ }
  return { ok: response.ok, status: response.status, data };
}

// 註冊並等到 Service Worker 啟用（訂閱推播需要已啟用的 worker）。
async function registerWorker() {
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  if (registration.active) return registration;
  const worker = registration.installing || registration.waiting;
  if (!worker) throw new Error('service worker unavailable');
  await new Promise((resolve, reject) => {
    const check = () => { if (worker.state === 'activated') resolve(); else if (worker.state === 'redundant') reject(new Error('service worker redundant')); };
    worker.addEventListener('statechange', check);
    check();
  });
  return registration;
}

const sameKey = (buffer, bytes) => {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  return a.length === bytes.length && a.every((value, index) => value === bytes[index]);
};

export default function HrCallNotify() {
  const { lang } = useLanguage();
  const language = isSupportedLanguage(lang) ? lang : 'zh';
  const t = copyFor(NOTIFY_COPY, language);
  const [config, setConfig] = useState(null);
  const [environment, setEnvironment] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const detect = useCallback(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setEnvironment(detectNotifyEnvironment({
      userAgent: window.navigator.userAgent,
      maxTouchPoints: window.navigator.maxTouchPoints,
      standalone,
      isSecureContext: window.isSecureContext,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasPushManager: 'PushManager' in window,
      hasNotification: 'Notification' in window,
      permission: 'Notification' in window ? Notification.permission : 'default',
    }));
  }, []);

  useEffect(() => { detect(); }, [detect]);

  useEffect(() => {
    let active = true;
    callApi('GET').then(result => { if (active && result.ok) setConfig(result.data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // 已經開啟過的裝置：確認訂閱還在，並把目前的語言與訂閱同步給伺服器（瀏覽器換了訂閱網址也會在這裡補登記）
  useEffect(() => {
    if (!config?.enabled || environment !== 'available' || Notification.permission !== 'granted') return undefined;
    let active = true;
    (async () => {
      try {
        const registration = await registerWorker();
        const existing = await registration.pushManager.getSubscription();
        if (!active) return;
        setSubscribed(!!existing);
        if (existing) await callApi('POST', { type: 'subscribe', subscription: existing.toJSON(), lang: language });
      } catch { /* 沒辦法確認時維持關閉狀態，使用者可以手動重新開啟 */ }
    })();
    return () => { active = false; };
  }, [config, environment, language]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!environment || (config && !config.enabled)) return null;

  const fail = (text, data) => setMessage({ error: true, text: (language === 'zh' ? data?.error : data?.en) || text });

  const enable = async () => {
    setBusy(true); setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      detect();
      if (permission !== 'granted') { fail(t.errors.permission); return; }
      const key = urlBase64ToUint8Array(config.publicKey);
      const registration = await registerWorker();
      let subscription = await registration.pushManager.getSubscription();
      // 推播金鑰換過時，舊訂閱不能再用，要重新訂閱
      if (subscription && !sameKey(subscription.options?.applicationServerKey, key)) { await subscription.unsubscribe(); subscription = null; }
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const result = await callApi('POST', { type: 'subscribe', subscription: subscription.toJSON(), lang: language });
      if (!result.ok) { await subscription.unsubscribe().catch(() => {}); fail(t.errors.server, result.data); return; }
      setSubscribed(true);
    } catch { fail(t.errors.subscribe); } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMessage(null);
    try {
      const registration = await registerWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await callApi('POST', { type: 'unsubscribe', endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch { fail(t.errors.server); } finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true); setMessage(null);
    try {
      const result = await callApi('POST', { type: 'test', lang: language });
      if (result.ok) setMessage({ error: false, text: t.testSent }); else fail(t.errors.test, result.data);
    } catch { fail(t.errors.test); } finally { setBusy(false); }
  };

  const guide = environment === 'ios-install' ? t.iosInstall : environment === 'denied' ? t.denied : null;
  const plain = { insecure: t.insecure, inapp: t.inapp, unsupported: t.unsupported }[environment];

  return <>
    <button type="button" className={styles.button} onClick={() => { setMessage(null); setOpen(true); }} aria-label={t.button} title={t.button}>
      <Bell size={16} aria-hidden="true" /><span className={styles.label}>{t.button}</span>
      {subscribed && <i className={styles.dot} aria-hidden="true" />}
    </button>
    {open && <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="hr-call-notify-title" onClick={event => event.stopPropagation()}>
        <div className={styles.head}>
          <h2 id="hr-call-notify-title">{guide ? guide.title : t.title}</h2>
          <button type="button" className={styles.close} aria-label={t.close} onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button>
        </div>
        {message && <p className={`${styles.message} ${message.error ? styles.isError : ''}`} role="status">{message.text}</p>}
        {plain && <p className={styles.text}>{plain}</p>}
        {guide && <><ol className={styles.steps}>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>{guide.note && <p className={styles.note}>{guide.note}</p>}</>}
        {environment === 'available' && <>
          <p className={styles.text}>{t.intro}</p>
          {subscribed && <p className={styles.status}>{t.on}</p>}
          <div className={styles.actions}>
            {subscribed
              ? <><button type="button" className={styles.primary} disabled={busy} onClick={sendTest}>{busy ? t.working : t.test}</button>
                <button type="button" className={styles.secondary} disabled={busy} onClick={disable}>{t.disable}</button></>
              : <button type="button" className={styles.primary} disabled={busy || !config} onClick={enable}>{busy ? t.working : t.enable}</button>}
          </div>
        </>}
        <p className={styles.note}>{t.lineNote}</p>
      </div>
    </div>}
  </>;
}
