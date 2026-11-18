import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('db.js has no default connection string and fails clearly without DATABASE_URL', () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', `
    const db = await import(${JSON.stringify(`${root}src/lib/db.js`)});
    try { await db.query('SELECT 1'); console.log('NO_ERROR'); } catch (error) { console.log(error.message); }
    process.exit(0);
  `], { env, encoding: 'utf8' });
  assert.match(out, /DATABASE_URL is not set/);
});

test('no database password or connection-string default is committed', async () => {
  const dbJs = await read('src/lib/db.js');
  assert.doesNotMatch(dbJs, /postgresql:\/\/[^'"`\s]*:[^'"`\s@]+@/);
  const compose = await read('docker-compose.yml');
  assert.doesNotMatch(compose, /POSTGRES_PASSWORD:-/);
  assert.match(compose, /POSTGRES_PASSWORD:\?/);
});

test('server.js refuses to start without DATABASE_URL', async () => {
  const server = await read('server.js');
  assert.match(server, /if \(!process\.env\.DATABASE_URL\)[\s\S]*process\.exit\(1\)/);
});
