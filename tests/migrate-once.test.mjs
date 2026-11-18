import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateOnce, resetMigrationJobs } from '../src/lib/migrate-once.js';

test.beforeEach(() => resetMigrationJobs());

test('同一個 key 同時被呼叫很多次，只會執行一次，大家等同一個結果', async () => {
  let runs = 0;
  const job = async () => { runs += 1; await new Promise(resolve => setTimeout(resolve, 10)); return 'ok'; };
  const results = await Promise.all([migrateOnce('a', job), migrateOnce('a', job), migrateOnce('a', job)]);
  assert.deepEqual(results, ['ok', 'ok', 'ok']);
  assert.equal(runs, 1);
  await migrateOnce('a', job); // 已完成：之後的呼叫不會再執行
  assert.equal(runs, 1);
});

test('不同 key 各跑各的', async () => {
  const seen = [];
  await Promise.all([migrateOnce('a', async () => seen.push('a')), migrateOnce('b', async () => seen.push('b'))]);
  assert.deepEqual(seen.sort(), ['a', 'b']);
});

test('失敗時清掉記錄，下一次呼叫會重試', async () => {
  let runs = 0;
  const flaky = async () => { runs += 1; if (runs === 1) throw new Error('db down'); return 'recovered'; };
  await assert.rejects(migrateOnce('flaky', flaky), /db down/);
  assert.equal(await migrateOnce('flaky', flaky), 'recovered');
  assert.equal(runs, 2);
});

test('記錄放在 globalThis，不同打包出來的模組實例也看得到', () => {
  assert.ok(globalThis.__hrMigrationJobs instanceof Map);
});
