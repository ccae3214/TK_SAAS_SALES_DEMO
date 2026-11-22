import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, computeCaseStage, TRAINING_STATUSES } from '../src/lib/hr-case-flow.js';
import { TRAINING_STATUSES as WORKER_TRAINING_STATUSES, allowedNextStatuses, statusSetFor } from '../src/lib/hr-worker-progress.js';

test('結訓已取證是合法的訓練狀態', () => {
  assert.ok(TRAINING_STATUSES.includes('certified'));
  assert.ok(WORKER_TRAINING_STATUSES.includes('certified'));
  assert.ok(statusSetFor('training').has('certified'));
});

test('訓練只能往前，可以跳過中間步驟，結訓後不能退回', () => {
  for (const to of ['in_progress', 'completed', 'certified']) assert.ok(canTransition('training', 'not_scheduled', to), to);
  assert.ok(canTransition('training', 'in_progress', 'certified'));
  assert.ok(canTransition('training', 'completed', 'certified'));
  assert.ok(!canTransition('training', 'completed', 'in_progress'));
  assert.ok(!canTransition('training', 'certified', 'completed'));
  assert.deepEqual(allowedNextStatuses('training', 'certified'), []);
  assert.deepEqual(allowedNextStatuses('training', 'completed'), ['certified']);
});

test('結訓已取證與結訓一樣會讓案件進到 OEC 與簽證階段', () => {
  const base = { gateClosed: false, documentsOpen: false, certificationOpen: false, medicalStatus: 'not_scheduled', oecDone: false, visaDone: false, arrived: false, arrivalDocsDone: false };
  assert.equal(computeCaseStage({ ...base, trainingStatus: 'in_progress' }), 'medical_training');
  assert.equal(computeCaseStage({ ...base, trainingStatus: 'completed' }), 'application');
  assert.equal(computeCaseStage({ ...base, trainingStatus: 'certified' }), 'application');
});
