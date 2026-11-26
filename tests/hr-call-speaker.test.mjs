import assert from 'node:assert/strict';
import test from 'node:test';
import { CallClient } from '../src/lib/hr-call-client.js';

class FakeTrack { constructor(kind) { this.kind = kind; this.enabled = true; this.readyState = 'live'; } stop() { this.readyState = 'ended'; } }
class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
}

function makeClient() {
  const snapshots = [];
  const env = { WebSocket: class {}, RTCPeerConnection: class {}, MediaStream: FakeStream, navigator: { mediaDevices: { async getUserMedia() { return new FakeStream(); } } } };
  const client = new CallClient({ api: async () => ({}), wsUrl: () => '', onChange: state => snapshots.push(state), env });
  return { client, snapshots };
}

test('喇叭預設開啟；切換後狀態改變並通知畫面，再切換回來', () => {
  const { client, snapshots } = makeClient();
  client.localStream = new FakeStream([new FakeTrack('audio')]);
  client.call = { roomId: 1, title: 't', phase: 'active', peers: [], everHadPeer: false };
  assert.equal(client.snapshot().call.speakerOn, true);
  client.toggleSpeaker();
  assert.equal(client.snapshot().call.speakerOn, false);
  assert.equal(snapshots.at(-1).call.speakerOn, false, '切換後有通知畫面');
  client.toggleSpeaker();
  assert.equal(client.snapshot().call.speakerOn, true);
});

test('關喇叭不影響麥克風與鏡頭', () => {
  const { client } = makeClient();
  client.localStream = new FakeStream([new FakeTrack('audio'), new FakeTrack('video')]);
  client.call = { roomId: 1, title: 't', phase: 'active', peers: [], everHadPeer: false };
  client.toggleSpeaker();
  const call = client.snapshot().call;
  assert.equal(call.micOn, true);
  assert.equal(call.camOn, true);
  client.toggleMic();
  assert.equal(client.snapshot().call.micOn, false);
  assert.equal(client.snapshot().call.speakerOn, false, '開關麥克風不會動到喇叭');
});

test('沒有通話時切換喇叭不動作；通話結束後下一通電話喇叭恢復開啟', () => {
  const { client } = makeClient();
  client.toggleSpeaker();
  assert.equal(client.speakerOn, true, '沒有通話時不改變');
  client.localStream = new FakeStream([new FakeTrack('audio')]);
  client.call = { roomId: 1, title: 't', phase: 'active', peers: [], everHadPeer: false };
  client.toggleSpeaker();
  assert.equal(client.speakerOn, false);
  client.cleanup();
  assert.equal(client.speakerOn, true, '掛斷後重置');
});
