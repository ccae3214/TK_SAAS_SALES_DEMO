// 通話核心（瀏覽器端，不依賴 React）：連信令 WebSocket、管理來電、建立每個人之間的 WebRTC 連線。
// 多人通話是「每個人彼此直連」(mesh)：新加入的人主動向每位現有參加者送 offer，現有參加者回 answer。
// 畫面在 components/HrCallProvider.jsx；這個檔案也是為了能單獨用瀏覽器測試而不 import 任何東西。

const JOIN_TIMEOUT_MS = 12000;
const RECONNECT_GIVE_UP_MS = 30000;
const ALONE_HANGUP_MS = 8000;

export function classifyError(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return { type: 'permission' };
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return { type: 'no-device' };
  if (name === 'NotReadableError' || name === 'AbortError') return { type: 'device-busy' };
  if (error?.apiMessage) return { type: 'api', message: error.apiMessage, en: error.apiEnglish };
  return { type: 'unknown' };
}

export class CallClient {
  constructor({ api, wsUrl, onChange, env = globalThis }) {
    this.api = api;
    this.wsUrl = wsUrl;
    this.onChange = onChange || (() => {});
    this.WebSocketCtor = env.WebSocket;
    this.PeerCtor = env.RTCPeerConnection;
    this.MediaStreamCtor = env.MediaStream;
    this.media = env.navigator?.mediaDevices;
    this.stopped = false;
    this.ws = null;
    this.wsReady = false;
    this.backoff = 1000;
    this.reconnectTimer = null;
    this.incoming = new Map();
    this.peers = new Map();
    this.call = null;
    this.localStream = null;
    this.notice = null;
    this.entering = false;
    this.timers = {};
  }

  supported() { return !!(this.WebSocketCtor && this.PeerCtor && this.media?.getUserMedia); }

  snapshot() {
    return {
      ready: this.wsReady,
      supported: this.supported(),
      incoming: [...this.incoming.values()],
      notice: this.notice,
      call: this.call && {
        ...this.call,
        localStream: this.localStream,
        micOn: !!this.localStream?.getAudioTracks().some(track => track.enabled),
        camOn: !!this.localStream?.getVideoTracks().some(track => track.enabled),
        hasCamera: !!this.localStream?.getVideoTracks().length,
        peers: [...this.peers.values()].map(peer => ({ id: peer.id, name: peer.name, state: peer.state, stream: peer.stream })),
      },
    };
  }

  emit() { this.onChange(this.snapshot()); }
  setNotice(notice) { this.notice = notice; this.emit(); }
  clearNotice() { if (this.notice) { this.notice = null; this.emit(); } }

  // ------------------------------------------------------------ 連線
  start() { this.stopped = false; return this.connect(); }

  stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.cleanup();
    const ws = this.ws; this.ws = null; this.wsReady = false;
    if (ws) { ws.onclose = null; try { ws.close(); } catch { /* 已經關閉 */ } }
    this.emit();
  }

  async connect() {
    if (this.stopped || this.ws || !this.WebSocketCtor) return;
    try {
      const { ticket } = await this.api({ type: 'presence' });
      if (this.stopped || this.ws) return;
      const ws = new this.WebSocketCtor(this.wsUrl(ticket));
      this.ws = ws;
      ws.onopen = () => { this.backoff = 1000; this.wsReady = true; this.emit(); if (this.call?.phase === 'reconnecting') void this.rejoin(); };
      ws.onmessage = event => { try { this.onMessage(JSON.parse(event.data)); } catch { /* 略過壞訊息 */ } };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null; this.wsReady = false;
        this.incoming.clear();
        if (this.call) {
          this.call.phase = 'reconnecting';
          this.dropPeers();
          clearTimeout(this.timers.giveUp);
          this.timers.giveUp = setTimeout(() => { if (this.call?.phase === 'reconnecting') { this.cleanup(); this.setNotice({ type: 'connection-lost' }); } }, RECONNECT_GIVE_UP_MS);
        }
        this.emit();
        this.scheduleReconnect();
      };
    } catch { this.scheduleReconnect(); }
  }

  scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => void this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 60000);
  }

  send(message) {
    if (this.ws && this.wsReady) { this.ws.send(JSON.stringify(message)); return true; }
    return false;
  }

  // ------------------------------------------------------------ 撥打、接聽、拒接、掛斷
  async getMedia(video) {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (!video) return this.media.getUserMedia({ audio, video: false });
    try {
      return await this.media.getUserMedia({ audio, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 }, facingMode: 'user' } });
    } catch (error) {
      // 沒有鏡頭、鏡頭被占用：退回只有聲音，不要讓整通電話打不成
      if (['NotFoundError', 'OverconstrainedError', 'NotReadableError'].includes(error?.name)) {
        const stream = await this.media.getUserMedia({ audio, video: false });
        this.notice = { type: 'no-camera' };
        return stream;
      }
      throw error;
    }
  }

  // 撥打與接聽是同一個動作：聊天室裡已經有通話就加入，沒有就建立。
  async enter({ roomId, video = false, title = '' }) {
    if (this.call || this.entering) return false;
    if (!this.supported()) { this.setNotice({ type: 'unsupported' }); return false; }
    if (!this.wsReady) { this.setNotice({ type: 'offline' }); return false; }
    this.entering = true;
    this.notice = null;
    let stream = null;
    try {
      stream = await this.getMedia(video);
      const info = await this.api({ type: 'room', roomId });
      this.iceServers = info.iceServers || [];
      this.localStream = stream;
      this.call = { roomId: info.roomId, title: info.title || title, roomType: info.roomType, video, callId: null, myId: null, phase: 'starting', everHadPeer: false };
      this.incoming.delete(info.roomId);
      if (!this.send({ t: 'start', ticket: info.ticket, video })) throw new Error('offline');
      this.timers.join = setTimeout(() => { if (this.call?.phase === 'starting') { this.cleanup(); this.setNotice({ type: 'timeout' }); } }, JOIN_TIMEOUT_MS);
      this.emit();
      return true;
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      this.localStream = null; this.call = null;
      this.setNotice(classifyError(error));
      return false;
    } finally { this.entering = false; }
  }

  async rejoin() {
    const call = this.call;
    if (!call) return;
    try {
      const info = await this.api({ type: 'room', roomId: call.roomId });
      this.iceServers = info.iceServers || this.iceServers;
      call.phase = 'starting';
      if (!this.send({ t: 'start', ticket: info.ticket, video: call.video })) throw new Error('offline');
      clearTimeout(this.timers.join);
      this.timers.join = setTimeout(() => { if (this.call?.phase === 'starting') { this.cleanup(); this.setNotice({ type: 'timeout' }); } }, JOIN_TIMEOUT_MS);
      this.emit();
    } catch { this.cleanup(); this.setNotice({ type: 'connection-lost' }); }
  }

  decline(roomId) { this.send({ t: 'decline', roomId }); this.incoming.delete(roomId); this.emit(); }

  leave() {
    if (!this.call) return;
    this.send({ t: 'leave' });
    this.cleanup();
  }

  toggleMic() { this.localStream?.getAudioTracks().forEach(track => { track.enabled = !track.enabled; }); this.emit(); }
  toggleCamera() { this.localStream?.getVideoTracks().forEach(track => { track.enabled = !track.enabled; }); this.emit(); }

  // ------------------------------------------------------------ 信令訊息
  onMessage(message) {
    switch (message.t) {
      case 'incoming':
        if (this.call?.roomId === message.roomId) break;
        this.incoming.set(message.roomId, { roomId: message.roomId, callId: message.callId, title: message.title, video: message.video, from: message.from });
        this.emit();
        break;
      case 'ring-stop': this.incoming.delete(message.roomId); this.emit(); break;
      case 'joined': {
        if (!this.call) { this.send({ t: 'leave' }); break; }
        clearTimeout(this.timers.join); clearTimeout(this.timers.alone);
        Object.assign(this.call, { callId: message.callId, myId: message.id, phase: 'active', mode: message.video ? 'video' : 'voice' });
        for (const peer of message.peers || []) this.addPeer(peer, true);
        this.emit();
        break;
      }
      case 'peer-joined': if (this.call) { clearTimeout(this.timers.alone); this.addPeer(message.peer, false); } break;
      case 'peer-left': this.removePeer(message.id); break;
      case 'signal': void this.onSignal(message.from, message.data); break;
      case 'declined': this.setNotice({ type: 'declined', name: message.name }); break;
      case 'ended':
        this.incoming.delete(message.roomId);
        if (this.call?.roomId === message.roomId) { this.cleanup(); if (message.reason !== 'ended') this.notice = { type: message.reason }; }
        this.emit();
        break;
      case 'error':
        if (this.call?.phase === 'starting') this.cleanup();
        this.setNotice({ type: message.code });
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------ WebRTC
  addPeer(info, initiator) {
    if (!this.call || this.peers.has(info.id)) return;
    const pc = new this.PeerCtor({ iceServers: this.iceServers });
    const peer = { id: info.id, name: info.name, pc, stream: null, state: 'connecting', queued: [], remoteSet: false, restarted: false, initiator };
    this.peers.set(info.id, peer);
    this.call.everHadPeer = true;
    for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream);
    pc.onicecandidate = event => { if (event.candidate) this.send({ t: 'signal', to: info.id, data: { kind: 'candidate', candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate } }); };
    pc.ontrack = event => {
      if (event.streams[0]) peer.stream = event.streams[0];
      else { peer.stream = peer.stream || new this.MediaStreamCtor(); peer.stream.addTrack(event.track); }
      this.emit();
    };
    pc.onconnectionstatechange = () => {
      peer.state = pc.connectionState;
      // 連線失敗時由主動方重新協商一次（網路切換，例如 Wi-Fi 換成行動網路）
      if (pc.connectionState === 'failed' && peer.initiator && !peer.restarted) { peer.restarted = true; void this.makeOffer(peer, true); }
      this.emit();
    };
    if (initiator) void this.makeOffer(peer, false);
    this.emit();
  }

  async makeOffer(peer, iceRestart) {
    try {
      const offer = await peer.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true, iceRestart });
      await peer.pc.setLocalDescription(offer);
      this.send({ t: 'signal', to: peer.id, data: { kind: 'offer', sdp: peer.pc.localDescription.sdp } });
    } catch { /* 這一位連不上不影響其他人 */ }
  }

  async flushCandidates(peer) {
    const queued = peer.queued; peer.queued = [];
    for (const candidate of queued) { try { await peer.pc.addIceCandidate(candidate); } catch { /* 略過過期的候選 */ } }
  }

  async onSignal(from, data) {
    const peer = this.peers.get(from);
    if (!peer || !data) return;
    try {
      if (data.kind === 'offer') {
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        peer.remoteSet = true; await this.flushCandidates(peer);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.send({ t: 'signal', to: from, data: { kind: 'answer', sdp: peer.pc.localDescription.sdp } });
      } else if (data.kind === 'answer') {
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        peer.remoteSet = true; await this.flushCandidates(peer);
      } else if (data.kind === 'candidate' && data.candidate) {
        if (peer.remoteSet) await peer.pc.addIceCandidate(data.candidate); else peer.queued.push(data.candidate);
      }
    } catch { /* 單一訊息失敗不中斷通話 */ }
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.onconnectionstatechange = null; peer.pc.ontrack = null; peer.pc.onicecandidate = null;
    peer.pc.close();
    this.peers.delete(id);
    // 大家都走了就自動掛斷（一對一通話對方掛掉時，自己這邊也結束）
    if (!this.peers.size && this.call?.everHadPeer && this.call.phase === 'active') {
      clearTimeout(this.timers.alone);
      this.timers.alone = setTimeout(() => { if (this.call && !this.peers.size) { this.leave(); this.setNotice({ type: 'everyone-left' }); } }, ALONE_HANGUP_MS);
    }
    this.emit();
  }

  dropPeers() { for (const id of [...this.peers.keys()]) this.removePeer(id); }

  cleanup() {
    for (const name of Object.keys(this.timers)) clearTimeout(this.timers[name]);
    this.timers = {};
    for (const peer of this.peers.values()) { peer.pc.onconnectionstatechange = null; peer.pc.close(); }
    this.peers.clear();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.call = null;
    this.emit();
  }
}
