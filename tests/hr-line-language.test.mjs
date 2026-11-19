import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectedLanguage, roleDefaultLanguage, fallbackReplyLanguage } from '../src/lib/hr-line-language.js';

const source = await readFile(new URL('../src/lib/hr-line-bot.js', import.meta.url), 'utf8');
// 從原始碼取出圖文選單會送出的指令，確保新增選單項目時這個測試會一起涵蓋。
const menuCommands = new Set([...source.matchAll(/type: 'message', label: '[^']*', text: '([^']+)'/g)].map(match => match[1]));

const worker = { role: 'worker' };
const phAgency = { role: 'agency', agency_type: 'philippines' };

test('圖文選單指令有被抓到（避免 regex 失效而讓測試空轉）', () => {
  assert.ok(menuCommands.size >= 15, `只抓到 ${menuCommands.size} 個`);
  for (const text of ['文件', '待辦', '案件', '我的工作者', '管理案件進度']) assert.ok(menuCommands.has(text), text);
});

test('菲律賓會員（工作者、菲律賓仲介）點任何圖文選單，備援語言是英文，不是中文', () => {
  for (const text of menuCommands) {
    assert.equal(fallbackReplyLanguage(text, worker, menuCommands), 'en', `worker ${text}`);
    assert.equal(fallbackReplyLanguage(text, phAgency, menuCommands), 'en', `ph agency ${text}`);
  }
});

test('台灣端會員點選單，備援語言維持中文', () => {
  for (const principal of [{ role: 'employer' }, { role: 'agency', agency_type: 'taiwan' }, { role: 'training_center' }, { role: 'admin' }]) {
    assert.equal(fallbackReplyLanguage('待辦', principal, menuCommands), 'zh', principal.role);
  }
});

test('不是選單指令的自由文字，仍依文字本身判斷語言', () => {
  assert.equal(fallbackReplyLanguage('我想查文件進度', worker, menuCommands), 'zh');
  assert.equal(fallbackReplyLanguage('my documents', worker, menuCommands), 'en');
  assert.equal(detectedLanguage('待辦'), 'zh');
});

test('尚未取得身分（principal 為空）時，選單指令用中文備援', () => {
  assert.equal(roleDefaultLanguage(null), 'zh');
  assert.equal(fallbackReplyLanguage('文件', null, menuCommands), 'zh');
});

test('hr-line-bot 把偏好語言放在備援之前，且選單指令不再被當成語言線索', () => {
  assert.match(source, /resolveReplyLanguage\(lineUserId, fallbackReplyLanguage\(text, principal, MENU_COMMAND_TEXTS\)\)/);
  assert.doesNotMatch(source, /resolveReplyLanguage\(lineUserId, detectedLanguage\(text\)\)/);
  assert.match(source, /resolveReplyLanguage\(lineUserId, roleDefaultLanguage\(principal\)\)/);
});

// ---- 圖文選單：按鈕文字依語言、不得偷寫語言 ----
const webhook = await readFile(new URL('../src/app/api/line/webhook/route.js', import.meta.url), 'utf8');
const schema = await readFile(new URL('../src/lib/hr-schema.js', import.meta.url), 'utf8'); // 資料表遷移在這裡
const menuTexts = new Function('return ' + source.slice(source.indexOf('const MENU_TEXTS = ') + 18, source.indexOf('\nconst MENU_LANGUAGES')).replace(/;\s*$/, ''))();
const definitions = source.slice(source.indexOf('const RICH_MENU_DEFINITIONS = '), source.indexOf('// 英文／Filipino 選單按鈕送出的文字'));

test('每個選單都有英文與 Filipino 按鈕文字，數量與中文選單的 message 按鈕一致、長度合法', () => {
  const blocks = definitions.split(/\n  (?=[a-z_]+: \{\n    image:)/).slice(1);
  assert.equal(blocks.length, Object.keys(menuTexts).length);
  for (const block of blocks) {
    const key = block.match(/^([a-z_]+):/)[1];
    const messageCount = (block.match(/type: 'message'/g) || []).length;
    for (const language of ['en', 'tl']) {
      const texts = menuTexts[key]?.[language];
      assert.ok(texts, `${key}/${language} 缺少`);
      assert.equal(texts.length, messageCount, `${key}/${language} 數量`);
      for (const text of texts) assert.ok(text.length > 0 && text.length <= 300, `${key}/${language}: ${text}`);
    }
  }
});

test('同步圖文選單只記錄選單，不能寫死 preferred_language（以前寫 zh 會把菲律賓會員釘成中文）', () => {
  assert.doesNotMatch(source, /INSERT INTO hr_line_member_settings\(line_user_id,preferred_language,rich_menu_role\)\s*VALUES\(\$1,'zh'/);
  assert.match(source, /INSERT INTO hr_line_member_settings\(line_user_id,preferred_language,rich_menu_role\)\s*VALUES\(\$1,NULL,\$2\)/);
  assert.match(schema, /ALTER COLUMN preferred_language DROP NOT NULL/);
});

test('選完語言後圖文選單立刻換成該語言', () => {
  assert.match(source, /await setPreferredLanguage\(lineUserId, chosenLanguage\);\s*await syncLineRichMenu\(lineUserId, principal, chosenLanguage\)/);
});

// ---- 圖文選單快取：內容變了就要換新選單，不能一直沿用舊的（否則按鈕文字永遠是舊的） ----
test('選單 key 帶有內容簽章，按鈕文字、圖片一變就會自動換新選單', () => {
  assert.match(source, /async function versionedRichMenuKey\(/);
  assert.match(source, /createHash\('sha1'\)\.update\(JSON\.stringify\(\{ name: spec\.name, chatBarText: spec\.chatBarText, areas: spec\.areas \}\)\)/);
  assert.match(source, /`\$\{menuKey\}@\$\{hash\.digest\('hex'\)\.slice\(0, 8\)\}`/);
  // 同步選單時比對與儲存的是帶簽章的 key；ensureRichMenu 也用同一把 key 查／存 LINE 選單 ID
  assert.match(source, /const menuKey = baseKey \? await versionedRichMenuKey\(baseKey\) : null;/);
  assert.match(source, /const stored = await query\('SELECT rich_menu_id FROM hr_line_rich_menus WHERE menu_key=\$1', \[versionedKey\]\)/);
  assert.match(source, /VALUES\(\$1,\$2\) ON CONFLICT\(menu_key\) DO NOTHING`, \[versionedKey, richMenuId\]\)/);
});

test('同步圖文選單沒指定語言時（核准會員、管理者建立會員），依已存語言或身分預設語言，不直接用中文選單', () => {
  assert.match(source, /const menuLanguage = language \|\| \(await getPreferredLanguage\(lineUserId\)\) \|\| roleDefaultLanguage\(principal\);\s*const baseKey = localizedMenuKey\(richMenuKey\(principal\), menuLanguage\);/);
});
