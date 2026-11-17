import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { MIGRATION_LOCK_KEY, runMigrationSteps } from '../src/lib/migration-runner.js';

const quiet = { log() {}, error() {} };
function fakeDb({ failConnects = 0 } = {}) {
  const events = [];
  let connects = 0;
  return {
    events,
    connect: async () => {
      connects += 1;
      if (connects <= failConnects) throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
      return { query: async (sql, params) => { events.push(`${sql.trim().split('(')[0]}:${params?.[0] ?? ''}`); return { rows: [] }; }, release: () => events.push('release') };
    },
  };
}

test('先拿到 advisory lock，再依序執行每個步驟，最後放開鎖', async () => {
  const db = fakeDb();
  const order = [];
  const steps = [['one', async () => { db.events.push('step:one'); order.push('one'); }], ['two', async () => { db.events.push('step:two'); order.push('two'); }]];
  assert.equal(await runMigrationSteps({ db, steps, log: quiet }), true);
  assert.deepEqual(order, ['one', 'two']);
  assert.deepEqual(db.events, [`SELECT pg_advisory_lock:${MIGRATION_LOCK_KEY}`, 'step:one', 'step:two', `SELECT pg_advisory_unlock:${MIGRATION_LOCK_KEY}`, 'release']);
});

test('步驟失敗會放開鎖並重試，重試成功就回報成功', async () => {
  const db = fakeDb();
  let tries = 0;
  const steps = [['flaky', async () => { tries += 1; if (tries === 1) throw new Error('boom'); }]];
  assert.equal(await runMigrationSteps({ db, steps, attempts: 3, delayMs: 1, log: quiet }), true);
  assert.equal(tries, 2);
  assert.equal(db.events.filter(event => event.startsWith('SELECT pg_advisory_unlock')).length, 2);
});

test('資料庫一直連不上：重試到上限後回報失敗，不丟出例外（伺服器照常啟動）', async () => {
  const db = fakeDb({ failConnects: 99 });
  let ran = false;
  assert.equal(await runMigrationSteps({ db, steps: [['x', async () => { ran = true; }]], attempts: 3, delayMs: 1, log: quiet }), false);
  assert.equal(ran, false);
});

// 防護：資料表遷移只能放在 lib 的遷移函式裡，請求路徑（src/app）不可以自己 CREATE／ALTER；
// 新增的 ensure* 遷移函式也一定要登記到啟動遷移清單，否則啟動時不會跑。
const walk = (dir, found = []) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path, found); else if (/\.(js|jsx)$/.test(name)) found.push(path); } return found; };
const srcDir = new URL('../src', import.meta.url).pathname;

test('src/app 的請求路徑沒有任何資料表遷移 SQL', () => {
  const offenders = walk(join(srcDir, 'app')).filter(path => /CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)|ALTER\s+TABLE|DROP\s+TRIGGER|CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|TRIGGER)/i.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders.map(path => path.split('/src/')[1]), []);
});

test('每個匯出的 ensure*Schema／ensureLogTable 都有登記到 hr-migrations.js', () => {
  const registry = readFileSync(join(srcDir, 'lib/hr-migrations.js'), 'utf8');
  const missing = [];
  for (const path of walk(join(srcDir, 'lib'))) {
    for (const match of readFileSync(path, 'utf8').matchAll(/export (?:async )?function (ensure\w*(?:Schema|LogTable))\b/g)) {
      if (!new RegExp(`\\b${match[1]}\\b`).test(registry)) missing.push(`${match[1]} (${path.split('/src/')[1]})`);
    }
  }
  assert.deepEqual(missing, []);
});
