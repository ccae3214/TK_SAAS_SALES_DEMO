"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { HrLanguageTools } from '@/lib/hr-translations';

export default function HrLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
    setError('');
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/hr',
    });
    setBusy(false);
    if (result?.ok) router.replace('/hr');
    else setError('帳號或密碼錯誤，或此會員帳號尚未啟用。');
  }

  const buttonStyle = {
    width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 15,
    fontWeight: 700, cursor: 'pointer',
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f3f6fb', color: '#14213d' }}><HrLanguageTools />
      <section style={{ width: '100%', maxWidth: 430, padding: 32, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, boxShadow: '0 18px 55px rgba(20,33,61,.09)' }}>
        <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>← 返回首頁</Link>
        <p style={{ margin: '28px 0 8px', color: '#287a69', fontSize: 13, fontWeight: 800, letterSpacing: '.08em' }}>KOLECION HR</p>
        <h1 style={{ margin: '0 0 8px', fontSize: 27 }}>{registerMode ? '註冊克雷迅會員' : '克雷迅人力仲介'}</h1>
        <p style={{ margin: '0 0 24px', color: '#64748b', lineHeight: 1.6 }}>{registerMode ? '使用 LINE 確認身分，登入後選擇工人、雇主或仲介類型送交審核。' : '使用人力仲介管理系統專用帳號登入。'}</p>
        {registerMode&&<ol style={{ display:'grid', gap:10, margin:'0 0 20px', padding:0, listStyle:'none' }}>{[['1','使用 LINE 授權確認身分'],['2','登入後選擇會員類型；工人、雇主及仲介需選擇所屬仲介'],['3','送出後等待管理者審核；核准前不會開放案件資料']].map(([number,text])=><li key={number} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:11, border:'1px solid #e2e8f0', borderRadius:10, background:'#f8fafc', color:'#475569', fontSize:13, lineHeight:1.55 }}><strong style={{ display:'grid', placeItems:'center', flex:'0 0 24px', width:24, height:24, borderRadius:'50%', background:'#e8f3ed', color:'#176b54' }}>{number}</strong><span>{text}</span></li>)}</ol>}

        {authError && (
          <div role="alert" style={{ marginBottom: 14, padding: 14, borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 14, lineHeight: 1.6 }}>
            登入沒有完成。如果你剛剛是從 LINE App 跳回來，可能是瀏覽器不同或隱私模式造成的，請按下方按鈕，改用 LINE 帳號密碼登入再試一次。
            <button type="button" onClick={retryLineWithoutAutoLogin} style={{ ...buttonStyle, marginTop: 10, color: '#fff', background: '#06C755', border: '1px solid #06C755' }}>
              改用 LINE 帳號密碼登入
            </button>
          </div>
        )}
        <button type="button" style={{ ...buttonStyle, color: '#fff', background: '#06C755', border: '1px solid #06C755' }} onClick={() => signIn('line', { callbackUrl: '/hr' })}>
          {registerMode ? '使用 LINE 授權並繼續註冊' : '使用 LINE 登入'}
        </button>
        {!registerMode && <button type="button" style={{ ...buttonStyle, marginTop: 10, color: '#fff', background: '#F28C28', border: '1px solid #F28C28' }} onClick={() => signIn('google', { callbackUrl: '/hr' })}>使用 Google 登入</button>}

        {!registerMode && <><div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: '#94a3b8', fontSize: 13 }}>
          <span style={{ height: 1, flex: 1, background: '#e2e8f0' }} />或使用會員帳號<span style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, color: '#475569', fontSize: 14 }}>Email
            <input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 9, fontSize: 15 }} />
          </label>
          <label style={{ display: 'grid', gap: 6, color: '#475569', fontSize: 14 }}>密碼
            <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 9, fontSize: 15 }} />
          </label>
          {error && <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 14 }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ ...buttonStyle, marginTop: 4, color: '#fff', background: '#14213d', border: 0, opacity: busy ? .7 : 1 }}>{busy ? '登入中…' : '登入人力管理系統'}</button>
        </form></>}
      </section>
    </main>
  );
}
