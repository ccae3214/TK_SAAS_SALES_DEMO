"use client";

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';
import { CallClient } from '@/lib/hr-call-client';

// 通話功能的畫面：來電提示、通話視窗。整個 /hr 頁面掛一個（見 app/hr/page.jsx），
// 聊天室的「語音／視訊通話」按鈕只要發出 hr:start-call 事件，就會在這裡撥號。
// 這個元件在 HrManagement／HrMemberPortal 的翻譯範圍之外，所以中英文文字自己處理（COPY）。

export const COPY = {
  zh: {
    incomingVoice: '語音來電', incomingVideo: '視訊來電', accept: '接聽', acceptVoice: '僅語音接聽', decline: '拒絕', hangUp: '掛斷',
    mute: '靜音', unmute: '取消靜音', cameraOff: '關閉鏡頭', cameraOn: '開啟鏡頭', me: '我',
    calling: '撥號中…', waiting: '等待對方接聽…', reconnecting: '重新連線中…', connecting: '連線中…', inCall: count => `通話中 · ${count + 1} 人`,
    dismiss: '關閉', callWindow: '通話視窗',
    notices: {
      permission: '無法使用麥克風或鏡頭。請在瀏覽器的網址列旁允許權限；如果是在 LINE 內開啟，請改用 Chrome 或 Safari 開啟本網站。',
      'no-device': '找不到麥克風，請確認裝置後再試一次。', 'device-busy': '麥克風或鏡頭正被其他程式使用，請關閉後再試一次。',
      'no-camera': '找不到可用的鏡頭，已改用語音通話。', unsupported: '這個瀏覽器不支援通話，請改用最新版的 Chrome 或 Safari。',
      offline: '通話連線尚未就緒，請稍後再試。', timeout: '連線逾時，請再試一次。', 'connection-lost': '網路中斷，通話已結束。',
      declined: name => `${name || '對方'}已拒絕通話。`, 'no-answer': '沒有人接聽。', 'everyone-left': '其他人都已離開，通話結束。',
      full: '通話人數已滿（最多 6 人）。', 'bad-ticket': '通話驗證失敗，請重新整理頁面後再試。', 'already-in-call': '你已經在通話中。',
      unknown: '無法開始通話，請稍後再試。',
    },
  },
  en: {
    incomingVoice: 'Voice call', incomingVideo: 'Video call', accept: 'Answer', acceptVoice: 'Answer with voice only', decline: 'Decline', hangUp: 'Hang up',
    mute: 'Mute', unmute: 'Unmute', cameraOff: 'Turn camera off', cameraOn: 'Turn camera on', me: 'Me',
    calling: 'Calling…', waiting: 'Waiting for others to answer…', reconnecting: 'Reconnecting…', connecting: 'Connecting…', inCall: count => `In call · ${count + 1} people`,
    dismiss: 'Close', callWindow: 'Call window',
    notices: {
      permission: 'The microphone or camera cannot be used. Allow access in the browser address bar. If you opened this site inside LINE, open it in Chrome or Safari instead.',
      'no-device': 'No microphone was found. Check your device and try again.', 'device-busy': 'The microphone or camera is being used by another app. Close it and try again.',
      'no-camera': 'No usable camera was found, so the call was started with voice only.', unsupported: 'This browser does not support calls. Please use the latest Chrome or Safari.',
      offline: 'The call connection is not ready yet. Please try again shortly.', timeout: 'The connection timed out. Please try again.', 'connection-lost': 'The network was interrupted and the call ended.',
      declined: name => `${name || 'The other person'} declined the call.`, 'no-answer': 'No one answered.', 'everyone-left': 'Everyone else has left, so the call ended.',
      full: 'The call is full (up to 6 people).', 'bad-ticket': 'Call verification failed. Refresh the page and try again.', 'already-in-call': 'You are already in a call.',
      unknown: 'Unable to start the call. Please try again later.',
    },
  },
};

async function callApi(body) {
  const response = await fetch('/api/hr/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data = {};
  try { data = await response.json(); } catch { /* 沒有內容 */ }
  if (!response.ok) {
    const error = new Error(data.error || 'call api failed');
    error.apiMessage = data.error; error.apiEnglish = data.en; error.status = response.status;
    throw error;
  }
  return data;
}

const wsUrl = ticket => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/hr/call/ws?ticket=${encodeURIComponent(ticket)}`;

export function noticeText(notice, lang) {
  if (!notice) return '';
  const copy = COPY[lang === 'en' ? 'en' : 'zh'];
  if (notice.type === 'api') return lang === 'en' ? (notice.en || translateHrText(notice.message, 'en')) : notice.message;
  const entry = copy.notices[notice.type] || copy.notices.unknown;
  return typeof entry === 'function' ? entry(notice.name) : entry;
}

function Tile({ stream, name, local = false, state }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().some(track => track.readyState === 'live' && (local ? track.enabled : true));
  return <div className={`hr-call-tile ${local ? 'is-local' : ''} ${hasVideo ? '' : 'no-video'}`} data-state={state || ''}>
    {/* 沒有影像時 video 元素仍保留（聲音要靠它播放），只是看不到 */}
    <video ref={ref} autoPlay playsInline muted={local} className={hasVideo ? '' : 'hr-call-audio-only'} />
    {!hasVideo && <span className="hr-call-avatar" aria-hidden="true">{(name || '?').trim().slice(0, 1).toUpperCase()}</span>}
    <span className="hr-call-name">{name}</span>
  </div>;
}

// 畫面（純顯示，方便單獨測試）
export function CallView({ state, lang, actions }) {
  if (!state) return null;
  const copy = COPY[lang === 'en' ? 'en' : 'zh'];
  const show = text => (lang === 'en' ? translateHrText(text || '', 'en') : text || '');
  const { call, incoming, notice } = state;
  const ringing = !call && incoming.length > 0 ? incoming[0] : null;
  const status = !call ? '' : call.phase === 'reconnecting' ? copy.reconnecting : call.phase === 'starting' ? (call.everHadPeer ? copy.connecting : copy.calling)
    : !call.everHadPeer && !call.peers.length ? copy.waiting : call.peers.some(peer => peer.state !== 'connected') && call.peers.every(peer => peer.state !== 'connected') ? copy.connecting : copy.inCall(call.peers.length);
  return <>
    {ringing && <div className="hr-call-incoming" role="alertdialog" aria-live="assertive" aria-label={ringing.video ? copy.incomingVideo : copy.incomingVoice}>
      <span className="hr-call-incoming-icon">{ringing.video ? <Video size={22} /> : <Phone size={22} />}</span>
      <div className="hr-call-incoming-text">
        <strong>{show(ringing.title)}</strong>
        <span>{ringing.video ? copy.incomingVideo : copy.incomingVoice}{ringing.from && ringing.from !== ringing.title ? ` · ${ringing.from}` : ''}{incoming.length > 1 ? ` (+${incoming.length - 1})` : ''}</span>
      </div>
      <div className="hr-call-incoming-actions">
        <button type="button" className="hr-call-btn is-decline" onClick={() => actions.decline(ringing.roomId)}><PhoneOff size={18} />{copy.decline}</button>
        {ringing.video && <button type="button" className="hr-call-btn is-voice" onClick={() => actions.accept(ringing, false)}><Phone size={18} />{copy.acceptVoice}</button>}
        <button type="button" className="hr-call-btn is-accept" onClick={() => actions.accept(ringing, ringing.video)}>{ringing.video ? <Video size={18} /> : <Phone size={18} />}{copy.accept}</button>
      </div>
    </div>}
    {call && <section className={`hr-call-overlay ${call.peers.length === 1 ? 'is-pip' : ''}`} role="dialog" aria-label={copy.callWindow}>
      <header className="hr-call-header"><strong>{show(call.title)}</strong><span aria-live="polite">{status}</span></header>
      <div className={`hr-call-grid count-${Math.min(call.peers.length + 1, 6)}`}>
        {call.peers.map(peer => <Tile key={peer.id} stream={peer.stream} name={peer.name} state={peer.state} />)}
        <Tile stream={call.localStream} name={copy.me} local />
      </div>
      <footer className="hr-call-controls">
        <button type="button" className={`hr-call-round ${call.micOn ? '' : 'is-off'}`} onClick={actions.toggleMic} aria-pressed={!call.micOn} aria-label={call.micOn ? copy.mute : copy.unmute} title={call.micOn ? copy.mute : copy.unmute}>{call.micOn ? <Mic size={22} /> : <MicOff size={22} />}</button>
        {call.hasCamera && <button type="button" className={`hr-call-round ${call.camOn ? '' : 'is-off'}`} onClick={actions.toggleCamera} aria-pressed={!call.camOn} aria-label={call.camOn ? copy.cameraOff : copy.cameraOn} title={call.camOn ? copy.cameraOff : copy.cameraOn}>{call.camOn ? <Video size={22} /> : <VideoOff size={22} />}</button>}
        <button type="button" className="hr-call-round is-hangup" onClick={actions.leave} aria-label={copy.hangUp} title={copy.hangUp}><PhoneOff size={22} /></button>
      </footer>
    </section>}
    {notice && <div className="hr-call-toast" role="status"><span>{noticeText(notice, lang)}</span><button type="button" onClick={actions.dismissNotice} aria-label={copy.dismiss}>×</button></div>}
  </>;
}

function startRingtone() {
  let context = null; let timer = null;
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    context = AudioContextCtor ? new AudioContextCtor() : null;
    void context?.resume?.();
  } catch { context = null; }
  const beep = (frequency, start, length) => {
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.frequency.value = frequency; oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.0001, context.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + start); oscillator.stop(context.currentTime + start + length + 0.05);
  };
  const ring = () => { beep(440, 0, 0.4); beep(480, 0.5, 0.4); try { navigator.vibrate?.([300, 150, 300]); } catch { /* 不支援震動 */ } };
  ring(); timer = setInterval(ring, 2800);
  return () => { clearInterval(timer); try { navigator.vibrate?.(0); void context?.close?.(); } catch { /* 已關閉 */ } };
}

export default function HrCallProvider() {
  const { lang } = useLanguage();
  const [state, setState] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const client = new CallClient({ api: callApi, wsUrl, onChange: setState });
    clientRef.current = client;
    client.start();
    const onStart = event => {
      const detail = event.detail || {};
      const roomId = Number(detail.roomId);
      if (Number.isSafeInteger(roomId) && roomId > 0) void client.enter({ roomId, video: !!detail.video, title: String(detail.title || '') });
    };
    window.addEventListener('hr:start-call', onStart);
    return () => { window.removeEventListener('hr:start-call', onStart); client.stop(); clientRef.current = null; };
  }, []);

  const ringing = !!state && !state.call && state.incoming.length > 0;
  useEffect(() => {
    if (!ringing) return undefined;
    const original = document.title;
    document.title = `📞 ${original}`;
    const stopRingtone = startRingtone();
    return () => { document.title = original; stopRingtone(); };
  }, [ringing]);

  const inCall = !!state?.call;
  useEffect(() => {
    if (!inCall || !navigator.wakeLock) return undefined; // 通話中讓手機不要自動鎖屏
    let lock = null; let cancelled = false;
    navigator.wakeLock.request('screen').then(result => { if (cancelled) void result.release(); else lock = result; }).catch(() => {});
    return () => { cancelled = true; void lock?.release?.(); };
  }, [inCall]);

  const notice = state?.notice;
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => clientRef.current?.clearNotice(), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  const actions = {
    accept: (item, video) => void clientRef.current?.enter({ roomId: item.roomId, video, title: item.title }),
    decline: roomId => clientRef.current?.decline(roomId),
    leave: () => clientRef.current?.leave(),
    toggleMic: () => clientRef.current?.toggleMic(),
    toggleCamera: () => clientRef.current?.toggleCamera(),
    dismissNotice: () => clientRef.current?.clearNotice(),
  };
  return <CallView state={state} lang={lang} actions={actions} />;
}
