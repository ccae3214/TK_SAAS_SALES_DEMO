// 詞彙的「多義字」與「造句」。資料仍存在原本的詞彙欄位（每行一個詞），不需要改資料庫：
//
//   中文 | 拼音 | 意思1；意思2；意思3 | [意思編號] 例句中文 ＝ 例句拼音 ＝ 例句英文 | …
//
// 例：是 | shì | am / is / are；to be；yes, true | [1] 我是男生。＝ Wǒ shì nánshēng. ＝ I am a boy.
//
// - 英文欄位用「；」分隔多個意思（一個意思內的同義詞用 / 或逗號）。
// - 第 4 欄以後每一欄是一個例句：中文 ＝ 拼音 ＝ 英文（拼音可省略：中文 ＝ 英文）。
// - 例句最前面可用 [2] 標示這句是在示範第幾個意思，沒標就是整個詞的例句。
// - 舊格式（只有 中文 | 拼音 | 英文）完全不受影響；舊的 parseLessonLines 只讀前 3 欄，所以測驗等舊功能照常運作。

export const LESSON_TEXT = {
  zh: { multiMeaning: count => `多義字・${count} 個意思`, examples: '造句' },
  en: { multiMeaning: count => `${count} meanings`, examples: 'Example sentences' },
};

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
export const senseMark = number => CIRCLED[Number(number) - 1] || `(${number})`;

const SENSE_TAG = /^[[［]\s*(\d{1,2})\s*[\]］]\s*/;

export function parseSenses(text) {
  return String(text || '').split(/\s*[；;]\s*/).map(part => part.trim()).filter(Boolean);
}

export function parseExample(field) {
  let body = String(field || '').trim();
  let sense = 0;
  const tag = SENSE_TAG.exec(body);
  if (tag) { sense = Number(tag[1]); body = body.slice(tag[0].length); }
  const parts = body.split(/\s*[＝=]\s*/).map(part => part.trim());
  const zh = parts[0] || '';
  if (!zh) return null;
  if (parts.length >= 3) return { zh, pinyin: parts[1], en: parts.slice(2).join(' = '), sense };
  return { zh, pinyin: '', en: parts[1] || '', sense };
}

// 回傳 [{ zh, pinyin, en, senses, examples }]。en 保留原字串（含「；」），senses 是拆開後的意思。
export function parseVocabularyEntries(text) {
  return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [zh = '', pinyin = '', en = '', ...extra] = line.split(/\s*[|｜]\s*/);
    return { zh, pinyin, en, senses: parseSenses(en), examples: extra.map(parseExample).filter(Boolean) };
  });
}
