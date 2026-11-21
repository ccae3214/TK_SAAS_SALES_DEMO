import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

// 英文翻譯是逐個文字節點比對的。JSX 寫成「文字{變數}文字」會被 React 拆成多個節點，
// 整句翻譯規則就比對不到，所以句子中間有變數時必須先組成一整個字串。
test('工人首頁「必要文件待補」提示是單一文字節點，才對得上既有翻譯規則', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(portal.includes('{`有 ${needsCorrection.length} 份必要文件需要上傳或補件。`}'));
  assert.ok(!portal.includes('有 {needsCorrection.length} 份必要文件需要上傳或補件。'));
  const translations = await read('../src/lib/hr-translations.jsx');
  assert.ok(translations.includes('/^有 (\\d+) 份必要文件需要上傳或補件。$/'), '翻譯規則不見了');
  assert.match('有 1 份必要文件需要上傳或補件。', /^有 (\d+) 份必要文件需要上傳或補件。$/);
});

test('工人「訓練課程」說明文字整句組成單一字串，並有中英文版本', async () => {
  const training = await read('../src/components/HrWorkerTraining.jsx');
  assert.match(training, /import \{ useLanguage \} from '@\/context\/LanguageContext';/);
  assert.ok(training.includes('<p>{intro}</p>'));
  assert.ok(!training.includes('；{TRAINING_REMINDER_DAYS} 天內'), '不可把變數直接放在 JSX 文字中間');
  assert.ok(training.includes('`顯示您報名的證照課程日期與證照辦件日期；${TRAINING_REMINDER_DAYS} 天內的日期會出現在上方提醒。`'));
  assert.ok(training.includes('Dates within ${TRAINING_REMINDER_DAYS} days appear in the reminders above.'));
  assert.ok(training.indexOf('useLanguage()') < training.indexOf('if (learningCourseId) return'), 'hook 必須在提早 return 之前');
});
