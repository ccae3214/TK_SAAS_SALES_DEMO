import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildUnitQuiz, quizAvailable, scoreQuiz, QUIZ_PASS_PERCENT, QUIZ_QUESTION_COUNT } from '../src/lib/hr-learning.js';
import { TRAINING_CENTER_EN, translateTrainingCenterPattern } from '../src/lib/hr-translations-training.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
// 固定亂數，讓測試結果可重現。
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const VOCAB = ['你好 | Nǐ hǎo | Hello', '謝謝 | Xièxie | Thank you', '再見 | Zàijiàn | Goodbye', '請 | Qǐng | Please', '對不起 | Duìbuqǐ | Sorry', '水 | Shuǐ | Water'].join('\n');

test('出題：每題 4 個不重複選項、含正確答案、最多 5 題', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const questions = buildUnitQuiz(VOCAB, { random: seeded(seed) });
    assert.equal(questions.length, QUIZ_QUESTION_COUNT);
    for (const question of questions) {
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options.map(option => option.toLowerCase())).size, 4);
      const expected = VOCAB.split('\n').map(line => line.split(' | ')).find(([zh]) => zh === question.zh)[2];
      assert.equal(question.options[question.answer], expected);
    }
    assert.equal(new Set(questions.map(question => question.zh)).size, questions.length, '同一個詞不會出兩次');
  }
});

test('出題：單元詞彙太少時用整門課的詞彙補選項；沒有英文或只有一種意思就不出題', () => {
  const one = '你好 | Nǐ hǎo | Hello';
  assert.equal(quizAvailable(one), false);
  assert.deepEqual(buildUnitQuiz(one), []);
  assert.equal(quizAvailable(one, VOCAB), true);
  const questions = buildUnitQuiz(one, { poolText: VOCAB, random: seeded(3) });
  assert.equal(questions.length, 1);
  assert.equal(questions[0].options.length, 4);
  assert.equal(questions[0].options[questions[0].answer], 'Hello');
  assert.equal(quizAvailable('你好 | Nǐ hǎo'), false, '沒有英文意思');
  assert.equal(quizAvailable('', VOCAB), false, '本單元沒有詞彙');
  assert.deepEqual(buildUnitQuiz(null), []);
  // 兩個詞彙英文相同時不會出現重複選項，沒有任何錯誤選項的題目會被略過。
  assert.deepEqual(buildUnitQuiz('你好 | a | Hello\n您好 | b | hello'), []);
});

test('出題：多義字用第一個意思當選項，其他選項不會挑到同一個詞的任何意思，也能讀新格式的造句欄位', () => {
  const vocab = ['是 | shì | am / is / are；to be；yes | [1] 我是男生。＝ Wǒ shì nánshēng. ＝ I am a boy.', '好 | hǎo | good', '水 | shuǐ | water', '飯 | fàn | to be'].join('\n');
  for (let seed = 1; seed <= 30; seed += 1) {
    const questions = buildUnitQuiz(vocab, { random: seeded(seed) });
    for (const question of questions) {
      assert.ok(question.options.every(option => !option.includes('；')), '選項不含整串多個意思');
      if (question.zh === '是') {
        assert.equal(question.options[question.answer], 'am / is / are');
        assert.ok(!question.options.some(option => ['to be', 'yes'].includes(option.toLowerCase())), '不會出現同一個詞的其他意思');
      }
    }
  }
});

test('計分：答對比例達 60% 以上通過', () => {
  const questions = [0, 1, 2, 3, 0].map(answer => ({ zh: 'x', pinyin: '', options: ['a', 'b', 'c', 'd'], answer }));
  assert.equal(QUIZ_PASS_PERCENT, 60);
  assert.deepEqual(scoreQuiz(questions, { 0: 0, 1: 1, 2: 2, 3: 3, 4: 0 }), { total: 5, correct: 5, percent: 100, passed: true });
  assert.deepEqual(scoreQuiz(questions, { 0: 0, 1: 1, 2: 2, 3: 0, 4: 1 }), { total: 5, correct: 3, percent: 60, passed: true });
  assert.deepEqual(scoreQuiz(questions, { 0: 0, 1: 1, 2: 0, 3: 0, 4: 1 }), { total: 5, correct: 2, percent: 40, passed: false });
  assert.deepEqual(scoreQuiz([], {}), { total: 0, correct: 0, percent: 0, passed: false });
});

test('小測驗的文字與句型都有英文翻譯', () => {
  const texts = ['小測驗', '看看自己記住了多少：每題選出正確的英文意思。', '測驗成績不會被記錄，可以重複作答。', '開始小測驗', '這個詞是什麼意思？',
    '請先回答所有題目。', '送出答案', '答對了', '答錯了', '正確答案：', '通過！你已經掌握這個單元的詞彙。', '再複習一次詞彙後重新測驗吧。', '重新測驗'];
  for (const text of texts) assert.ok(TRAINING_CENTER_EN[text], `missing English translation: ${text}`);
  assert.equal(translateTrainingCenterPattern('答對 4 / 5 題'), '4 of 5 correct');
});

test('畫面：單元內容後面顯示小測驗，元件用到的每一句中文都在翻譯表裡', async () => {
  const learning = await read('../src/components/HrWorkerLearning.jsx');
  assert.match(learning, /import HrUnitQuiz from '@\/components\/HrUnitQuiz';/);
  assert.match(learning, /<HrUnitQuiz key=\{unit\.id\} vocabulary=\{unit\.vocabulary\}/);
  const quiz = await read('../src/components/HrUnitQuiz.jsx');
  const quoted = [...quiz.matchAll(/(?:'|>)([^'<>{}`]*[\u4e00-\u9fff][^'<>{}`]*)(?:'|<)/g)].map(match => match[1].trim());
  assert.ok(quoted.length >= 12);
  for (const text of quoted) assert.ok(TRAINING_CENTER_EN[text] || translateTrainingCenterPattern(text), `missing English translation: ${text}`);
});
