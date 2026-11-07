"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { HrLanguageTools } from '@/lib/hr-translations';
import { AlertCircle, ArrowLeft, ClipboardCheck, FileText, MessagesSquare, MessageCircle, X } from 'lucide-react';
import styles from './login.module.css';

export default function HrLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErrorOpen, setLoginErrorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegisterMode(params.get('register') === '1');
    setAuthError(params.get('error') || '');
  }, []);

  // LINE 預設用自動登入（跳到 LINE App 認證）。自動登入失敗時，改用「關閉自動登入」重試，
  // 這是 LINE 官方建議的處理方式。
  const retryLineWithoutAutoLogin = () => signIn('line', { callbackUrl: '/hr' }, { disable_auto_login: 'true' });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/hr',
      });
      if (result?.ok) router.replace('/hr');
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
        <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" />返回首頁</Link>
        <p className={styles.eyebrow}>KOLECION HR</p>
        <h1>{registerMode ? '註冊克雷迅會員' : '克雷迅人力仲介'}</h1>
        <p className={styles.lead}>{registerMode ? '使用 LINE 確認身分，登入後選擇工作者、雇主或仲介類型送交審核。' : '使用人力仲介管理系統專用帳號登入。'}</p>
        {registerMode&&<ol className={styles.steps}>{[['1','使用 LINE 授權確認身分'],['2','登入後選擇會員類型；工作者、雇主及仲介需選擇所屬仲介'],['3','送出後等待管理者審核；核准前不會開放案件資料']].map(([number,text])=><li key={number}><strong>{number}</strong><span>{text}</span></li>)}</ol>}

        {authError && (
          <div role="alert" className={styles.alert}>
            登入沒有完成。如果你剛剛是從 LINE App 跳回來，可能是瀏覽器不同或隱私模式造成的，請按下方按鈕，改用 LINE 帳號密碼登入再試一次。
            <button type="button" onClick={retryLineWithoutAutoLogin} className={`${styles.btn} ${styles.line}`}>
              改用 LINE 帳號密碼登入
            </button>
          </div>
        )}
        <button type="button" className={`${styles.btn} ${styles.line}`} onClick={() => signIn('line', { callbackUrl: '/hr' })}>
          <MessageCircle size={20} aria-hidden="true" />{registerMode ? '使用 LINE 授權並繼續註冊' : '使用 LINE 登入'}
        </button>
        {!registerMode && <button type="button" className={`${styles.btn} ${styles.google}`} onClick={() => signIn('google', { callbackUrl: '/hr' })}>{googleIcon}使用 Google 登入</button>}

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
