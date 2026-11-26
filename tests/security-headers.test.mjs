import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import nextConfig from '../next.config.js';
import { MIN_PASSWORD_LENGTH } from '../src/lib/passwords.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('next.config 的安全標頭：同源可嵌入（文件預覽 iframe 需要），且與 nginx 一致', async () => {
  const [{ headers }] = await nextConfig.headers();
  const value = key => headers.find(item => item.key === key)?.value;
  assert.equal(value('X-Frame-Options'), 'SAMEORIGIN');
  assert.equal(value('X-Content-Type-Options'), 'nosniff');
  const nginx = await read('nginx.conf');
  assert.ok(nginx.includes(`add_header Permissions-Policy "${value('Permissions-Policy')}" always;`), 'Permissions-Policy 要和 nginx 相同');
  assert.ok(nginx.includes('add_header X-Frame-Options SAMEORIGIN always;'));
});

test('nginx 送出 HSTS，並丟掉 app 重複送的安全標頭', async () => {
  const nginx = await read('nginx.conf');
  assert.match(nginx, /add_header Strict-Transport-Security "max-age=\d{7,}" always;/);
  for (const name of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.ok(nginx.includes(`proxy_hide_header ${name};`), name);
  }
});

test('CSP 禁用 plugin 物件並鎖定 base 與 frame-ancestors', async () => {
  // middleware 依賴 next/server，無法直接在 node:test 載入，所以檢查設定原文。
  const source = await read('src/middleware.js');
  for (const directive of ["default-src 'self'", "frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'"]) {
    assert.ok(source.includes(`"${directive}"`), directive);
  }
  assert.match(source, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
});

test('會員密碼最短長度至少 10 字元', () => {
  assert.ok(MIN_PASSWORD_LENGTH >= 10);
});
