import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 「訓練與來台進度」：每位工作者一個小元件，展開後整合訓練中心的訓練與仲介的進度。
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workflow page uses worker tiles with training-center and agency sections', async () => {
  const comp = await read('src/components/HrWorkflowProgress.jsx');
  assert.match(comp, /訓練中心的訓練/);
  assert.match(comp, /仲介的進度/);
  assert.match(comp, /doc-worker-tile/);
  assert.match(comp, /setOpenId\(expanded \? null : row\.id\)/);
  assert.match(comp, /type: 'application-step'/);
  const admin = await read('src/components/HrManagement.jsx');
  assert.match(admin, /<HrWorkflowProgress /);
  assert.match(admin, /enrollments=\{data\.trainingEnrollments/);
});

test('api exposes trainingEnrollments to admin and agency only', async () => {
  const route = await read('src/app/api/hr/route.js');
  assert.match(route, /principal\.role === 'admin' \|\| principal\.role === 'agency'\) && documentWorkerIds\.size/);
  assert.match(route, /trainingCourses, trainingEnrollments, agencies/);
});

test('new strings have English translations', async () => {
  const dict = await read('src/lib/hr-translations.jsx');
  for (const text of ['訓練中心的訓練', '仲介的進度', '尚未報名訓練中心的班別。', '訓練完成', '證照辦件']) assert.ok(dict.includes(`'${text}'`), text);
});
