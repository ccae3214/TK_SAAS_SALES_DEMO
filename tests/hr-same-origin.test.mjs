import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestIsSameOrigin } from '../src/lib/request-origin.js';

const request = (headers = {}, url = 'http://app:3000/api/hr') => new Request(url, { method: 'POST', headers });
async function withEnv(env, run) {
  const before = { APP_ORIGIN: process.env.APP_ORIGIN, NEXTAUTH_URL: process.env.NEXTAUTH_URL };
  for (const key of Object.keys(before)) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  try { return await run(); } finally {
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

test('missing Origin is rejected', () => withEnv({}, () => assert.equal(requestIsSameOrigin(request()), false)));
test('Origin equal to request.url origin is accepted', () => withEnv({}, () => assert.equal(requestIsSameOrigin(request({ origin: 'http://app:3000' })), true)));
test('APP_ORIGIN is accepted', () => withEnv({ APP_ORIGIN: 'https://tk.example.invalid' }, () => assert.equal(requestIsSameOrigin(request({ origin: 'https://tk.example.invalid' })), true)));
test('NEXTAUTH_URL is accepted (path ignored)', () => withEnv({ NEXTAUTH_URL: 'https://site.example.invalid/some/path' }, () => assert.equal(requestIsSameOrigin(request({ origin: 'https://site.example.invalid' })), true)));
test('foreign Origin is rejected', () => withEnv({ APP_ORIGIN: 'https://tk.example.invalid' }, () => assert.equal(requestIsSameOrigin(request({ origin: 'https://evil.invalid' })), false)));
test('X-Forwarded-Host cannot add the attacker origin', () => withEnv({ APP_ORIGIN: 'https://tk.example.invalid' }, () => {
  assert.equal(requestIsSameOrigin(request({ origin: 'https://evil.invalid', 'x-forwarded-host': 'evil.invalid', 'x-forwarded-proto': 'https' })), false);
}));
test('Host header cannot add the attacker origin', () => withEnv({}, () => {
  assert.equal(requestIsSameOrigin(request({ origin: 'https://evil.invalid', host: 'evil.invalid' })), false);
}));
test('forwarded headers no longer make the public origin valid on their own', () => withEnv({}, () => {
  assert.equal(requestIsSameOrigin(request({ origin: 'https://tk.example.invalid', 'x-forwarded-host': 'tk.example.invalid', 'x-forwarded-proto': 'https' })), false);
}));
test('malformed Origin or env value fails closed', () => withEnv({ APP_ORIGIN: 'not a url' }, () => {
  assert.equal(requestIsSameOrigin(request({ origin: 'http://app:3000' })), false);
  assert.equal(requestIsSameOrigin(request({ origin: 'null' })), false);
}));

// No route may keep its own copy of the check, and nothing in src may trust forwarded host for it.
async function sourceFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await sourceFiles(path));
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(path);
  }
  return out;
}
test('no route defines its own same-origin check or reads x-forwarded-host', async () => {
  const root = fileURLToPath(new URL('../src', import.meta.url));
  const offenders = [];
  for (const file of await sourceFiles(root)) {
    const text = await readFile(file, 'utf8');
    if (/function\s+(sameOrigin|requestIsSameOrigin)\s*\(/.test(text) && !file.endsWith('request-origin.js')) offenders.push(`${file}: local copy`);
    if (/x-forwarded-host/i.test(text) && !file.endsWith('request-origin.js')) offenders.push(`${file}: x-forwarded-host`);
  }
  assert.deepEqual(offenders, []);
});
