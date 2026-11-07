// 統一 HR 介面名詞：工人 → 工作者；Broker → 業務
// 用法（在專案根目錄）：
//   node unify-hr-terms.mjs          # 只預覽，不寫檔
//   node unify-hr-terms.mjs --write  # 實際寫入
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const WRITE = process.argv.includes('--write');

// 順序很重要：先處理較長、較特定的字串。
const RULES = [
  // 說明文字裡「工人會稱台灣業務為 Broker」整句移除（業務就只叫業務）
  [/[，；]工(?:人|作者)會稱台灣業務為「Broker」/g, ''],
  [/台灣仲介 Broker/g, '台灣仲介業務'],
  [/台灣 Broker/g, '台灣業務'],
  // 角色名稱統一：工人 → 工作者
  [/工人/g, '工作者'],
];

const TARGETS = [
  'src/components',
  'src/lib',
  'src/app/hr',
  'src/app/api/hr',
  'scripts/seed-hr-role-tests.js',
];
const EXT = new Set(['.js', '.jsx', '.mjs']);

function* walk(path) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) { yield path; return; }
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    yield* walk(join(path, name));
  }
}

let changedFiles = 0, totalHits = 0;
for (const target of TARGETS) {
  for (const file of walk(target)) {
    if (!EXT.has(extname(file))) continue;
    const norm = file.replaceAll('\\', '/'); // Windows 路徑正規化
    // 只處理 HR 相關檔案（components/lib 內其他商店檔案不碰）
    if ((norm.startsWith('src/components/') || norm.startsWith('src/lib/')) && !/\/(Hr|hr-)[^/]*$/.test(norm)) continue;
    const before = readFileSync(file, 'utf8');
    let after = before, hits = 0;
    for (const [pattern, replacement] of RULES) {
      hits += (after.match(pattern) || []).length;
      after = after.replace(pattern, replacement);
    }
    if (after === before) continue;
    changedFiles++; totalHits += hits;
    console.log(`${WRITE ? '已修改' : '將修改'}  ${norm}  (${hits} 處)`);
    if (WRITE) writeFileSync(file, after, 'utf8');
  }
}
console.log(`\n${WRITE ? '完成' : '預覽'}：${changedFiles} 個檔案、${totalHits} 處替換${WRITE ? '' : '（加上 --write 才會寫入）'}`);
if (WRITE) console.log('接著請執行 npm run lint，並檢查 src/lib/hr-translations.jsx 是否出現重複的 key。');
