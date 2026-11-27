import assert from 'node:assert/strict';
import test from 'node:test';
import { CallHub, MAX_PARTICIPANTS, SFU_MAX_PARTICIPANTS } from '../src/lib/hr-call-signaling.js';
import { signTicket, verifyTicket } from '../src/lib/hr-call-ticket.js';
import { createSfuToken, newSfuIdentity, sfuConfig, sfuRoomName } from '../src/lib/hr-call-sfu.js';
import { CallClient, resolveSfuUrl } from '../src/lib/hr-call-client.js';

const SECRET = 'test-secret';

test('人數上限：彼此直連 6 人、自架 SFU 20 人', () => {
  assert.equal(MAX_PARTICIPANTS, 6);
  assert.equal(SFU_MAX_PARTICIPANTS, 20);
});

test('LIVEKIT 三個設定都有才啟用 SFU，缺任何一個都維持彼此直連', () => {
  assert.equal(sfuConfig({}), null);
  assert.equal(sfuConfig({ LIVEKIT_URL: '/livekit', LIVEKIT_API_KEY: 'k' }), null);
  assert.equal(sfuConfig({ LIVEKIT_URL: '/livekit', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: '  ' }), null);
  assert.deepEqual(sfuConfig({ LIVEKIT_URL: ' /livekit ', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' }), { url: '/livekit', apiKey: 'k', apiSecret: 's' });
});

test('LiveKit 憑證：只能進該聊天室的房間、可以發布與訂閱、不能做管理動作、有時效', async () => {
  const config = { url: '/livekit', apiKey: 'api-key', apiSecret: 'x'.repeat(40) };
  const jwt = await createSfuToken(config, { identity: newSfuIdentity(), name: '王小明', roomId: 12 });
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url'));
  assert.equal(payload.iss, 'api-key');
  assert.equal(payload.name, '王小明');
  assert.equal(payload.video.room, sfuRoomName(12));
  assert.equal(payload.video.roomJoin, true);
  assert.equal(payload.video.canPublish, true);
  assert.equal(payload.video.canSubscribe, true);
  assert.equal(payload.video.roomAdmin, undefined);
  assert.equal(payload.video.roomCreate, undefined);
  assert.ok(payload.exp - Math.floor(Date.now() / 1000) <= 300, '憑證只有幾分鐘的效期');
  assert.match(newSfuIdentity(), /^[0-9a-f]{18}$/);
  assert.notEqual(newSfuIdentity(), newSfuIdentity());
});

function makeHub() {
  const hub = new CallHub({ secret: SECRET, setTimer: () => 1, clearTimer: () => {} });
  let count = 0;
  const join = (name, ticketBody, type = 'start') => {
    const conn = { id: `c${++count}`, key: `member:${count}`, name, sent: [], send(message) { this.sent.push(message); } };
    assert.ok(hub.addConnection(conn));
    hub.handle(conn, { t: type, ticket: signTicket({ k: conn.key, r: 7, ct: '群組', invitees: [], ...ticketBody }, SECRET, 60), video: true });
    return conn;
  };
  return { hub, join };
}
const lk = n => n.toString(16).padStart(18, '0');

test('SFU 通話：可以到 20 人、第 21 人被拒；joined 會標示 sfu 並帶每個人的 LiveKit 識別碼', () => {
  const { join } = makeHub();
  const people = [join('P0', { sfu: true, lk: lk(0) })];
  for (let i = 1; i < 20; i++) people.push(join(`P${i}`, { sfu: true, lk: lk(i) }, 'join'));
  assert.equal(people.every(conn => conn.sent.some(m => m.t === 'joined')), true, '20 個人都加入成功');
  const last = people[19].sent.find(m => m.t === 'joined');
  assert.equal(last.sfu, true);
  assert.equal(last.peers.length, 19);
  assert.equal(last.peers[3].lk, lk(3));
  assert.equal(people[0].sent.find(m => m.t === 'peer-joined').peer.lk, lk(1));
  const extra = join('P20', { sfu: true, lk: lk(20) }, 'join');
  assert.deepEqual(extra.sent.at(-1), { t: 'error', code: 'full' });
});

test('彼此直連的通話仍是 6 人上限，且不帶 sfu 標記', () => {
  const { join } = makeHub();
  const people = [join('P0', {})];
  for (let i = 1; i < 6; i++) people.push(join(`P${i}`, {}, 'join'));
  assert.equal(people.every(conn => conn.sent.some(m => m.t === 'joined')), true);
  assert.equal(people[5].sent.find(m => m.t === 'joined').sfu, undefined);
  assert.deepEqual(join('P6', {}, 'join').sent.at(-1), { t: 'error', code: 'full' });
});

test('SFU 通話缺少或偽造 LiveKit 識別碼會被拒絕', () => {
  const { join } = makeHub();
  join('P0', { sfu: true, lk: lk(0) });
  assert.deepEqual(join('bad', { sfu: true }, 'join').sent.at(-1), { t: 'error', code: 'bad-ticket' });
  assert.deepEqual(join('bad2', { sfu: true, lk: '../../etc/passwd' }, 'join').sent.at(-1), { t: 'error', code: 'bad-ticket' });
});

test('SFU 位址：相對路徑依網站是 http 還是 https 補成 ws／wss', () => {
  assert.equal(resolveSfuUrl('/livekit', { location: { protocol: 'https:', host: 'kolecion.cc' } }), 'wss://kolecion.cc/livekit');
  assert.equal(resolveSfuUrl('/livekit', { location: { protocol: 'http:', host: 'localhost:8080' } }), 'ws://localhost:8080/livekit');
  assert.equal(resolveSfuUrl('https://sfu.example.com'), 'wss://sfu.example.com');
  assert.equal(resolveSfuUrl('wss://sfu.example.com'), 'wss://sfu.example.com');
});

// ---- 客戶端：用假的 livekit-client 驗證 SFU 流程
class FakeTrack { constructor(kind) { this.kind = kind; this.enabled = true; this.readyState = 'live'; } stop() { this.readyState = 'ended'; } }
class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  addTrack(t) { this.tracks.push(t); }
  removeTrack(t) { this.tracks = this.tracks.filter(x => x !== t); }
}
function makeLivekit() {
  const rooms = [];
  class Room {
    constructor() { this.handlers = {}; this.remoteParticipants = new Map(); this.published = []; this.disconnected = 0; this.localParticipant = { publishTrack: async (track, options) => { this.published.push({ track, options }); } }; rooms.push(this); }
    on(name, fn) { this.handlers[name] = fn; return this; }
    async connect(url, token) { this.url = url; this.token = token; }
    disconnect() { this.disconnected++; }
    emit(name, ...args) { this.handlers[name]?.(...args); }
  }
  const module = { Room, RoomEvent: { TrackSubscribed: 'ts', TrackUnsubscribed: 'tu', ParticipantConnected: 'pc', ParticipantDisconnected: 'pd', Disconnected: 'dc' }, Track: { Source: { Camera: 'camera', Microphone: 'microphone' } }, VideoQuality: { LOW: 0, HIGH: 2 } };
  return { module, rooms };
}
function makeSfuClient() {
  const snapshots = [];
  const { module, rooms } = makeLivekit();
  const env = { WebSocket: class {}, RTCPeerConnection: class {}, MediaStream: FakeStream, location: { protocol: 'https:', host: 'kolecion.cc' }, navigator: { mediaDevices: { async getUserMedia() { return new FakeStream(); } } } };
  const client = new CallClient({ api: async () => ({}), wsUrl: () => '', onChange: state => snapshots.push(state), loadSfu: async () => module, env });
  client.sfuInfo = { url: '/livekit', token: 'jwt-token' };
  client.localStream = new FakeStream([new FakeTrack('audio'), new FakeTrack('video')]);
  client.call = { roomId: 7, title: 't', phase: 'starting', peers: [], everHadPeer: false };
  client.ws = { send() {} }; client.wsReady = true;
  return { client, rooms, snapshots };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('收到 joined(sfu) 後連到 SFU、發布自己的麥克風與鏡頭，不建立 RTCPeerConnection', async () => {
  const { client, rooms } = makeSfuClient();
  client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: true, peers: [{ id: 'p1', name: '小美', lk: lk(1), media: { mic: 'on', cam: 'on', speaker: 'on' } }], sfu: true });
  await tick(); await tick();
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].url, 'wss://kolecion.cc/livekit');
  assert.equal(rooms[0].token, 'jwt-token');
  assert.deepEqual(rooms[0].published.map(item => item.options.source), ['microphone', 'camera']);
  assert.equal(rooms[0].published[1].options.simulcast, true, '鏡頭用 simulcast，人多時才能收低畫質');
  assert.equal(client.peers.get('p1').pc, null);
});

test('SFU 通話：對方的影像聲音依 LiveKit 識別碼對到畫面；離開後移除', async () => {
  const { client, rooms, snapshots } = makeSfuClient();
  client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: true, peers: [{ id: 'p1', name: '小美', lk: lk(1), media: { mic: 'on', cam: 'on', speaker: 'on' } }], sfu: true });
  await tick(); await tick();
  const room = rooms[0];
  assert.equal(snapshots.at(-1).call.peers[0].state, 'connecting', '還沒連上 SFU 前是連線中');
  const audio = { mediaStreamTrack: new FakeTrack('audio') };
  room.emit('pc', { identity: lk(1) });
  room.emit('ts', audio, {}, { identity: lk(1) });
  const peer = snapshots.at(-1).call.peers[0];
  assert.equal(peer.state, 'connected');
  assert.equal(peer.stream.getTracks().length, 1);
  assert.equal(peer.stream.getTracks()[0], audio.mediaStreamTrack);
  client.onMessage({ t: 'peer-left', id: 'p1' });
  assert.equal(snapshots.at(-1).call.peers.length, 0);
  assert.equal(client.lkStreams.size, 0);
});

test('SFU 通話：超過 6 位對方時改收低畫質，6 位以內收高畫質', async () => {
  const { client, rooms } = makeSfuClient();
  client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: true, peers: [], sfu: true });
  await tick(); await tick();
  const room = rooms[0];
  const qualities = [];
  const add = n => room.remoteParticipants.set(lk(n), { identity: lk(n), trackPublications: new Map([['v', { kind: 'video', setVideoQuality: q => qualities.push(q) }]]) });
  for (let i = 1; i <= 6; i++) add(i);
  client.applySfuQuality();
  assert.equal(qualities.every(q => q === 2), true, '6 位以內高畫質');
  qualities.length = 0;
  add(7);
  client.applySfuQuality();
  assert.equal(qualities.length, 7);
  assert.equal(qualities.every(q => q === 0), true, '7 位以上低畫質');
});

test('離開通話會斷開 SFU；SFU 連不上時結束通話並顯示提示', async () => {
  const { client, rooms } = makeSfuClient();
  client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: true, peers: [], sfu: true });
  await tick(); await tick();
  client.leave();
  assert.equal(rooms[0].disconnected, 1);
  assert.equal(client.sfuRoom, null);

  const failing = makeSfuClient();
  failing.client.loadSfu = async () => { throw new Error('boom'); };
  failing.client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: true, peers: [], sfu: true });
  await tick(); await tick();
  assert.equal(failing.client.call, null, '通話已結束');
  assert.equal(failing.client.snapshot().notice?.type, 'sfu-failed');
});

test('簽章票證會帶 sfu 與 lk 欄位，信令伺服器讀得到', () => {
  const ticket = signTicket({ k: 'member:1', r: 7, sfu: true, lk: lk(1) }, SECRET, 60);
  const payload = verifyTicket(ticket, SECRET);
  assert.equal(payload.sfu, true);
  assert.equal(payload.lk, lk(1));
});
