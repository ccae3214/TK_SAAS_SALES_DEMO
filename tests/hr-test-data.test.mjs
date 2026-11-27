import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TEST_FLAG_TABLES, addTestFlagColumns, parseTestFlagRequest } from '../src/lib/hr-test-data.js';
import { describeAdminOperation } from '../src/lib/hr-admin-audit-core.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('標記請求：只接受四種對象、正整數編號與布林值；資料表名稱只會來自固定清單', () => {
  assert.deepEqual(parseTestFlagRequest({ target: 'worker', id: 5, isTest: true }), { table: 'hr_workers', id: 5, isTest: true });
  assert.deepEqual(parseTestFlagRequest({ target: 'member', id: '7', isTest: false }), { table: 'hr_members', id: 7, isTest: false });
  assert.ok(parseTestFlagRequest({ target: 'hr_workers; DROP TABLE x', id: 5, isTest: true }).error);
  assert.ok(parseTestFlagRequest({ target: 'case', id: 5, isTest: true }).error);
  assert.ok(parseTestFlagRequest({ target: 'worker', id: 0, isTest: true }).error);
  assert.ok(parseTestFlagRequest({ target: 'worker', id: 5, isTest: 'yes' }).error);
  assert.deepEqual(Object.values(TEST_FLAG_TABLES), ['hr_workers', 'hr_employers', 'hr_agencies', 'hr_members']);
});

test('遷移：每張表加 is_test（NOT NULL DEFAULT FALSE，既有資料都是 FALSE）與索引；缺表略過', async () => {
  const sql = [];
  const db = { async query(text, params) { sql.push(text); return { rows: [{ t: params?.[0] === 'public.hr_agencies' ? null : 'x' }] }; } };
  await addTestFlagColumns(db);
  const alters = sql.filter(text => /^ALTER TABLE/.test(text));
  assert.deepEqual(alters, ['hr_workers', 'hr_employers', 'hr_members'].map(table => `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE`));
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS hr_workers_is_test_idx ON hr_workers(id) WHERE is_test'));
  assert.ok(!sql.some(text => /UPDATE|DELETE/.test(text)));
});

test('操作紀錄：標記與取消標記都有記錄', () => {
  assert.match(describeAdminOperation('PATCH', 'test-flag', { target: 'worker', isTest: true }, 'Maria', null, null).phrase, /將Maria工作者標記為測試資料/);
  assert.match(describeAdminOperation('PATCH', 'test-flag', { target: 'employer', isTest: false }, '王先生', null, null).phrase, /將王先生雇主取消測試資料標記/);
});

test('接線：只有系統管理者能標記、只改 is_test；畫面有標籤與按鈕；清單 SQL 只讀', async () => {
  const [route, ui, report, migrations, snapshot, audit] = await Promise.all([
    read('../src/app/api/hr/route.js'), read('../src/components/HrManagement.jsx'), read('../scripts/report-test-data.sql'),
    read('../src/lib/hr-migrations.js'), read('../src/lib/hr-audit-snapshot.js'), read('../src/lib/hr-audit.js'),
  ]);
  const start = route.indexOf("body.type === 'test-flag'");
  const block = route.slice(start, route.indexOf("body.type === 'worker-resume'", start));
  assert.ok(start > 0 && block.length > 0);
  assert.match(block, /principal\.role !== 'admin'/);
  assert.match(block, /UPDATE \$\{flag\.table\} SET is_test=\$2 WHERE id=\$1/);
  assert.doesNotMatch(block, /DELETE/);
  assert.equal((ui.match(/<TestFlagButton target="(worker|employer)"/g) || []).length, 4);
  assert.equal((ui.match(/<TestTag row=\{row\}\/>/g) || []).length, 4);
  assert.match(report, /BEGIN TRANSACTION READ ONLY;/);
  assert.match(report, /ROLLBACK;\s*$/);
  assert.doesNotMatch(report.replace(/^--.*$/gm, ''), /\b(DELETE|UPDATE|INSERT|DROP|TRUNCATE)\b/);
  assert.match(migrations, /\['test-data-flag', \(\) => ensureTestDataFlagSchema\(pool\)\]/);
  assert.equal((snapshot.match(/->>'is_test'\)::boolean AS is_test/g) || []).length, 4);
  assert.match(audit, /type === 'test-flag' \? String\(body\.target \|\| ''\) : type/);
});
