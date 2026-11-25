import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { buildIceServers, callSecret, signTicket, verifyTicket } from '../src/lib/hr-call-ticket.js';

test('票證簽章正確可驗證，被改過或過期就不能用', () => {
  const ticket = signTicket({ k: 'member:7', r: 3 }, 'secret', 60, 1_000_000);
  assert.deepEqual(verifyTicket(ticket, 'secret', 1_000_000 + 30_000), { k: 'member:7', r: 3, exp: 1_060 });
  assert.equal(verifyTicket(ticket, 'other-secret', 1_000_000), null, '密鑰不同');
  assert.equal(verifyTicket(ticket, 'secret', 1_000_000 + 61_000), null, '已過期');
  const [body, signature] = ticket.split('.');
  const forged = Buffer.from(JSON.stringify({ k: 'member:1', r: 3, exp: 9_999_999_999 })).toString('base64url');
  assert.equal(verifyTicket(`${forged}.${signature}`, 'secret', 1_000_000), null, '內容被改');
  assert.equal(verifyTicket(`${body}.`, 'secret'), null);
  assert.equal(verifyTicket('garbage', 'secret'), null);
  assert.equal(verifyTicket(ticket, '', 1_000_000), null, '沒有密鑰一律拒絕');
  assert.throws(() => signTicket({}, ''));
});

test('密鑰來源：HR_CALL_SECRET 優先，其次 NEXTAUTH_SECRET', () => {
  assert.equal(callSecret({ HR_CALL_SECRET: 'a', NEXTAUTH_SECRET: 'b' }), 'a');
  assert.equal(callSecret({ NEXTAUTH_SECRET: 'b' }), 'b');
  assert.equal(callSecret({}), '');
});

test('ICE 設定：預設只有 STUN；設定 TURN 後多一組 coturn 格式的限時帳密', () => {
  assert.deepEqual(buildIceServers({}, 'member:1', 0), [{ urls: ['stun:stun.l.google.com:19302'] }]);
  const env = { HR_CALL_TURN_URLS: 'turn:turn.example.com:3478?transport=udp, turn:turn.example.com:3478?transport=tcp', HR_CALL_TURN_SECRET: 'turn-secret' };
  const servers = buildIceServers(env, 'member:1', 1_000_000);
  assert.equal(servers.length, 2);
  const turn = servers[1];
  assert.deepEqual(turn.urls, ['turn:turn.example.com:3478?transport=udp', 'turn:turn.example.com:3478?transport=tcp']);
  assert.match(turn.username, /^\d+:[0-9a-f]{12}$/);
  assert.equal(Number(turn.username.split(':')[0]), 1000 + 6 * 3600);
  assert.equal(turn.credential, crypto.createHmac('sha1', 'turn-secret').update(turn.username).digest('base64'));
  assert.ok(!turn.username.includes('member'), '帳號不帶使用者資料');
  assert.deepEqual(buildIceServers({ HR_CALL_STUN_URLS: '' }, 'x', 0), [], '可以關掉 STUN');
});
