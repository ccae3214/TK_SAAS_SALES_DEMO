import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 「訓練與來台文件」已改名為「訓練與來台進度」（選單、標題、LINE bot 進度訊息與英文翻譯）。
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin menu and heading use 訓練與來台進度', async () => {
  const admin = await read('src/components/HrManagement.jsx');
  assert.match(admin, /id: 'workflow', label: '訓練與來台進度'/);
  assert.match(admin, /<h2>訓練與來台進度<\/h2>/);
  assert.doesNotMatch(admin, /訓練與來台文件/);
});

test('LINE bot progress header is renamed in zh / en / tl', async () => {
  const bot = await read('src/lib/hr-line-bot.js');
  assert.match(bot, /'Training and arrival progress:'/);
  assert.match(bot, /'Progreso ng pagsasanay at pagdating sa Taiwan:'/);
  assert.match(bot, /'訓練與來台進度：'/);
  assert.doesNotMatch(bot, /訓練與來台文件|Training and arrival documents/);
});

test('English dictionary translates the new name and drops the old keys', async () => {
  const dict = await read('src/lib/hr-translations.jsx');
  assert.match(dict, /'訓練與來台進度': 'Training & Arrival Progress'/);
  assert.doesNotMatch(dict, /'訓練與來台文件/);
  assert.doesNotMatch(dict, /Training & Arrival Documents|training and arrival documents/i);
});
