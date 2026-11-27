// 由 scripts/mandarin-a1/*.mjs（課程原始資料，每行「中文 | 拼音 | English | Filipino」）產生：
//   scripts/seed-mandarin-a1-course.sql    新安裝用（只新增、不覆蓋）
//   scripts/update-mandarin-a1-course.sql  既有資料庫改成新版內容（依單元位置更新，單元 ID 與學習進度不變）
//   src/data/tl-mandarin-a1.js             English → Filipino 對照（學習頁在 Filipino 介面顯示）
// 用法：node scripts/build-mandarin-a1-course.mjs，之後執行 node scripts/check-mandarin-pinyin.mjs 檢查拼音。
import { writeFileSync } from 'node:fs';
import units01 from './mandarin-a1/units-01-05.mjs';
import units06 from './mandarin-a1/units-06-10.mjs';
import units11 from './mandarin-a1/units-11-15.mjs';
import units16 from './mandarin-a1/units-16-20.mjs';
import { TOPIC_PINYIN, annotateChinese } from './mandarin-a1/topic-pinyin.mjs';

const root = new URL('../', import.meta.url);
const units = [...units01, ...units06, ...units11, ...units16];
const problems = [];

function rowsOf(unit, field) {
  return String(unit[field] || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s*\|\s*/);
    if (parts.length !== 4 || parts.some(part => !part)) problems.push(`Unit ${unit.position} ${field}：每行要有 4 欄（中文 | 拼音 | English | Filipino）→ ${line}`);
    const [zh = '', pinyin = '', en = '', tl = ''] = parts;
    return { zh, pinyin, en, tl };
  });
}

// 總複習單元的詞彙只寫中文，拼音與意思從前面單元帶過來，確保一致。
const lexicon = new Map();
for (const unit of units) if (unit.category !== '複習') for (const row of rowsOf(unit, 'vocabulary')) {
  if (lexicon.has(row.zh)) problems.push(`詞彙重複：「${row.zh}」出現在 Unit ${lexicon.get(row.zh).position} 和 Unit ${unit.position}`);
  else lexicon.set(row.zh, { ...row, position: unit.position });
}

const built = units.map(unit => {
  const vocabulary = unit.reviewWords
    ? unit.reviewWords.map(word => lexicon.get(word) || (problems.push(`總複習的「${word}」在前面單元找不到`), { zh: word, pinyin: '', en: '', tl: '' }))
    : rowsOf(unit, 'vocabulary');
  const meanings = vocabulary.map(row => row.en.toLowerCase());
  meanings.forEach((meaning, i) => { if (meanings.indexOf(meaning) !== i) problems.push(`Unit ${unit.position} 詞彙的英文意思重複：${meaning}`); });
  return { ...unit, rows: { examples: rowsOf(unit, 'examples'), vocabulary, dialogue: rowsOf(unit, 'dialogue') } };
});

// 學習重點的 English／Filipino 版：中文後面自動加拼音（先找課程裡同一句的拼音，再找 TOPIC_PINYIN）。
const coursePinyin = new Map();
for (const unit of built) for (const field of ['examples', 'vocabulary', 'dialogue']) for (const row of unit.rows[field]) {
  const zh = row.zh.replace(/^[AB]：/, '');
  if (!coursePinyin.has(zh)) coursePinyin.set(zh, row.pinyin);
  const bare = zh.replace(/[。！？]$/, '');
  if (!coursePinyin.has(bare)) coursePinyin.set(bare, row.pinyin.replace(/[.!?]$/, ''));
}
const topicLookup = run => TOPIC_PINYIN[run] || coursePinyin.get(run);
for (const unit of built) for (const field of ['topics_en', 'topics_tl']) {
  const missing = [];
  unit[field] = annotateChinese(unit[field], topicLookup, missing);
  for (const run of missing) problems.push(`Unit ${unit.position} ${field}：「${run}」找不到拼音，請加到 scripts/mandarin-a1/topic-pinyin.mjs`);
}

// English → Filipino。同一句英文對到不同 Filipino 時報錯，避免顯示錯誤的翻譯。
const tl = new Map();
const addTl = (en, text) => {
  if (!en || !text) return;
  if (tl.has(en) && tl.get(en) !== text) problems.push(`同一句英文有兩種 Filipino：「${en}」→「${tl.get(en)}」／「${text}」`);
  tl.set(en, text);
};
for (const unit of built) {
  addTl(unit.name_en, unit.name_tl); addTl(unit.category_en, unit.category_tl); addTl(unit.topics_en, unit.topics_tl);
  for (const field of ['examples', 'vocabulary', 'dialogue']) for (const row of unit.rows[field]) addTl(row.en, row.tl);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const sqlText = value => `E'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n')}'`;
const lines = rows => rows.map(row => `${row.zh} | ${row.pinyin} | ${row.en}`).join('\n');
const valuesRow = unit => `    (${unit.position}, ${sqlText(unit.name)}, ${sqlText(unit.name_en)}, ${unit.hours}, ${sqlText(unit.topics)}, ${sqlText(unit.topics_en)}, ${sqlText(lines(unit.rows.examples))}, ${sqlText(lines(unit.rows.vocabulary))}, ${sqlText(lines(unit.rows.dialogue))}, ${sqlText(unit.category)}, ${sqlText(unit.category_en)})`;
const values = built.map(valuesRow).join(',\n');
const totalHours = built.reduce((sum, unit) => sum + unit.hours, 0);
const uniqueWords = lexicon.size;
const columns = 'position, name, name_en, hours, topics, topics_en, examples, vocabulary, dialogue, category, category_en';

const findCenter = `-- 找不到訓練中心就中止，不寫入任何資料。
SELECT COALESCE(max(id), 0) AS center_id FROM hr_members
WHERE role = 'training_center' AND lower(email) = lower(:'center_email') \\gset
SELECT :center_id = 0 AS missing_center \\gset
\\if :missing_center
  \\echo '找不到這個 Email 的訓練中心會員（會員類型必須是訓練中心），已中止。'
  \\quit
\\endif`;

const columnsDdl = `ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS vocabulary TEXT NOT NULL DEFAULT '';
ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS dialogue TEXT NOT NULL DEFAULT '';
ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS category_en TEXT NOT NULL DEFAULT '';`;

const seed = `-- 中文 A1 課程（Mandarin A1 Course (Kolecion)）：專為在台灣工作的菲律賓移工（看護、家庭幫傭、工廠、農工）設計，CEFR A1／TOCFL 入門～Level 1。
-- 共 ${built.length} 個單元、${totalHours} 小時：基礎（發音、問候、數字）→ 到台灣生活 → 工作基本（指令、安全、薪水請假）→ 依職別（看護、幫傭、工廠、農業）→ 生活服務與求助 → 總複習。
-- 每個單元都有學習重點（目標、發音、句型、台灣文化提醒）、詞彙、例句與對話（中文 | 拼音 | 英文），不重複詞彙 ${uniqueWords} 個。
-- 用台灣繁體中文與台灣讀音（例如 垃圾 lèsè、星期 xīngqí）；拼音標注規則見 docs/MANDARIN_A1_REDESIGN.md，可用 node scripts/check-mandarin-pinyin.mjs 檢查。
-- Filipino 說明在 src/data/tl-mandarin-a1.js（學習頁在 Filipino 介面顯示）。
--
-- ⚠️ 這個檔案由 scripts/build-mandarin-a1-course.mjs 產生，請改 scripts/mandarin-a1/*.mjs 再重新產生，不要直接改這裡。
--
-- 會建立「中文A1」證照與「Mandarin A1 Course (Kolecion)」課程；不會動到既有的 CAV、中文N1 課程與單元。
-- 可重複執行：已存在的證照、課程、單元（名稱相同）不會被覆蓋，你在網站上編輯過的內容不會被蓋掉。
-- 已經匯入過舊版內容、想換成新版：請改用 scripts/update-mandarin-a1-course.sql。
--
-- 用法（在專案資料夾，center_email 換成訓練中心會員的 Email）：
--   docker compose cp scripts/seed-mandarin-a1-course.sql postgres:/tmp/seed-a1.sql
--   docker compose exec -T -e PGCLIENTENCODING=UTF8 postgres psql -U postgres -d kolecion_db -v center_email=center@example.com -f /tmp/seed-a1.sql
-- （不要用 Get-Content 管線：Windows PowerShell 會把中文編碼弄壞，造成 unterminated quoted string。）
--
-- 課程費用不會由這支腳本設定（預設為空白，網站顯示「—」），請到訓練中心的課程頁填入費用與幣別。
\\set ON_ERROR_STOP on

${findCenter}

BEGIN;

-- 這些欄位網站更新後也會自動建立，這裡先補上以免順序問題（與 seed-training-courses.sql 相同）。
ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS fee NUMERIC(12,2);
ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PHP';
${columnsDdl}

INSERT INTO hr_tc_certifications(center_id, name)
VALUES (:center_id, '中文A1')
ON CONFLICT (center_id, name) DO NOTHING;

INSERT INTO hr_tc_courses(center_id, certification_id, name)
SELECT :center_id, c.id, 'Mandarin A1 Course (Kolecion)'
FROM hr_tc_certifications c WHERE c.center_id = :center_id AND c.name = '中文A1'
ON CONFLICT (center_id, certification_id, name) DO NOTHING;

-- 課程時數 ${totalHours} 小時（原本沒填才補）。
UPDATE hr_tc_courses SET hours = ${totalHours}, updated_at = NOW()
WHERE center_id = :center_id AND name = 'Mandarin A1 Course (Kolecion)' AND hours IS NULL;

SELECT COALESCE(max(co.id), 0) AS course_id FROM hr_tc_courses co
JOIN hr_tc_certifications c ON c.id = co.certification_id
WHERE co.center_id = :center_id AND c.name = '中文A1' AND co.name = 'Mandarin A1 Course (Kolecion)' \\gset

-- 新增單元（名稱相同的不會覆蓋）。
WITH inserted AS (
  INSERT INTO hr_tc_course_units(center_id, course_id, ${columns})
  SELECT :center_id, :course_id, v.position, v.name, v.name_en, v.hours, v.topics, v.topics_en, v.examples, v.vocabulary, v.dialogue, v.category, v.category_en
  FROM (VALUES
${values}
  ) AS v(${columns})
  ON CONFLICT (course_id, name) DO NOTHING
  RETURNING id
)
SELECT count(*) AS added FROM inserted \\gset

COMMIT;
\\echo '完成：新增單元數（0 代表之前已經新增過）：' :added
`;

const update = `-- 把既有的「Mandarin A1 Course (Kolecion)」課程單元換成新版內容（菲律賓移工版，${built.length} 個單元、${totalHours} 小時）。
-- 依「單元位置」（1～${built.length}）更新名稱、時數、學習重點、詞彙、例句、對話與分類：單元 ID 不變，工人的學習進度與測驗紀錄都保留。
-- ⚠️ 會覆蓋你在網站上對這些單元做過的修改；位置不在 1～${built.length} 的單元不會被動到；缺少的位置會補上新單元。
-- 這個檔案由 scripts/build-mandarin-a1-course.mjs 產生，請改 scripts/mandarin-a1/*.mjs 再重新產生。
--
-- 用法（在專案資料夾，center_email 換成訓練中心會員的 Email；先備份：npm run db:backup）：
--   docker cp scripts/update-mandarin-a1-course.sql tk_saas_sales_demo-postgres-1:/tmp/update-a1.sql
--   docker exec -e PGCLIENTENCODING=UTF8 tk_saas_sales_demo-postgres-1 psql -U postgres -d kolecion_db -v center_email=center@example.com -f /tmp/update-a1.sql
\\set ON_ERROR_STOP on

${findCenter}

-- 只看課程名稱，不看證照名稱：證照在網站上改過名（例如「中文A1」改成「Mandarin A1」）也找得到。
-- 同名課程不只一個時，選單元最多的那個（一樣多就選最早建立的）。
SELECT COALESCE((SELECT co.id FROM hr_tc_courses co
  WHERE co.center_id = :center_id AND co.name = 'Mandarin A1 Course (Kolecion)'
  ORDER BY (SELECT count(*) FROM hr_tc_course_units u WHERE u.course_id = co.id) DESC, co.id
  LIMIT 1), 0) AS course_id \\gset
SELECT :course_id = 0 AS missing_course \\gset
\\if :missing_course
  \\echo '找不到 Mandarin A1 Course (Kolecion) 課程，請先執行 seed-mandarin-a1-course.sql，已中止。'
  \\quit
\\endif

BEGIN;

${columnsDdl}

CREATE TEMP TABLE a1_units(${columns.replace(/(\w+)/g, (name) => `${name} ${['position', 'hours'].includes(name) ? 'INTEGER' : 'TEXT'}`)}) ON COMMIT DROP;
INSERT INTO a1_units(${columns}) VALUES
${values};

-- 先把要更新的單元改成暫時名稱，避免新名稱和其他位置的舊名稱撞到「同課程名稱不可重複」的限制。
UPDATE hr_tc_course_units u SET name = u.name || ' #' || u.id
FROM a1_units v WHERE u.course_id = :course_id AND u.position = v.position;

WITH changed AS (
  UPDATE hr_tc_course_units u SET name = v.name, name_en = v.name_en, hours = v.hours, topics = v.topics, topics_en = v.topics_en,
    examples = v.examples, vocabulary = v.vocabulary, dialogue = v.dialogue, category = v.category, category_en = v.category_en
  FROM a1_units v WHERE u.course_id = :course_id AND u.position = v.position
  RETURNING u.id
)
SELECT count(*) AS updated FROM changed \\gset

WITH inserted AS (
  INSERT INTO hr_tc_course_units(center_id, course_id, ${columns})
  SELECT :center_id, :course_id, v.position, v.name, v.name_en, v.hours, v.topics, v.topics_en, v.examples, v.vocabulary, v.dialogue, v.category, v.category_en
  FROM a1_units v
  WHERE NOT EXISTS (SELECT 1 FROM hr_tc_course_units u WHERE u.course_id = :course_id AND u.position = v.position)
  ON CONFLICT (course_id, name) DO NOTHING
  RETURNING id
)
SELECT count(*) AS added FROM inserted \\gset

COMMIT;
\\echo '完成：更新單元數：' :updated '，新增單元數：' :added
`;

const tlModule = `// 中文 A1 課程的 English → Filipino 對照（學習頁在 Filipino 介面顯示單元名稱、學習重點、詞彙、例句與對話的說明）。
// ⚠️ 這個檔案由 scripts/build-mandarin-a1-course.mjs 產生，請改 scripts/mandarin-a1/*.mjs 再重新產生。
export const MANDARIN_A1_TL = ${JSON.stringify(Object.fromEntries(tl), null, 2)};
`;

writeFileSync(new URL('scripts/seed-mandarin-a1-course.sql', root), seed);
writeFileSync(new URL('scripts/update-mandarin-a1-course.sql', root), update);
writeFileSync(new URL('src/data/tl-mandarin-a1.js', root), tlModule);
console.log(`已產生：${built.length} 個單元、${totalHours} 小時、不重複詞彙 ${uniqueWords} 個、Filipino 對照 ${tl.size} 筆。`);
