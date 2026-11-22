import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTrainingStatus, taipeiToday } from '../src/lib/hr-training-auto-status.js';

const today = '2026-11-22';
const derive = input => deriveTrainingStatus({ manualStatus: 'not_scheduled', classes: [], certificateApproved: false, today, ...input });

test('沒有報名班別時沿用手動狀態，不自動判斷', () => {
  assert.deepEqual(derive({}), { status: 'not_scheduled', auto: false });
  assert.deepEqual(derive({ manualStatus: 'in_progress' }), { status: 'in_progress', auto: false });
  assert.deepEqual(derive({ manualStatus: 'bogus' }), { status: 'not_scheduled', auto: false });
  // 還沒報名班別時，已上傳核准的證照文件不算本次訓練取證
  assert.deepEqual(derive({ certificateApproved: true }), { status: 'not_scheduled', auto: false });
});

test('已報名班別且尚未結束 → 訓練中（忽略手動狀態）', () => {
  assert.deepEqual(derive({ manualStatus: 'completed', classes: [{ end: '2026-12-01', issued: false }] }), { status: 'in_progress', auto: true });
});

test('訓練結束日已過、尚未取證 → 結訓（未取證）；多個班別要全部結束', () => {
  assert.equal(derive({ classes: [{ end: '2026-11-21', issued: false }] }).status, 'completed');
  assert.equal(derive({ classes: [{ end: '2026-11-21', issued: false }, { end: '2026-12-05', issued: false }] }).status, 'in_progress');
  assert.equal(derive({ classes: [{ end: null, issued: false }] }).status, 'in_progress');
});

test('結訓當天還算訓練中，隔天才算結訓', () => {
  assert.equal(derive({ classes: [{ end: '2026-11-22', issued: false }] }).status, 'in_progress');
});

test('證照批次已發證，或證照文件核准（已報名班別）→ 結訓已取證', () => {
  assert.equal(derive({ classes: [{ end: '2026-11-21', issued: true }] }).status, 'certified');
  assert.equal(derive({ classes: [{ end: '2026-11-21', issued: false }], certificateApproved: true }).status, 'certified');
});

test('taipeiToday 使用台灣時間', () => {
  assert.equal(taipeiToday(new Date('2026-11-21T17:00:00Z')), '2026-11-22');
});
