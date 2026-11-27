import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const JOB_TYPES = ['家庭看護', '家庭幫傭', '機構看護工', '工廠技術工', '農工'];

test('會員頁不使用 HTML numeric entity（缺分號會直接顯示殘字並寫入 DB）', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  assert.equal(portal.match(/&#x?[0-9a-fA-F]+/g), null);
});

test('雇主編輯需求的職類選項有固定 value，與建立表單相同', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  const start = portal.indexOf('<select value={orderEditForm.jobType}');
  assert.ok(start > 0, '找不到編輯需求的職類選單');
  const select = portal.slice(start, portal.indexOf('</select>', start));
  for (const type of JOB_TYPES) assert.ok(select.includes(`<option value="${type}">${type}</option>`), `缺少 ${type}`);
  assert.ok(!/<option>/.test(select), '選項不可依賴顯示文字當值');
  assert.ok(!select.includes('家庭幫僱'), '應與全系統一致使用「家庭幫傭」');
});
