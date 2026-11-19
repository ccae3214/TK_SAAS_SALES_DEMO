// 學習頁的語音朗讀共用工具（瀏覽器內建 Web Speech API，不需要後端或金鑰）。
// 這裡只放不依賴 React／瀏覽器的純函式，方便用 node 測試。

export const SPEECH_LANG = { zh: 'zh-TW', en: 'en-US' };
export const SPEECH_RATES = { normal: 1, slow: 0.75 };

// 朗讀控制列的中英文字。學習頁依網站語言切換（見 HrWorkerLearning）。
export const SPEECH_TEXT = {
  zh: {
    listen: '發音',
    playZh: '播放中文發音',
    playEn: '播放英文發音',
    playUnit: '朗讀整個單元',
    stop: '停止朗讀',
    includeEnglish: '同時朗讀英文意思',
    speed: '朗讀速度',
    speedNormal: '正常速度',
    speedSlow: '慢速',
    unsupported: '這個瀏覽器不支援語音朗讀。',
    noChineseVoice: '這個裝置沒有安裝中文語音，朗讀可能無法使用。請在裝置的語音設定中安裝中文語音，或改用其他瀏覽器。',
    failed: '無法朗讀這段內容，請稍後再試。',
  },
  en: {
    listen: 'Listen',
    playZh: 'Play Chinese pronunciation',
    playEn: 'Play English pronunciation',
    playUnit: 'Read the whole unit aloud',
    stop: 'Stop reading',
    includeEnglish: 'Also read the English meanings',
    speed: 'Reading speed',
    speedNormal: 'Normal speed',
    speedSlow: 'Slow',
    unsupported: 'This browser does not support text-to-speech.',
    noChineseVoice: 'No Chinese voice is installed on this device, so reading aloud may not work. Install a Chinese voice in your device\'s speech settings, or try another browser.',
    failed: 'Unable to read this aloud. Please try again later.',
  },
};

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

export function cleanSpeechText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

const normalizeLang = voice => String(voice?.lang || '').toLowerCase().replace(/_/g, '-');

// 依語言挑語音：優先完全相同（zh-TW），其次同語系（zh-CN 的普通話也可以）。
// 中文不選粵語（zh-HK、yue），否則課程的普通話會唸成廣東話。
export function pickVoice(voices, lang) {
  const want = String(lang || '').toLowerCase().replace(/_/g, '-');
  if (!want || !Array.isArray(voices) || !voices.length) return null;
  const base = want.split('-')[0];
  const usable = voices.filter(voice => !(base === 'zh' && /^(zh-hk|zh-yue|yue)/.test(normalizeLang(voice))));
  return usable.find(voice => normalizeLang(voice) === want)
    || usable.find(voice => normalizeLang(voice).split('-')[0] === base)
    || null;
}

// 一列課文（詞彙／例句／對話）要唸的項目。part：'zh' 只唸中文、'en' 只唸英文、'both' 中文後接英文。
export function rowSpeechItems(section, index, row, part = 'zh') {
  const rowKey = `${section}-${index}`;
  const items = [];
  const zh = cleanSpeechText(row?.zh);
  // 多義字：各個意思依序唸（「am / is / are」的斜線改成逗號，避免唸出 slash）。
  const enSource = Array.isArray(row?.senses) && row.senses.length ? row.senses.join('. ') : row?.en;
  const en = cleanSpeechText(enSource).replace(/\s*\/\s*/g, ', ');
  if (zh && (part === 'zh' || part === 'both')) items.push({ rowKey, text: zh, lang: SPEECH_LANG.zh });
  if (en && (part === 'en' || part === 'both')) items.push({ rowKey, text: en, lang: SPEECH_LANG.en });
  return items;
}

// 整個單元依序朗讀：詞彙 → 例句 → 對話（講話者的 A／B 不唸，學習重點是說明文字也不唸）。
export function buildUnitSpeechQueue({ vocabulary = [], examples = [], dialogue = [] } = {}, { includeEnglish = true } = {}) {
  const part = includeEnglish ? 'both' : 'zh';
  // 詞彙後面接著唸它的造句（rowKey：vocabulary-{詞彙序}-ex-{造句序}）。
  const vocabularyItems = vocabulary.flatMap((row, index) => [
    ...rowSpeechItems('vocabulary', index, row, part),
    ...(row?.examples || []).flatMap((example, exampleIndex) => rowSpeechItems(`vocabulary-${index}-ex`, exampleIndex, example, part)),
  ]);
  return [
    ...vocabularyItems,
    ...examples.flatMap((row, index) => rowSpeechItems('examples', index, row, part)),
    ...dialogue.flatMap((row, index) => rowSpeechItems('dialogue', index, row, part)),
  ];
}
