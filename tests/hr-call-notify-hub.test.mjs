import assert from 'node:assert/strict';
import test from 'node:test';
import { CallHub } from '../src/lib/hr-call-signaling.js';
import { signTicket } from '../src/lib/hr-call-ticket.js';

const SECRET = 'test-secret';
const room = (key, roomId, invitees = [], title = '案件 A') => signTicket({ k: key, r: roomId, invitees, ct: title }, SECRET, 60);

// 手動觸發計時器的 hub：timers 依建立順序排列，fire(ms) 觸發指定時間的那一個
function makeHub() {
  const timers = [];
  const notices = [];
  const hub = new CallHub({
    secret: SECRET, ringMs: 45000, nudgeMs: 10000, onNotify: notice => notices.push(notice),
    setTimer: (fn, ms) => { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; },
    clearTimer: timer => { if (timer) timer.cleared = true; },
  });
  const fire = ms => { for (const timer of timers) if (timer.ms === ms && !timer.cleared) { timer.cleared = true; timer.fn(); } };
  const connect = (key, name) => {
    const conn = { id: `${key}-${Math.random().toString(16).slice(2)}`, key, name, sent: [], send(message) { this.sent.push(message); } };
    assert.ok(hub.addConnection(conn));
    return conn;
  };
  return { hub, notices, timers, fire, connect };
}

test('撥號時：不在線上的被叫者立刻通知（網頁推播／LINE），在線上的人只響鈴不通知', () => {
  const { hub, notices, connect } = makeHub();
  const alice = connect('member:1', 'Alice');
  connect('member:2', 'Bob'); // 在線
  hub.handle(alice, { t: 'start', ticket: room('member:1', 10, ['member:2', 'member:3', 'member:4', 'member:1']), video: true });
  assert.equal(notices.length, 1);
  assert.deepEqual(notices[0], { kind: 'offline', roomId: 10, callId: notices[0].callId, title: '案件 A', video: true, from: 'Alice', startedBy: 'member:1', keys: ['member:3', 'member:4'] });
  assert.ok(notices[0].callId);
});

test('所有被叫者都在線上：撥號時沒有通知', () => {
  const { hub, notices, connect } = makeHub();
  const alice = connect('member:1', 'Alice'); connect('member:2', 'Bob');
  hub.handle(alice, { t: 'start', ticket: room('member:1', 10, ['member:2']) });
  assert.deepEqual(notices, []);
});

test('已有的通話有人加入或再撥一次，不會重複通知', () => {
  const { hub, notices, connect } = makeHub();
  const alice = connect('member:1', 'Alice'); const bob = connect('member:2', 'Bob');
  hub.handle(alice, { t: 'start', ticket: room('member:1', 10, ['member:2', 'member:3']) });
  hub.handle(bob, { t: 'join', ticket: room('member:2', 10) });
  assert.equal(notices.length, 1);
});

test('響鈴 10 秒還沒人接：連著網頁卻沒反應的人（例如手機在背景）補發通知；已拒接的不發', () => {
  const { hub, notices, fire, connect } = makeHub();
  const alice = connect('member:1', 'Alice'); const bob = connect('member:2', 'Bob'); const carol = connect('member:3', 'Carol');
  connect('member:4', 'Dave');
  hub.handle(alice, { t: 'start', ticket: room('member:1', 10, ['member:2', 'member:3', 'member:4', 'member:5']) });
  assert.deepEqual(notices[0].keys, ['member:5']);
  hub.handle(carol, { t: 'decline', roomId: 10 });
  fire(10000);
  assert.equal(notices.length, 2);
  assert.equal(notices[1].kind, 'nudge');
  assert.deepEqual(notices[1].keys, ['member:2', 'member:4'], '沒拒接、仍在線上的人');
  assert.ok(bob);
});

test('響鈴期間已有人接聽，或通話已結束：不補發通知', () => {
  const answered = makeHub();
  const alice = answered.connect('member:1', 'Alice'); const bob = answered.connect('member:2', 'Bob'); answered.connect('member:3', 'Carol');
  answered.hub.handle(alice, { t: 'start', ticket: room('member:1', 10, ['member:2', 'member:3']) });
  answered.hub.handle(bob, { t: 'join', ticket: room('member:2', 10) });
  answered.fire(10000);
  assert.equal(answered.notices.length, 0);

  const ended = makeHub();
  const caller = ended.connect('member:1', 'Alice'); ended.connect('member:2', 'Bob');
  ended.hub.handle(caller, { t: 'start', ticket: room('member:1', 11, ['member:2']) });
  ended.hub.handle(caller, { t: 'leave' });
  ended.fire(10000);
  assert.equal(ended.notices.length, 0);
});

test('通知出錯不會影響通話；沒有設定通知時照常運作', () => {
  const broken = new CallHub({ secret: SECRET, onNotify: () => { throw new Error('boom'); } });
  const conn = { id: 'a', key: 'member:1', name: 'A', sent: [], send(message) { this.sent.push(message); } };
  broken.addConnection(conn);
  broken.handle(conn, { t: 'start', ticket: room('member:1', 10, ['member:9']) });
  assert.ok(conn.sent.some(message => message.t === 'joined'), '通話照常建立');
  const quiet = new CallHub({ secret: SECRET });
  const other = { id: 'b', key: 'member:1', name: 'A', sent: [], send(message) { this.sent.push(message); } };
  quiet.addConnection(other);
  quiet.handle(other, { t: 'start', ticket: room('member:1', 10, ['member:9']) });
  assert.ok(other.sent.some(message => message.t === 'joined'));
});
