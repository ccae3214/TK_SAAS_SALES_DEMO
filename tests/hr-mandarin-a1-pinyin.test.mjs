import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPinyinChecker, seedLessonLines } from '../src/lib/mandarin-pinyin-check.js';
import { MANDARIN_A1_TL } from '../src/data/tl-mandarin-a1.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const check = createPinyinChecker(JSON.parse(await read('../src/data/mandarin-char-readings.json')));
const seed = await read('../scripts/seed-mandarin-a1-course.sql');
const update = await read('../scripts/update-mandarin-a1-course.sql');
const rows = seedLessonLines(seed);
const codes = (zh, pinyin) => check(zh, pinyin).map(issue => issue.code);

test('A1 課程：每一行的拼音都逐字對得上（音節數、聲調、讀音、一／不變調、ü、隔音符號、大寫）', () => {
  assert.ok(rows.length > 1000, `只讀到 ${rows.length} 行`);
  const failures = rows.map(row => ({ row, issues: check(row.zh, row.pinyin) })).filter(item => item.issues.length);
  assert.deepEqual(failures.map(({ row, issues }) => `Unit ${row.position} ${row.field} #${row.index} ${row.zh} | ${row.pinyin} → ${issues.map(issue => issue.message).join('；')}`), []);
});

test('拼音檢查：正確的寫法不會被誤判', () => {
  for (const [zh, pinyin] of [
    ['你好', 'nǐ hǎo'], ['不是', 'bú shì'], ['不好', 'bù hǎo'], ['一次', 'yí cì'], ['一天', 'yì tiān'], ['一個', 'yí ge'],
    ['第一', 'dì-yī'], ['一一九', 'yī yī jiǔ'], ['十一', 'shíyī'], ['一百', 'yìbǎi'], ['看一看', 'kàn yi kàn'], ['好不好', 'hǎo bù hǎo'],
    ['對不起', 'duìbuqǐ'], ['謝謝', 'xièxie'], ['去', 'qù'], ['女兒', "nǚ'ér"], ['晚安', "wǎn'ān"], ['十二', "shí'èr"],
    ['垃圾', 'lèsè'], ['垃圾', 'lājī'], ['星期五', 'xīngqíwǔ'], ['我是菲律賓人。', 'Wǒ shì Fēilǜbīnrén.'], ['我去7-11。', 'Wǒ qù 7-11.'],
  ]) assert.deepEqual(codes(zh, pinyin), [], `${zh} ${pinyin}`);
});

test('拼音檢查：抓得出音節數、缺聲調、聲調符號不合法與讀音錯誤', () => {
  const cases = [
    ['你好', 'nǐ', 'SYLLABLE_COUNT'],
    ['你好嗎', 'nǐ hǎo ma ma', 'SYLLABLE_COUNT'],
    ['你好', 'ni hǎo', 'MISSING_TONE'],
    ['客氣', 'kèqi', 'MISSING_TONE'], // 台灣「客氣」不唸輕聲
    ['好', 'hăo', 'BAD_TONE_MARK'], // ă（短音符）不是三聲符號 ǎ
    ['好', 'haǒ', 'BAD_TONE_MARK'], // 聲調符號要標在 a 上
    ['老師', 'lǎo3shī', 'BAD_TONE_MARK'],
    ['喝', 'hēē', 'SYLLABLE_COUNT'],
    ['你好', 'ní hǎo', 'TONE'], // 三聲連讀照標原調
    ['女', 'nu', 'READING'],
    ['魚', 'xyz', 'INVALID_SYLLABLE'],
  ];
  for (const [zh, pinyin, code] of cases) assert.ok(codes(zh, pinyin).includes(code), `${zh} ${pinyin} 應該有 ${code}，實際：${codes(zh, pinyin)}`);
});

test('拼音檢查：一／不變調、ü、隔音符號、大寫與台灣讀音', () => {
  const cases = [
    ['不是', 'bù shì', 'SANDHI_BU'], ['不好', 'bú hǎo', 'SANDHI_BU'],
    ['一天', 'yí tiān', 'SANDHI_YI'], ['一次', 'yì cì', 'SANDHI_YI'], ['第一', 'dì-yí', 'SANDHI_YI'],
    ['去', 'qǜ', 'UMLAUT'], ['女', 'nv̌', 'UMLAUT'],
    ['晚安', 'wǎnān', 'APOSTROPHE'], ['十二', 'shíèr', 'APOSTROPHE'], ['棉被', "mián'bèi", 'APOSTROPHE'],
    ['我是台灣人。', 'wǒ shì Táiwānrén.', 'CAPITAL'], ['台灣', 'táiwān', 'CAPITAL'],
    ['星期', 'xīngqī', 'TAIWAN_READING'], ['危險', 'wēixiǎn', 'TAIWAN_READING'],
  ];
  for (const [zh, pinyin, code] of cases) assert.ok(codes(zh, pinyin).includes(code), `${zh} ${pinyin} 應該有 ${code}，實際：${codes(zh, pinyin)}`);
});

test('A1 課程：每一行英文說明都有 Filipino 翻譯（Filipino 介面顯示）', () => {
  const missing = rows.filter(row => !MANDARIN_A1_TL[row.en]).map(row => `Unit ${row.position} ${row.field} #${row.index}：${row.en}`);
  assert.deepEqual(missing, []);
});

test('A1 課程更新腳本：依單元位置更新、單元 ID 不變、不刪資料，內容與 seed 相同', () => {
  assert.match(update, /u\.position = v\.position/);
  assert.doesNotMatch(update, /DELETE FROM|TRUNCATE|DROP TABLE/i);
  assert.match(update, /BEGIN;[\s\S]*COMMIT;/);
  const valuesOf = sql => sql.split('\n').filter(line => /^\s+\(\d+, E'/.test(line)).map(line => line.trim().replace(/,$/, '').replace(/;$/, ''));
  assert.equal(valuesOf(update).length, 20);
  assert.deepEqual(valuesOf(update), valuesOf(seed));
});

test('A1 課程：English／Filipino 學習重點裡的中文都附拼音，拼音也通過檢查', async () => {
  const { TOPIC_PINYIN, chineseWithoutPinyin } = await import('../scripts/mandarin-a1/topic-pinyin.mjs');
  const topics = seed.split('\n').filter(line => /^\s+\(\d+, E'/.test(line)).map(line => [...line.matchAll(/E'((?:[^']|'')*)'/g)][3][1].replace(/''/g, "'"));
  assert.equal(topics.length, 20);
  const bare = topics.flatMap((text, i) => [text, MANDARIN_A1_TL[text] || ''].flatMap(t => chineseWithoutPinyin(t).map(run => `Unit ${i + 1}：${run}`)));
  assert.deepEqual(bare, []);
  assert.ok(topics.every(text => MANDARIN_A1_TL[text]), '每個單元的學習重點都要有 Filipino 版');
  const strip = text => text.replace(/…+/g, ' ').replace(/\s+/g, ' ').trim();
  const wrong = Object.entries(TOPIC_PINYIN).map(([zh, pinyin]) => [zh, pinyin, check(strip(zh).replace(/[。！？]$/, ''), strip(pinyin).replace(/^([a-zü])/, c => c).replace(/[.!?]$/, ''))]).filter(([, , issues]) => issues.length);
  assert.deepEqual(wrong.map(([zh, pinyin, issues]) => `${zh} | ${pinyin} → ${issues.map(issue => issue.message).join('；')}`), []);
});

test('Filipino／English 介面：網站自動翻譯不會改到課文的中文與拼音', async () => {
  const translations = await read('../src/lib/hr-translations.jsx');
  assert.match(translations, /closest\?\.\('\[translate="no"\]'\)/);
  assert.match(translations, /if \(isNoTranslate\(node\)\) return;/);
  const vocabulary = await read('../src/components/HrLessonVocabulary.jsx');
  assert.ok(vocabulary.includes('<td className={styles.zh} translate="no">{entry.zh}</td>'), '詞彙的中文欄要標 translate="no"（「是」不可變成 Oo）');
  assert.ok(vocabulary.includes('<td translate="no">{entry.pinyin}</td>'));
  const learning = await read('../src/components/HrWorkerLearning.jsx');
  assert.equal(learning.split('<div className={styles.lineText} translate="no">').length - 1, 2, '例句與對話都要標 translate="no"');
  assert.ok(learning.includes('<p translate="no">{topics}</p>'));
});
