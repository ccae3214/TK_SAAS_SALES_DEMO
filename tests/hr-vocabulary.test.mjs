import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseLessonLines } from '../src/lib/hr-learning.js';
import { LESSON_TEXT, parseExample, parseSenses, parseVocabularyEntries, senseMark } from '../src/lib/hr-vocabulary.js';
import { buildUnitSpeechQueue, rowSpeechItems } from '../src/lib/hr-speech.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const LESSON = [
  '是 | shì | am / is / are；to be；yes, true | [1] 我是男生。＝ Wǒ shì nánshēng. ＝ I am a boy. | [3] 是，我是。＝ Shì, wǒ shì. ＝ Yes, I am.',
  '是不是 | shì bu shì | yes or no (used to ask a question) | [1] 你是不是男生？我是。＝ Nǐ shì bu shì nánshēng? Wǒ shì. ＝ Are you a boy? Yes, I am. | 你是不是沒有吃早餐？＝ Didn\'t you eat breakfast?',
  '你好 | nǐ hǎo | hello',
].join('\n');

test('多義字：英文用「；」拆成多個意思，一個意思內的 / 與逗號保留', () => {
  assert.deepEqual(parseSenses('am / is / are；to be；yes, true'), ['am / is / are', 'to be', 'yes, true']);
  assert.deepEqual(parseSenses('a; b'), ['a', 'b']);
  assert.deepEqual(parseSenses(''), []);
});

test('造句：中文 ＝ 拼音 ＝ 英文，拼音可省略，[n] 標示意思編號', () => {
  assert.deepEqual(parseExample('[1] 我是男生。＝ Wǒ shì nánshēng. ＝ I am a boy.'), { zh: '我是男生。', pinyin: 'Wǒ shì nánshēng.', en: 'I am a boy.', sense: 1 });
  assert.deepEqual(parseExample('你是不是沒有吃早餐？＝ Didn\'t you eat breakfast?'), { zh: '你是不是沒有吃早餐？', pinyin: '', en: 'Didn\'t you eat breakfast?', sense: 0 });
  assert.deepEqual(parseExample('［2］他是老師。'), { zh: '他是老師。', pinyin: '', en: '', sense: 2 });
  assert.equal(parseExample('  '), null);
  assert.equal(parseExample('[1] ＝ only english'), null);
});

test('詞彙行解析：多義字、造句、沒有造句的舊格式', () => {
  const [shi, shiBuShi, hello] = parseVocabularyEntries(LESSON);
  assert.equal(shi.zh, '是');
  assert.equal(shi.pinyin, 'shì');
  assert.deepEqual(shi.senses, ['am / is / are', 'to be', 'yes, true']);
  assert.equal(shi.examples.length, 2);
  assert.deepEqual(shi.examples.map(e => e.sense), [1, 3]);
  assert.equal(shiBuShi.senses.length, 1);
  assert.deepEqual(shiBuShi.examples.map(e => e.sense), [1, 0]);
  assert.equal(shiBuShi.examples[0].en, 'Are you a boy? Yes, I am.');
  assert.deepEqual(hello.senses, ['hello']);
  assert.deepEqual(hello.examples, []);
  assert.deepEqual(parseVocabularyEntries(''), []);
});

test('舊功能相容：parseLessonLines 只讀前 3 欄，多出來的造句不會變成詞彙或弄亂測驗', () => {
  const rows = parseLessonLines(LESSON);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.zh), ['是', '是不是', '你好']);
  assert.equal(rows[0].en, 'am / is / are；to be；yes, true');
});

test('舊格式（只有 3 欄）解析結果與 parseLessonLines 一致', () => {
  const text = '你好 | nǐ hǎo | hello\n謝謝 | xièxie | thank you';
  const old = parseLessonLines(text);
  const next = parseVocabularyEntries(text);
  assert.deepEqual(next.map(({ zh, pinyin, en }) => ({ zh, pinyin, en })), old.map(({ zh, pinyin, en }) => ({ zh, pinyin, en })));
});

test('朗讀：詞 → 各個意思 → 該詞的造句，斜線改成逗號、不唸拼音', () => {
  const vocabulary = parseVocabularyEntries(LESSON).slice(0, 1);
  const queue = buildUnitSpeechQueue({ vocabulary }, { includeEnglish: true });
  assert.deepEqual(queue.map(i => i.text), ['是', 'am, is, are. to be. yes, true', '我是男生。', 'I am a boy.', '是，我是。', 'Yes, I am.']);
  assert.deepEqual(queue.map(i => i.rowKey), ['vocabulary-0', 'vocabulary-0', 'vocabulary-0-ex-0', 'vocabulary-0-ex-0', 'vocabulary-0-ex-1', 'vocabulary-0-ex-1']);
  assert.deepEqual(buildUnitSpeechQueue({ vocabulary }, { includeEnglish: false }).map(i => i.text), ['是', '我是男生。', '是，我是。']);
  assert.deepEqual(rowSpeechItems('vocabulary', 0, vocabulary[0], 'en').map(i => i.text), ['am, is, are. to be. yes, true']);
});

test('介面文字與意思編號', () => {
  assert.equal(LESSON_TEXT.zh.multiMeaning(3), '多義字・3 個意思');
  assert.equal(LESSON_TEXT.en.multiMeaning(3), '3 meanings');
  assert.equal(LESSON_TEXT.en.examples, 'Example sentences');
  assert.deepEqual(Object.keys(LESSON_TEXT.en).sort(), Object.keys(LESSON_TEXT.zh).sort());
  assert.equal(senseMark(1), '①');
  assert.equal(senseMark(12), '(12)');
});

test('學習頁改用多義字詞彙元件；單元編輯說明已更新並有英文翻譯', async () => {
  const page = await read('../src/components/HrWorkerLearning.jsx');
  assert.match(page, /parseVocabularyEntries\(unit\.vocabulary\)/);
  assert.match(page, /<HrLessonVocabulary /);
  const component = await read('../src/components/HrLessonVocabulary.jsx');
  assert.match(component, /copyFor\(LESSON_TEXT, lang\)/);
  const workspace = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  const dictionary = await read('../src/lib/hr-translations-training.js');
  assert.match(workspace, /hint: '詞彙、例句每行一筆[^']*多義字/);
  assert.match(dictionary, /'詞彙、例句每行一筆[^']*多義字[^']*': 'One entry per line[^']*several meanings/);
});
