import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEPOSIT_MESSAGES, depositDateLabel, formatDeposit, isCandidateClosed, parseDepositAmount } from '../src/lib/hr-candidate-deposit.js';
import { recordCandidateDeposit } from '../src/lib/hr-candidate-deposit-store.js';
import { recommendationStatus } from '../src/lib/hr-candidate-withdrawal.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('訂金金額：1 到 10,000,000 的整數，允許千分位，其餘一律不合法', () => {
  assert.equal(parseDepositAmount('5000'), 5000);
  assert.equal(parseDepositAmount(' 12,500 '), 12500);
  assert.equal(parseDepositAmount(10000000), 10000000);
  for (const bad of ['', null, undefined, '0', '-1', '1.5', '10000001', 'abc', '1e3', '１２']) assert.equal(parseDepositAmount(bad), null, String(bad));
});

test('已錄用且有付款登記才是「已結單」；取消登記回到「已錄用」', () => {
  assert.equal(isCandidateClosed({ status: 'passed', deposit_paid_at: '2026-11-20T01:00:00Z' }), true);
  assert.equal(isCandidateClosed({ status: 'passed', deposit_paid_at: null }), false);
  assert.equal(isCandidateClosed({ status: 'scheduled', deposit_paid_at: '2026-11-20T01:00:00Z' }), false);
  assert.equal(recommendationStatus({ status: 'passed', deposit_paid_at: '2026-11-20T01:00:00Z' }), '已結單');
  assert.equal(recommendationStatus({ status: 'passed', deposit_paid_at: null }), '已錄用');
});

test('金額與日期顯示（日期以台灣時間）', () => {
  assert.equal(formatDeposit(12500), 'NT$ 12,500');
  assert.equal(depositDateLabel('2026-11-20T17:00:00Z'), '2026-11-21');
  assert.equal(depositDateLabel('not a date'), '');
});

function fakePool({ found = [{ id: 7, status: 'passed', case_id: 3 }] } = {}) {
  const calls = [];
  const client = {
    async query(sql, params) {
      const text = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: text, params });
      if (text.startsWith('SELECT c.id')) return { rowCount: found.length, rows: found };
      if (text.startsWith('UPDATE')) return { rowCount: 1, rows: [{ id: 7, status: 'passed', deposit_amount: params[1] ?? null, deposit_paid_at: params[1] ? '2026-11-20T01:00:00Z' : null }] };
      return { rowCount: 0, rows: [] };
    },
    release() { calls.push({ sql: 'release' }); },
  };
  return { calls, connect: async () => client };
}
const taiwan = { role: 'agency', agency_type: 'taiwan', agency_id: 11, id: 5 };

test('只有台灣仲介與管理者可以登記；雇主、菲律賓仲介、工作者一律 403 且不碰資料庫', async () => {
  for (const principal of [{ role: 'employer' }, { role: 'worker' }, { role: 'agency', agency_type: 'philippines', agency_id: 2 }, null]) {
    const pool = fakePool();
    const result = await recordCandidateDeposit(pool, principal, { candidateId: 7, amount: 5000 });
    assert.equal(result.status, 403);
    assert.equal(result.body.error, DEPOSIT_MESSAGES.forbidden);
    assert.equal(pool.calls.length, 0);
  }
});

test('人選編號與金額不合法時 400，不會開交易', async () => {
  for (const body of [{ candidateId: 'x', amount: 5000 }, { candidateId: 0, amount: 5000 }, {}]) {
    const pool = fakePool();
    assert.equal((await recordCandidateDeposit(pool, taiwan, body)).status, 400);
    assert.equal(pool.calls.length, 0);
  }
  const pool = fakePool();
  const result = await recordCandidateDeposit(pool, taiwan, { candidateId: 7, amount: '0' });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, DEPOSIT_MESSAGES.badAmount);
  assert.equal(pool.calls.length, 0);
});

test('台灣仲介只能操作自己機構的需求單；管理者不限機構', async () => {
  const own = fakePool();
  await recordCandidateDeposit(own, taiwan, { candidateId: 7, amount: 5000 }, 'a@b.c');
  assert.deepEqual(own.calls.find(call => call.sql.startsWith('SELECT c.id')).params, [7, 11]);
  const admin = fakePool();
  await recordCandidateDeposit(admin, { role: 'admin' }, { candidateId: 7, amount: 5000 }, 'a@b.c');
  assert.deepEqual(admin.calls.find(call => call.sql.startsWith('SELECT c.id')).params, [7, null]);
});

test('找不到或不屬於自己機構 404；尚未錄用 409；都會 ROLLBACK 並釋放連線', async () => {
  const missing = fakePool({ found: [] });
  assert.equal((await recordCandidateDeposit(missing, taiwan, { candidateId: 7, amount: 5000 })).status, 404);
  assert.ok(missing.calls.some(call => call.sql === 'ROLLBACK'));
  assert.equal(missing.calls.at(-1).sql, 'release');
  const notHired = fakePool({ found: [{ id: 7, status: 'scheduled', case_id: null }] });
  const result = await recordCandidateDeposit(notHired, taiwan, { candidateId: 7, amount: 5000 });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, DEPOSIT_MESSAGES.notHired);
  assert.ok(!notHired.calls.some(call => call.sql.startsWith('UPDATE')));
});

test('登記成功：寫入金額、記錄操作紀錄、COMMIT，回傳 closed', async () => {
  const pool = fakePool();
  const result = await recordCandidateDeposit(pool, taiwan, { candidateId: 7, amount: '12,500' }, 'broker@example.com');
  assert.equal(result.status, 200);
  assert.equal(result.body.closed, true);
  assert.equal(result.body.deposit_amount, 12500);
  const update = pool.calls.find(call => call.sql.startsWith('UPDATE'));
  assert.deepEqual(update.params, [7, 12500, 5]);
  const activity = pool.calls.find(call => call.sql.startsWith('INSERT INTO hr_case_activity'));
  assert.deepEqual(activity.params, [3, 'broker@example.com', '登記雇主已付訂金（結單）', 'NT$ 12,500']);
  assert.ok(pool.calls.some(call => call.sql === 'COMMIT'));
});

test('取消登記：清空金額與付款時間，不需要金額', async () => {
  const pool = fakePool();
  const result = await recordCandidateDeposit(pool, taiwan, { candidateId: 7, paid: false }, 'broker@example.com');
  assert.equal(result.status, 200);
  assert.equal(result.body.closed, false);
  assert.match(pool.calls.find(call => call.sql.startsWith('UPDATE')).sql, /deposit_amount=NULL,deposit_paid_at=NULL/);
});

test('資料庫欄位、路由、金額權限與畫面都接上了', async () => {
  const schema = await read('../src/lib/hr-schema.js');
  for (const column of ['deposit_amount INTEGER', 'deposit_paid_at TIMESTAMPTZ', 'deposit_recorded_by BIGINT']) assert.ok(schema.includes(`ADD COLUMN IF NOT EXISTS ${column}`), column);
  const route = await read('../src/app/api/hr/route.js');
  assert.match(route, /body\.type === 'job-order-candidate-deposit'[\s\S]*?recordCandidateDeposit\(pool, principal, body, actor\)/);
  assert.match(route, /orderCandidates = orderCandidates\.map\(\(\{ deposit_amount, deposit_recorded_by, \.\.\.item \}\) => item\)/);
  assert.match(await read('../src/components/HrMemberPortal.jsx'), /<HrCandidateDeposit candidate=\{candidate\} canEdit onChanged=\{refresh\}\/>/);
  assert.equal((await read('../src/components/HrManagement.jsx')).match(/<HrCandidateDeposit candidate=\{person\}\/>/g)?.length, 2);
});

test('英文翻譯：每個畫面文字、每則伺服器訊息、確認視窗都有英文，且已接進 translateHrText', async () => {
  const source = await read('../src/lib/hr-translations-deposit.js');
  for (const text of ['已結單', '雇主訂金：', '已付', '尚未付款', '訂金金額：', '付款日期：', '訂金金額（新臺幣）', '登記已付訂金並結單', '取消訂金登記']) {
    assert.ok(source.includes(`'${text}':`), `缺少英文：${text}`);
  }
  for (const key of Object.keys(DEPOSIT_MESSAGES)) assert.ok(source.includes(`[DEPOSIT_MESSAGES.${key}]:`), `缺少訊息英文：${key}`);
  assert.ok(source.includes('登記後此人選狀態會設為「已結單」') && source.includes('取消後此人選會回到「已錄用」狀態'));
  const translations = await read('../src/lib/hr-translations.jsx');
  assert.ok(translations.includes('DEPOSIT_EN[trimmed]') && translations.includes('translateDepositPattern(trimmed)'));
});
