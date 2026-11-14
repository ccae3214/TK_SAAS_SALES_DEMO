import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 防止「上傳／審核後畫面跳回最上面」再次出現。
// 這裡只是程式碼守門；實際行為（上傳前後捲動位置與卡片位置不變）是在瀏覽器裡實測過的。
const source = await readFile(new URL('../src/components/HrDocumentReviewList.jsx', import.meta.url), 'utf8');

test('document review list decides its default filter once instead of following live data', () => {
  assert.match(source, /const \[initialFilter\] = useState\(\(\) => \(totals\.submitted > 0 \? 'submitted' : 'all'\)\)/);
  assert.match(source, /const activeFilter = filter \?\? initialFilter/);
  assert.doesNotMatch(source, /filter \?\? \(totals/);
});

test('document review list keeps worker and document order fixed until the filter changes', () => {
  assert.match(source, /function takeOrderSnapshot/);
  assert.match(source, /useState\(\(\) => takeOrderSnapshot\(summaries\)\)/);
  assert.match(source, /function changeFilter\(key\) \{ setFilter\(key\); setOrder\(takeOrderSnapshot\(summaries\)\); \}/);
  assert.match(source, /onClick=\{\(\) => changeFilter\(key\)\}/);
  // 排序不能再直接用即時的狀態
  assert.doesNotMatch(source, /STATUS_ORDER\[documentGroup\(x\)\] - STATUS_ORDER\[documentGroup\(y\)\]/);
});
