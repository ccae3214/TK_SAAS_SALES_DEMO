"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getProviders, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { HrLanguageTools } from '@/lib/hr-translations';
import { useLanguage } from '@/context/LanguageContext';
import { copyFor } from '@/lib/language';
import { HANDOFF_COPY } from '@/lib/hr-line-handoff-copy';
import { isMobileDevice, lineLoginMode } from '@/lib/hr-line-login-mode';
import { AlertCircle, ClipboardCheck, FileText, MessagesSquare, MessageCircle, X } from 'lucide-react';
import styles from './login.module.css';

// 桌面 App 登入 LINE 到一半的交接單（App 被系統回收再開啟時用來接續；10 分鐘後作廢）。
const HANDOFF_STORAGE_KEY = 'kolecion:line-handoff';
const HANDOFF_STORAGE_TTL_MS = 10 * 60 * 1000;
const readSavedHandoff = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(HANDOFF_STORAGE_KEY) || 'null');
    if (saved?.state && saved?.secret && Date.now() - saved.at < HANDOFF_STORAGE_TTL_MS) return { state: saved.state, secret: saved.secret, status: 'pending', error: '' };
  } catch { /* 讀不到就當作沒有 */ }
  return null;
};
const saveHandoff = ({ state, secret }) => { try { window.localStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify({ state, secret, at: Date.now() })); } catch { /* 無痕模式等無法儲存時，只是少了接續功能 */ } };
const clearSavedHandoff = () => { try { window.localStorage.removeItem(HANDOFF_STORAGE_KEY); } catch { /* 同上 */ } };

// 電腦版按下 LINE 登入的時間：LINE 網頁登入若在別的視窗／分頁完成（cookie 與瀏覽器共用），
// 回到這個視窗時用它判斷要不要檢查登入狀態；10 分鐘後作廢。
const WEB_LOGIN_KEY = 'kolecion:line-web-login';
const WEB_LOGIN_TTL_MS = 10 * 60 * 1000;

export default function HrLoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const handoffText = copyFor(HANDOFF_COPY, lang);
  const [standalone, setStandalone] = useState(false); // 只有「手機的桌面圖示 App」才是 true（走交接單）
  const [desktop, setDesktop] = useState(false); // 電腦（瀏覽器或桌面 App）：LINE 直接在這個視窗做網頁登入
  const [handoff, setHandoff] = useState(null); // { state, secret, status: pending | ready | expired, error }
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffCode, setHandoffCode] = useState('');
  const [handoffWebUrl, setHandoffWebUrl] = useState('');
  const autoFinishedFor = useRef('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErrorOpen, setLoginErrorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [providers, setProviders] = useState({});
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerError, setProviderError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegisterMode(params.get('register') === '1');
    setAuthError(params.get('error') || '');
  }, []);

  // 從手機桌面圖示開啟時（standalone），LINE 驗證會在另一個瀏覽器完成、cookie 不互通，
  // 所以改走「交接單 + 確認碼」流程；電腦（瀏覽器或桌面 App）與手機的一般瀏覽器分頁，直接在同一個視窗做 LINE 網頁登入。
  useEffect(() => {
    const isStandalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
    const device = { userAgent: window.navigator.userAgent, maxTouchPoints: window.navigator.maxTouchPoints };
    const useHandoff = lineLoginMode({ standalone: isStandalone, ...device }) === 'handoff';
    setStandalone(useHandoff);
    setDesktop(!isMobileDevice(device));
    if (useHandoff) {
      const saved = readSavedHandoff();
      if (saved) setHandoff(saved); else clearSavedHandoff();
    } else clearSavedHandoff();
  }, []);

  // 電腦版：LINE 網頁登入如果是在別的視窗／分頁完成的，回到這個視窗時直接進入系統。
  useEffect(() => {
    if (!desktop) return undefined;
    let active = true;
    const started = () => { try { return Date.now() - Number(window.localStorage.getItem(WEB_LOGIN_KEY) || 0) < WEB_LOGIN_TTL_MS; } catch { return false; } };
    const check = async () => {
      if (!started()) return;
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (active && data?.user) {
          try { window.localStorage.removeItem(WEB_LOGIN_KEY); } catch { /* 同上 */ }
          router.replace('/');
        }
      } catch { /* 暫時連不上：下次回到這個視窗再查 */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', onVisible); };
  }, [desktop, router]);

  const handoffState = handoff?.state;
  const handoffSecret = handoff?.secret;
  const handoffStatus = handoff?.status;
  useEffect(() => {
    if (!handoffState || handoffStatus !== 'pending') return undefined;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/hr/line-handoff/status', {
          method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: handoffState, secret: handoffSecret }),
        });
        const data = await response.json().catch(() => ({}));
        if (active && response.ok && data.status && data.status !== 'pending') {
          setHandoff(current => (current?.state === handoffState ? { ...current, status: data.status, via: data.via || null, error: '' } : current));
        }
      } catch { /* 網路暫時斷線：下一輪再查 */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const timer = window.setInterval(check, 2000);
    document.addEventListener('visibilitychange', onVisible);
    check();
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [handoffState, handoffSecret, handoffStatus]);

  useEffect(() => {
    if (handoffStatus === 'expired') clearSavedHandoff();
  }, [handoffStatus]);

  async function startLineHandoff() {
    setHandoffBusy(true);
    setHandoffCode('');
    try {
      const response = await fetch('/api/hr/line-handoff/start', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url || !data.state || !data.secret) throw new Error('unavailable');
      saveHandoff({ state: data.state, secret: data.secret });
      setHandoff({ state: data.state, secret: data.secret, status: 'pending', via: null, error: '' });
      // 主要方式：開啟 LINE 官方帳號聊天室（驗證碼已預填）；查不到官方帳號時直接走網頁驗證。
      setHandoffWebUrl(data.chatUrl ? data.url : '');
      window.location.assign(data.chatUrl || data.url);
    } catch {
      setHandoff({ state: '', secret: '', status: 'expired', error: 'unavailable' });
    } finally {
      setHandoffBusy(false);
    }
  }

  function cancelLineHandoff() {
    clearSavedHandoff();
    setHandoff(null);
    setHandoffCode('');
    setHandoffWebUrl('');
  }

  // 用交接單換成登入憑證。聊天室驗證（via=chat）不需要確認碼；網頁驗證（via=browser）要帶 6 位數確認碼。
  async function finishHandoff(code) {
    if (!handoff) return;
    setHandoffBusy(true);
    try {
      const result = await signIn('line-handoff', {
        state: handoff.state, secret: handoff.secret, code: String(code || '').replace(/\s+/g, ''), redirect: false, callbackUrl: '/',
      });
      if (result?.ok && !result?.error) {
        clearSavedHandoff();
        router.replace('/');
        return;
      }
      if (handoff.via === 'chat') {
        setHandoff(current => (current ? { ...current, status: 'expired', error: '' } : current));
        return;
      }
      // 確認碼錯誤：還有次數就留在輸入畫面；次數用完交接單已作廢，status 會變 expired。
      const response = await fetch('/api/hr/line-handoff/status', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: handoff.state, secret: handoff.secret }),
      }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => ({})) : {};
      setHandoff(current => (current ? { ...current, status: data.status === 'expired' ? 'expired' : 'ready', error: data.status === 'expired' ? '' : 'wrongCode' } : current));
      setHandoffCode('');
    } catch {
      setHandoff(current => (current ? { ...current, error: 'unavailable' } : current));
    } finally {
      setHandoffBusy(false);
    }
  }

  function submitHandoffCode(event) {
    event.preventDefault();
    finishHandoff(handoffCode);
  }

  // LINE 聊天室驗證完成：自動登入，每張交接單只觸發一次。
  useEffect(() => {
    if (handoff?.status === 'ready' && handoff.via === 'chat' && autoFinishedFor.current !== handoff.state) {
      autoFinishedFor.current = handoff.state;
      finishHandoff('');
    }
  // finishHandoff 每次 render 都是新函式；這裡只在交接單狀態改變時觸發。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff?.state, handoff?.status, handoff?.via]);

  useEffect(() => {
    let active = true;
    getProviders().then(value => { if (active) { setProviders(value || {}); setProviderError(!value); } })
      .catch(() => { if (active) setProviderError(true); })
      .finally(() => { if (active) setProviderLoading(false); });
    return () => { active = false; };
  }, []);

  // LINE 預設用自動登入（跳到 LINE App 認證）。自動登入失敗時，改用「關閉自動登入」重試，
  // 這是 LINE 官方建議的處理方式。
  const retryLineWithoutAutoLogin = () => signIn('line', { callbackUrl: '/' }, { disable_auto_login: 'true' });

  // 一般 LINE 登入。電腦沒有手機版 LINE App 可以自動認證，所以關閉自動登入，
  // 直接在這個視窗顯示 LINE 網頁登入（掃 QR Code 或輸入 LINE 帳號密碼）。
  const startLineWebLogin = () => {
    if (desktop) { try { window.localStorage.setItem(WEB_LOGIN_KEY, String(Date.now())); } catch { /* 無法儲存時只是少了跨視窗接續 */ } }
    return signIn('line', { callbackUrl: '/' }, desktop ? { disable_auto_login: 'true' } : undefined);
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/',
      });
      if (result?.ok) router.replace('/');
      else setLoginErrorOpen(true);
    } catch {
      setLoginErrorOpen(true);
    } finally {
      setBusy(false);
    }
  }

  const googleIcon = <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>;

  return (
    <main className={styles.page}><HrLanguageTools />
      <aside className={styles.brandPanel} aria-hidden="true">
        <div className={styles.logo}><span className={styles.logoMark}>K</span><div className={styles.logoText}><strong>克雷迅</strong><span>KOLECION HR</span></div></div>
        <div className={styles.hero}>
          <h2>跨國人力仲介，<br />從申辦到入境一次掌握</h2>
          <p>工作者、雇主與仲介在同一個平台協作，案件進度、文件審核與聊天溝通全部即時同步。</p>
          <ul className={styles.features}>
            <li><ClipboardCheck size={20} />案件進度透明，每個階段都看得到</li>
            <li><FileText size={20} />必要文件線上上傳、審核與補件</li>
            <li><MessagesSquare size={20} />LINE 通知與站內聊天室即時溝通</li>
          </ul>
        </div>
        <div className={styles.foot}>© 克雷迅人力管理系統</div>
      </aside>
      <div className={styles.formSide}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>KOLECION HR</p>
        <h1>{registerMode ? '註冊克雷迅會員' : '克雷迅人力仲介'}</h1>
        <p className={styles.lead}>{registerMode ? '使用 LINE 確認身分，登入後選擇工作者、雇主或仲介類型送交審核。' : '使用人力仲介管理系統專用帳號登入。'}</p>
        {registerMode&&<ol className={styles.steps}>{[['1','使用 LINE 授權確認身分'],['2','登入後選擇會員類型；工作者、雇主及仲介需選擇所屬仲介'],['3','送出後等待管理者審核；核准前不會開放案件資料']].map(([number,text])=><li key={number}><strong>{number}</strong><span>{text}</span></li>)}</ol>}

        {authError && providers.line && (
          <div role="alert" className={styles.alert}>
            登入沒有完成。如果你剛剛是從 LINE App 跳回來，可能是瀏覽器不同或隱私模式造成的，請按下方按鈕，改用 LINE 帳號密碼登入再試一次。
            <button type="button" onClick={retryLineWithoutAutoLogin} className={`${styles.btn} ${styles.line}`}>
              改用 LINE 帳號密碼登入
            </button>
          </div>
        )}
        {providers.line && handoff && <div className={styles.handoff} role="status" aria-live="polite">
          {handoff.status === 'pending' && <>
            <h2>{handoffText.waitingTitle}</h2>
            <p>{handoffText.waitingBody}</p>
            <p className={styles.handoffHint}>{handoffText.sheetHint}</p>
            {handoffWebUrl && <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => window.location.assign(handoffWebUrl)}>{handoffText.webFallback}</button>}
            <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={cancelLineHandoff}>{handoffText.cancel}</button>
          </>}
          {handoff.status === 'ready' && handoff.via === 'chat' && <p>{handoffText.signingIn}</p>}
          {handoff.status === 'ready' && handoff.via !== 'chat' && <form onSubmit={submitHandoffCode} className={styles.form}>
            <div><h2>{handoffText.codeTitle}</h2><p>{handoffText.codeBody}</p></div>
            <label className={styles.field}>{handoffText.codeLabel}
              <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} required autoFocus value={handoffCode} onChange={event => setHandoffCode(event.target.value.replace(/\D/g, ''))} />
            </label>
            {handoff.error === 'wrongCode' && <p role="alert" className={styles.handoffError}>{handoffText.wrongCode}</p>}
            {handoff.error === 'unavailable' && <p role="alert" className={styles.handoffError}>{handoffText.unavailable}</p>}
            <button type="submit" disabled={handoffBusy || handoffCode.length !== 6} className={`${styles.btn} ${styles.submit}`}>{handoffBusy ? handoffText.confirming : handoffText.confirm}</button>
            <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={cancelLineHandoff}>{handoffText.cancel}</button>
          </form>}
          {handoff.status === 'expired' && <>
            <p role="alert" className={styles.handoffError}>{handoff.error === 'unavailable' ? handoffText.unavailable : handoffText.expired}</p>
            <button type="button" disabled={handoffBusy} className={`${styles.btn} ${styles.line}`} onClick={startLineHandoff}><MessageCircle size={20} aria-hidden="true" />{handoffText.restart}</button>
            <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={cancelLineHandoff}>{handoffText.cancel}</button>
          </>}
        </div>}
        {providers.line && !handoff && <button type="button" disabled={handoffBusy} className={`${styles.btn} ${styles.line}`} onClick={() => (standalone ? startLineHandoff() : startLineWebLogin())}>
          <MessageCircle size={20} aria-hidden="true" />{registerMode ? '使用 LINE 授權並繼續註冊' : '使用 LINE 登入'}
        </button>}
        {!registerMode && providers.google && <button type="button" className={`${styles.btn} ${styles.google}`} onClick={() => signIn('google', { callbackUrl: '/' })}>{googleIcon}使用 Google 登入</button>}

        {providerLoading && <p role="status">正在確認可用的登入方式…</p>}
        {providerError && <p role="alert">暫時無法讀取登入方式，請重新整理頁面再試。</p>}
        {!providerLoading && !providers.line && !providers.google && <p>目前使用會員帳號登入；LINE 與 Google 登入尚未開放。</p>}
        {registerMode && !providerLoading && !providers.line && <Link href="/hr/login">返回會員帳號登入</Link>}
        {!registerMode && <><div className={styles.divider}>或使用會員帳號</div>
        <form onSubmit={submit} className={styles.form}>
          <label className={styles.field}>Email
            <input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <label className={styles.field}>密碼
            <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={busy} className={`${styles.btn} ${styles.submit}`}>{busy ? '登入中…' : '登入人力管理系統'}</button>
        </form></>}
      </section>
      </div>
      {loginErrorOpen && <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setLoginErrorOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') setLoginErrorOpen(false); }}>
        <section className={styles.errorDialog} role="alertdialog" aria-modal="true" aria-labelledby="login-error-title" aria-describedby="login-error-description">
          <button type="button" className={styles.dialogClose} aria-label="關閉" onClick={() => setLoginErrorOpen(false)}><X size={19} /></button>
          <div className={styles.dialogIcon}><AlertCircle size={27} aria-hidden="true" /></div>
          <h2 id="login-error-title">登入失敗</h2>
          <p id="login-error-description">請重新檢查帳號密碼。若帳號尚未啟用，請洽官方 LINE@ 管理員。</p>
          <button type="button" autoFocus className={`${styles.btn} ${styles.dialogConfirm}`} onClick={() => setLoginErrorOpen(false)}>我知道了</button>
        </section>
      </div>}
    </main>
  );
}
