// 通話核心（瀏覽器端，不依賴 React）：連信令 WebSocket、管理來電、建立影像與聲音的連線。
// 影像聲音有兩種走法：
// 1) 預設「每個人彼此直連」(mesh)：新加入的人主動向每位現有參加者送 offer，現有參加者回 answer（上限 6 人）。
// 2) 伺服器有設定自架 SFU（LiveKit）時改走 SFU：每個人只連到 SFU 伺服器，由它轉送給其他人（上限 20 人）。
//    信令（響鈴、加入離開、麥克風／鏡頭／喇叭狀態）兩種走法都一樣，仍由這裡的 WebSocket 處理。
// 畫面在 components/HrCallProvider.jsx；這個檔案也是為了能單獨用瀏覽器測試而不 import 任何東西。

const JOIN_TIMEOUT_MS = 12000;
const RECONNECT_GIVE_UP_MS = 30000;
const ALONE_HANGUP_MS = 8000;
const READY_WAIT_MS = 6000;
const SFU_LOW_QUALITY_FROM = 7; // 同時收到超過 6 個人的影像時，改收較低畫質，手機才撐得住

// SFU 位址可以寫相對路徑（例如 /livekit，由 nginx 轉送），這裡補成瀏覽器要連的 ws:// 或 wss:// 位址。
export function resolveSfuUrl(url, env = globalThis) {
  const value = String(url || '').trim();
  if (value.startsWith('/')) return `${env.location?.protocol === 'https:' ? 'wss' : 'ws'}://${env.location?.host}${value}`;
  return value.replace(/^http/i, 'ws');
}

export function classifyError(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return { type: 'permission' };
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return { type: 'no-device' };
  if (name === 'NotReadableError' || name === 'AbortError') return { type: 'device-busy' };
  if (error?.apiMessage) return { type: 'api', message: error.apiMessage, en: error.apiEnglish };
  return { type: 'unknown' };
}

// 連不上通話連線時，依原因給使用者不同的提示（不是一律「尚未就緒」）
export function classifyConnectFailure(error) {
  const status = Number(error?.status) || 0;
  if (status === 401 || status === 403) return { type: 'session' };
  if (status >= 500) return { type: 'service' };
  return { type: 'offline' };
}

// 瀏覽器不支援通話時，判斷最可能的原因，給使用者能照著做的提示。
// 非 https 網址（區網 IP 等）會讓瀏覽器直接拿掉麥克風功能；LINE 等應用程式內建瀏覽器則多半不支援 WebRTC。
const IN_APP_BROWSER = /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|KAKAOTALK|; wv\)/i;
export function unsupportedReason(env = globalThis) {
  if (env.isSecureContext === false) return { type: 'insecure' };
  if (IN_APP_BROWSER.test(env.navigator?.userAgent || '')) return { type: 'in-app' };
  return { type: 'unsupported' };
}

// 對方傳來的裝置狀態：只接受已知的值，其他一律當成預設（麥克風開、鏡頭沒有、喇叭開）。
export function normalizeMedia(value) {
  const pick = (input, allowed, fallback) => (allowed.includes(input) ? input : fallback);
  const source = value && typeof value === 'object' ? value : {};
  return { mic: pick(source.mic, ['on', 'off', 'none'], 'on'), cam: pick(source.cam, ['on', 'off', 'none'], 'none'), speaker: pick(source.speaker, ['on', 'off'], 'on') };
}

export class CallClient {
  // loadSfu：回傳 livekit-client 模組的函式（要用到 SFU 時才載入，沒設定 SFU 的網站不會多下載）。
  constructor({ api, wsUrl, onChange, onSound, loadSfu = null, env = globalThis, readyWaitMs = READY_WAIT_MS }) {
    this.api = api;
    this.loadSfu = loadSfu;
    this.sfuInfo = null; // /api/hr/call 回傳的 { url, token }；沒有就代表這次通話彼此直連
    this.sfuRoom = null;
    this.lkStreams = new Map(); // LiveKit 參加者識別碼 → 他的 MediaStream
    this.lkPresent = new Set(); // 已經連上 SFU 的參加者識別碼
    this.env = env;
    this.readyWaitMs = readyWaitMs;
    this.connecting = false;
    this.lastFailure = null;
    this.wsUrl = wsUrl;
    this.onChange = onChange || (() => {});
    this.onSound = onSound || (() => {});
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
    this.speakerOn = true; // 喇叭（聽對方的聲音）開關；每通電話開始時預設開啟
    this.notice = null;
    this.entering = false;
    this.timers = {};
  }

  supported() { return !!(this.WebSocketCtor && this.PeerCtor && this.media?.getUserMedia); }

  // 自己的麥克風／鏡頭／喇叭狀態（'on' 開啟、'off' 已關閉、'none' 沒有這個裝置），會同步給通話中的其他人。
  localMedia(stream = this.localStream) {
    const state = tracks => (!tracks?.length ? 'none' : tracks.some(track => track.enabled) ? 'on' : 'off');
    return { mic: state(stream?.getAudioTracks()), cam: state(stream?.getVideoTracks()), speaker: this.speakerOn ? 'on' : 'off' };
  }

  sendMedia() { if (this.call) this.send({ t: 'media', media: this.localMedia() }); }

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
        hasMic: !!this.localStream?.getAudioTracks().length,
        speakerOn: this.speakerOn,
        media: this.localMedia(),
        peers: [...this.peers.values()].map(peer => ({ id: peer.id, name: peer.name, state: peer.state, stream: peer.lk ? this.lkStreams.get(peer.lk) || null : peer.stream, media: peer.media })),
      },
    };
  }

  emit() { this.onChange(this.snapshot()); }
  // 音效交給畫面層播放（join：有人加入；leave：有人離開或自己掛斷）
  sound(kind) { try { this.onSound(kind); } catch { /* 音效失敗不影響通話 */ } }
  setNotice(notice) { this.notice = notice; this.emit(); }
  clearNotice() { if (this.notice) { this.notice = null; this.emit(); } }

  // ------------------------------------------------------------ 連線
  start() {
    this.stopped = false;
    this.listenForWake();
    return this.connect();
  }

  // 網路恢復、手機切回這個分頁時，立刻重連，不用等到下一次重試的間隔（最長 60 秒）。
  listenForWake() {
    if (this.wake) return;
    const wake = () => { if (!this.stopped && !this.ws) this.connectNow(); };
    const visible = () => { if (this.env.document?.visibilityState !== 'hidden') wake(); };
    this.wake = { wake, visible };
    this.env.addEventListener?.('online', wake);
    this.env.addEventListener?.('pageshow', wake);
    this.env.document?.addEventListener?.('visibilitychange', visible);
  }

  unlistenForWake() {
    if (!this.wake) return;
    this.env.removeEventListener?.('online', this.wake.wake);
    this.env.removeEventListener?.('pageshow', this.wake.wake);
    this.env.document?.removeEventListener?.('visibilitychange', this.wake.visible);
    this.wake = null;
  }

  connectNow() {
    clearTimeout(this.reconnectTimer);
    this.backoff = 1000;
    return this.connect();
  }

  // 等連線就緒（最多 ms 毫秒）；回傳是否已連上。
  async waitReady(ms) {
    const deadline = Date.now() + ms;
    while (!this.wsReady && !this.stopped && Date.now() < deadline) await new Promise(done => setTimeout(done, 50));
    return this.wsReady;
  }

  stop() {
    this.stopped = true;
    this.unlistenForWake();
    clearTimeout(this.reconnectTimer);
    this.cleanup();
    const ws = this.ws; this.ws = null; this.wsReady = false;
    if (ws) { ws.onclose = null; try { ws.close(); } catch { /* 已經關閉 */ } }
    this.emit();
  }

  async connect() {
    if (this.stopped || this.ws || this.connecting || !this.WebSocketCtor) return;
    this.connecting = true;
    try {
      const { ticket } = await this.api({ type: 'presence' });
      if (this.stopped || this.ws) return;
      const ws = new this.WebSocketCtor(this.wsUrl(ticket));
      this.ws = ws;
      let opened = false;
      ws.onopen = () => { opened = true; this.lastFailure = null; this.backoff = 1000; this.wsReady = true; this.emit(); if (this.call?.phase === 'reconnecting') void this.rejoin(); };
      ws.onmessage = event => { try { this.onMessage(JSON.parse(event.data)); } catch { /* 略過壞訊息 */ } };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (this.ws !== ws) return;
        // 還沒連上就被關掉：通常是代理伺服器（Cloudflare／nginx）或信令伺服器拒絕了這條連線
        if (!opened) this.lastFailure = { type: 'ws-failed' };
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
    } catch (error) {
      this.lastFailure = classifyConnectFailure(error);
      this.scheduleReconnect();
    } finally { this.connecting = false; }
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
    const missing = error => ['NotFoundError', 'OverconstrainedError'].includes(error?.name);
    const camera = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 }, facingMode: 'user' };
    try {
      if (!video) return await this.media.getUserMedia({ audio, video: false });
      try {
        return await this.media.getUserMedia({ audio, video: camera });
      } catch (error) {
        // 沒有鏡頭、鏡頭被占用：退回只有聲音，不要讓整通電話打不成
        if (['NotFoundError', 'OverconstrainedError', 'NotReadableError'].includes(error?.name)) {
          const stream = await this.media.getUserMedia({ audio, video: false });
          this.notice = { type: 'no-camera' };
          return stream;
        }
        throw error;
      }
    } catch (error) {
      // 找不到麥克風（沒有裝置、遠端桌面、系統停用輸入裝置）：改用鏡頭（視訊）或僅收聽加入，仍可聽到對方。
      // 權限被拒絕、麥克風被占用不在這裡處理，維持原本的錯誤提示。
      if (!missing(error)) throw error;
      let stream = null;
      if (video) { try { stream = await this.media.getUserMedia({ audio: false, video: camera }); } catch { stream = null; } }
      if (!stream && this.MediaStreamCtor) stream = new this.MediaStreamCtor();
      if (!stream) throw error;
      this.notice = { type: 'no-mic' };
      return stream;
    }
  }

  // 撥打與接聽是同一個動作：聊天室裡已經有通話就加入，沒有就建立。
  async enter({ roomId, video = false, title = '' }) {
    if (this.call || this.entering) return false;
    if (!this.supported()) { this.setNotice(unsupportedReason(this.env)); return false; }
    this.entering = true;
    // 連線還沒就緒（剛開頁面、剛從背景切回來、網路剛恢復）：立刻重連並等一下，不要直接叫使用者稍後再試。
    if (!this.wsReady) {
      this.notice = null;
      this.connectNow();
      if (!(await this.waitReady(this.readyWaitMs))) {
        this.entering = false;
        this.setNotice(this.lastFailure || { type: 'offline' });
        return false;
      }
    }
    this.notice = null;
    let stream = null;
    try {
      stream = await this.getMedia(video);
      const info = await this.api({ type: 'room', roomId });
      this.iceServers = info.iceServers || [];
      this.sfuInfo = info.sfu || null;
      this.localStream = stream;
      this.call = { roomId: info.roomId, title: info.title || title, roomType: info.roomType, video, callId: null, myId: null, phase: 'starting', everHadPeer: false };
      this.incoming.delete(info.roomId);
      if (!this.send({ t: 'start', ticket: info.ticket, video, media: this.localMedia(stream) })) throw new Error('offline');
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
      this.sfuInfo = info.sfu || null;
      call.phase = 'starting';
      if (!this.send({ t: 'start', ticket: info.ticket, video: call.video, media: this.localMedia() })) throw new Error('offline');
      clearTimeout(this.timers.join);
      this.timers.join = setTimeout(() => { if (this.call?.phase === 'starting') { this.cleanup(); this.setNotice({ type: 'timeout' }); } }, JOIN_TIMEOUT_MS);
      this.emit();
    } catch { this.cleanup(); this.setNotice({ type: 'connection-lost' }); }
  }

  decline(roomId) { this.send({ t: 'decline', roomId }); this.incoming.delete(roomId); this.emit(); }

  leave({ silent = false } = {}) {
    if (!this.call) return;
    if (!silent) this.sound('leave');
    this.send({ t: 'leave' });
    this.cleanup();
  }

  toggleMic() { this.localStream?.getAudioTracks().forEach(track => { track.enabled = !track.enabled; }); this.sendMedia(); this.emit(); }
  toggleCamera() { this.localStream?.getVideoTracks().forEach(track => { track.enabled = !track.enabled; }); this.sendMedia(); this.emit(); }
  // 關喇叭只是不播放對方的聲音（畫面層把對方的 video 設為靜音），連線與麥克風都不受影響
  toggleSpeaker() { if (!this.call) return; this.speakerOn = !this.speakerOn; this.sendMedia(); this.emit(); }

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
        Object.assign(this.call, { callId: message.callId, myId: message.id, phase: 'active', mode: message.video ? 'video' : 'voice', sfu: !!message.sfu });
        if (message.sfu) void this.startSfu();
        for (const peer of message.peers || []) this.addPeer(peer, true);
        this.emit();
        break;
      }
      case 'peer-joined': if (this.call) { clearTimeout(this.timers.alone); this.addPeer(message.peer, false); this.sound('join'); } break;
      case 'peer-left': this.onPeerLeft(message); break;
      case 'peer-media': this.onPeerMedia(message); break;
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

  // 其他人開關麥克風、鏡頭、喇叭：更新他的狀態讓畫面顯示。
  onPeerMedia(message) {
    const peer = this.peers.get(message.id);
    if (!peer) return;
    peer.media = normalizeMedia(message.media);
    this.emit();
  }

  // 有人離開：播放離開音效。一對一通話（整通電話最多只有對方一個人）對方按掛斷就立刻結束；
  // 對方只是連線中斷（網路瞬斷）時不立刻結束，沿用原本的等待重連。
  onPeerLeft(message) {
    const known = this.peers.has(message.id);
    const oneToOne = (this.call?.maxPeers || 0) <= 1;
    this.removePeer(message.id);
    if (!known) return;
    this.sound('leave');
    if (message.reason === 'left' && oneToOne && this.call?.phase === 'active' && !this.peers.size) {
      this.leave({ silent: true });
      this.setNotice({ type: 'peer-hangup' });
    }
  }

  // ------------------------------------------------------------ SFU（LiveKit）
  // SFU 通話的參加者沒有自己的 RTCPeerConnection：畫面對應靠簽章票證裡的 LiveKit 識別碼（info.lk），影像聲音從 SFU 收。
  addSfuPeer(info) {
    const peer = { id: info.id, name: info.name, lk: info.lk || null, media: normalizeMedia(info.media), pc: null, stream: null, state: 'connecting' };
    this.peers.set(info.id, peer);
    this.call.everHadPeer = true;
    this.call.maxPeers = Math.max(this.call.maxPeers || 0, this.peers.size);
    this.refreshSfuPeers();
  }

  refreshSfuPeers() {
    for (const peer of this.peers.values()) if (peer.lk) peer.state = this.lkPresent.has(peer.lk) ? 'connected' : 'connecting';
    this.emit();
  }

  async startSfu() {
    if (this.sfuRoom) return;
    const call = this.call;
    const info = this.sfuInfo;
    try {
      if (!call || !info || !this.loadSfu) throw new Error('sfu unavailable');
      const lk = await this.loadSfu();
      if (this.call !== call) return;
      // adaptiveStream 要靠 track.attach() 量畫面大小；這裡自己組 MediaStream 播放，所以關掉，畫質改由 applySfuQuality 控制
      const next = new lk.Room({ adaptiveStream: false, dynacast: true });
      this.sfuRoom = next; this.lk = lk;
      const events = lk.RoomEvent;
      next.on(events.TrackSubscribed, (track, publication, participant) => this.onSfuTrack(participant.identity, track, true));
      next.on(events.TrackUnsubscribed, (track, publication, participant) => this.onSfuTrack(participant.identity, track, false));
      next.on(events.ParticipantConnected, participant => { this.lkPresent.add(participant.identity); this.refreshSfuPeers(); });
      next.on(events.ParticipantDisconnected, participant => { this.lkPresent.delete(participant.identity); this.lkStreams.delete(participant.identity); this.refreshSfuPeers(); });
      next.on(events.Disconnected, () => {
        if (this.sfuRoom !== next || !this.call) return;
        this.leave({ silent: true });
        this.setNotice({ type: 'connection-lost' });
      });
      await next.connect(resolveSfuUrl(info.url, this.env), info.token);
      if (this.sfuRoom !== next || !this.call) { try { next.disconnect(false); } catch { /* 已經離開 */ } return; }
      for (const track of this.localStream?.getTracks() || []) {
        const isVideo = track.kind === 'video';
        await next.localParticipant.publishTrack(track, { source: isVideo ? lk.Track.Source.Camera : lk.Track.Source.Microphone, simulcast: isVideo });
      }
      for (const participant of next.remoteParticipants.values()) {
        this.lkPresent.add(participant.identity);
        for (const publication of participant.trackPublications.values()) if (publication.track) this.onSfuTrack(participant.identity, publication.track, true);
      }
      this.refreshSfuPeers();
      this.applySfuQuality();
    } catch {
      if (this.call === call) {
        this.leave({ silent: true });
        this.setNotice({ type: 'sfu-failed' });
      }
    }
  }

  onSfuTrack(identity, track, added) {
    const mediaTrack = track?.mediaStreamTrack;
    if (!mediaTrack || !this.MediaStreamCtor) return;
    let stream = this.lkStreams.get(identity);
    if (added) {
      if (!stream) { stream = new this.MediaStreamCtor(); this.lkStreams.set(identity, stream); }
      stream.addTrack(mediaTrack);
    } else if (stream) stream.removeTrack(mediaTrack);
    this.lkPresent.add(identity);
    this.refreshSfuPeers();
    this.applySfuQuality();
  }

  // 人多的時候只收較低畫質的影像（SFU 會轉送對應的 simulcast 層），減少手機與網路的負擔
  applySfuQuality() {
    const room = this.sfuRoom;
    if (!room || !this.lk?.VideoQuality) return;
    const quality = room.remoteParticipants.size >= SFU_LOW_QUALITY_FROM ? this.lk.VideoQuality.LOW : this.lk.VideoQuality.HIGH;
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) if (publication.kind === 'video') { try { publication.setVideoQuality?.(quality); } catch { /* 單一影像失敗不影響通話 */ } }
    }
  }

  // 離開 SFU：disconnect(false) 不會順便停掉本機的麥克風／鏡頭（斷線重連時還要繼續用），要停由 cleanup 負責
  stopSfu() {
    const room = this.sfuRoom;
    this.sfuRoom = null;
    this.lkStreams.clear();
    this.lkPresent.clear();
    if (room) { try { room.disconnect(false); } catch { /* 已經離開 */ } }
  }

  // ------------------------------------------------------------ WebRTC
  addPeer(info, initiator) {
    if (!this.call || this.peers.has(info.id)) return;
    if (this.call.sfu) { this.addSfuPeer(info); return; }
    const pc = new this.PeerCtor({ iceServers: this.iceServers });
    const peer = { id: info.id, name: info.name, media: normalizeMedia(info.media), pc, stream: null, state: 'connecting', queued: [], remoteSet: false, restarted: false, initiator };
    this.peers.set(info.id, peer);
    this.call.everHadPeer = true;
    this.call.maxPeers = Math.max(this.call.maxPeers || 0, this.peers.size);
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
    if (peer.pc) { peer.pc.onconnectionstatechange = null; peer.pc.ontrack = null; peer.pc.onicecandidate = null; peer.pc.close(); }
    if (peer.lk) this.lkStreams.delete(peer.lk);
    this.peers.delete(id);
    // 大家都走了就自動掛斷（一對一通話對方掛掉時，自己這邊也結束）
    if (!this.peers.size && this.call?.everHadPeer && this.call.phase === 'active') {
      clearTimeout(this.timers.alone);
      this.timers.alone = setTimeout(() => { if (this.call && !this.peers.size) { this.leave({ silent: true }); this.setNotice({ type: 'everyone-left' }); } }, ALONE_HANGUP_MS);
    }
    this.emit();
  }

  dropPeers() { for (const id of [...this.peers.keys()]) this.removePeer(id); this.stopSfu(); }

  cleanup() {
    for (const name of Object.keys(this.timers)) clearTimeout(this.timers[name]);
    this.timers = {};
    for (const peer of this.peers.values()) { if (peer.pc) { peer.pc.onconnectionstatechange = null; peer.pc.close(); } }
    this.peers.clear();
    this.stopSfu();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.call = null;
    this.speakerOn = true;
    this.emit();
  }
}
