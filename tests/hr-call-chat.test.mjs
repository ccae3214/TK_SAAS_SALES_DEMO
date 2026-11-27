import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TL_DICTIONARY } from '../src/data/tl-dictionary.js';
import { countUnread, latestMessageId, mergeMessages, shouldSendOnKey, CALL_CHAT_MAX_MESSAGES } from '../src/lib/hr-call-chat.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('合併訊息：依 id 去重、排序，只留最近 200 則', () => {
  const merged = mergeMessages([{ id: 3, body: 'c' }, { id: 1, body: 'a' }], [{ id: 2, body: 'b' }, { id: 3, body: 'c2' }, { id: 'x' }]);
  assert.deepEqual(merged.map(m => [m.id, m.body]), [[1, 'a'], [2, 'b'], [3, 'c2']]);
  const many = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
  const capped = mergeMessages([], many);
  assert.equal(capped.length, CALL_CHAT_MAX_MESSAGES);
  assert.equal(capped[0].id, 51);
  assert.equal(latestMessageId(capped), 250);
  assert.equal(latestMessageId([]), 0);
});

test('未讀：只算加入後別人傳的新訊息，自己送出的不算', () => {
  const messages = [{ id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }];
  assert.equal(countUnread(messages, 5), 3);
  assert.equal(countUnread(messages, 5, new Set([7])), 2);
  assert.equal(countUnread(messages, 8), 0);
});

test('Enter 送出、Shift+Enter 換行、輸入法選字時不送出', () => {
  assert.equal(shouldSendOnKey({ key: 'Enter' }), true);
  assert.equal(shouldSendOnKey({ key: 'Enter', shiftKey: true }), false);
  assert.equal(shouldSendOnKey({ key: 'Enter', nativeEvent: { isComposing: true } }), false);
  assert.equal(shouldSendOnKey({ key: 'Enter', keyCode: 229 }), false);
  assert.equal(shouldSendOnKey({ key: 'a' }), false);
});

test('通話視窗有聊天按鈕與面板，訊息寫進同一個聊天室', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  const chat = await read('../src/components/HrCallChat.jsx');
  const css = await read('../src/components/hr-call.css');
  assert.ok(provider.includes("import HrCallChat from '@/components/HrCallChat';"));
  assert.ok(provider.indexOf('const [chatOpen, setChatOpen] = useState(false);') < provider.indexOf('if (!state) return null;'), 'hook 要在 return 之前');
  assert.ok(provider.includes('<HrCallChat roomId={call.roomId} open={chatOpen}'));
  assert.ok(provider.includes('hr-call-chat-badge'), '沒打開時顯示未讀數');
  assert.ok(chat.includes('`/api/hr/chat?roomId=${roomId}`') && chat.includes("JSON.stringify({ roomId, message })"), '用聊天室本身的 API');
  assert.ok(chat.includes("type: 'read'"), '打開面板時同步聊天室已讀');
  assert.ok(css.includes('.hr-call-overlay.has-chat {') && css.includes('grid-template-columns: minmax(0, 1fr) 300px'));
  const mobile = css.slice(css.indexOf('@media (max-width: 720px)'));
  assert.ok(mobile.includes('.hr-call-chat { position: absolute;'), '手機從下方蓋住下半部');
});

test('聊天文字有中文、英文、Filipino', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  assert.ok(provider.includes("openChat: '開啟文字聊天'") && provider.includes("openChat: 'Open text chat'"));
  for (const english of ['Open text chat', 'Close text chat', 'Text chat', 'No messages yet. Messages here also stay in the chat room.',
    'Messages could not be loaded. Retrying automatically.', 'The message was not sent. Please try again.', 'Write a message…', 'Send', 'Sending…']) {
    assert.ok(TL_DICTIONARY[english], `缺 Filipino：${english}`);
  }
});
