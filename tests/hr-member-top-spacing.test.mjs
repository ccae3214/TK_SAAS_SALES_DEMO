import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

// 以前語言按鈕（HrLanguageTools 非 inline 版）固定浮在頁面頂端中央，
// 所以會員頁頂部才要留出一塊空白（手機 58px、桌機最多 44px）。
// 現在按鈕放進頁首，頂部就不需要留空了。
test('會員頁頂部不再留大塊空白', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(source.includes('padding:clamp(14px,3.5vw,44px);padding-top:12px;'), '桌機頂部間距應為 12px');
  assert.ok(source.includes('@media(max-width:700px){.hr-member-shell{padding:12px}'), '手機不可再有 58px 的頂部間距');
  assert.ok(!source.includes('padding:58px 12px 12px'));
});

test('語言按鈕放在三種會員頁首內，不再浮在頁面頂端', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  const headers = [...source.matchAll(/<header className="hr-member-header[^"]*">[\s\S]*?<\/header>/g)].map(match => match[0]);
  assert.equal(headers.length, 3, '應有 3 個會員頁首（會員類型審核、訓練中心、一般會員）');
  for (const header of headers) assert.ok(header.includes('<HrLanguageTools inline />'), '頁首要含 inline 語言按鈕');
  // 只剩「載入中」與「載入失敗」兩個沒有頁首的畫面使用浮動按鈕（它們的卡片本來就置中，不會被蓋住）
  assert.equal(source.split('<HrLanguageTools />').length - 1, 2);
  assert.equal(source.split('<HrLanguageTools inline />').length - 1, 3);
});
