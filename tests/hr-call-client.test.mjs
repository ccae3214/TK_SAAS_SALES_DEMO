import assert from 'node:assert/strict';
import test from 'node:test';
import { CallClient, classifyError } from '../src/lib/hr-call-client.js';

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
  assert.deepEqual(FakeSocket.last.sent[0], { t: 'start', ticket: 'room-ticket', video: false });
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
