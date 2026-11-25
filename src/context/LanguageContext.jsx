/* eslint-disable react-refresh/only-export-components */
"use client";
import React, { useState, createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { translations as baseTranslations } from '../data/translations.js';
import { htmlLangFor, isSupportedLanguage, mapLeaves, tlText } from '../lib/language.js';

// 菲律賓語（tl）：以英文版為基礎，逐句查 TL_DICTIONARY；查不到的句子維持英文。
const translations = { ...baseTranslations, tl: mapLeaves(baseTranslations.en, tlText) };

const defaultTranslation = translations?.['zh'] || {};

const LanguageContext = createContext({
  lang: 'zh',
  setLang: () => {},
  t: defaultTranslation
});

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('zh');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 从 localStorage 读取语言设置
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('language') : null;
    if (isSupportedLanguage(savedLang)) {
      setLang(savedLang);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = htmlLangFor(lang);
  }, [lang]);

  const handleSetLang = useCallback((newLang, { persist = true } = {}) => {
    if (!isSupportedLanguage(newLang)) return;
    setLang(newLang);
    if (persist && typeof window !== 'undefined') {
      localStorage.setItem('language', newLang);
    }
  }, []);

  // 「依 LINE 語言同步一次」會用這個事件通知這裡切換語言（見 components/LineLanguageSync.jsx）。
  useEffect(() => {
    const onSetLanguage = (event) => {
      const next = event?.detail;
      if (isSupportedLanguage(next)) handleSetLang(next);
    };
    window.addEventListener('kolecion:set-language', onSetLanguage);
    return () => window.removeEventListener('kolecion:set-language', onSetLanguage);
  }, [handleSetLang]);

  const t = translations[lang] || translations['zh'];
  const value = useMemo(() => ({ lang, setLang: handleSetLang, t }), [lang, handleSetLang, t]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  return context || { lang: 'zh', setLang: () => {}, t: translations['zh'] };
};
