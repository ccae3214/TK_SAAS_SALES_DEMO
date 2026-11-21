import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingEvents } from '../src/lib/hr-worker-training.js';
import { TRAINING_CENTER_EN, translateTrainingCenterPattern } from '../src/lib/hr-translations-training.js';

// 模擬 translateHrText：先查字典，再走句型（句型內的子字串用同一個函式翻譯）。
const translate = text => TRAINING_CENTER_EN[text] || translateTrainingCenterPattern(text, translate) || text;

// 工人「訓練課程」與提醒面板的日期標籤（含考場、辦件狀態）切換英文時都要有翻譯。
test('帶考場與辦件狀態的日期標籤有英文翻譯', () => {
  assert.equal(translate('考證日期（台北考場）'), 'Exam date (台北考場)');
  assert.equal(translate('證照辦件日期（已送件）'), 'Certification application date (Submitted)');
  assert.equal(translate('證照辦件日期（準備中）'), 'Certification application date (Preparing)');
  assert.equal(translate('證照辦件日期（已發證）'), 'Certification application date (Issued)');
});

test('trainingEvents 產生的帶括號標籤都會被句型翻譯', () => {
  const events = trainingEvents({
    training_start_date: '2026-12-01', training_end_date: '2026-12-20', exam_date: '2026-12-25',
    exam_location: 'Taipei', batch_applied_date: '2026-12-26', batch_status: 'submitted', certificate_issue_date: '2027-01-10',
  });
  const labels = Object.fromEntries(events.map(event => [event.key, translate(event.label)]));
  assert.equal(labels.exam, 'Exam date (Taipei)');
  assert.equal(labels.applied, 'Certification application date (Submitted)');
});

// 工人訓練課程卡片的「· 40 小時」（課程時數）。
test('課程時數「· N 小時」有英文翻譯', () => {
  assert.equal(translate('· 40 小時'), '· 40 hours');
  assert.equal(translate('· 1 小時'), '· 1 hour');
});

// 單元的詞彙量（訓練中心單元表、工人學習頁的單元清單與單元內頁）。
test('單元詞彙量有英文翻譯', () => {
  assert.equal(translate('詞彙量'), 'Vocabulary count');
  assert.equal(translate('35 個詞彙'), '35 words');
  assert.equal(translate('· 35 個詞彙'), '· 35 words');
  assert.equal(translate('1 個詞彙'), '1 word');
});
