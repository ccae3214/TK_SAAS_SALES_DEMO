import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { orderTrainingCenters } from '../src/lib/hr-training-center-order.js';

const names = list => list.map(center => center.display_name);

test('訓練中心：q8 和 kolecion 對調，kolecion 排第一，其他位置不變', () => {
  const centers = [{ display_name: 'Q8 Training' }, { display_name: 'ABC' }, { display_name: 'Kolecion Training Center' }, { display_name: 'Zeta' }];
  assert.deepEqual(names(orderTrainingCenters(centers)), ['Kolecion Training Center', 'ABC', 'Q8 Training', 'Zeta']);
  assert.deepEqual(names(centers), ['Q8 Training', 'ABC', 'Kolecion Training Center', 'Zeta'], '不能改到原本的陣列');
});

test('訓練中心：已經是 kolecion 在前、或少了其中一個時不動', () => {
  assert.deepEqual(names(orderTrainingCenters([{ display_name: 'kolecion' }, { display_name: 'q8' }])), ['kolecion', 'q8']);
  assert.deepEqual(names(orderTrainingCenters([{ display_name: 'q8' }, { display_name: 'other' }])), ['q8', 'other']);
  assert.deepEqual(orderTrainingCenters([]), []);
});

test('系統管理員的訓練中心清單有套用這個順序（訓練中心本人只看到自己）', async () => {
  const route = await readFile(new URL('../src/app/api/hr/training-center/route.js', import.meta.url), 'utf8');
  assert.ok(route.includes(": orderTrainingCenters(await query(\"SELECT id, display_name, email, active FROM hr_members WHERE role='training_center'"));
});
