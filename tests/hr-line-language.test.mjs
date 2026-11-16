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
