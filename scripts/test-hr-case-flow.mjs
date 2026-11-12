// 執行：node --test scripts/test-hr-case-flow.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canManageStep, canUpdateWorkflow, workflowBlockReason, canTransition, summarizeSteps, computeCaseStage, nextActionForStage,
  STEP_OWNERS, TAIWAN_ARRIVAL_STEPS,
} from '../src/lib/hr-case-flow.js';

const base = { gateClosed: false, documentsOpen: false, trainingStatus: 'completed', certificationOpen: false, medicalStatus: 'passed', oecDone: true, visaDone: true, arrived: true, arrivalDocsDone: true };

test('階段依序推進：文件 → 訓練 → OEC／簽證 → 抵台 → 完成', () => {
  assert.equal(computeCaseStage({ ...base, gateClosed: true }), 'intake');
  assert.equal(computeCaseStage({ ...base, documentsOpen: true }), 'documents');
  assert.equal(computeCaseStage({ ...base, trainingStatus: 'in_progress' }), 'medical_training');
  assert.equal(computeCaseStage({ ...base, certificationOpen: true }), 'medical_training');
  assert.equal(computeCaseStage({ ...base, oecDone: false }), 'application');
  assert.equal(computeCaseStage({ ...base, visaDone: false }), 'application');
  assert.equal(computeCaseStage({ ...base, arrived: false, medicalStatus: 'not_scheduled', arrivalDocsDone: false }), 'arrangement');
  assert.equal(computeCaseStage({ ...base, medicalStatus: 'scheduled' }), 'arrangement');
  assert.equal(computeCaseStage({ ...base, arrivalDocsDone: false }), 'arrangement');
  assert.equal(computeCaseStage(base), 'completed');
});

test('文件未備齊時，即使訓練或簽證已填也不會往後走', () => {
  assert.equal(computeCaseStage({ ...base, documentsOpen: true, trainingStatus: 'completed' }), 'documents');
  assert.equal(computeCaseStage({ ...base, gateClosed: true, documentsOpen: true }), 'intake');
});

test('summarizeSteps 只認有完成日期的程序', () => {
  const steps = [
    { step_key: 'oec', completed_on: '2026-11-01' }, { step_key: 'visa', completed_on: null },
    { step_key: 'actual_entry', completed_on: '2026-11-05' },
    ...TAIWAN_ARRIVAL_STEPS.slice(0, 2).map(step_key => ({ step_key, completed_on: '2026-11-06' })),
  ];
  assert.deepEqual(summarizeSteps(steps), { oecDone: true, visaDone: false, arrived: true, arrivalDocsDone: false });
  assert.equal(summarizeSteps([...steps, { step_key: 'arc', completed_on: '2026-11-07' }]).arrivalDocsDone, true);
  assert.deepEqual(summarizeSteps(undefined), { oecDone: false, visaDone: false, arrived: false, arrivalDocsDone: false });
});

test('OEC／簽證只有菲律賓仲介與管理者能編輯；在台文件只有台灣仲介與管理者', () => {
  for (const key of ['oec', 'visa']) {
    assert.equal(canManageStep('agency', 'philippines', key), true);
    assert.equal(canManageStep('agency', 'taiwan', key), false);
  }
  for (const key of ['entry_notification', 'insurance', 'arc', 'actual_entry']) {
    assert.equal(canManageStep('agency', 'taiwan', key), true);
    assert.equal(canManageStep('agency', 'philippines', key), false);
  }
  for (const key of Object.keys(STEP_OWNERS)) assert.equal(canManageStep('admin', null, key), true);
  for (const role of ['worker', 'employer', 'training_center']) assert.equal(canManageStep(role, null, 'oec'), false);
});

test('未指定負責單位的程序，兩種仲介都維持可編輯（不改變既有行為）', () => {
  for (const key of ['match_date', 'passport', 'document_arrival', 'personal_documents', 'pdos', 'medical', 'accr_in', 'accr_out', 'umid', 'training', 'owwa', 'expected_entry']) {
    assert.equal(canManageStep('agency', 'philippines', key), true, key);
    assert.equal(canManageStep('agency', 'taiwan', key), true, key);
  }
});

test('訓練只有訓練中心與管理者；抵台體檢只有台灣仲介與管理者', () => {
  assert.equal(canUpdateWorkflow('training_center', null, 'training'), true);
  assert.equal(canUpdateWorkflow('training_center', null, 'medical'), false);
  assert.equal(canUpdateWorkflow('agency', 'taiwan', 'medical'), true);
  assert.equal(canUpdateWorkflow('agency', 'taiwan', 'training'), false);
  assert.equal(canUpdateWorkflow('agency', 'philippines', 'training'), false);
  assert.equal(canUpdateWorkflow('agency', 'philippines', 'medical'), false);
  assert.equal(canUpdateWorkflow('admin', null, 'training'), true);
  assert.equal(canUpdateWorkflow('admin', null, 'medical'), true);
  assert.equal(canUpdateWorkflow('employer', null, 'training'), false);
  assert.equal(canUpdateWorkflow('worker', null, 'medical'), false);
  assert.equal(canUpdateWorkflow('admin', null, 'unknown'), false);
});

test('排訓練需文件全部核准；排抵台體檢需已登錄入境日期', () => {
  assert.match(workflowBlockReason('training', { gateClosed: true, documentsOpen: true, arrived: false }), /文件/);
  assert.match(workflowBlockReason('training', { gateClosed: false, documentsOpen: true, arrived: true }), /文件/);
  assert.equal(workflowBlockReason('training', { gateClosed: false, documentsOpen: false, arrived: false }), null);
  assert.match(workflowBlockReason('medical', { gateClosed: false, documentsOpen: false, arrived: false }), /入境日期/);
  assert.equal(workflowBlockReason('medical', { gateClosed: true, documentsOpen: true, arrived: true }), null);
});

test('狀態轉換維持既有規則', () => {
  assert.equal(canTransition('training', 'not_scheduled', 'scheduled'), true);
  assert.equal(canTransition('training', 'not_scheduled', 'completed'), false);
  assert.equal(canTransition('training', 'completed', 'scheduled'), false);
  assert.equal(canTransition('training', 'scheduled', 'scheduled'), true);
  assert.equal(canTransition('medical', 'failed', 'retest'), true);
  assert.equal(canTransition('medical', 'failed', 'passed'), false);
});

test('下一步提示指出負責單位', () => {
  assert.match(nextActionForStage('medical_training'), /訓練中心/);
  assert.match(nextActionForStage('application'), /菲律賓仲介.*OEC.*簽證/);
  assert.match(nextActionForStage('arrangement'), /台灣仲介.*體檢.*在台文件/);
  assert.equal(nextActionForStage('completed'), '');
});
