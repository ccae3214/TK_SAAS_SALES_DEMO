import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Windows 的工作目錄可能是 CRLF 換行，先統一成 LF 再比對。
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 雇主、仲介、訓練中心會員頁（桌機）要和系統管理員頁面一樣：功能選單固定在左側。
// 手機版維持底部選單，所以側邊樣式只能放在 701px 以上的 media query 裡。
test('側邊選單樣式只作用在桌機（701px 以上）', async () => {
  const css = await read('../src/components/hr-member-side-nav.css');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(rules.includes('@media (min-width: 701px) {'), '缺少桌機 media query');
  const outside = rules.replace(/@media \(min-width: 701px\)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.equal(outside.trim(), '', '側邊選單的規則不能寫在 media query 外面（會影響手機底部選單）');
});

test('選單是固定在左側的 nav.workspace-tabs，寬度和管理員側邊欄一致', async () => {
  const css = await read('../src/components/hr-member-side-nav.css');
  assert.match(css, /nav\.workspace-tabs \{[^}]*position: fixed;[^}]*left: 0;/);
  assert.ok(css.includes('clamp(200px, 22vw, 248px)'), '最寬 248px，和管理員側邊欄相同');
  assert.ok(css.includes('linear-gradient(180deg, #0c3327 0, #134e3b 55%, #176b54 100%)'), '背景色要和管理員側邊欄相同');
  assert.match(css, /button\.active,[\s\S]*?button\.active:hover \{[^}]*background: #fff;[^}]*color: #0f5a46;/, '選中狀態要和管理員相同（白底深綠字）');
});

test('內容只在真的有選單時才讓位，雇主建立需求頁（沒有選單）不留空白', async () => {
  const css = await read('../src/components/hr-member-side-nav.css');
  assert.ok(css.includes(':not(.hr-order-create-route):has(nav.workspace-tabs)'));
  assert.ok(css.includes('padding-left: calc(var(--hr-side-w) +'));
});

test('不新增任何會顯示的文字（只有品牌符號 K），所以不需要中英文翻譯', async () => {
  const css = await read('../src/components/hr-member-side-nav.css');
  const contents = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/content:\s*'([^']*)'/g)].map(match => match[1]);
  assert.deepEqual([...new Set(contents)], ['K']);
});

test('雇主、仲介、訓練中心的 /hr 頁面有 .hr-side-nav 包裝；工作者與管理員沒有', async () => {
  const source = await read('../src/app/hr/page.jsx');
  assert.match(source, /import '@\/components\/hr-member-side-nav\.css';/);
  assert.match(source, /const SIDE_NAV_ROLES = new Set\(\['employer', 'agency', 'training_center'\]\);/);
  assert.ok(!source.includes("'worker'"), '工作者維持原本的上方分頁');
  assert.ok(source.includes("className={SIDE_NAV_ROLES.has(principal?.role) ? 'hr-side-nav' : undefined}"));
  const wrapper = source.indexOf('hr-side-nav');
  const admin = source.indexOf('<HrManagement');
  assert.ok(wrapper > 0 && wrapper < admin, '包裝只能出現在會員頁面那一段');
});

test('雇主需求與配對頁（/hr/matching）也使用同一套側邊選單', async () => {
  const source = await read('../src/app/hr/matching/[[...view]]/page.jsx');
  assert.match(source, /import '@\/components\/hr-member-side-nav\.css';/);
  assert.match(source, /<div className="hr-side-nav">\s*<HrMemberPortal /);
});
