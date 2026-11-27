import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSessionGuard, identityOf } from '../src/lib/session-guard-core.js';

const A = { user: { name: 'A 會員', email: 'a@example.com' }, expires: '2026-11-28T00:00:00Z' };
const B = { user: { name: 'B 會員', email: 'b@example.com' }, expires: '2026-11-28T08:00:00Z' };
const LINE_A = { user: { name: 'A', lineUserId: 'Uaaa' } };

// 模擬瀏覽器：session 是「伺服器現在認得的登入者」，events 記錄 reload 與畫面顯示／隱藏。
function setup(initial, options = {}) {
  const env = { session: initial, fail: false, events: [], clock: 0 };
  const guard = createSessionGuard({
    readSession: async () => { if (env.fail) throw new Error('offline'); return env.session; },
    reload: () => env.events.push('reload'),
    setHidden: hidden => env.events.push(hidden ? 'hide' : 'show'),
    now: () => env.clock,
    ...options,
  });
  return { env, guard };
}

test('identityOf：同一個人固定得到同一個字串，沒登入是空字串', () => {
  assert.equal(identityOf(null), '');
  assert.equal(identityOf({}), '');
  assert.equal(identityOf({ user: null }), '');
  assert.equal(identityOf(A), identityOf({ ...A, expires: '2030-01-01T00:00:00Z' }), '重新登入（expires 不同）不算換帳號');
  assert.notEqual(identityOf(A), identityOf(B));
  assert.notEqual(identityOf(A), identityOf(LINE_A));
  assert.equal(identityOf({ user: { email: ' A@Example.com ', name: 'A 會員' } }), identityOf(A));
  assert.equal(identityOf({ user: {} }), 'signed-in');
});

test('換帳號：A 的頁面從往返快取復原，現在是 B → 先藏起來再重新載入，不會顯示 A 的內容', async () => {
  const { env, guard } = setup(A);
  await guard.start();
  env.session = B;
  assert.equal(await guard.check({ restored: true }), 'reload');
  assert.deepEqual(env.events, ['hide', 'reload']); // 沒有 show：畫面保持隱藏直到新頁面載入
});

test('登出：A 的頁面復原時已經沒有登入 → 重新載入（伺服器會導回登入頁）', async () => {
  const { env, guard } = setup(A);
  await guard.start();
  env.session = null;
  assert.equal(await guard.check({ restored: true }), 'reload');
  assert.deepEqual(env.events, ['hide', 'reload']);
});

test('同一個帳號復原：只是短暫隱藏後立刻顯示，不重新載入', async () => {
  const { env, guard } = setup(A);
  await guard.start();
  assert.equal(await guard.check({ restored: true }), 'same');
  assert.deepEqual(env.events, ['hide', 'show']);
});

test('切回前景（沒有復原）：換了帳號就重新載入；同一帳號不動作', async () => {
  const { env, guard } = setup(A);
  await guard.start();
  env.clock = 10000;
  assert.equal(await guard.check(), 'same');
  env.session = B;
  env.clock = 20000;
  assert.equal(await guard.check(), 'reload');
  assert.deepEqual(env.events, ['reload']); // 一般檢查不會動到畫面顯示
});

test('一開始就沒登入（登入頁）：別人在別處登入也不會把登入頁重新載入', async () => {
  const { env, guard } = setup(null);
  assert.equal(await guard.start(), '');
  env.session = A;
  assert.equal(await guard.check({ restored: true }), 'same');
  assert.deepEqual(env.events, ['hide', 'show']);
});

test('讀不到登入狀態（沒網路）：不重新載入、不把畫面一直藏著', async () => {
  const { env, guard } = setup(A);
  await guard.start();
  env.fail = true;
  assert.equal(await guard.check({ restored: true }), 'unknown');
  assert.deepEqual(env.events, ['hide', 'show']);
  env.events.length = 0;
  env.clock = 60000;
  assert.equal(await guard.check(), 'unknown');
  assert.deepEqual(env.events, []);
});

test('載入時就讀不到：之後第一次成功檢查才記下基準，不會誤判成換帳號', async () => {
  const { env, guard } = setup(A);
  env.fail = true;
  assert.equal(await guard.start(), null);
  env.fail = false;
  env.session = B;
  assert.equal(await guard.check({ restored: true }), 'baseline');
  env.session = A;
  env.clock = 99999;
  assert.equal(await guard.check(), 'reload', '基準記成 B 之後，換回 A 才算換帳號');
});

test('一般檢查有間隔限制（頻繁切換前景不會一直打 API），復原檢查不受限制', async () => {
  let reads = 0;
  let clock = 0;
  const guard = createSessionGuard({ readSession: async () => { reads += 1; return A; }, reload: () => {}, now: () => clock, minGapMs: 1500 });
  await guard.start();
  reads = 0;
  clock = 5000;
  assert.equal(await guard.check(), 'same');
  clock = 5500;
  assert.equal(await guard.check(), 'skipped');
  clock = 6600;
  assert.equal(await guard.check(), 'same');
  assert.equal(await guard.check({ restored: true }), 'same');
  assert.equal(reads, 3);
});

test('接線：providers 有掛上防護元件，元件監聽 pageshow 與 visibilitychange、只讀 /api/auth/session', () => {
  const providers = readFileSync(new URL('../src/app/providers.jsx', import.meta.url), 'utf8');
  assert.match(providers, /import HrSessionGuard from "@\/components\/HrSessionGuard"/);
  assert.match(providers, /<HrSessionGuard \/>/);
  const component = readFileSync(new URL('../src/components/HrSessionGuard.jsx', import.meta.url), 'utf8');
  assert.match(component, /'pageshow'/);
  assert.match(component, /event\.persisted/);
  assert.match(component, /'visibilitychange'/);
  assert.match(component, /\/api\/auth\/session/);
  assert.match(component, /no-store/);
});
