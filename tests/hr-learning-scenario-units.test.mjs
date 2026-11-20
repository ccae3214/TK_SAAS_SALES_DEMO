import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupUnitsByCategory } from '../src/lib/hr-learning-units.js';
import { TRAINING_CENTER_EN } from '../src/lib/hr-translations-training.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const VOWELS = /[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/giu;
const syllables = pinyin => (pinyin.match(/\p{L}+/gu) || []).reduce((sum, word) => sum + (word.match(VOWELS) || []).length, 0);

// 解析 seed 腳本裡每個單元的一行 VALUES：整數與 E'…' 字串依序排列。
function parseUnits(sql) {
  return sql.split('\n').filter(line => /^\s+\(\d+, E'/.test(line)).map(line => {
    const tokens = [...line.matchAll(/E'((?:[^']|'')*)'|(\d+)/g)].map(match => match[2] !== undefined ? Number(match[2]) : match[1].replace(/''/g, "'").replace(/\\n/g, '\n'));
    const [position, name, name_en, hours, topics, topics_en, examples, vocabulary, dialogue, category, category_en] = tokens;
    return { position, name, name_en, hours, topics, topics_en, examples, vocabulary, dialogue, category, category_en };
  });
}

test('依場合分類分組：相鄰且分類相同的單元放同一組，保留原本的序號', () => {
  const units = [{ category: 'A' }, { category: 'A' }, { category: 'B' }, { category: '' }, { category: 'A' }];
  assert.deepEqual(groupUnitsByCategory(units).map(group => [group.category, group.items.map(item => item.index)]), [['A', [0, 1]], ['B', [2]], ['', [3]], ['A', [4]]]);
  assert.deepEqual(groupUnitsByCategory(units, unit => unit.category.toLowerCase()).map(group => group.category), ['a', 'b', '', 'a']);
  assert.deepEqual(groupUnitsByCategory([]), []);
  assert.deepEqual(groupUnitsByCategory([{ name: 'x' }]).map(group => group.category), ['']);
});

test('場合分類欄位：資料表、儲存 API、學習 API、編輯表單、學習頁都有接上', async () => {
  assert.match(await read('../src/lib/hr-training-center.js'), /ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''[\s\S]*ADD COLUMN IF NOT EXISTS category_en TEXT NOT NULL DEFAULT ''/);
  const route = await read('../src/app/api/hr/training-center/route.js');
  assert.match(route, /category: body\.category === undefined && existing \? existing\.category : clean\(body\.category, 60\)/);
  assert.match(route, /category_en: body\.categoryEn === undefined && existing \? existing\.category_en : clean\(body\.categoryEn, 120\)/);
  assert.match(await read('../src/app/api/hr/learning/route.js'), /UNIT_COLUMNS = '[^']*category, category_en[^']*'/);
  const workspace = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  assert.match(workspace, /name: 'category', label: '場合分類'[\s\S]*name: 'categoryEn', label: '場合分類（英文）'/);
  assert.match(workspace, /category: record\?\.category \|\| '', categoryEn: record\?\.category_en \|\| ''/);
  const learning = await read('../src/components/HrWorkerLearning.jsx');
  assert.match(learning, /import \{ groupUnitsByCategory \} from '@\/lib\/hr-learning-units';/);
  assert.match(learning, /groupUnitsByCategory\(units, item => pick\(item\.category, item\.category_en\)\)/);
  assert.equal(TRAINING_CENTER_EN['場合分類'], 'Occasion category');
  assert.equal(TRAINING_CENTER_EN['場合分類（英文）'], 'Occasion category (English)');
});

test('場合單元 seed：每個單元都有分類、英文名稱、詞彙、例句與對話，格式與拼音音節數正確', async () => {
  const sql = await read('../scripts/seed-mandarin-scenario-units.sql');
  const units = parseUnits(sql);
  assert.equal(units.length, 19);
  assert.equal(new Set(units.map(unit => unit.name)).size, units.length, '單元名稱不可重複');
  assert.equal(new Set(units.map(unit => unit.position)).size, units.length, '順序不可重複');
  const categories = new Set(units.map(unit => unit.category));
  for (const required of ['購物與飲食', '交通與出行', '住宿與生活服務', '職場溝通', '照護工作', '健康與緊急']) assert.ok(categories.has(required), `缺少分類 ${required}`);
  for (const unit of units) {
    assert.ok(unit.name_en && unit.topics && unit.topics_en && unit.category_en && unit.hours > 0, unit.name);
    assert.ok(unit.topics.length < 1000 && unit.examples.length < 2000 && unit.vocabulary.length < 4000 && unit.dialogue.length < 4000, `${unit.name} 超過欄位長度上限`);
    const vocab = unit.vocabulary.split('\n'), dialogue = unit.dialogue.split('\n'), examples = unit.examples.split('\n');
    assert.ok(vocab.length >= 10, `${unit.name} 詞彙至少 10 個（小測驗要有足夠選項）`);
    assert.ok(dialogue.length >= 6 && examples.length >= 3, unit.name);
    const meanings = vocab.map(line => line.split(' | ')[2].toLowerCase());
    assert.equal(new Set(meanings).size, meanings.length, `${unit.name} 詞彙的英文意思不可重複`);
    for (const line of [...vocab, ...examples, ...dialogue]) {
      const parts = line.split(' | ');
      assert.equal(parts.length, 3, `${unit.name}：格式必須是「中文 | 拼音 | 英文」→ ${line}`);
      assert.ok(parts.every(part => part.trim()), line);
      const chinese = parts[0].replace(/^[AB]：/, '').match(/[\u4e00-\u9fff]/g) || [];
      assert.equal(syllables(parts[1]), chinese.length, `${unit.name}：拼音音節數和中文字數不一致 → ${line}`);
    }
    assert.ok(dialogue.every(line => /^[AB]：/.test(line)), `${unit.name} 對話每行開頭要有 A： 或 B：`);
  }
});

test('場合單元 seed：可重複執行、只補不覆蓋，既有 8 個單元補上分類並保留', async () => {
  const sql = await read('../scripts/seed-mandarin-scenario-units.sql');
  assert.match(sql, /ON CONFLICT \(course_id, name\) DO NOTHING/);
  assert.match(sql, /WHERE u\.course_id = :course_id AND u\.name = v\.name AND u\.category = ''/);
  assert.match(sql, /\\if :did_add[\s\S]*UPDATE hr_tc_course_units u SET position = v\.position[\s\S]*\\endif/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE/i);
  for (const name of ['發音與聲調', '問候與自我介紹', '數字、時間、日期', '日常生活', '住宿與宿舍生活', '職場基本用語', '身體與緊急狀況', '複習與結業測驗']) assert.ok(sql.includes(`E'${name}'`), `${name} 要補上分類並排序`);
  assert.doesNotMatch(sql, /UPDATE hr_tc_courses/, '不修改課程時數與費用');
});
