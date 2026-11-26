import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 會員頁面頂端要和系統管理頁面一樣，不能出現 iOS Safari 的模糊漸層：用一條固定、實色的頂端細條取代。
test('會員頁面頂端有固定、實色、與背景同色的細條', async () => {
  const css = await read('../src/components/hr-member-top-edge.css');
  const rule = css.match(/\.hr-member-shell:not\(\.hr-embedded\)::before \{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /position: fixed;/);
  assert.match(rule, /top: 0;/);
  assert.match(rule, /left: 0;/);
  assert.match(rule, /right: 0;/);
  assert.match(rule, /background: #f2f6f3;/, '要和會員頁背景同色，畫面才不會多一條');
  assert.match(rule, /pointer-events: none;/, '不能擋住點擊');
  assert.ok(!/blur|backdrop-filter|gradient/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), '不能再有模糊或漸層');
});

test('沒有新增會顯示的文字（不需要中英文翻譯）', async () => {
  const css = await read('../src/components/hr-member-top-edge.css');
  const contents = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/content:\s*'([^']*)'/g)].map(match => match[1]);
  assert.deepEqual(contents, ['']);
});

test('/hr 與 /hr/matching 都載入頂端細條樣式', async () => {
  for (const path of ['../src/app/hr/page.jsx', '../src/app/hr/matching/[[...view]]/page.jsx']) {
    const source = await read(path);
    assert.match(source, /import '@\/components\/hr-member-top-edge\.css';/, path);
  }
});

test('標題卡捲動時固定在頂端細條的正下方', async () => {
  const css = await read('../src/components/hr-member-top-edge.css');
  const rule = css.match(/\.hr-member-shell:not\(\.hr-embedded\) > \.hr-member-header \{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /position: sticky;/);
  assert.match(rule, /top: max\(12px, env\(safe-area-inset-top, 0px\)\);/, '要和細條同高，才不會重疊或留縫');
  assert.match(rule, /z-index: 26;/, '要蓋過內容、但在細條（25）之上不重疊');
});
