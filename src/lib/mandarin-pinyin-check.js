// 中文課程拼音檢查：逐字比對「中文 | 拼音」，給 scripts/check-mandarin-pinyin.mjs 與測試共用。
//
// 標注規則（中文 A1 課程，詳見 docs/MANDARIN_A1_REDESIGN.md）：
// - 依《漢語拼音正詞法基本規則》：以詞連寫、句首大寫、聲調符號標在主要母音上、輕聲不標。
// - 讀音以台灣教育部《國語辭典》為主（TAIWAN_READINGS 補上 pypinyin 沒收的台灣讀音）。
// - 三聲＋三聲：照標原調（nǐ hǎo），不標變調。
// - 「不」「一」：標實際讀音（語音教學依需要標變調），本檢查依下一個字的聲調驗證。
// - 輕聲只允許 NEUTRAL_CHARS、NEUTRAL_WORDS 與重疊字的第二個字。
//
// 用法：const check = createPinyinChecker(readingsJson); check(zh, pinyin) → [{ code, message }]

const TONE_OF_MARK = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
const MARK_OF_TONE = { 1: '̄', 2: '́', 3: '̌', 4: '̀' };
const UMLAUT = '̈';
const HANZI = /[㐀-䶿一-鿿]/u;
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ü']);

// 台灣讀音（教育部《國語辭典》或台灣常見讀音），pypinyin 沒收或不是第一讀音的補在這裡。
export const TAIWAN_READINGS = {
  期: ['qí'], 垃: ['lè'], 圾: ['sè'], 和: ['hàn'], 危: ['wéi'], 微: ['wéi'], 液: ['yì'], 息: ['xí'],
  企: ['qì'], 亞: ['yǎ'], 髮: ['fǎ'], 誰: ['shéi'], 熄: ['xí'], 夕: ['xì'], 擊: ['jí'], 質: ['zhí'],
  跌: ['dié'], 嬤: ['mà'], 研: ['yán'], 癌: ['yán'], 暴: ['pù'],
};

// 台灣讀音註記：課程出現這些詞時，報告會列出來提醒老師講解。
export const TAIWAN_NOTES = {
  垃圾: '台灣標準讀音 lèsè，口語也常說 lājī',
  星期: '台灣讀 xīngqí（大陸 xīngqī），口語也說「禮拜」lǐbài',
  和: '連接詞「和」台灣口語常讀 hàn，也可讀 hé',
  危險: '台灣讀 wéixiǎn（大陸 wēixiǎn）',
  微波: '台灣讀 wéibō（大陸 wēibō）',
  血: '台灣口語常讀 xiě（流血 liúxiě、血壓 xiěyā），字典讀音也有 xuè',
  休息: '台灣讀 xiūxí（大陸 xiūxi）',
  訊息: '台灣讀 xùnxí（大陸 xùnxī）',
  品質: '台灣讀 pǐnzhí（大陸 pǐnzhì）',
  跌倒: '台灣讀 diédǎo（大陸 diēdǎo）',
  誰: '台灣多讀 shéi，也可讀 shuí',
  阿嬤: '台灣用語，讀 āmà（來自台語「阿媽」）',
  乳液: '台灣讀 rǔyì（大陸 rǔyè）',
  多少: '台灣讀 duōshǎo，不唸輕聲（大陸 duōshao）',
  頭髮: '台灣讀 tóufǎ（大陸 tóufa）',
};

// 一定要用台灣讀音的詞：課程出現時，拼音要是其中一種寫法（不分大小寫、不管空格）。
export const TAIWAN_FORMS = {
  星期: ['xīngqí'], 垃圾: ['lèsè', 'lājī'], 危險: ['wéixiǎn'], 微波: ['wéibō'], 休息: ['xiūxí'], 訊息: ['xùnxí'],
  品質: ['pǐnzhí'], 跌倒: ['diédǎo'], 頭髮: ['tóufǎ'], 乳液: ['rǔyì'], 多少: ['duōshǎo'],
};

// 一定可以唸輕聲的字（台灣也唸輕聲）。
export const NEUTRAL_CHARS = new Set([...'的了嗎呢吧啊呀著過們麼個子得']);
// 台灣也唸輕聲的固定詞（第二個字輕聲）。
// 台灣也唸輕聲的固定詞（最後一個字輕聲）。其他詞台灣照標聲調，例如 喜歡 xǐhuān、客氣 kèqì、朋友 péngyǒu、衣服 yīfú。
export const NEUTRAL_WORDS = new Set(['東西', '名字', '意思', '耳朵', '骨頭', '舌頭', '石頭', '枕頭', '饅頭', '外頭', '裡頭', '蘿蔔']);

// 專有名詞一定要大寫。
export const PROPER_NOUNS = { 台灣: 'Táiwān', 臺灣: 'Táiwān', 菲律賓: 'Fēilǜbīn', 台北: 'Táiběi', 臺北: 'Táiběi', 馬尼拉: 'Mǎnílā' };

const NUMERALS = new Set([...'零〇一二三四五六七八九十百千萬兩']);
const DIGITS = new Set([...'零〇一二三四五六七八九十']);
const YI_AFTER = new Set([...'第']);
const YI_ORDINAL_NEXT = new Set([...'月號樓']);

function parseReading(text) {
  const letters = [];
  let tone = 0;
  for (const ch of text.normalize('NFD').toLowerCase()) {
    if (TONE_OF_MARK[ch]) tone = TONE_OF_MARK[ch];
    else if (ch === UMLAUT) letters[letters.length - 1] = 'ü';
    else letters.push(ch);
  }
  return { base: letters.join(''), tone };
}

export const formatSyllable = (base, tone) => {
  if (!tone) return base;
  const index = toneIndex(base);
  if (index < 0) return base;
  const chars = [...base];
  chars[index] = (chars[index] === 'ü' ? 'ü' : chars[index]) + MARK_OF_TONE[tone];
  return chars.join('').normalize('NFC');
};

// 聲調符號應該標在哪個字母：有 a 標 a；沒有 a 有 e 標 e；ou 標 o；其他標最後一個母音（iu 標 u、ui 標 i）。
export function toneIndex(base) {
  const chars = [...base];
  if (chars.includes('a')) return chars.indexOf('a');
  if (chars.includes('e')) return chars.indexOf('e');
  if (base.includes('ou')) return chars.indexOf('o');
  for (let i = chars.length - 1; i >= 0; i -= 1) if (VOWELS.has(chars[i])) return i;
  return -1;
}

// 把一個拼音詞（不含空白）拆成字母：{ letter, tone, upper, badMark }。
function lettersOf(word) {
  const out = [];
  for (const ch of word.normalize('NFD')) {
    if (TONE_OF_MARK[ch]) {
      const last = out[out.length - 1];
      if (!last || !VOWELS.has(last.letter)) out.push({ letter: '', badMark: ch });
      else if (last.tone) last.doubleTone = true;
      else last.tone = TONE_OF_MARK[ch];
    } else if (ch === UMLAUT) {
      const last = out[out.length - 1];
      if (last && last.letter === 'u' && !last.tone) last.letter = 'ü';
      else out.push({ letter: '', badMark: ch });
    } else if (/\p{M}/u.test(ch)) {
      out.push({ letter: '', badMark: ch });
    } else {
      out.push({ letter: ch.toLowerCase(), upper: ch !== ch.toLowerCase(), raw: ch });
    }
  }
  return out;
}

export function createPinyinChecker(readingsJson) {
  const syllables = new Set(readingsJson.syllables);
  const readings = {};
  for (const [ch, value] of Object.entries(readingsJson.chars)) readings[ch] = value.split(',').map(parseReading);
  for (const [ch, list] of Object.entries(TAIWAN_READINGS)) readings[ch] = [...(readings[ch] || []), ...list.map(parseReading)];

  // 把一段字母切成音節。allowVowelStart=false 時，第二個以後的音節不能以 a/o/e 開頭（那要用隔音符號）。
  function segment(letters, allowVowelStart) {
    const text = letters.map(item => item.letter).join('');
    const n = letters.length;
    const memo = new Map();
    const walk = start => {
      if (start === n) return [];
      if (memo.has(start)) return memo.get(start);
      let result = null;
      for (let end = Math.min(n, start + 6); end > start; end -= 1) {
        const base = text.slice(start, end);
        if (!syllables.has(base)) continue;
        if (start > 0 && !allowVowelStart && /^[aoe]/.test(base)) continue;
        const rest = walk(end);
        if (rest) { result = [{ start, end, base }, ...rest]; break; }
      }
      memo.set(start, result);
      return result;
    };
    return walk(0);
  }

  // 解析整行拼音 → 音節清單（含所在的詞、位置）與格式問題。
  function parseLine(pinyin, issues, vowelStart = false) {
    const result = [];
    const words = pinyin.normalize('NFC').split(/[\s,.!?;:，。！？、；：「」『』“”"()（）…—]+/u).filter(Boolean);
    words.forEach((word, wordIndex) => {
      if (/\d/.test(word)) { issues.push({ code: 'BAD_TONE_MARK', message: `拼音不可用數字標調或混入數字：${word}` }); return; }
      if (/v/i.test(word)) issues.push({ code: 'UMLAUT', message: `ü 不要寫成 v：${word}` });
      const wordSyllables = [];
      for (const part of word.split('-')) {
        part.split(/['’]/).forEach((piece, pieceIndex) => {
          if (piece) wordSyllables.push(...parsePiece(piece, pieceIndex, word, wordIndex, issues, vowelStart));
        });
      }
      wordSyllables.forEach((syllable, index) => { syllable.wordFinal = index === wordSyllables.length - 1; });
      result.push(...wordSyllables);
    });
    return result;
  }

  // 一段（以 - 或 ' 分開的）拼音 → 音節清單；有問題就記到 issues，拆不出音節時回傳空陣列。
  function parsePiece(piece, pieceIndex, word, wordIndex, issues, vowelStart) {
    const letters = lettersOf(piece);
    reportMarkIssues(letters, word, issues);
    const clean = letters.filter(item => item.letter);
    if (clean.some(item => !/^[a-zü]$/.test(item.letter))) {
      issues.push({ code: 'BAD_TONE_MARK', message: `拼音含有不合法的字元：${word}` });
      return [];
    }
    if (pieceIndex > 0 && !/^[aoe]/.test(clean[0]?.letter || '')) issues.push({ code: 'APOSTROPHE', message: `隔音符號 ' 只用在 a、o、e 開頭的音節前：${word}` });
    const segs = segmentPiece(clean, word, issues, vowelStart);
    return segs ? segs.map(seg => toSyllable(seg, clean.slice(seg.start, seg.end), word, wordIndex, issues)) : [];
  }

  function reportMarkIssues(letters, word, issues) {
    for (const item of letters) {
      if (item.badMark) issues.push({ code: 'BAD_TONE_MARK', message: `聲調符號不合法（${JSON.stringify(item.badMark)}）：${word}` });
      if (item.doubleTone) issues.push({ code: 'BAD_TONE_MARK', message: `同一個字母標了兩個聲調：${word}` });
    }
  }

  // 照規則切音節；切不出來再試「a、o、e 開頭也可接在後面」（代表少了隔音符號）。都失敗回傳 null。
  function segmentPiece(clean, word, issues, vowelStart) {
    const segs = segment(clean, vowelStart);
    if (segs) return segs;
    const relaxed = segment(clean, true);
    if (relaxed) {
      issues.push({ code: 'APOSTROPHE', message: `缺隔音符號 '（a、o、e 開頭的音節接在後面要加 '）：${word}` });
      return relaxed;
    }
    const text = clean.map(item => item.letter).join('');
    if (/[jqxy]ü/.test(text)) issues.push({ code: 'UMLAUT', message: `j、q、x、y 後面寫 u，不寫 ü：${word}` });
    else issues.push({ code: 'INVALID_SYLLABLE', message: `拆不出合法的普通話音節：${word}` });
    return null;
  }

  // 一個音節：檢查聲調符號數量與位置。
  function toSyllable(seg, own, word, wordIndex, issues) {
    const toned = own.map((item, index) => ({ ...item, index })).filter(item => item.tone);
    if (toned.length > 1) issues.push({ code: 'BAD_TONE_MARK', message: `一個音節只能有一個聲調符號：${word}` });
    const tone = toned[0]?.tone || 0;
    const expectedIndex = toneIndex(seg.base);
    if (tone && expectedIndex >= 0 && toned[0].index !== expectedIndex) {
      issues.push({ code: 'BAD_TONE_MARK', message: `聲調符號位置不對：${word} 裡的 ${seg.base} 應寫成 ${formatSyllable(seg.base, tone)}` });
    }
    return { base: seg.base, tone, upper: own[0]?.upper, word, wordIndex };
  }

  // 先照正常規則切音節；切出來讀音對不上時，再試「a、o、e 開頭的音節也可以接在後面」，
  // 如果這樣錯誤比較少，代表是少了隔音符號（例如 wǎnān 應寫 wǎn'ān）。
  return function check(zhText, pinyinText) {
    const first = analyze(zhText, pinyinText, false);
    if (!first.some(issue => ['READING', 'TONE', 'MISSING_TONE', 'SYLLABLE_COUNT'].includes(issue.code))) return first;
    const second = analyze(zhText, pinyinText, true);
    if (second.length >= first.length) return first;
    return [...second, { code: 'APOSTROPHE', message: "缺隔音符號 '（a、o、e 開頭的音節接在別的音節後面要加 '，例如 wǎn'ān）" }];
  };

  function analyze(zhText, pinyinText, vowelStart) {
    const issues = [];
    const zh = String(zhText || '').replace(/^[A-Za-z]\s*[：:]\s*/, '');
    let pinyin = String(pinyinText || '').normalize('NFC');
    // 中文欄裡的英文字母／數字（7-11、ATM、Wi-Fi）在拼音欄照抄，不算音節。
    for (const token of zh.match(/[A-Za-z0-9][A-Za-z0-9.\-]*/g) || []) pinyin = pinyin.replace(token, ' ');
    const hanzi = [...zh].filter(ch => HANZI.test(ch));
    const syls = parseLine(pinyin, issues, vowelStart);
    if (syls.length !== hanzi.length) {
      issues.push({ code: 'SYLLABLE_COUNT', message: `音節數 ${syls.length} 和漢字數 ${hanzi.length} 不一致` });
      return issues;
    }
    // 句首大寫；專有名詞大寫。
    if (/[。！？]$/.test(zh.trim()) && syls[0] && !syls[0].upper) issues.push({ code: 'CAPITAL', message: '句子開頭的拼音要大寫' });
    const compact = pinyin.toLowerCase().replace(/[^\p{L}']/gu, '');
    for (const [word, forms] of Object.entries(TAIWAN_FORMS)) if (zh.includes(word) && !forms.some(form => compact.includes(form))) issues.push({ code: 'TAIWAN_READING', message: `「${word}」要用台灣讀音：${forms.join(' 或 ')}` });
    for (const [name, form] of Object.entries(PROPER_NOUNS)) if (zh.includes(name) && !pinyin.includes(form)) issues.push({ code: 'CAPITAL', message: `專有名詞「${name}」要寫成 ${form}` });

    const nextTone = i => {
      const next = syls[i + 1];
      if (!next) return null;
      if (next.tone) return next.tone;
      const options = readings[hanzi[i + 1]] || [];
      return options.find(option => option.base === next.base && option.tone)?.tone || 4;
    };

    const sandhiBase = ch => (ch === '不' ? 'bu' : 'yi');
    // 「一」單用、詞尾、接在數字或「第」後、或後面接數字／序數 → 一聲。
    const yiIsFirstTone = (i, syl, prev, next) => !next
      || (syl.wordFinal && syls[i - 1]?.wordIndex === syl.wordIndex)
      || NUMERALS.has(prev) || YI_AFTER.has(prev) || DIGITS.has(next) || YI_ORDINAL_NEXT.has(next);
    const expectedSandhiTone = (ch, i, syl, prev, next) => {
      if (ch === '一' && yiIsFirstTone(i, syl, prev, next)) return 1;
      return nextTone(i) === 4 ? 2 : 4;
    };

    // 「不」「一」的變調。
    const checkBuYi = (ch, i, syl, shown) => {
      const prev = hanzi[i - 1], next = hanzi[i + 1];
      if (syl.base !== sandhiBase(ch)) { issues.push({ code: 'READING', message: `「${ch}」讀音不對：${shown}` }); return; }
      if (!syl.tone) {
        const sameWord = syls[i + 1] && syls[i + 1].wordIndex === syl.wordIndex && syls[i - 1]?.wordIndex === syl.wordIndex;
        if ((prev && prev === next) || (ch === '不' && sameWord)) return; // 看一看、好不好、對不起
        issues.push({ code: 'MISSING_TONE', message: `「${ch}」缺聲調：${shown}` });
        return;
      }
      const expected = expectedSandhiTone(ch, i, syl, prev, next);
      if (syl.tone === expected) return;
      const [code, rule] = ch === '不'
        ? ['SANDHI_BU', '「不」在四聲前標 bú，其他標 bù']
        : ['SANDHI_YI', '「一」單用、詞尾、數字或序數標 yī；在四聲前標 yí；在一、二、三聲前標 yì'];
      issues.push({ code, message: `「${ch}${next || ''}」應標 ${formatSyllable(syl.base, expected)}，不是 ${shown}（${rule}）` });
    };

    // 沒標聲調時，是否可以讀輕聲。
    const neutralAllowed = (ch, i, sameBase) => {
      const prev = hanzi[i - 1];
      return NEUTRAL_CHARS.has(ch) || ch === prev || NEUTRAL_WORDS.has(`${prev}${ch}`)
        || NEUTRAL_WORDS.has(`${hanzi[i - 2]}${prev}${ch}`) || sameBase.some(option => !option.tone);
    };

    // 一般字：對字音表檢查讀音與聲調。
    const checkReading = (ch, i, syl, shown) => {
      const options = readings[ch];
      if (!options) { issues.push({ code: 'UNKNOWN_CHAR', message: `字音表沒有「${ch}」，請執行 python scripts/generate-mandarin-char-readings.py` }); return; }
      const sameBase = options.filter(option => option.base === syl.base);
      const list = (items, sep) => items.map(o => formatSyllable(o.base, o.tone)).join(sep);
      if (!sameBase.length) {
        issues.push({ code: 'READING', message: `「${ch}」讀音不對：${shown}（字典：${list(options, '、')}）` });
        return;
      }
      if (!syl.tone) {
        if (!neutralAllowed(ch, i, sameBase)) issues.push({ code: 'MISSING_TONE', message: `「${ch}」缺聲調：${shown}（不是輕聲字，應標 ${list(sameBase.filter(o => o.tone), ' 或 ')}）` });
        return;
      }
      if (!sameBase.some(option => option.tone === syl.tone)) {
        issues.push({ code: 'TONE', message: `「${ch}」聲調不對：${shown}（字典：${list(sameBase, '、')}）` });
      }
    };

    hanzi.forEach((ch, i) => {
      const syl = syls[i];
      const shown = formatSyllable(syl.base, syl.tone);
      if (ch === '不' || ch === '一') checkBuYi(ch, i, syl, shown);
      else checkReading(ch, i, syl, shown);
    });
    return issues;
  }
}

// 從 seed SQL 取出每個單元的「中文 | 拼音 | 英文」行（examples、vocabulary、dialogue 三個欄位）。
export function seedLessonLines(sql) {
  const fields = ['examples', 'vocabulary', 'dialogue'];
  const rows = [];
  for (const line of String(sql).split('\n')) {
    if (!/^\s+\(\d+, E'/.test(line)) continue;
    const tokens = [...line.matchAll(/E'((?:[^']|'')*)'|(\d+)/g)].map(match => match[2] !== undefined ? Number(match[2]) : match[1].replace(/''/g, "'"));
    const [position, name] = tokens;
    fields.forEach((field, k) => {
      String(tokens[6 + k] || '').split('\\n').forEach((text, index) => {
        const [zh = '', pinyin = '', en = ''] = text.split(' | ');
        if (zh) rows.push({ position, unit: name, field, index: index + 1, zh, pinyin, en });
      });
    });
  }
  return rows;
}
