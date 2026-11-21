import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const VOWELS = /[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/giu;
const syllables = pinyin => (pinyin.match(/\p{L}+/gu) || []).reduce((sum, word) => sum + (word.match(VOWELS) || []).length, 0);

// 解析 seed 腳本裡每個單元的一行 VALUES：整數與 E'…' 字串依序排列（與 hr-learning-scenario-units.test.mjs 相同的做法）。
function parseUnits(sql) {
  return sql.split('\n').filter(line => /^\s+\(\d+, E'/.test(line)).map(line => {
    const tokens = [...line.matchAll(/E'((?:[^']|'')*)'|(\d+)/g)].map(match => match[2] !== undefined ? Number(match[2]) : match[1].replace(/''/g, "'").replace(/\\n/g, '\n'));
    const [position, name, name_en, hours, topics, topics_en, examples, vocabulary, dialogue, category, category_en] = tokens;
    return { position, name, name_en, hours, topics, topics_en, examples, vocabulary, dialogue, category, category_en };
  });
}

const sql = await read('../scripts/seed-mandarin-a1-course.sql');
const units = parseUnits(sql);

test('A1 課程 seed：20 個單元、240 小時、順序與名稱不重複，不重複詞彙至少 800 個', () => {
  assert.equal(units.length, 20);
  assert.deepEqual(units.map(unit => unit.position), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal(new Set(units.map(unit => unit.name)).size, units.length, '單元名稱不可重複');
  assert.equal(units.reduce((sum, unit) => sum + unit.hours, 0), 240);
  const words = units.flatMap(unit => unit.vocabulary.split('\n').map(line => line.split(' | ')[0]));
  assert.ok(new Set(words).size >= 800, `不重複詞彙 ${new Set(words).size}`);
  assert.equal(units.at(-1).category, '複習', '總複習放在最後');
  const body = units.slice(0, -1).flatMap(unit => unit.vocabulary.split('\n').map(line => line.split(' | ')[0]));
  assert.equal(new Set(body).size, body.length, '總複習以外的單元，詞彙不可重複出現');
});

test('A1 課程 seed：每個單元都有分類、英文名稱、詞彙、例句與對話，格式與拼音音節數正確', () => {
  for (const unit of units) {
    assert.ok(unit.name_en && unit.topics && unit.topics_en && unit.category && unit.category_en && unit.hours > 0, unit.name);
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
      const chinese = parts[0].replace(/^[AB]：/, '').match(/[一-鿿]/g) || [];
      assert.equal(syllables(parts[1]), chinese.length, `${unit.name}：拼音音節數和中文字數不一致 → ${line}`);
    }
    assert.ok(dialogue.every(line => /^[AB]：/.test(line)), `${unit.name} 對話每行開頭要有 A： 或 B：`);
  }
});

test('A1 課程 seed：相鄰且分類相同的單元排在一起（學習頁依分類分組）', () => {
  const groups = units.reduce((list, unit) => (list.at(-1)?.category === unit.category ? list.at(-1).count++ : list.push({ category: unit.category, count: 1 }), list), []);
  assert.equal(new Set(groups.map(group => group.category)).size, groups.length, '同一個分類的單元要連續排列');
});

test('A1 課程 seed：可重複執行、只補不覆蓋，不動既有課程', () => {
  assert.match(sql, /ON CONFLICT \(center_id, name\) DO NOTHING/);
  assert.match(sql, /ON CONFLICT \(center_id, certification_id, name\) DO NOTHING/);
  assert.match(sql, /ON CONFLICT \(course_id, name\) DO NOTHING/);
  assert.match(sql, /hours IS NULL/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE/i);
  assert.doesNotMatch(sql, /Mandarin Training \(Kolecion\)|CAV Training/, '不修改既有的 CAV 與中文 N1 課程');
  assert.match(sql, /找不到這個 Email 的訓練中心會員/);
});
