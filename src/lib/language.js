import { TL_DICTIONARY } from '../data/tl-dictionary.js';

// 網站支援的語言。'tl' 與 LINE 機器人、資料庫（preferred_language）使用同一個代碼，代表菲律賓語（Filipino）。
export const LANGUAGES = [
  { code: 'zh', label: '中文', short: '中文', htmlLang: 'zh-Hant' },
  { code: 'en', label: 'English', short: 'EN', htmlLang: 'en' },
  { code: 'tl', label: 'Filipino', short: 'FIL', htmlLang: 'fil' },
];
export const isSupportedLanguage = value => value === 'zh' || value === 'en' || value === 'tl';
export const normalizeLanguage = value => (isSupportedLanguage(value) ? value : 'zh');
export const htmlLangFor = lang => LANGUAGES.find(item => item.code === lang)?.htmlLang || 'zh-Hant';
export const localeFor = lang => (lang === 'tl' ? 'fil-PH' : lang === 'en' ? 'en-US' : 'zh-TW');
// 沒有專屬翻譯時，非中文語言一律退回英文。
export const isEnglishLike = lang => lang !== 'zh';

// 英文 → 菲律賓語。找不到就回傳原英文；保留前後空白。
export function tlText(english) {
  if (typeof english !== 'string') return english;
  const trimmed = english.trim();
  const translated = Object.prototype.hasOwnProperty.call(TL_DICTIONARY, trimmed) ? TL_DICTIONARY[trimmed] : undefined;
  if (!translated) return english;
  const leading = english.match(/^\s*/)?.[0] || '';
  const trailing = english.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

// 依語言挑文字：pick(lang, '中文', 'English')。菲律賓語由英文查字典，查不到就用英文。
export function pick(lang, zh, en, tl) {
  if (lang === 'zh') return zh;
  if (lang === 'tl') return tl !== undefined ? tl : tlText(en);
  return en;
}

// 把物件樹裡所有字串（含陣列）套用 fn；函式、數字等原樣保留。
export function mapLeaves(node, fn) {
  if (typeof node === 'string') return fn(node);
  if (Array.isArray(node)) return node.map(item => mapLeaves(item, fn));
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, mapLeaves(value, fn)]));
  return node;
}

// 取得多語文案：COPY[lang] 優先；菲律賓語用 COPY.en 逐句查字典（結果會快取）。
const COPY_CACHE = new WeakMap();
export function copyFor(copy, lang) {
  if (!copy) return copy;
  if (copy[lang]) return copy[lang];
  if (lang === 'tl' && copy.en) {
    if (!COPY_CACHE.has(copy)) COPY_CACHE.set(copy, mapLeaves(copy.en, tlText));
    return COPY_CACHE.get(copy);
  }
  return copy.en || copy.zh;
}

// pick 的別名：避免和元件裡自己取名為 pick 的函式衝突。
export const pickLang = pick;

// 依序切換 zh → en → tl → zh（給只有一顆按鈕的地方用）。
export const nextLanguage = lang => {
  const index = LANGUAGES.findIndex(item => item.code === lang);
  return LANGUAGES[(index + 1) % LANGUAGES.length].code;
};
