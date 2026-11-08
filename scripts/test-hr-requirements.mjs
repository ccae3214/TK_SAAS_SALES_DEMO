// 執行：node --test scripts/test-hr-requirements.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveApplicability, buildRequirementRows, ENTRY_GATE_DOCUMENTS, WORKER_DOCUMENTS, certificationNamesForJobType, CERTIFICATION_STATUSES } from '../src/lib/hr-requirements.js';

const rowsByName = profile => Object.fromEntries(buildRequirementRows(profile).map(row => [row.name, row]));

test('前置文件只有新護照與 PSA 出生證明，體檢文件不是前置', () => {
  const rows = rowsByName({});
  const gates = Object.values(rows).filter(row => row.entryGate).map(row => row.name).sort();
  assert.deepEqual(gates, [...ENTRY_GATE_DOCUMENTS].sort());
  assert.equal(rows['體檢 Medical'].entryGate, false);
  assert.equal(rows['體檢 Medical'].applicable, true);
});

test('空履歷：條件式文件維持不適用，其餘 15 項適用', () => {
  const rows = buildRequirementRows({});
  assert.equal(rows.length, WORKER_DOCUMENTS.length);
  assert.equal(rows.filter(row => row.applicability && row.applicable).length, 0);
  assert.equal(rows.filter(row => !row.applicability && row.applicable).length, 15);
});

test('已婚 + 有子女 → 結婚證明與子女出生證明', () => {
  const rows = rowsByName({ maritalStatus: '已結婚', numberOfChildren: '2' });
  assert.equal(rows['PSA結婚證明（附收據）'].applicable, true);
  assert.equal(rows['子女PSA出生證明（附收據）'].applicable, true);
  assert.equal(rows['PSA CENOMAR'].applicable, false);
});

test('單身無子女 → CENOMAR；子女人數 0 不適用', () => {
  const rows = rowsByName({ maritalStatus: '單身', numberOfChildren: '0', childrenAges: '' });
  assert.equal(rows['PSA CENOMAR'].applicable, true);
  assert.equal(rows['PSA結婚證明（附收據）'].applicable, false);
  assert.equal(rows['子女PSA出生證明（附收據）'].applicable, false);
});

test('「有伴侶」或欄位空白不猜測，交給仲介', () => {
  const rows = rowsByName({ maritalStatus: '有伴侶' });
  assert.equal(rows['PSA CENOMAR'].applicable, false);
  assert.equal(rows['PSA結婚證明（附收據）'].applicable, false);
});

test('子女人數未填但有子女年齡 → 視為有子女', () => {
  assert.equal(deriveApplicability({ childrenAges: '5,2' })['子女PSA出生證明（附收據）'], true);
});

test('曾在台灣工作 → ARC、Health Card 與 DMW', () => {
  const rows = rowsByName({ workedAbroad: '是', overseasExperiences: [{ workplace: 'Taichung, Taiwan', period: '2019-2022', title: 'caregiver', content: '' }] });
  assert.equal(rows['ARC'].applicable, true);
  assert.equal(rows['Health Card'].applicable, true);
  assert.equal(rows['DMW Info Sheet'].applicable, true);
});

test('曾在其他國家工作 → 只有 DMW', () => {
  const rows = rowsByName({ workedAbroad: '是', overseasExperiences: [{ workplace: 'Hong Kong', period: '2018', title: '', content: '' }] });
  assert.equal(rows['DMW Info Sheet'].applicable, true);
  assert.equal(rows['ARC'].applicable, false);
  assert.equal(rows['Health Card'].applicable, false);
});

test('舊版 overseasWorkDetails 文字也能判斷；workedAbroad 為否則不適用', () => {
  assert.equal(deriveApplicability({ overseasWorkDetails: '2020 台灣 家庭看護' })['ARC'], true);
  assert.equal(deriveApplicability({ workedAbroad: '否' })['DMW Info Sheet'], false);
});

test('出生逾10年補登證明無法推導，永遠不自動適用', () => {
  const rows = rowsByName({ maritalStatus: '已結婚', numberOfChildren: '3', workedAbroad: '是' });
  assert.equal(rows['出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）'].applicable, false);
});

test('壞資料不會丟例外', () => {
  for (const bad of [null, undefined, 'x', 5, [], { overseasExperiences: 'oops' }]) assert.doesNotThrow(() => buildRequirementRows(bad));
});

test('案件專屬證照：看護類職類需要 Caregiving NC2，其他職類沒有', () => {
  assert.deepEqual(certificationNamesForJobType('家庭看護'), ['Caregiving NC2']);
  assert.deepEqual(certificationNamesForJobType('機構看護工'), ['Caregiving NC2']);
  assert.deepEqual(certificationNamesForJobType('工廠技術工'), []);
  assert.deepEqual(certificationNamesForJobType(''), []);
  assert.deepEqual(certificationNamesForJobType(undefined), []);
  assert.deepEqual(CERTIFICATION_STATUSES, ['not_started', 'training', 'assessment', 'obtained']);
});
