import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CallClient } from '../src/lib/hr-call-client.js';

// 接聽後影像聲音一直連不上對方：以前畫面會永遠停在「連線中…」，現在逾時或連線失敗時會提示（peer-failed）。
class FakeTrack { constructor(kind) { this.kind = kind; this.enabled = true; this.readyState = 'live'; } stop() { this.readyState = 'ended'; } }
class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
}
class FakeSocket {
  constructor() { this.sent = []; FakeSocket.last = this; setTimeout(() => this.onopen?.(), 5); }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() {}
}
class FakePeer {
  constructor() { this.closed = false; this.localDescription = { sdp: 'v=0' }; }
  addTrack() {}
  async createOffer() { return { sdp: 'v=0' }; }
  async setLocalDescription() {}
  close() { this.closed = true; }
}
const wait = ms => new Promise(done => setTimeout(done, ms));
const okApi = async body => (body.type === 'presence' ? { ticket: 'p' } : { ticket: 't', roomId: 7, roomType: 'case', title: 'T', iceServers: [] });

async function activeCall(options = {}) {
  const media = { async getUserMedia() { return new FakeStream([new FakeTrack('audio')]); } };
  const env = { WebSocket: FakeSocket, RTCPeerConnection: FakePeer, MediaStream: FakeStream, navigator: { mediaDevices: media } };
  const client = new CallClient({ api: okApi, wsUrl: () => '', onChange: () => {}, env, readyWaitMs: 400, ...options });
  assert.equal(await client.enter({ roomId: 7 }), true);
  client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: false, peers: [] });
  return client;
}

test('接聽後一直連不上對方（被動方）：逾時提示 peer-failed，通話不會被掛斷', async () => {
  const client = await activeCall({ peerConnectMs: 30 });
  client.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  assert.equal(client.notice, null);
  await wait(80);
  assert.deepEqual(client.notice, { type: 'peer-failed' });
  assert.ok(client.call, '通話還在，使用者可自己決定掛斷');
  client.stop();
});

test('接聽後連不上（主動方）：先重新協商一次，再逾時才提示', async () => {
  const client = await activeCall({ peerConnectMs: 40 });
  client.onMessage({ t: 'joined', callId: 'c', id: 'me', video: true, peers: [{ id: 'a', name: 'A' }] });
  await wait(15);
  const offersBefore = FakeSocket.last.sent.filter(item => item.t === 'signal').length;
  assert.ok(offersBefore >= 1, '加入時先送出 offer');
  await wait(40);
  assert.equal(client.notice, null, '第一次逾時只重新協商，還不提示');
  assert.ok(FakeSocket.last.sent.filter(item => item.t === 'signal').length > offersBefore, '有再送一次 offer');
  await wait(60);
  assert.deepEqual(client.notice, { type: 'peer-failed' });
  client.stop();
});

test('對方連上了就不提示；對方離開或掛斷也會清掉計時', async () => {
  const connected = await activeCall({ peerConnectMs: 30 });
  connected.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  const peer = connected.peers.get('a');
  peer.pc.connectionState = 'connected';
  peer.pc.onconnectionstatechange();
  await wait(80);
  assert.equal(connected.notice, null);
  connected.stop();

  const left = await activeCall({ peerConnectMs: 30 });
  left.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  left.onMessage({ t: 'peer-left', id: 'a', reason: 'dropped' });
  await wait(80);
  assert.equal(left.notice, null);
  left.stop();
});

test('連線狀態 failed 且是被動方（或已重新協商過）：立刻提示 peer-failed', async () => {
  const client = await activeCall({ peerConnectMs: 5000 });
  client.onMessage({ t: 'peer-joined', peer: { id: 'a', name: 'A' } });
  const peer = client.peers.get('a');
  peer.pc.connectionState = 'failed';
  peer.pc.onconnectionstatechange();
  assert.deepEqual(client.notice, { type: 'peer-failed' });
  client.stop();
});

test('peer-failed 提示有中文與英文各一句', async () => {
  const provider = (await readFile(new URL('../src/components/HrCallProvider.jsx', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(provider.split("'peer-failed':").length - 1, 2);
});
