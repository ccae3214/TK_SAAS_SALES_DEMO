import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseLessonLines, learningProgress } from '../src/lib/hr-learning.js';
import { TRAINING_CENTER_EN, translateTrainingCenterPattern } from '../src/lib/hr-translations-training.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('課文每行「中文 | 拼音 | 英文」，對話可帶講話的人', () => {
  assert.deepEqual(parseLessonLines('你好 | Nǐ hǎo | Hello.\n\n  謝謝  '), [
    { speaker: '', zh: '你好', pinyin: 'Nǐ hǎo', en: 'Hello.' },
    { speaker: '', zh: '謝謝', pinyin: '', en: '' },
  ]);
  assert.deepEqual(parseLessonLines('A：你好！ | Nǐ hǎo! | Hello!\nb: 再見 | Zàijiàn | Goodbye', { speaker: true }).map(row => [row.speaker, row.zh]), [['A', '你好！'], ['B', '再見']]);
  assert.deepEqual(parseLessonLines('A：你好', { speaker: false })[0].zh, 'A：你好');
  assert.deepEqual(parseLessonLines(null), []);
});

test('學習進度：已讀單元數、百分比、時數與下一個要讀的單元', () => {
  const units = [{ id: 1, hours: 8 }, { id: 2, hours: 6 }, { id: '3', hours: null }];
  assert.deepEqual(learningProgress(units, []), { total: 3, done: 0, percent: 0, hoursDone: 0, hoursTotal: 14, nextUnitId: 1 });
  assert.deepEqual(learningProgress(units, ['1', 3]), { total: 3, done: 2, percent: 67, hoursDone: 8, hoursTotal: 14, nextUnitId: 2 });
  assert.equal(learningProgress(units, [1, 2, 3]).nextUnitId, null);
  assert.equal(learningProgress([], []).percent, 0);
});

test('學習 API：工人只能讀自己報名的課程，標記進度要同源，管理者與訓練中心唯讀', async () => {
  const route = await read('../src/app/api/hr/learning/route.js');
  assert.match(route, /EXISTS\(SELECT 1 FROM hr_tc_enrollments e JOIN hr_tc_classes cl ON cl\.id=e\.class_id WHERE e\.worker_id=\$2 AND cl\.course_id=co\.id\)/);
  assert.match(route, /co\.center_id=\$2/);
  assert.match(route, /if \(!sameOrigin\(request\)\) return fail\('Invalid origin', 403\);/);
  assert.match(route, /if \(ctx\.role !== 'worker'\) return fail\('只有工人可以記錄學習進度。', 403\);/);
  assert.match(route, /ON CONFLICT\(worker_id, unit_id\) DO NOTHING/);
  assert.match(route, /readOnly: ctx\.role !== 'worker'/);
});

test('資料表與畫面：進度表隨單元／工人刪除、工人訓練頁有「開始學習」', async () => {
  const schema = await read('../src/lib/hr-training-center.js');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS hr_tc_unit_progress/);
  assert.match(schema, /unit_id BIGINT NOT NULL REFERENCES hr_tc_course_units\(id\) ON DELETE CASCADE/);
  assert.match(schema, /UNIQUE\(worker_id, unit_id\)/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS vocabulary TEXT NOT NULL DEFAULT ''/);
  assert.match(await read('../src/app/api/hr/route.js'), /SELECT e\.id, co\.id AS course_id,/);
  const training = await read('../src/components/HrWorkerTraining.jsx');
  assert.match(training, /setLearningCourseId\(course\.course_id\)/);
  const workspace = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  assert.match(workspace, /name: 'vocabulary', label: '詞彙'/);
  assert.match(workspace, /name: 'dialogue', label: '對話'/);
});

test('學習頁的文字與句型都有英文翻譯', () => {
  const learning = ['詞彙', '對話', '拼音', '開始學習', '繼續學習', '複習', '回到課程', '回到單元清單', '上一單元', '下一單元', '標記為已讀完',
    '取消已讀完標記', '已讀完', '未讀', '讀取中…', '這個單元還沒有學習內容。', '無法讀取學習內容，請稍後再試。', '無法記錄學習進度，請稍後再試。',
    '找不到這門課程，或您沒有報名這門課程。', '只有工人可以記錄學習進度。'];
  for (const text of learning) assert.ok(TRAINING_CENTER_EN[text], `missing English translation: ${text}`);
  assert.equal(translateTrainingCenterPattern('學習：Mandarin'), 'Learning: Mandarin');
  assert.equal(translateTrainingCenterPattern('已讀完 3 / 8 個單元'), '3 of 8 units completed');
  assert.equal(translateTrainingCenterPattern('2 / 8 · 6 小時'), '2 / 8 · 6 hours');
  assert.equal(translateTrainingCenterPattern('8 小時'), '8 hours');
});

test('預設課文：8 個單元都有詞彙與對話，每行都有中文、拼音、英文', async () => {
  const seed = await read('../scripts/seed-training-courses.sql');
  const block = seed.slice(seed.indexOf('UPDATE hr_tc_course_units u SET vocabulary'), seed.indexOf('COMMIT;'));
  const rows = [...block.matchAll(/^\s+\(E'([^']+)', E'((?:[^']|'')+)', E'((?:[^']|'')+)'\)/gm)];
  assert.equal(rows.length, 8);
  for (const [, name, vocabulary, dialogue] of rows) {
    const lines = [...vocabulary.split('\\n'), ...dialogue.split('\\n')];
    assert.ok(vocabulary.split('\\n').length >= 9 && dialogue.split('\\n').length >= 4, `${name}: too little content`);
    for (const line of lines) assert.equal(line.split(' | ').length, 3, `${name}: ${line}`);
  }
  assert.match(block, /u\.vocabulary = '' AND u\.dialogue = ''/);
});
