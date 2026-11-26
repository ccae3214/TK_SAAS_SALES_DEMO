import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const rules = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

// 會員頁面的標題列要和系統管理頁面（.topbar）一樣：sticky、top: 0、滿版，頂端不留縫，iOS Safari 才不會加模糊。
test('標題列貼齊頂端（sticky, top: 0），上方沒有圓角', async () => {
  const css = rules(await read('../src/components/hr-member-top-edge.css'));
  const rule = css.match(/\n\.hr-member-shell:not\(\.hr-embedded\) > \.hr-member-header \{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /position: sticky;/);
  assert.match(rule, /top: 0;/);
  assert.match(rule, /margin: 0 calc\(-1 \* var\(--hr-shell-pad\)\) 18px;/, '用負邊距變成滿版');
  assert.match(rule, /border-radius: 0 0 22px 22px;/, '上方不能有圓角');
  assert.match(rule, /env\(safe-area-inset-top, 0px\)/);
});

test('會員頁上方不留空白，也不再用頂端細條或模糊', async () => {
  const css = rules(await read('../src/components/hr-member-top-edge.css'));
  assert.match(css, /\.hr-member-shell:not\(\.hr-embedded\) \{[^}]*padding-top: 0;/);
  assert.ok(!css.includes('::before'), '不再用頂端細條');
  assert.ok(!/blur|backdrop-filter/.test(css));
  assert.match(css, /@media \(max-width: 700px\) \{[\s\S]*--hr-shell-pad: 12px;/, '手機的負邊距要等於手機的 12px 留白');
});

test('沒有新增會顯示的文字（不需要中英文翻譯）', async () => {
  const css = rules(await read('../src/components/hr-member-top-edge.css'));
  assert.ok(!/content:/.test(css));
});

test('/hr 與 /hr/matching 都載入標題列樣式', async () => {
  for (const path of ['../src/app/hr/page.jsx', '../src/app/hr/matching/[[...view]]/page.jsx']) {
    const source = await read(path);
    assert.match(source, /import '@\/components\/hr-member-top-edge\.css';/, path);
  }
});
