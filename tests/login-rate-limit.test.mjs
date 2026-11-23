import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { isLoginLocked, recordLoginFailure, clearLoginFailures, resetLoginRateLimitForTests } from '../src/lib/login-rate-limit.js';

beforeEach(() => resetLoginRateLimitForTests());

test('連續失敗 5 次後鎖定，第 4 次以前不鎖', () => {
  const t = 1_000_000;
  for (let i = 0; i < 4; i++) { recordLoginFailure('a@example.com', t + i); assert.equal(isLoginLocked('a@example.com', t + i), false); }
  recordLoginFailure('a@example.com', t + 5);
  assert.equal(isLoginLocked('a@example.com', t + 6), true);
});

test('email 大小寫與空白視為同一個帳號，不同帳號互不影響', () => {
  const t = 1_000_000;
  for (let i = 0; i < 5; i++) recordLoginFailure(' A@Example.com ', t + i);
  assert.equal(isLoginLocked('a@example.com', t + 10), true);
  assert.equal(isLoginLocked('b@example.com', t + 10), false);
});

test('15 分鐘後自動解除，登入成功會清除紀錄', () => {
  const t = 1_000_000;
  for (let i = 0; i < 5; i++) recordLoginFailure('a@example.com', t + i);
  assert.equal(isLoginLocked('a@example.com', t + 15 * 60 * 1000 + 10), false);
  for (let i = 0; i < 5; i++) recordLoginFailure('c@example.com', t + i);
  clearLoginFailures('c@example.com');
  assert.equal(isLoginLocked('c@example.com', t + 10), false);
});

test('空白的 key 不會被鎖也不會被記錄', () => {
  for (let i = 0; i < 10; i++) recordLoginFailure('', 1);
  assert.equal(isLoginLocked('', 2), false);
});
