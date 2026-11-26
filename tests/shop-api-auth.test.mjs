import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('資料庫埠只綁本機，不對外網開放', async () => {
  const compose = await read('docker-compose.yml');
  assert.match(compose, /- "127\.0\.0\.1:5433:5432"/);
  assert.doesNotMatch(compose, /^\s*- "(?:5432|5433):5432"/m);
});
