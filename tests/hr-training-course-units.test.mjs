import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const route = await read('../src/app/api/hr/training-center/route.js');
const schema = await read('../src/lib/hr-training-center.js');
const ui = await read('../src/components/HrTrainingCenterWorkspace.jsx');
const seed = await read('../scripts/seed-training-courses.sql');
const { TRAINING_CENTER_EN, translateTrainingCenterPattern } = await import('../src/lib/hr-translations-training.js');

test('課程單元資料表：隨課程刪除、同課程單元名稱不可重複', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS hr_tc_course_units/);
  assert.match(schema, /course_id BIGINT NOT NULL REFERENCES hr_tc_courses\(id\) ON DELETE CASCADE/);
  assert.match(schema, /UNIQUE\(course_id, name\)/);
  assert.match(schema, /name_en TEXT NOT NULL DEFAULT ''/);
});

test('API：單元只能掛在自己訓練中心的課程，不填順序時新增排最後、編輯維持原順序', () => {
  assert.match(route, /unit: 'hr_tc_course_units'/);
  assert.match(route, /owned\('hr_tc_courses', body\.courseId \?\? existing\?\.course_id, centerId\)/);
  assert.match(route, /COALESCE\(MAX\(position\),0\)\+1/);
  assert.match(route, /existing \? existing\.position :/);
  assert.match(route, /query\('SELECT \* FROM hr_tc_course_units WHERE center_id=\$1 ORDER BY course_id, position, id'/);
});

test('畫面：課程列有「課程單元」入口，英文介面優先顯示英文欄位', () => {
  assert.match(ui, /課程單元（\$\{unitsOf\(row\.id\)\.length\}）/);
  assert.match(ui, /const pick = \(zh, en\) => lang === 'en' && en \? en : zh;/);
  assert.match(ui, /resource: 'unit', centerId, courseId: unitCourse\.id/);
  assert.match(ui, /remove\('unit', row\.id, row\.name\)/);
});

test('新增的畫面文字與句型都有英文翻譯', () => {
  for (const text of ['單元名稱', '英文單元名稱', '順序', '學習重點', '學習重點（英文）', '例句', '新增單元', '編輯單元', '尚無單元',
    '已新增課程單元', '已更新課程單元', '請輸入單元名稱。', '單元順序必須是 0 以上的整數。', '例句每行一句，格式：中文 | 拼音 | 英文']) {
    assert.ok(TRAINING_CENTER_EN[text], `missing English translation: ${text}`);
  }
  assert.equal(translateTrainingCenterPattern('課程單元：Mandarin Training'), 'Course units: Mandarin Training');
  assert.equal(translateTrainingCenterPattern('課程單元（8）'), 'Course units (8)');
  assert.equal(translateTrainingCenterPattern('單元時數合計：60 小時'), 'Total unit hours: 60');
});

test('預設內容：中文 N1 共 8 個單元、60 小時，重跑不覆蓋已編輯的內容', () => {
  const rows = [...seed.matchAll(/^\s+\((\d), E'([^']+)', E'([^']+)', (\d+),/gm)];
  assert.equal(rows.length, 8);
  assert.equal(rows.reduce((sum, row) => sum + Number(row[4]), 0), 60);
  assert.match(seed, /NOT EXISTS \(SELECT 1 FROM hr_tc_course_units u WHERE u\.course_id = co\.id\)/);
  assert.match(seed, /hours IS NULL/);
});
