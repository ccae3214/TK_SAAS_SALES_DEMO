import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopSessionToken, verifyShopSessionToken, SHOP_SESSION_MAX_AGE } from '../src/lib/shop-session.js';

const secret = 'test-secret';
const now = Date.UTC(2026, 10, 16);

test('簽發後可驗證，email 一律轉小寫', () => {
  const token = createShopSessionToken('  Maria@Example.COM ', { now, secret });
  assert.equal(verifyShopSessionToken(token, { now, secret }), 'maria@example.com');
});

test('憑證被改過（換 email 或簽章）一律不通過', () => {
  const token = createShopSessionToken('a@example.com', { now, secret });
  const [payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ e: 'admin@example.com', x: Math.floor(now / 1000) + 999999 })).toString('base64url');
  assert.equal(verifyShopSessionToken(`${forged}.${signature}`, { now, secret }), null);
  assert.equal(verifyShopSessionToken(`${payload}.${signature.slice(0, -2)}AA`, { now, secret }), null);
  assert.equal(verifyShopSessionToken(`${payload}.${signature}.x`, { now, secret }), null);
});

test('用別的密鑰驗證不通過；伺服器沒設密鑰時不發也不認憑證', () => {
  const token = createShopSessionToken('a@example.com', { now, secret });
  assert.equal(verifyShopSessionToken(token, { now, secret: 'other' }), null);
  assert.equal(createShopSessionToken('a@example.com', { now, secret: '' }), null);
  assert.equal(verifyShopSessionToken(token, { now, secret: '' }), null);
});

test('過期後不通過；到期前一刻仍通過', () => {
  const token = createShopSessionToken('a@example.com', { now, secret });
  assert.equal(verifyShopSessionToken(token, { now: now + (SHOP_SESSION_MAX_AGE - 1) * 1000, secret }), 'a@example.com');
  assert.equal(verifyShopSessionToken(token, { now: now + SHOP_SESSION_MAX_AGE * 1000, secret }), null);
});

test('壞資料不會丟例外', () => {
  for (const bad of [undefined, null, '', 'abc', '.', 'a.b', 12345, {}]) assert.equal(verifyShopSessionToken(bad, { now, secret }), null);
  assert.equal(createShopSessionToken('', { now, secret }), null);
});
