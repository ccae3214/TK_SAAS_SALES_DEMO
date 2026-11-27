import assert from 'node:assert/strict';
import test from 'node:test';
import { CallClient, classifyError, unsupportedReason } from '../src/lib/hr-call-client.js';

class FakeTrack { constructor(kind) { this.kind = kind; this.enabled = true; this.readyState = 'live'; } stop() { this.readyState = 'ended'; } }
class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
}

const domError = name => Object.assign(new Error(name), { name });

// devices：這台電腦有哪些裝置；每次 getUserMedia 記錄收到的要求
function makeClient(devices, { withStreamCtor = true } = {}) {
  const requests = [];
  const media = {
    async getUserMedia(constraints) {
      requests.push(constraints);
      const wantsAudio = !!constraints.audio; const wantsVideo = !!constraints.video;
      if (wantsAudio && !devices.mic) throw domError('NotFoundError');
      if (wantsVideo && !devices.camera) throw domError('NotFoundError');
      return new FakeStream([...(wantsAudio ? [new FakeTrack('audio')] : []), ...(wantsVideo ? [new FakeTrack('video')] : [])]);
    },
  };
  const env = { WebSocket: class {}, RTCPeerConnection: class {}, MediaStream: withStreamCtor ? FakeStream : undefined, navigator: { mediaDevices: media } };
  const client = new CallClient({ api: async () => ({}), wsUrl: () => '', onChange: () => {}, env });
  return { client, requests };
}

test('有麥克風：語音通話只要求聲音，沒有提示', async () => {
  const { client } = makeClient({ mic: true, camera: false });
  const stream = await client.getMedia(false);
  assert.equal(stream.getAudioTracks().length, 1);
  assert.equal(client.notice, null);
});

test('視訊通話沒有鏡頭：退回語音並提示 no-camera（原本的行為不變）', async () => {
  const { client } = makeClient({ mic: true, camera: false });
  const stream = await client.getMedia(true);
  assert.equal(stream.getAudioTracks().length, 1);
  assert.equal(stream.getVideoTracks().length, 0);
  assert.deepEqual(client.notice, { type: 'no-camera' });
});

test('語音通話找不到麥克風：改用僅收聽加入，並提示 no-mic', async () => {
  const { client, requests } = makeClient({ mic: false, camera: true });
  const stream = await client.getMedia(false);
  assert.equal(stream.getTracks().length, 0);
  assert.deepEqual(client.notice, { type: 'no-mic' });
  assert.equal(requests.length, 1, '語音通話不會去開鏡頭');
});

test('視訊通話找不到麥克風但有鏡頭：只用鏡頭加入，並提示 no-mic', async () => {
  const { client } = makeClient({ mic: false, camera: true });
  const stream = await client.getMedia(true);
  assert.equal(stream.getAudioTracks().length, 0);
  assert.equal(stream.getVideoTracks().length, 1);
  assert.deepEqual(client.notice, { type: 'no-mic' });
});

test('麥克風與鏡頭都沒有：仍可僅收聽加入', async () => {
  const { client } = makeClient({ mic: false, camera: false });
  const stream = await client.getMedia(true);
  assert.equal(stream.getTracks().length, 0);
  assert.deepEqual(client.notice, { type: 'no-mic' });
});

test('權限被拒絕、麥克風被占用不會被當成沒有麥克風，維持原本的錯誤', async () => {
  for (const [name, type] of [['NotAllowedError', 'permission'], ['NotReadableError', 'device-busy']]) {
    const { client } = makeClient({ mic: true, camera: true });
    client.media.getUserMedia = async () => { throw domError(name); };
    await assert.rejects(client.getMedia(false), error => classifyError(error).type === type);
  }
});

test('瀏覽器沒有 MediaStream 時找不到麥克風仍回報錯誤，不會假裝加入', async () => {
  const { client } = makeClient({ mic: false, camera: false }, { withStreamCtor: false });
  await assert.rejects(client.getMedia(false), error => classifyError(error).type === 'no-device');
});

test('通話畫面的狀態會標示有沒有麥克風，介面用它決定要不要顯示靜音鈕', async () => {
  const { client } = makeClient({ mic: false, camera: false });
  client.localStream = await client.getMedia(false);
  client.call = { roomId: 1, title: 't', phase: 'active', peers: [], everHadPeer: false };
  assert.equal(client.snapshot().call.hasMic, false);
  client.localStream = new FakeStream([new FakeTrack('audio')]);
  assert.equal(client.snapshot().call.hasMic, true);
});

// ---------------------------------------------------------------- 連線就緒與失敗原因
class FakeSocket {
  static mode = 'open';
  constructor() { this.sent = []; FakeSocket.last = this; setTimeout(() => { if (FakeSocket.mode === 'open') this.onopen?.(); else this.onclose?.(); }, 20); }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() {}
}

function makeConnClient(api, { readyWaitMs = 400 } = {}) {
  FakeSocket.mode = 'open';
  const media = { async getUserMedia() { return new FakeStream([new FakeTrack('audio')]); } };
  const env = { WebSocket: FakeSocket, RTCPeerConnection: class {}, MediaStream: FakeStream, navigator: { mediaDevices: media } };
  return new CallClient({ api, wsUrl: ticket => `ws://x/${ticket}`, onChange: () => {}, env, readyWaitMs });
}
const roomInfo = { ticket: 'room-ticket', roomId: 7, roomType: 'case', title: 'T', iceServers: [] };
const okApi = async body => (body.type === 'presence' ? { ticket: 'p' } : roomInfo);

test('連線還沒就緒時撥號：立刻重連並等待，連上後照常開始通話（不再直接跳「尚未就緒」）', async () => {
  const client = makeConnClient(okApi);
  assert.equal(client.wsReady, false);
  assert.equal(await client.enter({ roomId: 7, video: false }), true);
  assert.equal(client.notice, null);
  assert.deepEqual(FakeSocket.last.sent[0], { t: 'start', ticket: 'room-ticket', video: false, media: { mic: 'on', cam: 'none', speaker: 'on' } });
  client.stop();
});

test('登入逾時（401）：提示重新登入，而不是籠統的尚未就緒', async () => {
  const client = makeConnClient(async () => { throw Object.assign(new Error('x'), { status: 401 }); });
  assert.equal(await client.enter({ roomId: 7 }), false);
  assert.deepEqual(client.notice, { type: 'session' });
  client.stop();
});

test('伺服器錯誤（503）：提示服務暫時無法使用', async () => {
  const client = makeConnClient(async () => { throw Object.assign(new Error('x'), { status: 503 }); });
  assert.equal(await client.enter({ roomId: 7 }), false);
  assert.deepEqual(client.notice, { type: 'service' });
  client.stop();
});

test('連線被代理或伺服器拒絕（還沒連上就被關閉）：提示連不上通話伺服器', async () => {
  const client = makeConnClient(okApi);
  FakeSocket.mode = 'close';
  assert.equal(await client.enter({ roomId: 7 }), false);
  assert.deepEqual(client.notice, { type: 'ws-failed' });
  client.stop();
});

test('網路恢復或切回分頁時立即重連；停止時移除監聽', async () => {
  const listeners = {};
  const media = { async getUserMedia() { return new FakeStream(); } };
  const env = {
    WebSocket: FakeSocket, RTCPeerConnection: class {}, MediaStream: FakeStream, navigator: { mediaDevices: media },
    addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; },
    document: { visibilityState: 'visible', addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; } },
  };
  FakeSocket.mode = 'open';
  const client = new CallClient({ api: okApi, wsUrl: () => '', onChange: () => {}, env });
  client.start();
  await new Promise(done => setTimeout(done, 60));
  assert.equal(client.wsReady, true);
  assert.deepEqual(Object.keys(listeners).sort(), ['online', 'pageshow', 'visibilitychange']);
  FakeSocket.last.onclose(); // 連線中斷
  assert.equal(client.wsReady, false);
  listeners.online();
  await new Promise(done => setTimeout(done, 60));
  assert.equal(client.wsReady, true, '網路恢復後立刻重連，不等退避間隔');
  client.stop();
  assert.deepEqual(Object.keys(listeners), []);
});

// ---------------------------------------------------------------- 不支援通話時的原因
test('不支援通話的原因：非 https、應用程式內建瀏覽器、其他', () => {
  assert.deepEqual(unsupportedReason({ isSecureContext: false, navigator: { userAgent: 'Mozilla/5.0 Chrome' } }), { type: 'insecure' });
  const line = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.0.0';
  assert.deepEqual(unsupportedReason({ isSecureContext: true, navigator: { userAgent: line } }), { type: 'in-app' });
  assert.deepEqual(unsupportedReason({ isSecureContext: true, navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' } }), { type: 'in-app' });
  assert.deepEqual(unsupportedReason({ isSecureContext: true, navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36' } }), { type: 'unsupported' });
  assert.deepEqual(unsupportedReason({ navigator: {} }), { type: 'unsupported' }, '沒有資訊就維持原本的提示');
});

test('撥號時瀏覽器缺少通話功能：依原因顯示提示，不會嘗試連線', async () => {
  for (const [extra, type] of [[{ isSecureContext: false }, 'insecure'], [{ isSecureContext: true, navigator: { userAgent: 'Foo Line/1.0' } }, 'in-app']]) {
    const env = { WebSocket: class {}, RTCPeerConnection: class {}, MediaStream: FakeStream, navigator: { userAgent: '' }, ...extra };
    const client = new CallClient({ api: async () => ({}), wsUrl: () => '', onChange: () => {}, env });
    assert.equal(await client.enter({ roomId: 1 }), false);
    assert.deepEqual(client.notice, { type });
    assert.equal(client.ws, null);
  }
});

// ---------------------------------------------------------------- 音效與一對一通話掛斷
class FakePeer {
  constructor() { this.closed = false; this.localDescription = { sdp: 'v=0' }; }
  addTrack() {}
  async createOffer() { return { sdp: 'v=0' }; }
  async setLocalDescription() {}
  close() { this.closed = true; }
}

// 建立一通「已接通」的電話：自己是 me，之後依測試加入對方
async function activeCall() {
  FakeSocket.mode = 'open';
  const sounds = [];
  const media = { async getUserMedia() { return new FakeStream([new FakeTrack('audio')]); } };
  const env = { WebSocket: FakeSocket, RTCPeerConnection: FakePeer, MediaStream: FakeStream, navigator: { mediaDevices: media } };
  const client = new CallClient({ api: okApi, wsUrl: () => '', onChange: () => {}, onSound: kind => sounds.push(kind), env, readyWaitMs: 400 });
  assert.equal(await client.enter({ roomId: 7 }), true);
  client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: false, peers: [] });
  const sent = () => FakeSocket.last.sent.map(item => item.t);
  return { client, sounds, sent };
}

test('有人加入通話播放加入音效；有人離開播放離開音效', async () => {
  const { client, sounds } = await activeCall();
  client.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  client.onMessage({ t: 'peer-joined', peer: { id: 'b', name: 'B' } });
  assert.deepEqual(sounds, ['join', 'join']);
  client.onMessage({ t: 'peer-left', id: 'b', reason: 'left' });
  assert.deepEqual(sounds, ['join', 'join', 'leave']);
  client.onMessage({ t: 'peer-left', id: 'unknown', reason: 'left' });
  assert.deepEqual(sounds, ['join', 'join', 'leave'], '不認識的人離開不出聲');
  client.stop();
});

test('一對一通話：對方按掛斷，立刻結束通話並提示（只響一次離開音）', async () => {
  const { client, sounds, sent } = await activeCall();
  client.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  client.onMessage({ t: 'peer-left', id: 'a', reason: 'left' });
  assert.equal(client.call, null, '通話已結束');
  assert.deepEqual(client.notice, { type: 'peer-hangup' });
  assert.deepEqual(sounds, ['join', 'leave']);
  assert.ok(sent().includes('leave'), '也通知伺服器自己離開');
  client.stop();
});

test('一對一通話：對方只是連線中斷（dropped）不立刻掛斷，保留重連的寬限', async () => {
  const { client } = await activeCall();
  client.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  client.onMessage({ t: 'peer-left', id: 'a', reason: 'dropped' });
  assert.ok(client.call, '通話還在等對方回來');
  assert.equal(client.notice, null);
  client.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  assert.equal(client.peers.size, 1, '對方重連回來');
  client.stop();
});

test('多人通話：有人掛斷通話繼續；只剩自己時才依原本規則等待後掛斷', async () => {
  const { client, sounds } = await activeCall();
  client.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  client.onMessage({ t: 'peer-joined', peer: { id: 'b', name: 'B' } });
  client.onMessage({ t: 'peer-left', id: 'a', reason: 'left' });
  assert.ok(client.call && client.peers.size === 1, '還有人在，通話繼續');
  client.onMessage({ t: 'peer-left', id: 'b', reason: 'left' });
  assert.ok(client.call, '曾經是多人通話：不立刻結束，等一下再掛斷');
  assert.ok(client.timers.alone, '已排定自動掛斷');
  assert.deepEqual(sounds, ['join', 'join', 'leave', 'leave']);
  client.stop();
});

test('自己按掛斷：播放一次離開音效；靜音掛斷（自動結束）不重複出聲', async () => {
  const first = await activeCall();
  first.client.leave();
  assert.deepEqual(first.sounds, ['leave']);
  const second = await activeCall();
  second.client.leave({ silent: true });
  assert.deepEqual(second.sounds, []);
  first.client.stop(); second.client.stop();
});

// ---- 彼此直連（mesh）的信令：offer／answer／ICE 候選 ----
function signalPeer({ failOn = null } = {}) {
  const log = [];
  const step = async (name, value) => { log.push(name); if (failOn === name) throw new Error(name); return value; };
  const pc = {
    localDescription: null,
    setRemoteDescription: description => step(`remote:${description.type}`),
    createAnswer: () => step('createAnswer', { type: 'answer', sdp: 'answer-sdp' }),
    setLocalDescription: async description => { await step('local'); pc.localDescription = description; },
    addIceCandidate: candidate => step(`candidate:${candidate.id}`),
  };
  return { log, peer: { id: 'p1', pc, queued: [], remoteSet: false } };
}

function signalClient(peer) {
  const { client } = makeClient({ mic: true });
  const sent = [];
  client.send = message => { sent.push(message); return true; };
  client.peers.set(peer.id, peer);
  return { client, sent };
}

test('收到 offer：設定遠端、送出先前排隊的候選、回覆 answer', async () => {
  const { log, peer } = signalPeer();
  const { client, sent } = signalClient(peer);
  await client.onSignal('p1', { kind: 'candidate', candidate: { id: 'early' } });
  assert.deepEqual(peer.queued, [{ id: 'early' }], '遠端還沒設定前，候選先排隊');
  await client.onSignal('p1', { kind: 'offer', sdp: 'offer-sdp' });
  assert.deepEqual(log, ['remote:offer', 'candidate:early', 'createAnswer', 'local']);
  assert.equal(peer.remoteSet, true);
  assert.deepEqual(peer.queued, []);
  assert.deepEqual(sent, [{ t: 'signal', to: 'p1', data: { kind: 'answer', sdp: 'answer-sdp' } }]);
  await client.onSignal('p1', { kind: 'candidate', candidate: { id: 'late' } });
  assert.equal(log.at(-1), 'candidate:late', '遠端設定後的候選直接加入');
});

test('收到 answer：設定遠端並送出排隊的候選；不回覆任何訊息', async () => {
  const { log, peer } = signalPeer();
  const { client, sent } = signalClient(peer);
  peer.queued.push({ id: 'q' });
  await client.onSignal('p1', { kind: 'answer', sdp: 'x' });
  assert.deepEqual(log, ['remote:answer', 'candidate:q']);
  assert.deepEqual(sent, []);
});

test('未知的對象、沒有內容、沒有候選或失敗的訊息都安靜略過，不影響通話', async () => {
  const { log, peer } = signalPeer({ failOn: 'remote:offer' });
  const { client, sent } = signalClient(peer);
  await client.onSignal('nobody', { kind: 'offer', sdp: 'x' });
  await client.onSignal('p1', null);
  await client.onSignal('p1', { kind: 'candidate' });
  await client.onSignal('p1', { kind: 'unknown' });
  await client.onSignal('p1', { kind: 'offer', sdp: 'x' });
  assert.deepEqual(log, ['remote:offer']);
  assert.deepEqual(sent, []);
  assert.equal(peer.remoteSet, false);
});

// ---- 斷線後重新加入 ----
test('重新加入：取得新票證後送出 start，逾時沒加入就結束並提示', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client } = makeClient({ mic: true });
  const sent = [];
  client.send = message => { sent.push(message); return true; };
  client.localMedia = () => ({ mic: 'on' });
  client.api = async body => { assert.deepEqual(body, { type: 'room', roomId: 7 }); return { ticket: 'tk', iceServers: [{ urls: 'stun:x' }], sfu: { url: '/lk' } }; };
  client.call = { roomId: 7, video: true, phase: 'reconnecting' };
  await client.rejoin();
  assert.deepEqual(sent, [{ t: 'start', ticket: 'tk', video: true, media: { mic: 'on' } }]);
  assert.equal(client.call.phase, 'starting');
  assert.deepEqual(client.iceServers, [{ urls: 'stun:x' }]);
  assert.deepEqual(client.sfuInfo, { url: '/lk' });
  t.mock.timers.tick(12000);
  assert.equal(client.call, null);
  assert.deepEqual(client.notice, { type: 'timeout' });
});

test('重新加入：沒有通話不做事；取票失敗或送不出去都結束並提示連線中斷', async () => {
  const { client } = makeClient({ mic: true });
  let calls = 0;
  client.api = async () => { calls++; throw new Error('offline'); };
  await client.rejoin();
  assert.equal(calls, 0);
  client.call = { roomId: 1, video: false };
  await client.rejoin();
  assert.equal(client.call, null);
  assert.deepEqual(client.notice, { type: 'connection-lost' });

  const second = makeClient({ mic: true }).client;
  second.api = async () => ({ ticket: 't' });
  second.send = () => false;
  second.call = { roomId: 2, video: false };
  const before = second.iceServers;
  await second.rejoin();
  assert.equal(second.call, null);
  assert.equal(second.iceServers, before, '沒有提供新的 ICE 伺服器就沿用原本的');
  assert.deepEqual(second.notice, { type: 'connection-lost' });
});
