import test from 'node:test';
import assert from 'node:assert/strict';
import { availableActions, actionLabel } from '../src/lib/hr-agency-certification.js';

test('可做的動作：沒有紀錄、被拒、被撤銷都可以重新申請；已認證只能解除', () => {
  for (const row of [null, { status: 'rejected' }, { status: 'revoked' }]) {
    assert.deepEqual(availableActions(row, 'taiwan'), ['request']);
  }
  assert.deepEqual(availableActions({ status: 'certified' }, 'philippines'), ['revoke']);
});

test('可做的動作：申請中時，申請方只能撤回，另一方可以同意或拒絕', () => {
  const pending = { status: 'pending', requested_by_side: 'taiwan' };
  assert.deepEqual(availableActions(pending, 'taiwan'), ['revoke']);
  assert.deepEqual(availableActions(pending, 'philippines'), ['approve', 'reject']);
});

test('可做的動作：不是台灣或菲律賓仲介、或未知狀態，一律沒有動作', () => {
  assert.deepEqual(availableActions(null, 'employer'), []);
  assert.deepEqual(availableActions({ status: 'certified' }, undefined), []);
  assert.deepEqual(availableActions({ status: 'weird' }, 'taiwan'), []);
});

test('按鈕文字依動作與目前狀態決定', () => {
  assert.equal(actionLabel('request', null), '申請認證');
  assert.equal(actionLabel('request', { status: 'rejected' }), '重新申請認證');
  assert.equal(actionLabel('approve'), '同意認證');
  assert.equal(actionLabel('reject'), '拒絕');
  assert.equal(actionLabel('certify'), '直接認證');
  assert.equal(actionLabel('revoke', { status: 'pending' }), '撤回申請');
  assert.equal(actionLabel('revoke', { status: 'certified' }), '解除認證');
  assert.equal(actionLabel('revoke', null), '解除認證');
  assert.equal(actionLabel('unknown'), 'unknown');
});
