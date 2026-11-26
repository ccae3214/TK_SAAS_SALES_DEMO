import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chatRoomFromUrl, chatRoomLineUrl, chatRoomPath, stripChatLinkParams } from '../src/lib/hr-chat-link.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('來電連結直接開到聊天室；LINE 連結加 openExternalBrowser=1', () => {
  assert.equal(chatRoomPath(12), '/hr?chatRoom=12');
  assert.equal(chatRoomPath(0), '/hr');
  assert.equal(chatRoomPath('abc'), '/hr');
  assert.equal(chatRoomLineUrl('https://kolecion.cc', 12), 'https://kolecion.cc/hr?chatRoom=12&openExternalBrowser=1');
  assert.equal(chatRoomLineUrl('https://kolecion.cc', 0), 'https://kolecion.cc/hr?openExternalBrowser=1');
});

test('從網址讀聊天室編號；打開後把參數拿掉', () => {
  assert.equal(chatRoomFromUrl('https://kolecion.cc/hr?chatRoom=12&openExternalBrowser=1'), 12);
  assert.equal(chatRoomFromUrl('/hr?chatRoom=5'), 5);
  assert.equal(chatRoomFromUrl('https://kolecion.cc/shop?chatRoom=12'), null, '不是 /hr 不處理');
  assert.equal(chatRoomFromUrl('https://kolecion.cc/hr?chatRoom=-3'), null);
  assert.equal(chatRoomFromUrl('https://kolecion.cc/hr?chatRoom=1e3'), 1000);
  assert.equal(chatRoomFromUrl('not a url ::'), null);
  assert.equal(stripChatLinkParams('https://kolecion.cc/hr?chatRoom=12&openExternalBrowser=1&tab=a#x'), '/hr?tab=a#x');
  assert.equal(stripChatLinkParams('https://kolecion.cc/hr'), null, '沒有參數就不改網址');
});

test('電腦版 App：manifest 設 launch_handler，網站有接收 launchQueue 與推播點擊訊息', async () => {
  const manifest = JSON.parse(await read('../public/manifest.json'));
  assert.deepEqual(manifest.launch_handler, { client_mode: ['focus-existing', 'auto'] });
  const handler = await read('../src/components/HrLaunchHandler.jsx');
  assert.ok(handler.includes('window.launchQueue.setConsumer'));
  assert.ok(handler.includes("event.data?.type !== 'hr:open-chat-room'"));
  assert.ok((await read('../src/app/providers.jsx')).includes('<HrLaunchHandler />'));
  const sw = await read('../public/hr-push-sw.js');
  assert.ok(sw.includes("client.postMessage({ type: 'hr:open-chat-room', roomId })"));
  assert.ok((await read('../src/components/HrChat.jsx')).includes('chatRoomFromUrl(window.location.href)'));
});
