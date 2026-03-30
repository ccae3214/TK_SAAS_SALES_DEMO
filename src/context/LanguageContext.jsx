/* eslint-disable react-refresh/only-export-components */
"use client";
import React, { useState, createContext, useContext } from 'react';
import { translations } from '../data/translations.js';

const LanguageContext = createContext({
  lang: 'zh',
  setLang: () => {},
  t: translations['zh']
});

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('zh');
  const t = translations[lang] || translations['zh'];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
