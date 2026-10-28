/* eslint-disable react-refresh/only-export-components */
"use client";
import React, { useState, createContext, useContext, useEffect } from 'react';
import { translations } from '../data/translations.js';

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
    if (savedLang && (savedLang === 'en' || savedLang === 'zh')) {
      setLang(savedLang);
    }
    setMounted(true);
  }, []);

  const handleSetLang = (newLang) => {
    setLang(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', newLang);
    }
  };

  const t = translations[lang] || translations['zh'];

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  return context || { lang: 'zh', setLang: () => {}, t: translations['zh'] };
};
