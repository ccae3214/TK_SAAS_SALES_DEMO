"use client";
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Globe } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function PageHeader({ title = '' }) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang } = useLanguage();
  const isHome = pathname === '/';

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'white',
      padding: '12px 16px',
      borderRadius: '30px',
      border: '1px solid rgba(0,0,0,0.1)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }}>
      {/* 回首頁按鈕 */}
      {!isHome && (
        <button 
          onClick={() => router.push('/')}
          style={{
            background: '#f1f5f9',
            border: 'none',
            color: '#0f172a',
            padding: '8px 12px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
          onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
        >
          <ArrowLeft size={16} />
          <span>{lang === 'zh' ? '首頁' : 'Home'}</span>
        </button>
      )}

      {/* 語言切換按鈕 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        background: '#f1f5f9',
        padding: '4px',
        borderRadius: '8px'
      }}>
        <button
          onClick={() => setLang('zh')}
          style={{
            background: lang === 'zh' ? '#2563eb' : 'transparent',
            color: lang === 'zh' ? '#fff' : '#0f172a',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: lang === 'zh' ? '600' : '500',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            if (lang !== 'zh') e.target.style.background = '#e2e8f0';
          }}
          onMouseLeave={(e) => {
            if (lang !== 'zh') e.target.style.background = 'transparent';
          }}
        >
          <Globe size={14} />
          中文
        </button>
        <button
          onClick={() => setLang('en')}
          style={{
            background: lang === 'en' ? '#2563eb' : 'transparent',
            color: lang === 'en' ? '#fff' : '#0f172a',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: lang === 'en' ? '600' : '500',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            if (lang !== 'en') e.target.style.background = '#e2e8f0';
          }}
          onMouseLeave={(e) => {
            if (lang !== 'en') e.target.style.background = 'transparent';
          }}
        >
          <Globe size={14} />
          English
        </button>
      </div>
    </div>
  );
}
