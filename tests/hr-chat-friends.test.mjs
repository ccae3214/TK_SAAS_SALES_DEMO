import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { listFriends, memberChatKey, rememberAdminIdentity } from '../src/lib/hr-chat-friends.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('好友識別碼：環境變數管理員用 admin:<email>，其他人用 member:<編號>', () => {
  assert.equal(memberChatKey({ id: 7, email: 'Allen@Example.com' }, ['allen@example.com'], []), 'admin:allen@example.com');
  assert.equal(memberChatKey({ id: 7, email: null, line_user_id: 'U123' }, [], ['U123']), 'admin:U123');
  assert.equal(memberChatKey({ id: 8, email: 'ryan@example.com' }, ['allen@example.com'], []), 'member:8');
});

// 用假的資料庫依 SQL 內容回傳資料，驗證合併與過濾規則。
function fakeRun({ chatted = [], admins = [], directory = [] }) {
  return async sql => {
    if (sql.includes('FROM hr_chat_participants me')) return chatted;
    if (sql.includes("m.admin_scope='system'")) return admins;
    if (sql.includes('FROM hr_chat_directory')) return directory;
    throw new Error(`unexpected sql: ${sql}`);
  };
}

test('單獨聊天過的人自動成為好友（不含自己），一般會員看不到管理員名錄', async () => {
  const run = fakeRun({
    chatted: [{ key: 'member:5', name: 'Maria', member_id: 5, room_id: 11, role: 'worker', admin_scope: 'none', agency_name: null }],
    admins: [{ id: 1, email: 'ryan@example.com', line_user_id: null, display_name: 'RYAN' }],
    directory: [{ participant_key: 'admin:allen@example.com', display_name: 'ALLEN' }],
  });
  const friends = await listFriends(run, { principal: { role: 'worker' }, selfKey: 'member:9' });
  assert.deepEqual(friends.map(item => [item.key, item.chatted, item.roomId]), [['member:5', true, 11]]);
});

test('系統管理員彼此找得到：RYAN 看得到 ALLEN，ALLEN 看得到 RYAN，且不會列出自己', async () => {
  const data = {
    admins: [{ id: 1, email: 'ryan@example.com', line_user_id: null, display_name: 'RYAN' }],
    directory: [{ participant_key: 'admin:allen@example.com', display_name: 'ALLEN' }],
  };
  const ryan = await listFriends(fakeRun(data), { principal: { role: 'admin', id: 1 }, selfKey: 'member:1' });
  assert.deepEqual(ryan.map(item => [item.name, item.key, item.role, item.memberId]), [['ALLEN', 'admin:allen@example.com', 'admin', null]]);
  const allen = await listFriends(fakeRun(data), { principal: { role: 'admin' }, selfKey: 'admin:allen@example.com' });
  assert.deepEqual(allen.map(item => [item.name, item.key, item.role, item.memberId]), [['RYAN', 'member:1', 'admin', 1]]);
});

test('管理員同時是會員時只列一次，且用他實際登入的 admin: 識別碼', async () => {
  const friends = await listFriends(fakeRun({
    admins: [{ id: 2, email: 'allen@example.com', line_user_id: null, display_name: 'ALLEN' }],
    directory: [{ participant_key: 'admin:allen@example.com', display_name: 'ALLEN' }],
  }), { principal: { role: 'admin', id: 1 }, selfKey: 'member:1', adminEmails: ['allen@example.com'] });
  assert.deepEqual(friends.map(item => [item.key, item.memberId]), [['admin:allen@example.com', 2]]);
});

test('已經聊過的管理員保留聊天室編號並標成管理員', async () => {
  const friends = await listFriends(fakeRun({
    chatted: [{ key: 'admin:allen@example.com', name: 'ALLEN', member_id: null, room_id: 3, role: null, admin_scope: null, agency_name: null }],
    directory: [{ participant_key: 'admin:allen@example.com', display_name: 'ALLEN' }],
  }), { principal: { role: 'admin', id: 1 }, selfKey: 'member:1' });
  assert.deepEqual(friends.map(item => [item.roomId, item.role, item.chatted]), [[3, 'admin', true]]);
});

test('記錄管理員名字：空白名字改用「管理者」，只在名字變動時才更新', async () => {
  const calls = [];
  await rememberAdminIdentity(async (sql, params) => calls.push({ sql, params }), 'admin:a@b.c', '  ');
  assert.deepEqual(calls[0].params, ['admin:a@b.c', '管理者']);
  assert.ok(calls[0].sql.includes('IS DISTINCT FROM EXCLUDED.display_name'));
});

test('聊天室 API 與畫面接上好友列表，英文與中文文字都有', async () => {
  const route = await read('../src/app/api/hr/chat/route.js');
  assert.ok(route.includes("searchParams.get('friends')==='1'"));
  assert.ok(route.includes("body.type==='friend'"));
  assert.ok(route.includes('只能私訊好友或其他系統管理員。'));
  assert.ok(route.includes('memberChatKey(targetRow,getAdminEmails(),getAdminLineUserIds())'));
  const schema = await read('../src/lib/hr-schema.js');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS hr_chat_directory'));
  const chat = await read('../src/components/HrChat.jsx');
  assert.ok(chat.includes("friends:'Friends'") && chat.includes("friends:'好友列表'"));
  assert.ok(chat.includes("roleAdmin:'System administrator'") && chat.includes("roleAdmin:'系統管理員'"));
  assert.ok(chat.includes("noFriends:'No friends yet.") && chat.includes("noFriends:'還沒有好友。"));
});
