import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('訓練中心工作區（系統管理員／訓練中心）的課程列有「學習預覽」，開啟學習頁', async () => {
  const ui = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  assert.match(ui, /import HrWorkerLearning from '@\/components\/HrWorkerLearning';/);
  assert.match(ui, /const \[learningCourseId, setLearningCourseId\] = useState\(null\);/);
  assert.match(ui, /lang === 'en' \? 'Preview learning' : '學習預覽'/);
  assert.match(ui, /lang === 'en' \? 'Add course units first' : '請先新增課程單元'/);
  // 沒有單元的課程不能預覽；再按一次收合
  assert.match(ui, /disabled=\{!unitsOf\(row\.id\)\.length\}/);
  assert.match(ui, /setLearningCourseId\(Number\(learningCourseId\) === Number\(row\.id\) \? null : row\.id\)/);
  // 只在「課程」分頁、且該課程屬於目前選的訓練中心時顯示
  assert.match(ui, /tab === 'courses' && learningCourseId && courses\.some\(item => Number\(item\.id\) === Number\(learningCourseId\)\)/);
  assert.match(ui, /<HrWorkerLearning key=\{learningCourseId\} courseId=\{learningCourseId\} onClose=\{\(\) => setLearningCourseId\(null\)\} \/>/);
  // 管理員切換訓練中心時關掉預覽，避免顯示別的中心的課程
  assert.match(ui, /setData\(null\); setLearningCourseId\(null\); void load\(event\.target\.value\);/);
});

test('學習頁 API：非工人（管理員、訓練中心）為唯讀，不能標記進度', async () => {
  const route = await read('../src/app/api/hr/learning/route.js');
  assert.match(route, /readOnly: ctx\.role !== 'worker'/);
  const page = await read('../src/components/HrWorkerLearning.jsx');
  assert.match(page, /!data\.readOnly && <button/);
});
