import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// 這些 API 回傳／修改「屬於某個 email」的資料，必須先確認是本人或管理者。
const owned = [
  'src/app/api/orders/user/[email]/route.js',
  'src/app/api/cart/route.js',
  'src/app/api/cart/[email]/route.js',
  'src/app/api/wishlist/[email]/route.js',
];

test('訂單／購物車／願望清單 API 都先檢查本人或管理者', async () => {
  for (const path of owned) {
    const source = await read(path);
    assert.match(source, /requireOwnerOrAdmin\(request,/, path);
    // 驗證要在任何資料庫存取之前
    const guard = source.indexOf('requireOwnerOrAdmin(request,');
    for (const db of ['await query(', 'await run(']) {
      const first = source.indexOf(db);
      if (first >= 0) assert.ok(guard < first, `${path}: 驗證必須在 ${db} 之前`);
    }
  }
});

test('GET /api/orders：不帶 email 只有管理者；帶 email 要是本人', async () => {
  const source = await read('src/app/api/orders/route.js');
  assert.match(source, /requireOwnerOrAdmin\(request, email\)/);
  assert.match(source, /const admin = await requireAdmin\(\);\s*if \(!admin\.authorized\) return admin\.response;\s*const orders = await query\('SELECT \* FROM orders ORDER BY/);
});

test('購物車 API 有 import requireCsrf（少了會 ReferenceError，整支寫入永遠 500）', async () => {
  for (const path of ['src/app/api/cart/route.js', 'src/app/api/cart/[email]/route.js', 'src/app/api/wishlist/[email]/route.js']) {
    const source = await read(path);
    if (/requireCsrf\(/.test(source)) assert.match(source, /import \{[^}]*requireCsrf[^}]*\} from '@\/lib\/security'/, path);
  }
});

test('錯誤回應不洩漏內部訊息（error.message）', async () => {
  for (const path of [...owned, 'src/app/api/orders/route.js']) {
    assert.doesNotMatch(await read(path), /details:\s*error\.message/, path);
  }
});

test('商店登入／註冊會發 cookie，登出會清除；管理者只認 NextAuth 登入', async () => {
  for (const path of ['src/app/api/users/login/route.js', 'src/app/api/users/register/route.js']) {
    const source = await read(path);
    assert.match(source, /createShopSessionToken\(user\.email\)/, path);
    assert.match(source, /response\.cookies\.set\(shopSessionCookie/, path);
  }
  assert.match(await read('src/app/api/users/logout/route.js'), /clearedShopSessionCookie/);
  const security = await read('src/lib/security.js');
  assert.match(security, /const isAdmin = !!sessionEmail && getAdminEmails\(\)\.includes\(sessionEmail\)/);
});

test('資料庫埠只綁本機，不對外網開放', async () => {
  const compose = await read('docker-compose.yml');
  assert.match(compose, /- "127\.0\.0\.1:5433:5432"/);
  assert.doesNotMatch(compose, /^\s*- "(?:5432|5433):5432"/m);
});
