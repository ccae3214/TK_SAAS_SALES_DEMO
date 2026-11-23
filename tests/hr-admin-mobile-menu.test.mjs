import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Windows 的工作目錄可能是 CRLF 換行，先統一成 LF 再比對。
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 系統管理員頁面（HrManagement）手機版：功能菜單固定在畫面最底部。
// 樣式用 HTML 結構選擇器（CSS Module 的 class 會被改名），所以這裡確認 HrManagement 的結構沒有被改掉。
test('HrManagement 仍保有手機底部選單依賴的結構', async () => {
  const source = await read('../src/components/HrManagement.jsx');
  assert.ok(source.includes('<div className={styles.app} data-hr-translatable-root>'), '根元素要有 data-hr-translatable-root');
  assert.ok(source.includes('<aside className={`${styles.sidebar}'), '選單要是根元素底下的 <aside>');
  assert.ok(source.includes('<nav className={styles.nav}>'), 'aside 底下要有 <nav>');
  assert.ok(source.includes("className={active===id?styles.navActive:''}"), '選中的分頁要用 styles.navActive');
  assert.ok(source.includes('data-tour={`nav-${id}`}'));
  assert.ok(source.includes('<main className={styles.main}>'));
  assert.ok(source.includes('<header className={styles.topbar}>'));
  // 底部選單 CSS 預設 nav 前面有品牌區、後面有帳號區（手機會隱藏），且選單是 aside 的子元素
  assert.match(source, /<aside[^>]*>\s*<div className=\{styles\.brand\}>[\s\S]*?<\/div>\s*<div className=\{styles\.workspaceLabel\}>[\s\S]*?<nav className=\{styles\.nav\}>[\s\S]*?<\/nav>\s*<div className=\{styles\.sidebarBottom\}>/);
});

test('底部選單的 CSS 只在手機（720px 以下）生效，並選到 aside > nav', async () => {
  const css = await read('../src/components/hr-admin-mobile-nav.css');
  const media = css.indexOf('@media (max-width: 720px)');
  assert.ok(media > 0, '缺少手機斷點');
  const mobile = css.slice(media);
  assert.ok(mobile.includes('div[data-hr-translatable-root] > aside {\n    position: fixed;'));
  assert.ok(mobile.includes('bottom: 0;'));
  assert.ok(mobile.includes('env(safe-area-inset-bottom'), '要留出 iPhone 底部安全區');
  assert.ok(mobile.includes('overflow-x: auto'), '選單項目多，要能左右滑動');
  assert.ok(mobile.includes('button[class*="navActive"]'));
  // 桌機：手機專用按鈕不顯示；固定定位的選單只出現在手機區塊內
  assert.ok(css.slice(0, media).includes('.hr-admin-mobile-actions { display: none; }'));
  assert.ok(!css.slice(0, media).includes('position: fixed'));
});

test('手機版語言切換與登出按鈕有中英文，並掛在 /hr 管理者頁面', async () => {
  const bar = await read('../src/components/HrAdminMobileBar.jsx');
  assert.ok(bar.includes("zh: { signOut: '登出' }"));
  assert.ok(bar.includes("en: { signOut: 'Sign out' }"));
  assert.ok(bar.includes('<HrLanguageToggle'));
  assert.ok(bar.includes("signOut({ callbackUrl: '/' })"));
  const page = await read('../src/app/hr/page.jsx');
  assert.ok(page.includes("import '@/components/hr-admin-mobile-nav.css';"));
  const admin = page.slice(page.indexOf('<HrManagement'));
  assert.ok(admin.includes('<HrAdminMobileBar />'));
  assert.ok(!page.slice(0, page.indexOf('<HrManagement')).includes('<HrAdminMobileBar'), '會員頁面不顯示管理者按鈕');
});
