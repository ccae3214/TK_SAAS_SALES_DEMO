import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('訓練中心新增／編輯視窗層級高於會員端手機底部導覽列與頁首，按鈕不會被蓋住', async () => {
  const nav = await read('../src/components/hr-member-mobile-nav.css');
  const theme = await read('../src/components/hr-member-admin-theme.css');
  const css = await read('../src/components/HrManagement.module.css');
  const zOf = (text, re) => Number((text.match(re) || [])[1]);
  const navZ = zOf(nav, /nav\.workspace-tabs\s*\{[^}]*?z-index:\s*(\d+)/);
  const headerZ = zOf(theme, /> \.hr-member-header\s*\{[^}]*?z-index:\s*(\d+)/);
  const modalZ = zOf(css, /\.modalBackdrop,\.drawerBackdrop\{[^}]*?z-index:(\d+)/);
  assert.ok(navZ >= 900 && headerZ >= 905, '導覽列／頁首層級讀取失敗');
  assert.ok(modalZ > navZ && modalZ > headerZ, `視窗層級 ${modalZ} 必須高於導覽列 ${navZ}、頁首 ${headerZ}`);
});
