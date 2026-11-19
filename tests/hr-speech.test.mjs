import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseLessonLines } from '../src/lib/hr-learning.js';
import { SPEECH_LANG, SPEECH_TEXT, buildUnitSpeechQueue, cleanSpeechText, pickVoice, rowSpeechItems, speechSupported } from '../src/lib/hr-speech.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('挑語音：優先 zh-TW，其次其他普通話，不選粵語', () => {
  const voices = [{ lang: 'en-US', name: 'A' }, { lang: 'zh-HK', name: 'B' }, { lang: 'zh_CN', name: 'C' }, { lang: 'zh-TW', name: 'D' }];
  assert.equal(pickVoice(voices, 'zh-TW').name, 'D');
  assert.equal(pickVoice(voices.filter(v => v.name !== 'D'), 'zh-TW').name, 'C');
  assert.equal(pickVoice([{ lang: 'zh-HK' }, { lang: 'yue-Hant-HK' }], 'zh-TW'), null);
  assert.equal(pickVoice([{ lang: 'en-GB', name: 'G' }], 'en-US').name, 'G');
  assert.equal(pickVoice([], 'zh-TW'), null);
  assert.equal(pickVoice(undefined, 'zh-TW'), null);
});

test('一列課文：可只唸中文、只唸英文或兩者；空白與缺少的欄位會略過', () => {
  const row = { zh: ' 你好 ', pinyin: 'Nǐ hǎo', en: 'Hello ' };
  assert.deepEqual(rowSpeechItems('vocabulary', 2, row), [{ rowKey: 'vocabulary-2', text: '你好', lang: 'zh-TW' }]);
  assert.deepEqual(rowSpeechItems('vocabulary', 2, row, 'en'), [{ rowKey: 'vocabulary-2', text: 'Hello', lang: 'en-US' }]);
  assert.deepEqual(rowSpeechItems('dialogue', 0, row, 'both').map(i => i.lang), ['zh-TW', 'en-US']);
  assert.deepEqual(rowSpeechItems('dialogue', 0, { zh: '謝謝', en: '' }, 'both').length, 1);
  assert.deepEqual(rowSpeechItems('dialogue', 0, { zh: '', en: '' }, 'both'), []);
  assert.deepEqual(rowSpeechItems('dialogue', 0, null), []);
  assert.equal(cleanSpeechText('  a \n b  '), 'a b');
  assert.equal(cleanSpeechText(null), '');
});

test('整個單元朗讀順序：詞彙 → 例句 → 對話，不唸講話者 A／B 與拼音', () => {
  const sections = {
    vocabulary: parseLessonLines('你好 | Nǐ hǎo | Hello\n謝謝 | Xièxie | Thank you'),
    examples: parseLessonLines('我是工人。 | Wǒ shì gōngrén. | I am a worker.'),
    dialogue: parseLessonLines('A：你好！ | Nǐ hǎo! | Hello!\nB：你好嗎？ | Nǐ hǎo ma? | How are you?', { speaker: true }),
  };
  const withEnglish = buildUnitSpeechQueue(sections, { includeEnglish: true });
  assert.deepEqual(withEnglish.map(i => i.text), ['你好', 'Hello', '謝謝', 'Thank you', '我是工人。', 'I am a worker.', '你好！', 'Hello!', '你好嗎？', 'How are you?']);
  assert.deepEqual(withEnglish.map(i => i.rowKey).slice(0, 3), ['vocabulary-0', 'vocabulary-0', 'vocabulary-1']);
  assert.ok(withEnglish.every(i => !/Nǐ|^A$|^B$/.test(i.text)));
  const zhOnly = buildUnitSpeechQueue(sections, { includeEnglish: false });
  assert.deepEqual(zhOnly.map(i => i.text), ['你好', '謝謝', '我是工人。', '你好！', '你好嗎？']);
  assert.ok(zhOnly.every(i => i.lang === SPEECH_LANG.zh));
  assert.deepEqual(buildUnitSpeechQueue(), []);
});

test('沒有瀏覽器環境時（node）判定為不支援，不會丟出錯誤', () => {
  assert.equal(speechSupported(), false);
});

test('朗讀控制列的中英文字完整對應，英文都有翻譯', () => {
  assert.deepEqual(Object.keys(SPEECH_TEXT.en).sort(), Object.keys(SPEECH_TEXT.zh).sort());
  for (const key of Object.keys(SPEECH_TEXT.zh)) {
    assert.ok(SPEECH_TEXT.en[key] && SPEECH_TEXT.en[key] !== SPEECH_TEXT.zh[key], `missing English text: ${key}`);
    assert.doesNotMatch(SPEECH_TEXT.en[key], /[\u4e00-\u9fff]/, `English text has Chinese: ${key}`);
  }
});

test('學習頁已接上朗讀：語音 hook、單元朗讀、每列播放鈕、切換單元會停止', async () => {
  const page = await read('../src/components/HrWorkerLearning.jsx');
  assert.match(page, /useLessonSpeech/);
  assert.match(page, /SPEECH_TEXT\[lang === 'en' \? 'en' : 'zh'\]/);
  assert.match(page, /buildUnitSpeechQueue\(/);
  assert.match(page, /rowSpeechItems\(/);
  assert.match(page, /stopSpeech\(\);\s*\}, \[unitId, stopSpeech\]\)/);
  for (const section of ['examples', 'dialogue']) assert.match(page, new RegExp(`speakButtons\\('${section}'`));
  assert.match(await read('../src/components/HrLessonVocabulary.jsx'), /speakButtons\('vocabulary'/);
  const hook = await read('../src/lib/use-lesson-speech.js');
  assert.match(hook, /speechSynthesis\.cancel\(\)/);
  assert.match(hook, /voiceschanged/);
});
