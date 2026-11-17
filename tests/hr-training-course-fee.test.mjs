import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('../src/app/api/hr/training-center/route.js', import.meta.url), 'utf8');
const schema = await readFile(new URL('../src/lib/hr-training-center.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../src/components/HrTrainingCenterWorkspace.jsx', import.meta.url), 'utf8');
const { TRAINING_CENTER_EN } = await import('../src/lib/hr-translations-training.js');

// 直接取出 route 裡的金額驗證函式來測行為，避免只比對字串。
const moneyOf = new Function(`${route.match(/const moneyOf = [\s\S]*?\n};\n/)[0]}; return moneyOf;`)();

test('課程費用：空白為未填，0 以上最多兩位小數，其餘拒絕', () => {
  assert.equal(moneyOf(''), null);
  assert.equal(moneyOf(undefined), null);
  assert.equal(moneyOf('35000'), 35000);
  assert.equal(moneyOf(20000), 20000);
  assert.equal(moneyOf('0'), 0);
  assert.equal(moneyOf('12.345'), 12.35);
  assert.equal(moneyOf('-1'), undefined);
  assert.equal(moneyOf('abc'), undefined);
  assert.equal(moneyOf('Infinity'), undefined);
  assert.equal(moneyOf('100000001'), undefined);
});

test('課程資料表有費用與幣別欄位，API 預設幣別為披索並保留舊呼叫端的費用', () => {
  assert.match(schema, /ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS fee NUMERIC\(12,2\)/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PHP'/);
  assert.match(route, /const CURRENCIES = new Set\(\['PHP', 'TWD', 'USD'\]\)/);
  assert.match(route, /CURRENCIES\.has\(body\.currency\) \? body\.currency : 'PHP'/);
  assert.match(route, /const keepFee = body\.fee === undefined && existing;/);
  assert.match(route, /課程費用必須是 0 以上的數字。/);
});

test('課程畫面可編輯並顯示費用，新增的文字都有英文翻譯', () => {
  assert.match(ui, /name: 'fee', label: '課程費用', type: 'number', step: '0\.01'/);
  assert.match(ui, /<th>課程費用<\/th>/);
  assert.match(ui, /<td>\{feeText\(row\)\}<\/td>/);
  for (const text of ['課程費用', '幣別', '菲律賓披索 (PHP)', '新台幣 (TWD)', '美元 (USD)', '課程費用必須是 0 以上的數字。']) {
    assert.ok(TRAINING_CENTER_EN[text], `missing English translation: ${text}`);
  }
});

test('預設課程 SQL：CAV 35,000 與中文 N1 20,000（披索），找不到訓練中心就中止', async () => {
  const sql = await readFile(new URL('../scripts/seed-training-courses.sql', import.meta.url), 'utf8');
  assert.match(sql, /'CAV Training \(Q8\)',\s+35000/);
  assert.match(sql, /'Mandarin Training \(Kolecion\)',\s+20000/);
  assert.match(sql, /ON CONFLICT \(center_id, certification_id, name\) DO NOTHING/);
  assert.match(sql, /\\if :missing_center/);
});
