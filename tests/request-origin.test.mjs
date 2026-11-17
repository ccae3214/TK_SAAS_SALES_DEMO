import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { requestIsSameOrigin } from '../src/lib/request-origin.js';

const req = (headers = {}, url = 'https://app.example.com/api/hr') => new Request(url, { method: 'POST', headers });

test('沒有 Origin 標頭一律拒絕', () => {
  assert.equal(requestIsSameOrigin(req()), false);
});

test('Origin 與請求網址相同才通過，其他網站被拒絕', () => {
  assert.equal(requestIsSameOrigin(req({ origin: 'https://app.example.com' })), true);
  assert.equal(requestIsSameOrigin(req({ origin: 'https://evil.example.net' })), false);
  assert.equal(requestIsSameOrigin(req({ origin: 'not a url' })), false);
});

test('反向代理轉送的 Host 與 x-forwarded-proto 視為本站', () => {
  const proxied = req({ origin: 'https://www.example.org', 'x-forwarded-host': 'www.example.org', 'x-forwarded-proto': 'https' }, 'http://localhost:3000/api/hr');
  assert.equal(requestIsSameOrigin(proxied), true);
});

test('APP_ORIGIN 設定的網址視為本站', () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'https://hr.example.com/';
  try { assert.equal(requestIsSameOrigin(req({ origin: 'https://hr.example.com' }, 'http://localhost:3000/api/hr')), true); }
  finally { if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous; }
});

// 防止有人又在路由裡複製一份：同源檢查只能定義在 src/lib/request-origin.js。
test('src 內只有 request-origin.js 定義同源檢查', () => {
  const found = [];
  const walk = dir => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.(js|jsx)$/.test(name) && /function\s+(sameOrigin|requestIsSameOrigin)\s*\(/.test(readFileSync(path, 'utf8'))) found.push(path.replaceAll('\\', '/')); } };
  walk(new URL('../src', import.meta.url).pathname);
  assert.deepEqual(found.map(path => path.split('/src/')[1]), ['lib/request-origin.js']);
});
