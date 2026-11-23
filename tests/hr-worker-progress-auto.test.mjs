import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_SOURCE_LABELS, applyAutoStep, deriveAutoSteps, toTaipeiDate } from '../src/lib/hr-worker-progress-auto.js';

const doc = (name, status, approvedAt, extra = {}) => ({ name, required: true, applicable: true, status, approved_at: approvedAt, ...extra });

test('沒有任何資料時不帶入任何項目', () => {
  assert.deepEqual(deriveAutoSteps({ today: '2026-11-23' }), {});
});

test('時間轉成台灣日期：UTC 晚上 8 點已經是台灣隔天', () => {
  assert.equal(toTaipeiDate('2026-11-22T20:30:00.000Z'), '2026-11-23');
  assert.equal(toTaipeiDate(new Date('2026-11-22T03:00:00.000Z')), '2026-11-22');
  assert.equal(toTaipeiDate('2026-11-22'), '2026-11-22');
  assert.equal(toTaipeiDate(''), '');
  assert.equal(toTaipeiDate('not-a-date'), '');
});

test('配工日期取最早的案件建立日期；核准函取最近一次上傳日期', () => {
  const auto = deriveAutoSteps({
    caseCreatedAt: ['2026-10-05T01:00:00Z', '2026-09-01T01:00:00Z'],
    approvalLetterUploadedAt: ['2026-10-20T01:00:00Z', '2026-11-02T01:00:00Z'],
    today: '2026-11-23',
  });
  assert.deepEqual(auto.match_date, { started_on: '', completed_on: '2026-09-01', source: 'case_created' });
  assert.deepEqual(auto.employer_approval_received, { started_on: '', completed_on: '2026-11-02', source: 'approval_letter' });
});

test('護照：「新護照」核准才帶入，不適用或未核准都不帶入', () => {
  const approved = deriveAutoSteps({ documents: [doc('新護照', 'approved', '2026-10-10T02:00:00Z')] });
  assert.equal(approved.passport.completed_on, '2026-10-10');
  assert.equal(deriveAutoSteps({ documents: [doc('新護照', 'submitted', null)] }).passport, undefined);
  assert.equal(deriveAutoSteps({ documents: [doc('新護照', 'approved', '2026-10-10T02:00:00Z', { applicable: false })] }).passport, undefined);
  assert.equal(deriveAutoSteps({ documents: [doc('舊護照', 'approved', '2026-10-10T02:00:00Z')] }).passport, undefined);
});

test('個人文件：全部必要文件核准才帶入，取最晚的核准日期；選填文件不影響', () => {
  const documents = [
    doc('新護照', 'approved', '2026-10-10T02:00:00Z'),
    doc('PEOS', 'approved', '2026-10-15T02:00:00Z'),
    doc('ARC', 'missing', null, { applicable: false }),
    doc('簽證 Visa', 'missing', null, { required: false }),
  ];
  assert.equal(deriveAutoSteps({ documents }).personal_documents.completed_on, '2026-10-15');
  assert.equal(deriveAutoSteps({ documents }).personal_documents.source, 'documents_approved');
  const open = [...documents, doc('NBI（確認有效期限）', 'submitted', null)];
  assert.equal(deriveAutoSteps({ documents: open }).personal_documents, undefined);
  assert.equal(deriveAutoSteps({ documents: [] }).personal_documents, undefined);
});

test('訓練：有報名班別就帶入開始日；結訓日已過才帶入完成日', () => {
  const classes = [{ start: '2026-10-01', end: '2026-11-01' }, { start: '2026-11-10', end: '2026-12-20' }];
  assert.deepEqual(deriveAutoSteps({ classes, today: '2026-11-23' }).training, { started_on: '2026-10-01', completed_on: '', source: 'training_classes' });
  assert.deepEqual(deriveAutoSteps({ classes, today: '2026-12-21' }).training, { started_on: '2026-10-01', completed_on: '2026-12-20', source: 'training_classes' });
  assert.equal(deriveAutoSteps({ classes: [], today: '2026-11-23' }).training, undefined);
});

test('手動日期永遠優先；沒有手動日期（只有備註）時才補上自動值', () => {
  const auto = { started_on: '', completed_on: '2026-10-10', source: 'passport_approved' };
  const manual = { step_key: 'passport', started_on: '', completed_on: '2026-10-12', note: '' };
  assert.deepEqual(applyAutoStep(manual, auto), { ...manual, auto_source: null });
  const noteOnly = { step_key: 'passport', started_on: '', completed_on: '', note: '待補' };
  assert.deepEqual(applyAutoStep(noteOnly, auto), { ...noteOnly, completed_on: '2026-10-10', auto_source: 'passport_approved' });
  assert.deepEqual(applyAutoStep(noteOnly, undefined), { ...noteOnly, auto_source: null });
});

test('每個來源代碼都有中文說明', () => {
  const sources = new Set(Object.values(deriveAutoSteps({
    documents: [doc('新護照', 'approved', '2026-10-10T02:00:00Z')],
    caseCreatedAt: ['2026-09-01'], approvalLetterUploadedAt: ['2026-10-01'], classes: [{ start: '2026-10-01', end: '2026-11-01' }], today: '2026-11-23',
  })).map(item => item.source));
  for (const source of sources) assert.ok(AUTO_SOURCE_LABELS[source], source);
});
