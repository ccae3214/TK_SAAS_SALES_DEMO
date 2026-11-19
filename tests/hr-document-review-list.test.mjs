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
  assert.match(source, /function changeFilter\(key\) \{ setFilter\(key\); setOpenStage\(null\); setOrder\(takeOrderSnapshot\(summaries\)\); \}/);
  assert.match(source, /onClick=\{\(\) => changeFilter\(key\)\}/);
  // 排序不能再直接用即時的狀態
  assert.doesNotMatch(source, /STATUS_ORDER\[documentGroup\(x\)\] - STATUS_ORDER\[documentGroup\(y\)\]/);
});

// 每位工作者是一個小元件；點選才展開文件，同一時間只展開一位（點另一位會收起前一位）。
test('document review list shows workers as tiles and keeps only one expanded at a time', () => {
  assert.match(source, /className="doc-worker-grid"/);
  assert.match(source, /doc-worker-tile/);
  assert.match(source, /const \[openId, setOpenId\] = useState\(undefined\)/);
  assert.match(source, /onClick=\{\(\) => \{ setOpenId\(expanded \? null : person\.id\); setOpenStage\(null\); \}\}/);
  // 不能再用「每位工作者各自記錄展開狀態」的 map
  assert.doesNotMatch(source, /useState\(\{\}\)/);
  assert.doesNotMatch(source, /setOpen\(prev =>/);
});

// 點開工作者時，各階段（A–G）預設全部收起；一次只展開一個階段（點 D 會收起 A）。
test('document review list opens a worker with every stage collapsed and keeps one stage open at a time', () => {
  assert.match(source, /const \[openStage, setOpenStage\] = useState\(null\)/);
  assert.match(source, /open=\{openStage === row\.stage\.key\}/);
  assert.match(source, /onToggle=\{\(\) => setOpenStage\(openStage === row\.stage\.key \? null : row\.stage\.key\)\}/);
  // 階段不能再各自記錄展開狀態，也不能有「依狀況預設展開」
  assert.doesNotMatch(source, /defaultOpen/);
  assert.doesNotMatch(source, /function StageGroup[^{]*\{\s*const \[open, setOpen\]/);
  // 換工作者、換篩選時階段回到全部收起
  assert.match(source, /function changeFilter\(key\) \{ setFilter\(key\); setOpenStage\(null\);/);
  assert.match(source, /setOpenId\(expanded \? null : person\.id\); setOpenStage\(null\);/);
});
