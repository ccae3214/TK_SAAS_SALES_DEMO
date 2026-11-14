import assert from 'node:assert/strict';
import test from 'node:test';
import { APPROVAL_MESSAGES, APPROVAL_NUMBER_MAX, validateApprovalFields } from '../src/lib/hr-employer-approval.js';
import { PROCESS_ROUTES, SINGLE_DATE_STEPS, STEP_DATE_LABELS, WORKER_PROGRESS_STEPS, routeOfStep } from '../src/lib/hr-worker-progress.js';
import { canManageStep, STEP_OWNERS } from '../src/lib/hr-case-flow.js';
import { WORKER_STAGE_EN, stageOfStep } from '../src/lib/hr-worker-stages.js';

const NEW_STEPS = ['employer_approval_submit', 'employer_approval_received', 'approval_mailed_ph'];

test('approval date and document number are both required', () => {
  assert.equal(validateApprovalFields({ approvalDate: '', approvalNumber: 'A-1' }).code, 'approval_date_required');
  assert.equal(validateApprovalFields({ approvalDate: '2026-11-14', approvalNumber: '  ' }).code, 'approval_number_required');
  assert.equal(validateApprovalFields({}).code, 'approval_date_required');
  assert.equal(validateApprovalFields({ approvalDate: '2026-02-30', approvalNumber: 'A-1' }).code, 'approval_date_invalid');
  assert.equal(validateApprovalFields({ approvalDate: 'x', approvalNumber: 'A-1' }).code, 'approval_date_invalid');
  assert.equal(validateApprovalFields({ approvalDate: '2026-11-14', approvalNumber: 'x'.repeat(APPROVAL_NUMBER_MAX + 1) }).code, 'approval_number_too_long');
});

test('valid approval fields are trimmed and normalised', () => {
  assert.deepEqual(validateApprovalFields({ approvalDate: ' 2026-11-14 ', approvalNumber: '  勞動發字   第 123 號 ' }), { ok: true, date: '2026-11-14', number: '勞動發字 第 123 號' });
});

test('every validation message has zh and en text', () => {
  for (const [code, message] of Object.entries(APPROVAL_MESSAGES)) {
    assert.ok(message.zh && message.en, code);
    assert.notEqual(message.zh, message.en, code);
  }
});

test('prep route has the three employer approval letter steps, in order, after matching', () => {
  const prep = PROCESS_ROUTES.find(route => route.key === 'prep');
  assert.deepEqual(prep.steps.slice(0, 4), ['match_date', ...NEW_STEPS]);
  const keys = WORKER_PROGRESS_STEPS.map(([key]) => key);
  for (const key of NEW_STEPS) {
    assert.ok(keys.includes(key), key);
    assert.equal(routeOfStep(key), 'prep');
    assert.equal(stageOfStep(key), 'C');
    assert.ok(SINGLE_DATE_STEPS.has(key), `${key} should be a single date step`);
    assert.ok(STEP_DATE_LABELS[key], `${key} needs a date label`);
  }
  assert.equal(new Set(keys).size, keys.length, 'no duplicate step keys');
});

test('approval letter steps are handled by the Taiwan agency (and admin)', () => {
  for (const key of NEW_STEPS) {
    assert.equal(STEP_OWNERS[key], 'taiwan');
    assert.equal(canManageStep('agency', 'taiwan', key), true);
    assert.equal(canManageStep('admin', null, key), true);
    assert.equal(canManageStep('agency', 'philippines', key), false);
    assert.equal(canManageStep('employer', null, key), false);
  }
});

test('new step labels and date labels have English translations', () => {
  const labels = [
    ...WORKER_PROGRESS_STEPS.filter(([key]) => NEW_STEPS.includes(key)).map(([, label]) => label),
    ...NEW_STEPS.map(key => STEP_DATE_LABELS[key]),
  ];
  for (const label of labels) assert.ok(WORKER_STAGE_EN[label], `missing English for ${label}`);
});
