import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// HrReminders 是 React 元件，沒有元件測試環境；這裡確認「讀取中或沒有提醒就不渲染」的守門條件還在。
const source = readFileSync(new URL('../src/components/HrReminders.jsx', import.meta.url), 'utf8');

test('the reminders panel renders nothing while loading or when there are no reminders', () => {
  assert.match(source, /if \(loading \|\| reminderCount === 0\) return null;/);
  assert.ok(source.indexOf('return null;') < source.indexOf('<section className={styles.panel}'));
});
