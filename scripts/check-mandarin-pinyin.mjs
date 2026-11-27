// 檢查中文 A1 課程每一行「中文 | 拼音」：音節數、聲調符號、讀音、一／不變調、ü、隔音符號、大寫。
// 用法：node scripts/check-mandarin-pinyin.mjs [seed.sql]   （預設 scripts/seed-mandarin-a1-course.sql）
// 有錯誤時 exit code 1；台灣讀音註記只是提醒，不算錯誤。
import { readFileSync } from 'node:fs';
import { createPinyinChecker, seedLessonLines, TAIWAN_NOTES } from '../src/lib/mandarin-pinyin-check.js';

const seedPath = process.argv[2] || 'scripts/seed-mandarin-a1-course.sql';
const readings = JSON.parse(readFileSync(new URL('../src/data/mandarin-char-readings.json', import.meta.url), 'utf8'));
const check = createPinyinChecker(readings);
const rows = seedLessonLines(readFileSync(seedPath, 'utf8'));

let syllables = 0;
const byCode = {};
const failures = [];
const notes = new Map();
for (const row of rows) {
  syllables += [...row.zh].filter(ch => /[㐀-鿿]/u.test(ch)).length;
  const issues = check(row.zh, row.pinyin);
  for (const issue of issues) byCode[issue.code] = (byCode[issue.code] || 0) + 1;
  if (issues.length) failures.push({ row, issues });
  for (const [word, note] of Object.entries(TAIWAN_NOTES)) if (row.zh.includes(word) && !notes.has(word)) notes.set(word, { note, at: `Unit ${row.position} ${row.field} #${row.index}` });
}

console.log(`拼音檢查：${seedPath}`);
console.log(`檢查 ${rows.length} 行、${syllables} 個字／音節，有問題的行：${failures.length}`);
for (const { row, issues } of failures) {
  console.log(`\n✗ Unit ${row.position}「${row.unit}」${row.field} 第 ${row.index} 行：${row.zh} | ${row.pinyin}`);
  for (const issue of issues) console.log(`   [${issue.code}] ${issue.message}`);
}
if (Object.keys(byCode).length) console.log('\n錯誤類型統計：', byCode);
if (notes.size) {
  console.log('\n台灣讀音註記（提醒，不是錯誤）：');
  for (const [word, { note, at }] of notes) console.log(`  ${word}：${note}（首次出現：${at}）`);
}
console.log(failures.length ? '\n結果：有錯誤，請修正。' : '\n結果：全部通過。');
process.exitCode = failures.length ? 1 : 0;
