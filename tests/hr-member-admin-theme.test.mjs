import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const rules = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const PREFIX = 'html body .hr-member-shell:not(.hr-embedded)';

// 會員頁整體樣式要和系統管理頁（HrManagement）一樣；頁首是貼齊頂端、滿版的白色標題列。
test('選擇器優先權高於 hr-member-mobile-nav.css（body .hr-member-shell...），才不會又被蓋掉', async () => {
  const css = rules(await read('../src/components/hr-member-admin-theme.css'));
  const selectors = [...css.matchAll(/(^|\n)\s*([^{}@\n][^{}]*)\{/g)].map(m => m[2].trim()).filter(s => !s.startsWith('@'));
  assert.ok(selectors.length > 10);
  for (const group of selectors) for (const selector of group.split(',')) assert.ok(selector.trim().startsWith(PREFIX), selector);
});

test('頁首和管理頁 .topbar 一樣：sticky、top: 0、滿版、白底、無圓角', async () => {
  const css = rules(await read('../src/components/hr-member-admin-theme.css'));
  const rule = css.match(/\n\Shtml body \.hr-member-shell:not\(\.hr-embedded\) > \.hr-member-header \{([^}]*)\}/)?.[1]
    || css.match(/html body \.hr-member-shell:not\(\.hr-embedded\) > \.hr-member-header \{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /position: sticky;/);
  assert.match(rule, /top: 0;/);
  assert.match(rule, /margin: 0 calc\(-1 \* var\(--hr-pad-right\)\) 25px calc\(-1 \* var\(--hr-pad-left\)\);/);
  assert.match(rule, /border-radius: 0;/);
  assert.match(rule, /background: rgba\(255, 255, 255, 0\.82\);/, '同管理頁 .topbar');
  assert.match(css, new RegExp(`${PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{[^}]*padding-top: 0;`), '頁面上方不留縫');
});

test('手機的左右負邊距和 hr-member-mobile-nav.css 的留白一致', async () => {
  const css = rules(await read('../src/components/hr-member-admin-theme.css'));
  const mobileNav = await read('../src/components/hr-member-mobile-nav.css');
  assert.ok(mobileNav.includes('padding: 12px max(14px, var(--member-nav-right))'), '手機留白若改了，這裡的負邊距也要跟著改');
  assert.match(css, /--hr-pad-left: max\(14px, var\(--member-nav-left, 0px\)\);/);
  assert.match(css, /--hr-pad-right: max\(14px, var\(--member-nav-right, 0px\)\);/);
});

test('只新增分隔符號「/」，沒有需要翻譯的文字', async () => {
  const css = rules(await read('../src/components/hr-member-admin-theme.css'));
  const contents = [...css.matchAll(/content:\s*'([^']*)'/g)].map(m => m[1]);
  assert.deepEqual(contents, ['/']);
});

test('/hr 與 /hr/matching 都在 mobile-nav、side-nav 之後載入這個樣式', async () => {
  for (const path of ['../src/app/hr/page.jsx', '../src/app/hr/matching/[[...view]]/page.jsx']) {
    const source = await read(path);
    const theme = source.indexOf("import '@/components/hr-member-admin-theme.css';");
    assert.ok(theme > source.indexOf('hr-member-mobile-nav.css') && theme > source.indexOf('hr-member-side-nav.css'), path);
  }
});
