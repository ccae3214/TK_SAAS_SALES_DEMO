import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLatestStep, stepDetailLabel } from '../src/lib/hr-worker-progress.js';

test('同一個項目有工作者與案件兩筆資料時，採用最近更新的那一筆', () => {
  const worker = { id: 1, updated_at: '2026-01-02T00:00:00Z' };
  const olderCase = { id: 2, updated_at: '2026-01-01T00:00:00Z' };
  const newerCase = { id: 3, updated_at: '2026-01-03T00:00:00Z' };
  assert.deepEqual(pickLatestStep(worker, olderCase), { ...worker, source: 'worker' });
  assert.deepEqual(pickLatestStep(worker, newerCase), { ...newerCase, source: 'case' });
  assert.deepEqual(pickLatestStep(worker, { ...worker, id: 4 }), { ...worker, source: 'worker' }, '同時間以工作者層級為準');
});

test('只有一邊有資料就用那一邊；都沒有回傳 null', () => {
  assert.deepEqual(pickLatestStep({ id: 1 }, null), { id: 1, source: 'worker' });
  assert.deepEqual(pickLatestStep(null, { id: 2 }), { id: 2, source: 'case' });
  assert.equal(pickLatestStep(null, null), null);
});

test('進度項目的補充欄位：選單轉成選項名稱，文字原樣，其他一律空字串', () => {
  assert.equal(stepDetailLabel('visa', 'regular'), '一般件（5 個工作天）');
  assert.equal(stepDetailLabel('visa', 'expedite'), '加急件（3 個工作天）');
  assert.equal(stepDetailLabel('visa', 'unknown'), '');
  assert.equal(stepDetailLabel('ticket', 'PR 890'), 'PR 890');
  assert.equal(stepDetailLabel('ticket', ''), '');
  assert.equal(stepDetailLabel('no-such-step', 'x'), '');
});
