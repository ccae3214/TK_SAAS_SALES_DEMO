import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CHAT_NOTICE_TTL_SECONDS, buildChatNotice, dispatchChatNotifications } from '../src/lib/hr-call-notify-core.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const KEY = 'B'.repeat(87);
const AUTH = 'a'.repeat(22);
const sub = (endpoint, lang = 'zh') => ({ endpoint, p256dh: KEY, auth: AUTH, lang });

function makeDeps({ subs = {}, lines = {}, lineAllowed } = {}) {
  const log = { push: [], line: [] };
  return {
    log,
    deps: {
      subscriptionsFor: async keys => new Map(keys.filter(key => subs[key]).map(key => [key, subs[key]])),
      lineTargetsFor: async keys => new Map(keys.filter(key => lines[key]).map(key => [key, lines[key]])),
      sendPush: async (s, payload, options) => { log.push.push({ endpoint: s.endpoint, payload: JSON.parse(payload), options }); },
      pushLine: async (lineUserId, text) => { log.line.push({ lineUserId, text }); },
      removeSubscription: async () => {},
      ...(lineAllowed ? { lineAllowed } : {}),
    },
  };
}
const message = { from: 'Alice', title: 'C-001 · Maria／ABC', body: '明天面試請準時到', roomId: 7 };

test('訊息通知文字：中文、英文、菲律賓語，帶聊天室連結，私訊不重複顯示名稱，預覽截斷', () => {
  const zh = buildChatNotice({ ...message, lang: 'zh', origin: 'https://hr.example.com' });
  assert.equal(zh.push.kind, 'chat'); assert.equal(zh.push.title, '💬 Alice 傳來新訊息');
  assert.equal(zh.push.body, 'C-001 · Maria／ABC：明天面試請準時到'); assert.equal(zh.push.tag, 'hr-chat-7'); assert.equal(zh.push.url, '/hr?chatRoom=7');
  assert.ok(zh.line.includes('https://hr.example.com/hr?chatRoom=7&openExternalBrowser=1'));
  const en = buildChatNotice({ ...message, lang: 'en', body: 'See you tomorrow' });
  assert.equal(en.push.title, '💬 New message from Alice'); assert.equal(en.push.body, 'C-001 · Maria／ABC: See you tomorrow');
  const tl = buildChatNotice({ ...message, lang: 'tl', body: 'See you tomorrow' });
  assert.ok(tl.push.title.includes('Bagong mensahe') && tl.push.title.includes('Alice'));
  assert.equal(buildChatNotice({ ...message, title: 'Alice', lang: 'zh' }).push.body, '明天面試請準時到', '私訊的聊天室名稱就是傳訊息的人，不重複');
  assert.ok(buildChatNotice({ ...message, body: 'x'.repeat(500) }).push.body.length < 120, '訊息預覽要截斷');
  assert.equal(buildChatNotice({ lang: 'en' }).push.title, '💬 New chat message');
});

test('系統訊息的預覽會依收件人語言翻譯，使用者自己輸入的訊息不動', () => {
  const system = '管理者已將媒合需求單 #12（家庭幫傭）直接指派給台灣仲介 甲 與菲律賓仲介 乙，請雙方直接聯繫媒合。';
  assert.ok(buildChatNotice({ ...message, body: system, lang: 'en' }).push.body.includes('An administrator assigned job order #12'));
  assert.ok(buildChatNotice({ ...message, body: system, lang: 'zh' }).push.body.includes('管理者已將媒合需求單'));
  assert.ok(buildChatNotice({ ...message, body: '你好', lang: 'en' }).push.body.endsWith('你好'));
});

test('訊息推播：用訂閱時的語言、TTL 1 小時、一般優先；有網頁推播就不用 LINE', async () => {
  const { deps, log } = makeDeps({ subs: { 'member:1': [sub('e1', 'en')] }, lines: { 'member:1': { lineUserId: 'U1', language: 'zh' } } });
  const result = await dispatchChatNotifications({ keys: ['member:1'], call: message, deps, origin: 'https://h.example' });
  assert.deepEqual(result, { push: 1, line: 0, failed: 0, removed: 0, recipients: 1 });
  assert.deepEqual(log.push[0].options, { TTL: CHAT_NOTICE_TTL_SECONDS, urgency: 'normal' });
  assert.equal(log.push[0].payload.title, '💬 New message from Alice');
});

test('沒有網頁推播的人改收 LINE 訊息通知（用他的 LINE 語言）；LINE 冷卻中就不送', async () => {
  let { deps, log } = makeDeps({ lines: { 'member:2': { lineUserId: 'U2', language: 'en' } } });
  const sent = await dispatchChatNotifications({ keys: ['member:2'], call: message, deps, origin: 'https://h.example' });
  assert.equal(sent.line, 1); assert.ok(log.line[0].text.includes('New message from Alice'));
  ({ deps, log } = makeDeps({ lines: { 'member:2': { lineUserId: 'U2', language: 'en' } }, lineAllowed: () => false }));
  assert.equal((await dispatchChatNotifications({ keys: ['member:2'], call: message, deps })).line, 0);
  assert.equal(log.line.length, 0);
});

test('聊天室 API：送出訊息後通知其他成員（不含自己），通知失敗不影響送出', async () => {
  const chat = await read('../src/app/api/hr/chat/route.js');
  assert.ok(chat.includes("import { notifyChat } from '@/lib/hr-call-notify-store'"));
  const start = chat.indexOf('async function recipientKeys('); assert.ok(start > 0);
  const recipients = chat.slice(start, chat.indexOf('\n}\n', start));
  assert.ok(recipients.includes('key!==senderKey'), '不通知傳訊息的人自己');
  assert.ok(chat.includes('hr_chat_notify_failed') && chat.includes('notifyNewMessage(room,principal,session,inserted[0]);'));
  assert.ok(chat.indexOf('notifyNewMessage(room,principal,session,inserted[0]);') < chat.indexOf('status:201'));
  // 對象與來電響鈴對象一致（群組成員／私訊對方）
  const call = await read('../src/app/api/hr/call/route.js');
  const members = text => text.match(/FROM hr_members m[^`']*/g).map(item => item.replace(/\s+/g, ' ')).sort();
  assert.deepEqual(members(recipients), members(call.slice(call.indexOf('async function inviteeKeys('), call.indexOf('\n}\n', call.indexOf('async function inviteeKeys(')))));
});

test('Service Worker：聊天訊息用較輕的通知，使用者正看著時只在 Chrome／Edge 略過；仍不攔截請求', async () => {
  const worker = await read('../public/hr-push-sw.js');
  assert.ok(worker.includes("data.kind === 'chat'") && worker.includes('MAY_SKIP_WHEN_VISIBLE') && worker.includes("client.visibilityState === 'visible'"));
  assert.ok(worker.includes('Firefox') && worker.includes('iPhone'), 'Safari／Firefox 每則推播都要顯示通知');
  assert.ok(!worker.includes("addEventListener('fetch'") && worker.includes('requireInteraction: true'));
});

test('設定：新訊息 LINE 模式有 .env 範例與 docker-compose 設定', async () => {
  assert.ok((await read('../docker-compose.yml')).includes('- HR_CHAT_LINE_NOTIFY='));
  assert.ok((await read('../.env.example')).includes('HR_CHAT_LINE_NOTIFY='));
});
