import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BACKFILL_CENTERS_SQL, CENTER_DATA_TABLES, CENTER_TRIGGER_SQL, CREATE_CENTERS_SQL, REPOINTED_FOREIGN_KEYS, migrateTrainingCenterEntity,
} from '../src/lib/hr-training-center-entity.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('中心編號沿用會員編號：建表不另外產生流水號，補資料只新增', () => {
  assert.match(CREATE_CENTERS_SQL, /id BIGINT PRIMARY KEY/);
  assert.doesNotMatch(CREATE_CENTERS_SQL, /BIGSERIAL|GENERATED/);
  assert.match(CREATE_CENTERS_SQL, /owner_member_id BIGINT UNIQUE REFERENCES hr_members\(id\) ON DELETE SET NULL/);
  assert.match(BACKFILL_CENTERS_SQL, /ON CONFLICT \(id\) DO NOTHING$/);
  // 所有已經被當成中心使用的編號都要先有中心資料列，改外鍵時才不會失敗
  for (const table of CENTER_DATA_TABLES) assert.match(BACKFILL_CENTERS_SQL, new RegExp(`UNION SELECT center_id FROM ${table}`));
  assert.match(BACKFILL_CENTERS_SQL, /UNION SELECT training_center_id FROM hr_members/);
});

test('外鍵改指向 hr_training_centers：中心資料 RESTRICT（不會被連帶刪除），成員所屬中心 SET NULL', () => {
  assert.deepEqual(REPOINTED_FOREIGN_KEYS.map(([table]) => table), [...CENTER_DATA_TABLES, 'hr_members']);
  for (const [, name, , onDelete] of REPOINTED_FOREIGN_KEYS.slice(0, -1)) { assert.match(name, /_center_id_fkey$/); assert.equal(onDelete, 'RESTRICT'); }
  assert.deepEqual(REPOINTED_FOREIGN_KEYS.at(-1), ['hr_members', 'hr_members_training_center_id_fkey', 'training_center_id', 'SET NULL']);
  assert.ok(!REPOINTED_FOREIGN_KEYS.some(([, , , onDelete]) => onDelete === 'CASCADE'));
});

test('trigger：成為訓練中心（且不屬於其他中心）時自動建立中心資料列', () => {
  const sql = CENTER_TRIGGER_SQL.join('\n');
  assert.match(sql, /IF NEW\.role = 'training_center' AND NEW\.training_center_id IS NULL THEN/);
  assert.match(sql, /AFTER INSERT OR UPDATE OF role,training_center_id,display_name ON hr_members/);
  assert.doesNotMatch(sql, /DELETE/);
});

function fakePool(refs = {}) {
  const sql = [];
  return {
    sql,
    connect: async () => ({
      async query(text, params = []) {
        sql.push(text);
        if (/to_regclass\(\$1\) AS t/.test(text)) return { rows: [{ t: 'x' }] };
        if (/confrelid::regclass::text AS ref/.test(text)) return { rows: [{ ref: refs[params[1]] ?? 'hr_members' }] };
        return { rows: [], rowCount: text === BACKFILL_CENTERS_SQL ? 2 : 0 };
      },
      release() {},
    }),
  };
}

test('流程：建表 → 補中心 → trigger → 改外鍵；已改過的略過；不刪任何資料', async () => {
  const pool = fakePool();
  const log = await migrateTrainingCenterEntity(pool);
  assert.equal(log[0], 'centers_backfilled:2');
  assert.equal(log.filter(item => item.startsWith('repointed:')).length, REPOINTED_FOREIGN_KEYS.length);
  assert.equal(pool.sql[0], 'BEGIN');
  assert.equal(pool.sql.at(-1), 'COMMIT');
  assert.ok(pool.sql.indexOf(BACKFILL_CENTERS_SQL) < pool.sql.findIndex(text => /ADD CONSTRAINT/.test(text)));
  assert.ok(!pool.sql.some(text => /DELETE FROM|DROP TABLE|TRUNCATE/.test(text)));

  const done = fakePool(Object.fromEntries(REPOINTED_FOREIGN_KEYS.map(([, name]) => [name, 'hr_training_centers'])));
  assert.deepEqual(await migrateTrainingCenterEntity(done), ['centers_backfilled:2']);
  assert.ok(!done.sql.some(text => /DROP CONSTRAINT/.test(text)));
});

test('接線：在訓練中心資料表建好之後執行', async () => {
  const migrations = await read('../src/lib/hr-migrations.js');
  const steps = [...migrations.matchAll(/\['([\w-]+)', /g)].map(match => match[1]);
  assert.equal(steps.indexOf('training-center-entity'), steps.indexOf('training-center') + 1);
  assert.ok(steps.indexOf('identity') < steps.indexOf('training-center-entity'));
});
