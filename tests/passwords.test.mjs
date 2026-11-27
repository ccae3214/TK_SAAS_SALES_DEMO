import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/passwords.js';

test('密碼雜湊可以驗證，錯誤密碼不通過', async () => {
  const encoded = await hashPassword('correct horse battery');
  assert.match(encoded, /^scrypt\$[\da-f]{32}\$[\da-f]{128}$/);
  assert.equal(await verifyPassword('correct horse battery', encoded), true);
  assert.equal(await verifyPassword('wrong password!!', encoded), false);
});

test('格式不對的雜湊一律不通過，也不會丟例外', async () => {
  const [, salt, key] = (await hashPassword('x')).split('$');
  for (const encoded of [undefined, null, 123, '', 'plain', `bcrypt$${salt}$${key}`, `scrypt$${salt}`, `scrypt$zz$${key}`, `scrypt$${salt}$${key.slice(2)}`]) {
    assert.equal(await verifyPassword('x', encoded), false, String(encoded));
  }
});
