import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { quizResultOf, QUIZ_QUESTION_COUNT } from '../src/lib/hr-learning.js';
import { buildStudentProgress, learningStatus } from '../src/lib/hr-tc-student-progress.js';
import { TRAINING_CENTER_EN, translateTrainingCenterPattern } from '../src/lib/hr-translations-training.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('測驗成績驗證：只接受合理的答對題數／總題數，並算出百分比與是否通過', () => {
  assert.deepEqual(quizResultOf({ correct: 4, total: 5 }), { correct: 4, total: 5, percent: 80, passed: true });
  assert.deepEqual(quizResultOf({ correct: '3', total: '5' }), { correct: 3, total: 5, percent: 60, passed: true });
  assert.deepEqual(quizResultOf({ correct: 2, total: 5 }), { correct: 2, total: 5, percent: 40, passed: false });
  assert.deepEqual(quizResultOf({ correct: 0, total: 1 }), { correct: 0, total: 1, percent: 0, passed: false });
  for (const bad of [null, {}, { correct: 6, total: 5 }, { correct: -1, total: 5 }, { correct: 1, total: 0 }, { correct: 1.5, total: 5 },
    { correct: 1, total: QUIZ_QUESTION_COUNT + 1 }, { correct: 'a', total: 5 }]) assert.equal(quizResultOf(bad), null, JSON.stringify(bad));
});

const classes = [{ id: 1, course_id: 10, name: 'A班' }, { id: 2, course_id: 20, name: 'B班' }];
const units = [
  { id: 100, course_id: 10, hours: 8 }, { id: 101, course_id: 10, hours: 6 }, { id: 200, course_id: 20, hours: 4 },
];
const enrollments = [
  { id: 1, class_id: 1, worker_id: 7, worker_name: 'Ana' }, { id: 2, class_id: 1, worker_id: 8, worker_name: 'Ben' },
  { id: 3, class_id: 2, worker_id: 7, worker_name: 'Ana' },
];
const progress = [{ worker_id: 7, unit_id: 100, completed_at: '2026-11-20T01:00:00Z' }, { worker_id: 7, unit_id: 101, completed_at: '2026-11-21T01:00:00Z' }];
const quizzes = [
  { worker_id: 7, unit_id: 100, attempts: 2, best_percent: 80, passed: true, last_percent: 60, last_correct: 3, last_total: 5, last_at: '2026-11-22T02:00:00Z' },
  { worker_id: 8, unit_id: 101, attempts: 1, best_percent: 40, passed: false, last_percent: 40, last_correct: 2, last_total: 5, last_at: '2026-11-19T02:00:00Z' },
];

test('學員進度：依班別的課程算單元進度、時數、測驗通過數與平均（取各單元最佳成績）', () => {
  const [a, b] = buildStudentProgress({ classes, enrollments, units, progress, quizzes });
  assert.equal(a.totalUnits, 2);
  const [ana, ben] = a.students;
  assert.deepEqual([ana.name, ana.done, ana.total, ana.percent, ana.hoursDone, ana.hoursTotal, ana.status], ['Ana', 2, 2, 100, 14, 14, 'done']);
  assert.deepEqual(ana.quiz, { taken: 1, passed: 1, attempts: 2, average: 80 });
  assert.equal(ana.lastActivity, '2026-11-22T02:00:00Z');
  assert.deepEqual([ben.done, ben.status], [0, 'learning']);
  assert.deepEqual(ben.quiz, { taken: 1, passed: 0, attempts: 1, average: 40 });
  assert.equal(ben.lastActivity, '2026-11-19T02:00:00Z');
  // 同一位工人在另一個班別（另一門課）的進度不會混在一起
  assert.deepEqual(b.students.map(item => [item.name, item.done, item.total, item.quiz.taken, item.status]), [['Ana', 0, 1, 0, 'not_started']]);
  assert.equal(b.students[0].quiz.average, null);
  assert.equal(b.students[0].lastActivity, null);
});

test('學員進度：課程沒有單元、或沒有學員時不出錯', () => {
  const [empty] = buildStudentProgress({ classes: [{ id: 9, course_id: 99 }], enrollments: [{ id: 5, class_id: 9, worker_id: 1, worker_name: 'Cy' }], units });
  assert.equal(empty.totalUnits, 0);
  assert.equal(empty.students[0].status, 'no_units');
  assert.deepEqual(buildStudentProgress(), []);
  assert.equal(learningStatus({ total: 3, done: 0, quiz: { taken: 0 } }), 'not_started');
  assert.equal(learningStatus({ total: 3, done: 0, quiz: { taken: 1 } }), 'learning');
});

test('API：工人送出測驗成績會記錄（同源、僅工人），訓練中心只拿到自己課程且已報名工人的進度與成績', async () => {
  const schema = await read('../src/lib/hr-training-center.js');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS hr_tc_quiz_results/);
  assert.match(schema, /worker_id BIGINT NOT NULL REFERENCES hr_workers\(id\) ON DELETE CASCADE/);
  assert.match(schema, /unit_id BIGINT NOT NULL REFERENCES hr_tc_course_units\(id\) ON DELETE CASCADE/);
  const learning = await read('../src/app/api/hr/learning/route.js');
  assert.match(learning, /body\?\.action === 'quiz'/);
  assert.match(learning, /INSERT INTO hr_tc_quiz_results\(worker_id, unit_id, correct, total, percent, passed\)/);
  assert.ok(learning.indexOf("if (ctx.role !== 'worker')") < learning.indexOf('INSERT INTO hr_tc_quiz_results'), '非工人不能寫入成績');
  assert.ok(learning.indexOf('readableCourse(ctx, unit.course_id)') < learning.indexOf('INSERT INTO hr_tc_quiz_results'), '必須是已報名的課程');
  const center = await read('../src/app/api/hr/training-center/route.js');
  assert.match(center, /FROM hr_tc_unit_progress p JOIN hr_tc_course_units u ON u\.id=p\.unit_id/);
  assert.match(center, /FROM hr_tc_quiz_results q JOIN hr_tc_course_units u ON u\.id=q\.unit_id/);
  assert.equal((center.match(/u\.center_id=\$1 AND \$\{enrolledInCourseSql\(/g) || []).length, 2, '兩個查詢都限制單元屬於這個訓練中心、且工人已報名該課程');
  assert.match(center, /students, progress, quizzes,/);
});

test('畫面：學習與成績分頁，工人才記錄成績，預覽（唯讀）不記錄', async () => {
  const ui = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  assert.match(ui, /\['progress', '學習與成績'\]/);
  assert.match(ui, /tab === 'progress'/);
  assert.match(ui, /buildStudentProgress\(\{ classes: shown, enrollments, units, progress: data\.progress \|\| \[\], quizzes: data\.quizzes \|\| \[\] \}\)/);
  const learning = await read('../src/components/HrWorkerLearning.jsx');
  assert.match(learning, /onResult=\{data\.readOnly \? undefined : result => recordQuiz\(unit, result\)\}/);
  const quiz = await read('../src/components/HrUnitQuiz.jsx');
  assert.match(quiz, /if \(!onResult\) return;/);
});

test('學習與成績的畫面文字與句型都有英文翻譯', async () => {
  const texts = ['學習與成績', '學員學習狀況與測驗成績', '查看已報名學員的單元學習進度與小測驗成績；測驗成績取每個單元最佳的一次，並顯示作答次數。', '全部班別',
    '學員人數', '學習中', '全體測驗平均', '學習進度', '學習時數', '通過測驗', '測驗平均', '最近學習', '課程尚無單元', '查看明細', '收合明細', '單元',
    '學習狀態', '最佳成績', '作答次數', '最近一次', '測驗結果', '達標', '未達標', '尚未測驗', '尚無學員', '這個班別還沒有學員報名。',
    '這個班別的課程還沒有單元內容，學員暫時無法學習。', '測驗成績會記錄給訓練中心，可以重複作答。', '無法記錄測驗成績，請稍後再試。'];
  for (const text of texts) assert.ok(TRAINING_CENTER_EN[text], `missing English translation: ${text}`);
  assert.equal(translateTrainingCenterPattern('3 位學員'), '3 students');
  assert.equal(translateTrainingCenterPattern('1 位學員'), '1 student');
  assert.equal(translateTrainingCenterPattern('3 / 10 個單元'), '3 / 10 units');
  assert.equal(translateTrainingCenterPattern('4 / 12 小時'), '4 / 12 hours');
  assert.equal(translateTrainingCenterPattern('及格標準為答對 60% 以上。'), 'Pass mark: 60% or more correct.');
  // 新分頁裡寫死的中文字串都要在翻譯表（或既有的主翻譯表）裡
  const ui = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  const block = ui.slice(ui.indexOf("{tab === 'progress'"), ui.indexOf("{tab === 'audit'"));
  const main = await read('../src/lib/hr-translations.jsx');
  const quoted = [...block.matchAll(/(?:'|>|")([^'<>{}`"]*[一-鿿][^'<>{}`"]*)(?:'|<|")/g)].map(match => match[1].trim()).filter(Boolean);
  assert.ok(quoted.length >= 20);
  for (const text of quoted) assert.ok(TRAINING_CENTER_EN[text] || translateTrainingCenterPattern(text) || main.includes(`'${text}':`), `missing English translation: ${text}`);
});
