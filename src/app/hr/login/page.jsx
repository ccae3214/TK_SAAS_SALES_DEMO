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

  useEffect(() => {
    setRegisterMode(new URLSearchParams(window.location.search).get('register') === '1');
  }, []);

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
