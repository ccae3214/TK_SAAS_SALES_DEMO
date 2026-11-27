"use client";

import { useEffect, useState } from 'react';

// 課文的 Filipino 說明：介面語言是 Filipino（tl）時才載入中文 A1 課程的 English → Filipino 對照（檔案較大，不放進其他頁面）。
// 回傳 lessonTl(english)：查得到就回傳 Filipino，查不到回傳空字串（畫面照舊只顯示英文）。
export function useLessonTl(lang) {
  const [dictionary, setDictionary] = useState(null);
  useEffect(() => {
    if (lang !== 'tl' || dictionary) return undefined;
    let cancelled = false;
    import('@/data/tl-mandarin-a1').then(module => { if (!cancelled) setDictionary(module.MANDARIN_A1_TL); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lang, dictionary]);
  return english => (lang === 'tl' && dictionary && typeof english === 'string' ? dictionary[english.trim()] || '' : '');
}
