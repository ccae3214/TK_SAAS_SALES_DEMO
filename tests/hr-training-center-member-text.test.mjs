import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 訓練中心會員頁底部的說明文字要有英文與 Filipino 翻譯（文字改過時，字典也要跟著改）。
test('訓練中心會員說明文字有英文與 Filipino 翻譯', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  const zh = portal.match(/<h2>訓練中心會員<\/h2><p>([^<]+)<\/p>/)?.[1];
  assert.ok(zh, '找不到訓練中心會員說明文字');
  const translations = await read('../src/lib/hr-translations.jsx');
  const line = translations.split('\n').find(item => item.trim().startsWith(`'${zh}':`));
  assert.ok(line, '缺少英文翻譯');
  const en = line.slice(line.indexOf(`'${zh}':`) + zh.length + 4).trim().replace(/^'/, '').replace(/',$/, '');
  const dictionary = await read('../src/data/tl-dictionary.js');
  assert.ok(dictionary.includes(`"${en.replaceAll('"', '\\"')}":`), '缺少 Filipino 翻譯');
});

test('訓練中心聊天室標籤有 Filipino 翻譯', async () => {
  const dictionary = await read('../src/data/tl-dictionary.js');
  assert.ok(dictionary.includes('"Training center chat": "Chat ng training center",'));
  assert.ok(dictionary.includes('"Training center group chat": "Group chat ng training center",'));
});
