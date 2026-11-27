import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WORKER_DOCUMENT_NAMES } from '../src/lib/hr-requirements.js';
import { DOCUMENT_NAME_TEXT, documentDisplayName } from '../src/lib/hr-line-document-names.js';

const CJK = /[㐀-鿿]/;

test('每一種工作者文件，英文與 Filipino 都有對照名稱，且不含中文字', () => {
  for (const language of ['en', 'tl']) {
    for (const name of WORKER_DOCUMENT_NAMES) {
      const translated = DOCUMENT_NAME_TEXT[language][name];
      assert.ok(translated, `${language} 缺少「${name}」`);
      assert.ok(!CJK.test(translated), `${language}「${name}」的翻譯還有中文：${translated}`);
    }
  }
});

test('護照與照片換成對應語言；中文與未知名稱維持原樣', () => {
  assert.equal(documentDisplayName('新護照', 'en'), 'New passport');
  assert.equal(documentDisplayName('照片（2x2 16張及護照尺寸2張）', 'en'), '16 2x2 photos and 2 passport-size photos');
  assert.equal(documentDisplayName('新護照', 'tl'), 'Bagong pasaporte');
  assert.equal(documentDisplayName('新護照', 'zh'), '新護照');
  assert.equal(documentDisplayName('未來新增的文件', 'en'), '未來新增的文件');
});

// 退件通知的文件名稱翻譯改由 tests/hr-member-notices.test.mjs 實際產生訊息來驗證。
test('LINE 文件清單用翻譯後的文件名稱', async () => {
  const bot = await readFile(new URL('../src/lib/hr-line-bot.js', import.meta.url), 'utf8');
  assert.match(bot, /documentDisplayName\(item\.name, activeLanguage\)/);
});
