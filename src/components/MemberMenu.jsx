"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, LogOut, IdCard, X, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

const L = {
  zh: { signIn: '使用 Google 登入', profile: '會員資料', logout: '登出', name: '姓名', email: 'Email', method: '登入方式', points: '點數', spending: '累計消費', close: '關閉', member: '會員' },
  en: { signIn: 'Sign in with Google', profile: 'My Profile', logout: 'Log out', name: 'Name', email: 'Email', method: 'Sign-in method', points: 'Points', spending: 'Total spending', close: 'Close', member: 'Member' },
};

function Avatar({ user, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0 };
  // 圖片網址改變時重新嘗試載入
  useEffect(() => setFailed(false), [user.image]);
  if (user.image && !failed) {
    return <img src={user.image} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ ...base, objectFit: 'cover' }} />;
  }
  return (
    <span style={{ ...base, background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.45 }}>
      {(user.name || user.email || '?')[0].toUpperCase()}
    </span>
  );
}

export default function MemberMenu() {
  const { userProfile, signInWithGoogle, logout } = useAuth();
  const { lang } = useLanguage();
  const tx = L[lang === 'en' ? 'en' : 'zh'];
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setShowProfile(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!userProfile) {
    return (
      <button
        onClick={() => signInWithGoogle('/')}
        style={{ border: '1px solid #cbd5e1', borderRadius: 20, padding: '6px 16px', background: '#fff', color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
      >
        {tx.signIn}
      </button>
    );
  }

  const itemStyle = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', textAlign: 'left' };
  const methodLabel = userProfile.provider === 'google' ? 'Google' : 'Email';
  const rows = [
    [tx.name, userProfile.name || '-'],
    [tx.email, userProfile.email || '-'],
    [tx.method, methodLabel],
    ...(userProfile.points !== undefined ? [[tx.points, String(userProfile.points)]] : []),
    ...(userProfile.spending !== undefined ? [[tx.spending, `$${Number(userProfile.spending).toFixed(0)}`]] : []),
  ];

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(37,99,235,0.1)', color: '#2563eb', padding: '4px 12px 4px 4px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
      >
        <Avatar user={userProfile} />
        <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile.name || tx.member}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 220, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', padding: 6, zIndex: 10000 }}>
          <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid #e2e8f0', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{userProfile.name || tx.member}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile.email}</div>
          </div>
          <button role="menuitem" style={itemStyle} onClick={() => { setShowProfile(true); setOpen(false); }}>
            <IdCard size={16} /> {tx.profile}
          </button>
          <button role="menuitem" style={{ ...itemStyle, color: '#dc2626' }} onClick={async () => { setOpen(false); await logout(); }}>
            <LogOut size={16} /> {tx.logout}
          </button>
        </div>
      )}

      {mounted && showProfile && createPortal(
        <div onClick={() => setShowProfile(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, position: 'relative', color: '#0f172a' }}>
            <button onClick={() => setShowProfile(false)} aria-label={tx.close} style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
              <X size={20} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Avatar user={userProfile} size={72} />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}><User size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />{tx.profile}</h3>
            </div>
            <dl style={{ margin: 0 }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: '1px solid #e2e8f0' }}>
                  <dt style={{ color: '#64748b', fontSize: '0.9rem' }}>{k}</dt>
                  <dd style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-all', textAlign: 'right' }}>{v}</dd>
                </div>
              ))}
            </dl>
            <button onClick={async () => { setShowProfile(false); await logout(); }} style={{ marginTop: 16, width: '100%', padding: '10px 16px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <LogOut size={16} /> {tx.logout}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
