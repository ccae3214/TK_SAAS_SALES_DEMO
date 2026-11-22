import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { HR_INLINE_HELP_ROLES, HR_TOUR_START_EVENT } from '../src/lib/hr-help-events.js';

// Windows 的工作目錄可能是 CRLF 換行，先統一成 LF 再比對。
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 訓練中心會員頁要和工作者頁面一樣：功能選單（nav.workspace-tabs）手機時固定在畫面底部，
// 「使用導覽」與「介紹影片」按鈕放在總覽裡，不再用左下角浮動按鈕（浮動按鈕會擋到底部選單）。
test('訓練中心不再顯示左下角的浮動導覽按鈕', () => {
  for (const role of ['worker', 'employer', 'agency', 'training_center']) assert.ok(HR_INLINE_HELP_ROLES.includes(role), role);
  assert.ok(!HR_INLINE_HELP_ROLES.includes('admin'), '管理者仍使用浮動按鈕');
});

test('訓練中心會員頁的功能分頁是 nav.workspace-tabs；管理者頁面維持原本的按鈕列', async () => {
  const source = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  const nav = source.indexOf('{self && <nav className="workspace-tabs"');
  const oldBar = source.indexOf("{!self && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px 4px' }}>");
  assert.ok(nav >= 0, '缺少 nav.workspace-tabs');
  assert.ok(oldBar > nav, '管理者的按鈕列必須只在 !self 時顯示');
  assert.match(source, /<\/div>\}\n    <\/section>/, '按鈕列的結尾要跟著條件一起關閉');
  assert.equal(source.split('data-tour={`tc-tab-${id}`}').length - 1, 2, '導覽用的 data-tour 只能出現在 nav 與管理者按鈕列各一次（兩者互斥）');
  assert.ok(source.includes("aria-current={tab === id ? 'page' : undefined}"));
});

test('每一個分頁都有圖示（新增分頁卻忘了補圖示會讓整頁壞掉）', async () => {
  const source = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  const tabs = [...source.match(/const TABS = (\[.*\]);/)[1].matchAll(/\['([a-z]+)',/g)].map(match => match[1]);
  const audit = source.match(/const AUDIT_TAB = \['([a-z]+)'/)[1];
  const icons = Object.keys(Object.fromEntries([...source.match(/const TAB_ICONS = \{([^}]*)\}/)[1].matchAll(/([a-z]+): [A-Za-z]+/g)].map(match => [match[1], 1])));
  for (const id of [...tabs, audit]) assert.ok(icons.includes(id), `分頁 ${id} 沒有圖示`);
});

test('使用導覽與介紹影片按鈕都在總覽裡；導覽按鈕只在會員頁（self）顯示', async () => {
  const source = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  const start = source.indexOf("{tab === 'overview' && (() => {");
  const end = source.indexOf("{tab === 'teachers'");
  assert.ok(start >= 0 && end > start);
  const overview = source.slice(start, end);
  assert.ok(overview.includes('{self && <button'), '導覽按鈕只在訓練中心自己的頁面顯示（管理者頁面沒有這個導覽）');
  assert.ok(overview.includes('window.dispatchEvent(new CustomEvent(HR_TOUR_START_EVENT))'));
  assert.ok(overview.includes('setIntroOpen(true)'));
  assert.ok(overview.includes("lang === 'en' ? 'Quick tour' : '使用導覽'"), '導覽按鈕要有英文');
  assert.match(source, /import \{ HR_TOUR_START_EVENT \} from '@\/lib\/hr-help-events';/);
  assert.equal(HR_TOUR_START_EVENT, 'hr-help:start-tour');
});
