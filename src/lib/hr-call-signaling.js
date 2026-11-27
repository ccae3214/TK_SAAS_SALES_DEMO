import crypto from 'node:crypto';
import { verifyTicket } from './hr-call-ticket.js';

// 通話信令：只轉送「誰要通話、誰加入、WebRTC 的連線資訊」，聲音與影像不經過這裡（瀏覽器之間直連，必要時走 TURN）。
// 通話狀態只存在記憶體（單一 app 容器）；重啟 app 時進行中的通話會中斷，使用者重新撥打即可。
// WebSocket 協定（RFC 6455）自己實作在下面，不需要額外安裝套件。

export const MAX_PARTICIPANTS = 6; // 多人通話是每個人彼此直連（mesh），超過約 4～6 人手機會吃不消
export const SFU_MAX_PARTICIPANTS = 20; // 有設定自架 SFU（LiveKit）時，影像聲音經過伺服器轉送，上限提高到 20 人
export const maxParticipantsFor = call => (call.sfu ? SFU_MAX_PARTICIPANTS : MAX_PARTICIPANTS);
export const RING_MS = 45000;
export const NUDGE_MS = 10000; // 響鈴這麼久還沒人接，連著網頁卻沒反應的人（例如手機切到背景）也補發一次通知
const MAX_CONNECTIONS_PER_KEY = 6;
const MAX_CONNECTIONS = 500;
const MAX_MESSAGE_BYTES = 64 * 1024;

// 參加者的麥克風／鏡頭／喇叭狀態：mic、cam 是 'on'（開啟）、'off'（已關閉）、'none'（沒有這個裝置）；speaker 是 'on'／'off'。
// 只轉送這三個欄位，其他內容一律丟掉；沒有提供就用預設值（麥克風開、鏡頭依通話類型、喇叭開）。
export function cleanMedia(value, video = false) {
  const pickState = (input, allowed, fallback) => (allowed.includes(input) ? input : fallback);
  const source = value && typeof value === 'object' ? value : {};
  return {
    mic: pickState(source.mic, ['on', 'off', 'none'], 'on'),
    cam: pickState(source.cam, ['on', 'off', 'none'], video ? 'on' : 'none'),
    speaker: pickState(source.speaker, ['on', 'off'], 'on'),
  };
}

// ---------------------------------------------------------------- 通話邏輯（與連線方式無關，可單獨測試）
export class CallHub {
  // onNotify(call)：有人撥號時通知「不在線上」的被叫者（網頁推播／LINE），見 hr-call-notify-store.js。通知失敗不影響通話。
  constructor({ secret, ringMs = RING_MS, nudgeMs = NUDGE_MS, onNotify = null, setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now() } = {}) {
    this.secret = secret;
    this.ringMs = ringMs;
    this.nudgeMs = nudgeMs;
    this.onNotify = onNotify;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.now = now;
    this.byKey = new Map(); // 使用者識別 → 連線集合（同一人可以開多個分頁或裝置）
    this.calls = new Map(); // 聊天室編號 → 通話
    this.connectionCount = 0;
  }

  addConnection(conn) {
    if (this.connectionCount >= MAX_CONNECTIONS) return false;
    const set = this.byKey.get(conn.key) || new Set();
    if (set.size >= MAX_CONNECTIONS_PER_KEY) return false;
    set.add(conn);
    this.byKey.set(conn.key, set);
    this.connectionCount += 1;
    conn.roomId = null;
    // 剛連上（或重新整理）時，補送還在響鈴的來電
    for (const call of this.calls.values()) if (call.ringing && call.invitees.has(conn.key) && !this.isParticipantKey(call, conn.key) && !call.declined.has(conn.key)) conn.send(this.incomingMessage(call));
    return true;
  }

  removeConnection(conn) {
    if (conn.roomId != null) this.leave(conn, 'dropped');
    const set = this.byKey.get(conn.key);
    if (set?.delete(conn)) this.connectionCount -= 1;
    if (set && !set.size) this.byKey.delete(conn.key);
  }

  isOnline(key) { return (this.byKey.get(key)?.size || 0) > 0; }

  notify(call, keys, kind) {
    if (!this.onNotify || !keys.length) return;
    try { this.onNotify({ kind, roomId: call.roomId, callId: call.id, title: call.title, video: call.video, from: call.startedByName, startedBy: call.startedBy, keys }); } catch { /* 通知失敗不影響通話 */ }
  }

  // 響鈴一段時間還沒人加入：還在線上、沒拒接的被叫者也補發通知（網頁在背景時可能聽不到鈴聲）。
  nudge(call) {
    call.nudgeTimer = null;
    if (this.calls.get(call.roomId) !== call || !call.ringing || call.participants.size > 1) return;
    this.notify(call, [...call.invitees].filter(key => this.isOnline(key) && !call.declined.has(key) && !this.isParticipantKey(call, key)), 'nudge');
  }

  isParticipantKey(call, key) {
    for (const participant of call.participants.values()) if (participant.key === key) return true;
    return false;
  }

  incomingMessage(call) {
    return { t: 'incoming', callId: call.id, roomId: call.roomId, title: call.title, video: call.video, from: call.startedByName };
  }

  handle(conn, message) {
    if (!message || typeof message !== 'object') return;
    switch (message.t) {
      case 'ping': conn.send({ t: 'pong' }); break;
      case 'start': case 'join': this.enter(conn, message); break;
      case 'signal': this.relay(conn, message); break;
      case 'media': this.setMedia(conn, message); break;
      case 'decline': this.decline(conn, message); break;
      case 'leave': this.leave(conn, 'left'); break;
      default: break;
    }
  }

  // 通話票證要是這個連線本人的、而且指向合法的聊天室；不合法回傳 null。
  enterTicket(conn, message) {
    const ticket = verifyTicket(message.ticket, this.secret, this.now());
    const roomId = Number(ticket?.r);
    if (!ticket || ticket.k !== conn.key || !Number.isSafeInteger(roomId) || roomId < 1) return null;
    return { ticket, roomId };
  }

  // 第一個人開始通話：建立通話、開始響鈴計時，通知在線上的被叫者，離線的改發推播。
  startCall(conn, message, ticket, roomId) {
    const invitees = (Array.isArray(ticket.invitees) ? ticket.invitees : []).filter(key => typeof key === 'string' && key !== conn.key).slice(0, 300);
    const call = {
      id: crypto.randomUUID(), roomId, title: String(ticket.ct || ticket.title || '').slice(0, 200), video: !!message.video,
      startedBy: conn.key, startedByName: conn.name, invitees: new Set(invitees),
      participants: new Map(), declined: new Set(), ringing: true, timer: null,
      sfu: ticket.sfu === true, // 這通電話的影像聲音走 SFU 還是彼此直連，由第一個開始通話的人的票證決定
    };
    this.calls.set(roomId, call);
    call.timer = this.setTimer(() => this.ringTimeout(call), this.ringMs);
    call.nudgeTimer = this.nudgeMs > 0 ? this.setTimer(() => this.nudge(call), this.nudgeMs) : null;
    for (const key of call.invitees) for (const other of this.byKey.get(key) || []) other.send(this.incomingMessage(call));
    this.notify(call, [...call.invitees].filter(key => !this.isOnline(key)), 'offline');
    return call;
  }

  // 傳給其他參加者的「這個人是誰」：SFU 通話才帶 lk。
  peerInfo(item, call) {
    return { id: item.id, name: item.name, ...(item.lk ? { lk: item.lk } : {}), media: item.media || cleanMedia(null, call.video) };
  }

  // SFU 通話：LiveKit 的參加者識別碼來自簽章票證（不能自己亂填），其他人用它把畫面對應到這個人
  sfuIdentity(call, ticket) {
    return call.sfu && typeof ticket.lk === 'string' && /^[0-9a-f]{18}$/.test(ticket.lk) ? ticket.lk : null;
  }

  enter(conn, message) {
    const entry = this.enterTicket(conn, message);
    if (!entry) return conn.send({ t: 'error', code: 'bad-ticket' });
    if (conn.roomId != null) return conn.send({ t: 'error', code: 'already-in-call' });
    const { ticket, roomId } = entry;
    const existing = this.calls.get(roomId);
    if (existing && existing.participants.size >= maxParticipantsFor(existing)) return conn.send({ t: 'error', code: 'full' });
    const call = existing || this.startCall(conn, message, ticket, roomId);
    const peers = [...call.participants.values()].map(item => this.peerInfo(item, call));
    conn.media = cleanMedia(message.media, call.video);
    conn.lk = this.sfuIdentity(call, ticket);
    if (call.sfu && !conn.lk) return conn.send({ t: 'error', code: 'bad-ticket' });
    this.joinCall(conn, call, peers);
  }

  joinCall(conn, call, peers) {
    const { roomId } = call;
    call.participants.set(conn.id, conn);
    conn.roomId = roomId;
    conn.send({ t: 'joined', callId: call.id, roomId, id: conn.id, video: call.video, title: call.title, peers, ...(call.sfu ? { sfu: true } : {}) });
    const joined = { t: 'peer-joined', peer: this.peerInfo(conn, call) };
    for (const other of call.participants.values()) if (other !== conn) other.send(joined);
    // 同一個人的其他分頁／裝置不用再響鈴
    for (const other of this.byKey.get(conn.key) || []) if (other !== conn && other.roomId == null) other.send({ t: 'ring-stop', roomId });
  }

  relay(conn, message) {
    const call = this.calls.get(conn.roomId);
    const target = call?.participants.get(String(message.to));
    if (!call || !target || target === conn) return;
    target.send({ t: 'signal', from: conn.id, data: message.data });
  }

  // 參加者開關麥克風、鏡頭、喇叭時，把最新狀態轉送給同一通電話的其他人（只在通話中才有效）。
  setMedia(conn, message) {
    const call = this.calls.get(conn.roomId);
    if (!call || !call.participants.has(conn.id)) return;
    conn.media = cleanMedia(message.media, call.video);
    for (const other of call.participants.values()) if (other !== conn) other.send({ t: 'peer-media', id: conn.id, media: conn.media });
  }

  decline(conn, message) {
    const call = this.calls.get(Number(message.roomId));
    if (!call || !call.invitees.has(conn.key)) return;
    call.declined.add(conn.key);
    for (const other of this.byKey.get(conn.key) || []) other.send({ t: 'ring-stop', roomId: call.roomId });
    for (const participant of call.participants.values()) participant.send({ t: 'declined', name: conn.name });
    if (call.participants.size <= 1 && call.invitees.size > 0 && [...call.invitees].every(key => call.declined.has(key))) this.endCall(call, 'declined');
  }

  // reason：'left' 是對方自己按掛斷；'dropped' 是連線中斷（網路瞬斷、關分頁），客戶端會保留重連的寬限時間。
  leave(conn, reason = 'left') {
    const call = this.calls.get(conn.roomId);
    conn.roomId = null;
    if (!call || !call.participants.delete(conn.id)) return;
    for (const other of call.participants.values()) other.send({ t: 'peer-left', id: conn.id, reason });
    if (!call.participants.size) this.endCall(call, 'ended');
  }

  ringTimeout(call) {
    call.timer = null;
    if (this.calls.get(call.roomId) !== call || !call.ringing) return;
    call.ringing = false;
    if (call.participants.size <= 1) this.endCall(call, 'no-answer');
    else for (const key of call.invitees) for (const other of this.byKey.get(key) || []) if (other.roomId == null) other.send({ t: 'ring-stop', roomId: call.roomId });
  }

  endCall(call, reason) {
    if (this.calls.get(call.roomId) !== call) return;
    this.calls.delete(call.roomId);
    if (call.timer) { this.clearTimer(call.timer); call.timer = null; }
    if (call.nudgeTimer) { this.clearTimer(call.nudgeTimer); call.nudgeTimer = null; }
    const notice = { t: 'ended', roomId: call.roomId, callId: call.id, reason };
    for (const participant of call.participants.values()) { participant.roomId = null; participant.send(notice); }
    call.participants.clear();
    for (const key of call.invitees) for (const other of this.byKey.get(key) || []) if (other.roomId == null) other.send(notice);
  }
}

// ---------------------------------------------------------------- WebSocket（RFC 6455）精簡實作：只收發文字訊息
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function encodeFrame(opcode, payload = Buffer.alloc(0)) {
  const length = payload.length;
  let header;
  if (length < 126) header = Buffer.from([0x80 | opcode, length]);
  else if (length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(length), 2); }
  return Buffer.concat([header, payload]);
}

// 從累積的資料中取出一個完整的客戶端影格；資料不夠時回傳 null。客戶端影格一律要有遮罩。
export function decodeFrame(buffer, maxBytes = MAX_MESSAGE_BYTES) {
  if (buffer.length < 2) return null;
  const fin = (buffer[0] & 0x80) !== 0;
  const opcode = buffer[0] & 0x0f;
  if (buffer[0] & 0x70) return { error: 1002 };
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) { if (buffer.length < 4) return null; length = buffer.readUInt16BE(2); offset = 4; }
  else if (length === 127) {
    if (buffer.length < 10) return null;
    const big = buffer.readBigUInt64BE(2);
    if (big > BigInt(maxBytes)) return { error: 1009 };
    length = Number(big); offset = 10;
  }
  if (!masked) return { error: 1002 };
  if (length > maxBytes) return { error: 1009 };
  if (buffer.length < offset + 4 + length) return null;
  const mask = buffer.subarray(offset, offset + 4);
  const payload = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length));
  for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
  return { fin, opcode, payload, size: offset + 4 + length };
}

function rejectUpgrade(socket, status, text) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

// 通知掛鉤由 Next 那邊（instrumentation）登記在 globalThis；server.js 不直接碰資料庫。
const notifyViaGlobalHook = call => globalThis.__hrCallNotifyHook?.(call);

// 網站只允許從自己的頁面連線（避免別的網站利用使用者的瀏覽器連進來）；沒有 Origin 的非瀏覽器用戶端放行。
function sameOriginUpgrade(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

// 檢查 WebSocket 升級請求：不合法回傳 { reject: [狀態碼, 說明] }，合法回傳 { key, ticket }。
function checkUpgrade(req, url, secret, hub) {
  const key = req.headers['sec-websocket-key'];
  if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || req.headers['sec-websocket-version'] !== '13' || typeof key !== 'string') return { reject: [400, 'Bad Request'] };
  if (!sameOriginUpgrade(req)) return { reject: [403, 'Forbidden'] };
  const ticket = verifyTicket(url.searchParams.get('ticket'), secret, hub.now());
  if (!ticket || ticket.p !== 'presence' || typeof ticket.k !== 'string' || !ticket.k) return { reject: [401, 'Unauthorized'] };
  if (hub.connectionCount >= MAX_CONNECTIONS || (hub.byKey.get(ticket.k)?.size || 0) >= MAX_CONNECTIONS_PER_KEY) return { reject: [503, 'Service Unavailable'] };
  return { key, ticket };
}

function socketConnection(socket, ticket) {
  return {
    id: crypto.randomBytes(8).toString('hex'), key: ticket.k, name: String(ticket.n || '').slice(0, 80), roomId: null,
    send(message) {
      if (socket.destroyed || !socket.writable) return;
      if (socket.writableLength > 1024 * 1024) return socket.destroy();
      socket.write(encodeFrame(1, Buffer.from(JSON.stringify(message))));
    },
  };
}

// 控制影格與不支援的影格要怎麼處理；回傳 null 代表是文字資料（opcode 1 或接續的 0）。
// 只收文字：二進位（2）回 1003；未知 opcode、或上一則分段還沒收完又來新的文字訊息，回 1002。
export function controlFrameAction(opcode, hasFragments) {
  switch (opcode) {
    case 8: return { close: 1000 };
    case 9: return { pong: true };
    case 10: return { skip: true };
    case 2: return { close: 1003 };
    case 0: return null;
    case 1: return hasFragments ? { close: 1002 } : null;
    default: return { close: 1002 };
  }
}

export function attachCallSignaling(httpServer, { path = '/api/hr/call/ws', secret, hub = new CallHub({ secret, onNotify: notifyViaGlobalHook }), heartbeatMs = 25000, log = console } = {}) {
  const sockets = new Set();
  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return socket.destroy(); }
    if (url.pathname !== path) { if (httpServer.listenerCount('upgrade') === 1) socket.destroy(); return; }
    socket.on('error', () => {});
    const checked = checkUpgrade(req, url, secret, hub);
    if (checked.reject) return rejectUpgrade(socket, ...checked.reject);
    const { key, ticket } = checked;
    const conn = socketConnection(socket, ticket);
    // 先回 101 完成握手，再登記連線（登記時會補送還在響鈴的來電，必須排在握手回應之後）
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash('sha1').update(key + GUID).digest('base64')}\r\n\r\n`);
    socket.setNoDelay(true);
    sockets.add(socket);
    hub.addConnection(conn);

    let pending = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
    let fragments = [];
    let fragmentBytes = 0;
    let lastSeen = Date.now();
    let windowStart = Date.now();
    let windowCount = 0;
    let closed = false;
    const close = (code = 1000) => {
      if (closed) return;
      closed = true;
      try { const reason = Buffer.alloc(2); reason.writeUInt16BE(code); if (socket.writable) socket.write(encodeFrame(8, reason)); } catch {}
      socket.end();
    };
    const heartbeat = setInterval(() => {
      if (Date.now() - lastSeen > heartbeatMs * 3) return socket.destroy();
      if (socket.writable) socket.write(encodeFrame(9));
    }, heartbeatMs);
    heartbeat.unref?.();
    // HTTP 伺服器的連線預設是半開模式：對方直接斷線（關分頁、手機斷網）時要自己收尾，否則會一直卡在通話名單裡
    socket.on('end', () => socket.end());
    socket.on('close', () => { clearInterval(heartbeat); sockets.delete(socket); closed = true; hub.removeConnection(conn); });

    // 收集文字影格（可能分段）：回傳 { close } 超過大小、{ wait } 還沒收完、{ text } 完整訊息。
    const collect = frame => {
      fragments.push(frame.payload);
      fragmentBytes += frame.payload.length;
      if (fragmentBytes > MAX_MESSAGE_BYTES) return { close: 1009 };
      if (!frame.fin) return { wait: true };
      const text = Buffer.concat(fragments).toString('utf8');
      fragments = []; fragmentBytes = 0;
      return { text };
    };
    // 10 秒超過 600 則訊息就斷線，避免被灌爆
    const rateLimited = () => {
      if (Date.now() - windowStart > 10000) { windowStart = Date.now(); windowCount = 0; }
      return ++windowCount > 600;
    };
    const dispatch = text => {
      let message;
      try { message = JSON.parse(text); } catch { return; }
      try { hub.handle(conn, message); } catch (error) { log.error?.('hr_call_message_failed', error?.name || 'Error'); }
    };
    const drain = () => {
      for (;;) {
        const frame = decodeFrame(pending);
        if (!frame) return;
        if (frame.error) return close(frame.error);
        pending = pending.subarray(frame.size);
        lastSeen = Date.now();
        const control = controlFrameAction(frame.opcode, fragments.length > 0);
        if (control?.close) return close(control.close);
        if (control?.pong && socket.writable) socket.write(encodeFrame(10, frame.payload));
        if (control) continue;
        const data = collect(frame);
        if (data.close) return close(data.close);
        if (data.wait) continue;
        if (rateLimited()) return close(1008);
        dispatch(data.text);
      }
    };
    socket.on('data', chunk => { pending = pending.length ? Buffer.concat([pending, chunk]) : chunk; drain(); });
    if (pending.length) drain();
  });
  return { hub, closeAll() { for (const socket of sockets) socket.destroy(); } };
}
