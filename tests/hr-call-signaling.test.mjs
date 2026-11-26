import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import { CallHub, attachCallSignaling, decodeFrame, encodeFrame } from '../src/lib/hr-call-signaling.js';
import { signTicket } from '../src/lib/hr-call-ticket.js';

const SECRET = 'test-secret';
const presence = (key, name) => signTicket({ p: 'presence', k: key, n: name }, SECRET, 60);
const room = (key, roomId, invitees = [], title = '案件 A') => signTicket({ k: key, r: roomId, invitees, ct: title }, SECRET, 60);

// 精簡的測試用 WebSocket 客戶端（會做遮罩，跟瀏覽器一樣）
function connect(port, ticket, { origin, host = `127.0.0.1:${port}` } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    const key = crypto.randomBytes(16).toString('base64');
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    const inbox = [];
    const waiters = [];
    const client = {
      socket, inbox,
      send(message, { fragment = false } = {}) {
        const payload = Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
        const frames = fragment ? [[0x01, payload.subarray(0, 5)], [0x80, payload.subarray(5)]] : [[0x81, payload]];
        for (const [first, part] of frames) {
          const mask = crypto.randomBytes(4);
          const masked = Buffer.from(part).map((byte, index) => byte ^ mask[index % 4]);
          let header;
          if (part.length < 126) header = Buffer.from([first, 0x80 | part.length]);
          else if (part.length < 65536) { header = Buffer.alloc(4); header[0] = first; header[1] = 0x80 | 126; header.writeUInt16BE(part.length, 2); }
          else { header = Buffer.alloc(10); header[0] = first; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(part.length), 2); }
          socket.write(Buffer.concat([header, mask, masked]));
        }
      },
      next(match = () => true, ms = 1500) {
        const found = inbox.findIndex(match);
        if (found >= 0) return Promise.resolve(inbox.splice(found, 1)[0]);
        return new Promise((ok, fail) => {
          const timer = setTimeout(() => fail(new Error(`no message in ${ms}ms; inbox=${JSON.stringify(inbox)}`)), ms);
          waiters.push({ match, done: message => { clearTimeout(timer); ok(message); } });
        });
      },
      quiet: async ms => { await new Promise(done => setTimeout(done, ms)); return inbox.splice(0); },
      closed: new Promise(done => socket.on('close', done)),
      close() { socket.destroy(); },
    };
    const deliver = message => {
      const waiting = waiters.findIndex(item => item.match(message));
      if (waiting >= 0) waiters.splice(waiting, 1)[0].done(message); else inbox.push(message);
    };
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const head = buffer.subarray(0, end).toString();
        buffer = buffer.subarray(end + 4);
        const status = Number(head.split(' ')[1]);
        if (status !== 101) return resolve({ status, closed: client.closed });
        assert.match(head, new RegExp(`Sec-WebSocket-Accept: ${crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64').replace(/[+/=]/g, '.')}`, 'i'));
        upgraded = true;
        resolve({ status, ...client });
      }
      for (;;) {
        if (buffer.length < 2) return;
        let length = buffer[1] & 0x7f; let offset = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
        if (buffer.length < offset + length) return;
        const opcode = buffer[0] & 0x0f;
        const payload = buffer.subarray(offset, offset + length);
        buffer = buffer.subarray(offset + length);
        if (opcode === 1) deliver(JSON.parse(payload.toString()));
        if (opcode === 8) client.closeCode = payload.readUInt16BE(0);
        if (opcode === 9) client.pinged = true;
      }
    });
    socket.on('error', reject);
    socket.write([`GET /api/hr/call/ws?ticket=${encodeURIComponent(ticket)} HTTP/1.1`, `Host: ${host}`, 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', ...(origin ? [`Origin: ${origin}`] : []), '', ''].join('\r\n'));
  });
}

async function withServer(run, options = {}) {
  const server = http.createServer((req, res) => res.end('ok'));
  const { hub, closeAll } = attachCallSignaling(server, { secret: SECRET, hub: new CallHub({ secret: SECRET, ringMs: options.ringMs ?? 60000 }), heartbeatMs: options.heartbeatMs ?? 25000, log: { error() {} } });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try { await run(server.address().port, hub); } finally { closeAll(); server.close(); }
}

test('影格編碼解碼：短、中、長訊息與遮罩', () => {
  for (const size of [0, 5, 125, 126, 300, 65535, 65536, 70000]) {
    const payload = crypto.randomBytes(size);
    const mask = crypto.randomBytes(4);
    const header = size < 126 ? Buffer.from([0x81, 0x80 | size]) : size < 65536 ? Buffer.from([0x81, 0xfe, size >> 8, size & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x81; h[1] = 0xff; h.writeBigUInt64BE(BigInt(size), 2); return h; })();
    const frame = Buffer.concat([header, mask, Buffer.from(payload).map((byte, index) => byte ^ mask[index % 4])]);
    const decoded = decodeFrame(frame, 100000);
    assert.ok(decoded.fin); assert.equal(decoded.opcode, 1); assert.deepEqual(decoded.payload, payload); assert.equal(decoded.size, frame.length);
    assert.equal(decodeFrame(frame.subarray(0, frame.length - 1), 100000), null, '資料不夠要等');
  }
  assert.equal(decodeFrame(Buffer.from([0x81, 0x05, 1, 2, 3, 4, 5])).error, 1002, '客戶端沒遮罩');
  assert.equal(decodeFrame(Buffer.concat([Buffer.from([0x81, 0xfe, 0xff, 0xff]), Buffer.alloc(4 + 65535)]), 1000).error, 1009, '太大');
  const out = encodeFrame(1, Buffer.from('hi'));
  assert.deepEqual([...out], [0x81, 2, 104, 105]);
});

test('沒票、票證錯誤、來源網站不對都不能連線', async () => {
  await withServer(async port => {
    assert.equal((await connect(port, 'nope')).status, 401);
    assert.equal((await connect(port, signTicket({ p: 'presence', k: 'member:1' }, 'wrong', 60))).status, 401);
    assert.equal((await connect(port, signTicket({ k: 'member:1', r: 1 }, SECRET, 60))).status, 401, '房間票證不能當連線票證');
    assert.equal((await connect(port, presence('member:1', 'A'), { origin: 'https://evil.example' })).status, 403);
    const ok = await connect(port, presence('member:1', 'A'), { origin: `http://127.0.0.1:${port}` });
    assert.equal(ok.status, 101);
    ok.send({ t: 'ping' });
    assert.deepEqual(await ok.next(), { t: 'pong' });
    ok.send('{broken json'); ok.send({ t: 'ping' }, { fragment: true });
    assert.deepEqual(await ok.next(), { t: 'pong' }, '壞掉的訊息被略過、分段訊息可以組合');
    ok.close();
  });
});

test('一對一通話：來電 → 接聽 → 交換連線資訊 → 掛斷', async () => {
  await withServer(async port => {
    const alice = await connect(port, presence('member:1', 'Alice'));
    const bob = await connect(port, presence('member:2', 'Bob'));
    const bob2 = await connect(port, presence('member:2', 'Bob 手機'));
    alice.send({ t: 'start', ticket: room('member:1', 10, ['member:2', 'member:1'], 'Alice'), video: true });
    const joined = await alice.next(m => m.t === 'joined');
    assert.equal(joined.roomId, 10); assert.equal(joined.video, true); assert.deepEqual(joined.peers, []);
    const ring = await bob.next(m => m.t === 'incoming');
    assert.deepEqual({ ...ring, callId: 'x' }, { t: 'incoming', callId: 'x', roomId: 10, title: 'Alice', video: true, from: 'Alice' });
    await bob2.next(m => m.t === 'incoming');

    bob.send({ t: 'join', ticket: room('member:2', 10) });
    const bobJoined = await bob.next(m => m.t === 'joined');
    assert.deepEqual(bobJoined.peers, [{ id: joined.id, name: 'Alice', media: { mic: 'on', cam: 'on', speaker: 'on' } }]);
    assert.deepEqual((await alice.next(m => m.t === 'peer-joined')).peer, { id: bobJoined.id, name: 'Bob', media: { mic: 'on', cam: 'on', speaker: 'on' } });
    await bob2.next(m => m.t === 'ring-stop');

    bob.send({ t: 'signal', to: joined.id, data: { kind: 'offer', sdp: 'v=0' } });
    assert.deepEqual(await alice.next(m => m.t === 'signal'), { t: 'signal', from: bobJoined.id, data: { kind: 'offer', sdp: 'v=0' } });
    alice.send({ t: 'signal', to: 'unknown', data: {} });
    assert.deepEqual(await alice.quiet(100), [], '不在同一通話的對象不會收到');

    bob.send({ t: 'leave' });
    assert.deepEqual(await alice.next(m => m.t === 'peer-left'), { t: 'peer-left', id: bobJoined.id, reason: 'left' });
    alice.send({ t: 'leave' });
    alice.send({ t: 'ping' });
    await alice.next(m => m.t === 'pong');
    alice.close(); bob.close(); bob2.close();
  });
});

test('票證不能冒用：別人的票、過期的票、已在通話中都被擋下', async () => {
  await withServer(async port => {
    const alice = await connect(port, presence('member:1', 'Alice'));
    alice.send({ t: 'start', ticket: room('member:2', 10) });
    assert.deepEqual(await alice.next(), { t: 'error', code: 'bad-ticket' });
    alice.send({ t: 'start', ticket: signTicket({ k: 'member:1', r: 10 }, SECRET, -5) });
    assert.deepEqual(await alice.next(), { t: 'error', code: 'bad-ticket' });
    alice.send({ t: 'start', ticket: room('member:1', 10) });
    await alice.next(m => m.t === 'joined');
    alice.send({ t: 'start', ticket: room('member:1', 11) });
    assert.deepEqual(await alice.next(), { t: 'error', code: 'already-in-call' });
    alice.close();
  });
});

test('拒接：一對一通話所有人都拒接就結束；沒人接聽超時也會結束', async () => {
  await withServer(async port => {
    const alice = await connect(port, presence('member:1', 'Alice'));
    const bob = await connect(port, presence('member:2', 'Bob'));
    alice.send({ t: 'start', ticket: room('member:1', 10, ['member:2']) });
    await alice.next(m => m.t === 'joined');
    await bob.next(m => m.t === 'incoming');
    bob.send({ t: 'decline', roomId: 10 });
    assert.deepEqual(await alice.next(m => m.t === 'declined'), { t: 'declined', name: 'Bob' });
    assert.equal((await alice.next(m => m.t === 'ended')).reason, 'declined');
    alice.close(); bob.close();
  });
  await withServer(async port => {
    const alice = await connect(port, presence('member:1', 'Alice'));
    const bob = await connect(port, presence('member:2', 'Bob'));
    alice.send({ t: 'start', ticket: room('member:1', 10, ['member:2']) });
    await alice.next(m => m.t === 'joined');
    await bob.next(m => m.t === 'incoming');
    assert.equal((await alice.next(m => m.t === 'ended', 1500)).reason, 'no-answer');
    assert.equal((await bob.next(m => m.t === 'ended')).reason, 'no-answer');
    alice.close(); bob.close();
  }, { ringMs: 150 });
});

test('群組通話：晚到的人收到補送的來電、可中途加入，人數有上限，斷線自動離開', async () => {
  await withServer(async port => {
    const host = await connect(port, presence('member:1', 'Host'));
    host.send({ t: 'start', ticket: room('member:1', 20, ['member:2', 'member:3', 'member:4', 'member:5', 'member:6', 'member:7'], '機構群組') });
    await host.next(m => m.t === 'joined');
    const late = await connect(port, presence('member:2', 'Late'));
    assert.equal((await late.next(m => m.t === 'incoming')).title, '機構群組', '重新連線的人補送來電');
    const people = [late];
    late.send({ t: 'join', ticket: room('member:2', 20) });
    await late.next(m => m.t === 'joined');
    for (const index of [3, 4, 5, 6]) {
      const person = await connect(port, presence(`member:${index}`, `P${index}`));
      person.send({ t: 'join', ticket: room(`member:${index}`, 20) });
      await person.next(m => m.t === 'joined');
      people.push(person);
    }
    const extra = await connect(port, presence('member:7', 'Extra'));
    extra.send({ t: 'join', ticket: room('member:7', 20) });
    assert.deepEqual(await extra.next(m => m.t === 'error'), { t: 'error', code: 'full' });
    people[1].close();
    const dropped = await host.next(m => m.t === 'peer-left');
    assert.equal(dropped.t, 'peer-left', '斷線等於離開');
    assert.equal(dropped.reason, 'dropped', '斷線與主動掛斷要能區分');
    for (const person of [host, extra, ...people]) person.close();
  });
});

test('CallHub：沒人了通話就結束，同一聊天室再撥是新的通話', () => {
  const hub = new CallHub({ secret: SECRET, setTimer: () => 1, clearTimer: () => {} });
  const make = (key, name) => { const conn = { id: `${key}-${Math.random()}`, key, name, sent: [], send(message) { this.sent.push(message); } }; assert.ok(hub.addConnection(conn)); return conn; };
  const a = make('member:1', 'A');
  hub.handle(a, { t: 'start', ticket: room('member:1', 5) });
  const first = a.sent.find(m => m.t === 'joined').callId;
  hub.handle(a, { t: 'leave' });
  assert.equal(hub.calls.size, 0);
  hub.handle(a, { t: 'start', ticket: room('member:1', 5) });
  assert.notEqual(a.sent.filter(m => m.t === 'joined')[1].callId, first);
  hub.removeConnection(a);
  assert.equal(hub.calls.size, 0); assert.equal(hub.connectionCount, 0);
});

test('群組通話有人接聽後，沒加入的人的來電提示在響鈴時間結束時收掉；通話繼續', async () => {
  await withServer(async port => {
    const host = await connect(port, presence('member:1', 'Host'));
    const joiner = await connect(port, presence('member:2', 'Joiner'));
    const idle = await connect(port, presence('member:3', 'Idle'));
    host.send({ t: 'start', ticket: room('member:1', 30, ['member:2', 'member:3']) });
    await host.next(m => m.t === 'joined');
    await joiner.next(m => m.t === 'incoming'); await idle.next(m => m.t === 'incoming');
    joiner.send({ t: 'join', ticket: room('member:2', 30) });
    await joiner.next(m => m.t === 'joined');
    assert.deepEqual(await idle.quiet(50), [], '有人接聽時，還沒決定的人仍可加入，提示不會立刻消失');
    assert.deepEqual(await idle.next(m => m.t === 'ring-stop', 1500), { t: 'ring-stop', roomId: 30 });
    assert.deepEqual((await host.quiet(50)).filter(m => m.t === 'ended'), [], '通話本身沒有因為響鈴結束而中斷');
    host.close(); joiner.close(); idle.close();
  }, { ringMs: 200 });
});

test('通話中的麥克風／鏡頭／喇叭狀態：加入時帶入、改變時轉送給其他人，不合法的值用預設值', () => {
  const hub = new CallHub({ secret: SECRET, setTimer: () => 1, clearTimer: () => {} });
  const make = (key, name) => { const conn = { id: `${key}-${Math.random()}`, key, name, sent: [], send(message) { this.sent.push(message); } }; assert.ok(hub.addConnection(conn)); return conn; };
  const a = make('member:1', 'A');
  const b = make('member:2', 'B');
  hub.handle(a, { t: 'start', ticket: room('member:1', 40, ['member:2']), video: true, media: { mic: 'off', cam: 'on', speaker: 'off' } });
  hub.handle(b, { t: 'join', ticket: room('member:2', 40), media: { mic: 'none', cam: 'bogus', speaker: 'on', extra: 'x' } });
  assert.deepEqual(b.sent.find(m => m.t === 'joined').peers[0].media, { mic: 'off', cam: 'on', speaker: 'off' }, '後加入的人看得到先加入者的狀態');
  assert.deepEqual(a.sent.find(m => m.t === 'peer-joined').peer.media, { mic: 'none', cam: 'on', speaker: 'on' }, '不合法的值退回預設（視訊通話鏡頭預設開）');

  hub.handle(b, { t: 'media', media: { mic: 'on', cam: 'off', speaker: 'off' } });
  assert.deepEqual(a.sent.find(m => m.t === 'peer-media'), { t: 'peer-media', id: b.id, media: { mic: 'on', cam: 'off', speaker: 'off' } });
  assert.equal(b.sent.some(m => m.t === 'peer-media'), false, '不會回傳給自己');

  const outsider = make('member:3', 'C');
  hub.handle(outsider, { t: 'media', media: { mic: 'off', cam: 'off', speaker: 'off' } });
  assert.equal(a.sent.filter(m => m.t === 'peer-media').length, 1, '沒有在通話中的人送狀態會被忽略');
});
