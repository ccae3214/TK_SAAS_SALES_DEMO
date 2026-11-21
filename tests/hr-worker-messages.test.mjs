import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WORKER_MESSAGES_EN, translateWorkerMessagePattern } from '../src/lib/hr-translations-worker-messages.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const cjk = /[\u3400-\u9fff]/;

test('每一句系統提示都有英文，且英文不含中文字', () => {
  const entries = Object.entries(WORKER_MESSAGES_EN);
  assert.ok(entries.length > 40);
  for (const [zh, en] of entries) {
    assert.ok(cjk.test(zh), `key 沒有中文：${zh}`);
    assert.ok(en.trim() && !cjk.test(en), `英文空白或混到中文：${zh}`);
  }
});

test('工人會碰到的伺服器錯誤訊息都有英文對照', async () => {
  const sources = {
    'member-request': await read('../src/app/api/hr/member-request/route.js'),
    documents: await read('../src/app/api/hr/documents/route.js'),
    'documents-download': await read('../src/app/api/hr/documents/[submissionId]/route.js'),
  };
  // 這些訊息只給管理者或寫進稽核紀錄，不會出現在工人畫面。
  const adminOnly = new Set(['LINE 會員', '收到文件', '登入會員', '下載文件', '管理者不需申請會員類型。']);
  for (const [name, source] of Object.entries(sources)) {
    const messages = [...source.matchAll(/error:\s*'([^'\n]*[\u3400-\u9fff][^'\n]*)'/g)].map(match => match[1]);
    assert.ok(messages.length > 0, `${name} 沒找到錯誤訊息`);
    for (const message of messages) {
      if (adminOnly.has(message)) continue;
      assert.ok(WORKER_MESSAGES_EN[message], `${name} 缺英文：${message}`);
    }
  }
});

test('句型：伺服器沒回應、課程時數', () => {
  assert.match(translateWorkerMessagePattern('伺服器暫時沒有回應（HTTP 502），可能正在更新或重新啟動，請稍後再試。'), /HTTP 502/);
  assert.equal(translateWorkerMessagePattern(' · 40 小時'), ' · 40 hours'.trim());
  assert.equal(translateWorkerMessagePattern('1 小時'), '1 hour');
  assert.equal(translateWorkerMessagePattern('3 / 12 · 2.5 小時'), '3 / 12 · 2.5 hours');
});

test('句型不會把還有中文的字串翻一半，也不會動使用者輸入', () => {
  assert.equal(translateWorkerMessagePattern('中文基礎班 · 40 小時'), '');
  assert.equal(translateWorkerMessagePattern('今天天氣很好'), '');
  assert.equal(translateWorkerMessagePattern(null), '');
});

test('translateHrText 已接上這份對照', async () => {
  const source = await read('../src/lib/hr-translations.jsx');
  assert.match(source, /from '@\/lib\/hr-translations-worker-messages'/);
  assert.match(source, /WORKER_MESSAGES_EN\[trimmed\]/);
  assert.match(source, /translateWorkerMessagePattern\(trimmed/);
});
