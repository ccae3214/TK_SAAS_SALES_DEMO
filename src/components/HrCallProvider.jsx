"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Mic, MicOff, Phone, PictureInPicture2, PhoneOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';
import { CallClient } from '@/lib/hr-call-client';
import HrCallChat from '@/components/HrCallChat';
import { canDragCallWindow, clampCallPosition, keyboardOffset } from '@/lib/hr-call-drag';
import { copyStylesTo, pickPipVideo, pictureInPictureMode, pipWindowSize } from '@/lib/hr-call-pip';
import { pickLang, copyFor } from '@/lib/language';

// 通話功能的畫面：來電提示、通話視窗。整個 /hr 頁面掛一個（見 app/hr/page.jsx），
// 聊天室的「語音／視訊通話」按鈕只要發出 hr:start-call 事件，就會在這裡撥號。
// 這個元件在 HrManagement／HrMemberPortal 的翻譯範圍之外，所以中英文文字自己處理（COPY）。

export const COPY = {
  zh: {
    incomingVoice: '語音來電', incomingVideo: '視訊來電', accept: '接聽', acceptVoice: '僅語音接聽', decline: '拒絕', hangUp: '掛斷',
    mute: '關閉麥克風', unmute: '開啟麥克風', speakerOff: '關閉喇叭', speakerOn: '開啟喇叭', cameraOff: '關閉鏡頭', cameraOn: '開啟鏡頭', me: '我',
    calling: '撥號中…', waiting: '等待對方接聽…', reconnecting: '重新連線中…', connecting: '連線中…', inCall: count => `通話中 · ${count + 1} 人`,
    dismiss: '關閉', callWindow: '通話視窗',
    enlarge: '放大畫面', backToGrid: '回到並排畫面',
    moveWindow: '拖曳這裡移動通話視窗（也可以用方向鍵；按兩下回到右下角）',
    popOut: '彈出到桌面（可以移到瀏覽器外面）', popOutVideo: '把畫面彈出到桌面（可以移到瀏覽器外面）', popIn: '移回網頁', pipActive: '通話視窗已彈出到桌面',
    openChat: '開啟文字聊天', closeChat: '關閉文字聊天', chatTitle: '文字聊天', chatEmpty: '還沒有訊息。這裡的訊息也會留在聊天室裡。',
    chatPlaceholder: '輸入訊息…', chatSend: '送出', chatSending: '送出中…', chatLoadFailed: '無法載入訊息，稍後會自動重試。', chatSendFailed: '訊息未能送出，請再試一次。', chatUnread: count => `${count} 則未讀訊息`,
    status: {
      micOn: '麥克風已開啟', micOff: '麥克風已關閉', micNone: '沒有麥克風',
      camOn: '鏡頭已開啟', camOff: '鏡頭已關閉', camNone: '沒有鏡頭',
      speakerOn: '喇叭已開啟', speakerOff: '喇叭已關閉',
    },
    notices: {
      permission: '無法使用麥克風或鏡頭。請在瀏覽器的網址列旁允許權限；如果是在 LINE 內開啟，請改用 Chrome 或 Safari 開啟本網站。',
      'no-device': '找不到麥克風，請確認裝置後再試一次。', 'device-busy': '麥克風或鏡頭正被其他程式使用，請關閉後再試一次。',
      'no-camera': '找不到可用的鏡頭，已改用語音通話。', 'peer-hangup': '對方已掛斷，通話已結束。', 'no-mic': '找不到麥克風，已加入通話但對方聽不到你的聲音。請確認裝置後重新加入。', unsupported: '這個瀏覽器不支援通話，請改用最新版的 Chrome 或 Safari。', insecure: '目前的網址不是安全連線（https），瀏覽器會封鎖麥克風與鏡頭。請改用 https 網址開啟本網站。', 'in-app': '應用程式內建的瀏覽器（例如 LINE）不支援通話。請從選單選擇用 Safari 或 Chrome 開啟本網站。',
      offline: '通話連線尚未就緒，請稍後再試。', session: '登入已逾時，請重新整理頁面並重新登入後再試。', service: '通話服務暫時無法使用，請稍後再試；若持續發生請聯絡管理員。', 'ws-failed': '無法連上通話伺服器，請檢查網路後再試；若持續發生請聯絡管理員。', timeout: '連線逾時，請再試一次。', 'connection-lost': '網路中斷，通話已結束。', 'peer-failed': '已接通，但影像與聲音一直連不上對方（雙方的網路可能無法直連）。請改用 Wi-Fi 或行動網路後重新撥打；若持續發生，請聯絡管理員確認通話中繼伺服器（TURN）已啟用。',
      declined: name => `${name || '對方'}已拒絕通話。`, 'no-answer': '沒有人接聽。', 'everyone-left': '其他人都已離開，通話結束。',
      full: '通話人數已滿。', 'sfu-failed': '無法連上影像伺服器，請檢查網路後再試；若持續發生請聯絡管理員。', 'bad-ticket': '通話驗證失敗，請重新整理頁面後再試。', 'already-in-call': '你已經在通話中。',
      unknown: '無法開始通話，請稍後再試。',
    },
  },
  en: {
    incomingVoice: 'Voice call', incomingVideo: 'Video call', accept: 'Answer', acceptVoice: 'Answer with voice only', decline: 'Decline', hangUp: 'Hang up',
    mute: 'Mute microphone', unmute: 'Unmute microphone', speakerOff: 'Turn speaker off', speakerOn: 'Turn speaker on', cameraOff: 'Turn camera off', cameraOn: 'Turn camera on', me: 'Me',
    calling: 'Calling…', waiting: 'Waiting for others to answer…', reconnecting: 'Reconnecting…', connecting: 'Connecting…', inCall: count => `In call · ${count + 1} people`,
    dismiss: 'Close', callWindow: 'Call window',
    enlarge: 'Enlarge video', backToGrid: 'Back to side-by-side view',
    moveWindow: 'Drag here to move the call window (arrow keys also work; double-click to return it to the bottom right)',
    popOut: 'Pop out to the desktop (can be moved outside the browser)', popOutVideo: 'Pop out the video to the desktop (can be moved outside the browser)', popIn: 'Move back into the page', pipActive: 'The call window is popped out to the desktop',
    openChat: 'Open text chat', closeChat: 'Close text chat', chatTitle: 'Text chat', chatEmpty: 'No messages yet. Messages here also stay in the chat room.',
    chatPlaceholder: 'Write a message…', chatSend: 'Send', chatSending: 'Sending…', chatLoadFailed: 'Messages could not be loaded. Retrying automatically.', chatSendFailed: 'The message was not sent. Please try again.', chatUnread: count => `${count} unread messages`,
    status: {
      micOn: 'Microphone on', micOff: 'Microphone off', micNone: 'No microphone',
      camOn: 'Camera on', camOff: 'Camera off', camNone: 'No camera',
      speakerOn: 'Speaker on', speakerOff: 'Speaker off',
    },
    notices: {
      permission: 'The microphone or camera cannot be used. Allow access in the browser address bar. If you opened this site inside LINE, open it in Chrome or Safari instead.',
      'no-device': 'No microphone was found. Check your device and try again.', 'device-busy': 'The microphone or camera is being used by another app. Close it and try again.',
      'no-camera': 'No usable camera was found, so the call was started with voice only.', 'peer-hangup': 'The other person hung up, so the call ended.', 'no-mic': 'No microphone was found. You joined the call, but others cannot hear you. Check your device and rejoin.', unsupported: 'This browser does not support calls. Please use the latest Chrome or Safari.', insecure: 'This page is not on a secure (https) connection, so the browser blocks the microphone and camera. Please open the site with its https address.', 'in-app': 'In-app browsers such as LINE do not support calls. Open this site in Safari or Chrome from the menu.',
      offline: 'The call connection is not ready yet. Please try again shortly.', session: 'Your session has expired. Refresh the page and sign in again.', service: 'The call service is temporarily unavailable. Try again later, and contact your administrator if it keeps happening.', 'ws-failed': 'Cannot reach the call server. Check your connection and try again, and contact your administrator if it keeps happening.', timeout: 'The connection timed out. Please try again.', 'connection-lost': 'The network was interrupted and the call ended.', 'peer-failed': 'The call was answered, but video and audio could not connect to the other person (the two networks may not be able to reach each other directly). Switch between Wi-Fi and mobile data and call again, and ask your administrator to check that the call relay server (TURN) is enabled if it keeps happening.',
      declined: name => `${name || 'The other person'} declined the call.`, 'no-answer': 'No one answered.', 'everyone-left': 'Everyone else has left, so the call ended.',
      full: 'The call is full.', 'sfu-failed': 'Cannot reach the video server. Check your connection and try again, and contact your administrator if it keeps happening.', 'bad-ticket': 'Call verification failed. Refresh the page and try again.', 'already-in-call': 'You are already in a call.',
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
  const copy = copyFor(COPY, lang);
  if (notice.type === 'api') return lang !== 'zh' ? translateHrText(notice.en || translateHrText(notice.message, 'en'), lang) : notice.message;
  const entry = copy.notices[notice.type] || copy.notices.unknown;
  return typeof entry === 'function' ? entry(notice.name) : entry;
}

// 每個畫面右下角的三個小圖示：麥克風、鏡頭、喇叭是否開啟（關閉或沒有裝置時變紅色並加斜線）。
export function MediaStatus({ media, copy }) {
  const m = media || { mic: 'on', cam: 'none', speaker: 'on' };
  const items = [
    { key: 'mic', on: m.mic === 'on', text: m.mic === 'on' ? copy.status.micOn : m.mic === 'off' ? copy.status.micOff : copy.status.micNone, On: Mic, Off: MicOff },
    { key: 'cam', on: m.cam === 'on', text: m.cam === 'on' ? copy.status.camOn : m.cam === 'off' ? copy.status.camOff : copy.status.camNone, On: Video, Off: VideoOff },
    { key: 'speaker', on: m.speaker === 'on', text: m.speaker === 'on' ? copy.status.speakerOn : copy.status.speakerOff, On: Volume2, Off: VolumeX },
  ];
  return <span className="hr-call-status" role="group" aria-label={items.map(item => item.text).join('，')}>
    {items.map(({ key, on, text, On, Off }) => <span key={key} className={`hr-call-status-icon ${on ? '' : 'is-off'}`} data-kind={key} data-on={on ? 'true' : 'false'} title={text}>{on ? <On size={13} /> : <Off size={13} />}</span>)}
  </span>;
}

function Tile({ stream, name, local = false, state, speakerOff = false, media, copy, focused = false, onSelect = null }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().some(track => track.readyState === 'live' && (local ? track.enabled : true));
  // 點畫面放大這個人；已經放大的再點一次回到並排。用鍵盤（Enter／空白鍵）也可以操作。
  const label = focused ? copy.backToGrid : `${copy.enlarge} · ${name}`;
  const select = () => onSelect?.();
  return <div className={`hr-call-tile ${local ? 'is-local' : ''} ${hasVideo ? '' : 'no-video'} ${focused ? 'is-focused' : ''} ${onSelect ? 'is-selectable' : ''}`} data-state={state || ''}
    {...(onSelect ? { role: 'button', tabIndex: 0, 'aria-pressed': focused, 'aria-label': label, title: label, onClick: select, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } } } : {})}>
    {/* 沒有影像時 video 元素仍保留（聲音要靠它播放），只是看不到 */}
    <video ref={ref} autoPlay playsInline muted={local || speakerOff} className={hasVideo ? '' : 'hr-call-audio-only'} />
    {!hasVideo && <span className="hr-call-avatar" aria-hidden="true">{(name || '?').trim().slice(0, 1).toUpperCase()}</span>}
    <span className="hr-call-name">{name}</span>
    <MediaStatus media={media} copy={copy} />
  </div>;
}

// 畫面（純顯示，方便單獨測試）
export function CallView({ state, lang, actions }) {
  // 放大中的畫面（peer.id，自己是 'me'）；null 表示所有人並排
  const [focusedId, setFocusedId] = useState(null);
  // 通話中的文字聊天：是否打開面板、沒打開時的未讀數。換一通電話就重設。
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const callRoomId = state?.call?.roomId || null;
  // 電腦版拖曳移動通話視窗：position 是視窗左上角；null 表示用 CSS 預設的右下角位置
  const [position, setPosition] = useState(null);
  const overlayRef = useRef(null);
  const dragRef = useRef(null);
  useEffect(() => { setChatOpen(false); setChatUnread(0); setPosition(null); dragRef.current = null; }, [callRoomId]);
  // 彈出到桌面：pipMode 是瀏覽器支援的方式（'document'／'video'／null），pipWindow 是彈出的視窗（Document PiP）
  const [pipMode, setPipMode] = useState(null);
  const [pipWindow, setPipWindow] = useState(null);
  useEffect(() => { setPipMode(canDragCallWindow() ? pictureInPictureMode() : null); }, []);
  // 掛斷或換一通電話：關掉彈出的視窗
  const pipRoomRef = useRef(null);
  useEffect(() => {
    if (pipWindow && pipRoomRef.current !== callRoomId) { pipWindow.close(); setPipWindow(null); }
  }, [callRoomId, pipWindow]);
  // 離開頁面時也一起關掉
  useEffect(() => {
    if (!pipWindow) return undefined;
    const close = () => pipWindow.close();
    window.addEventListener('pagehide', close);
    return () => window.removeEventListener('pagehide', close);
  }, [pipWindow]);
  // 瀏覽器視窗縮放、聊天面板開關（通話視窗變寬）後，把通話視窗拉回畫面內；變成手機寬度就回到預設的全螢幕
  useEffect(() => {
    if (!position) return undefined;
    const fit = () => {
      const element = overlayRef.current;
      if (!element) return;
      if (!canDragCallWindow()) { setPosition(null); return; }
      const next = clampCallPosition(position, element.offsetWidth, element.offsetHeight, window.innerWidth, window.innerHeight);
      if (next.x !== position.x || next.y !== position.y) setPosition(next);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [position, chatOpen]);
  if (!state) return null;
  const copy = copyFor(COPY, lang);
  const show = text => (lang !== 'zh' ? translateHrText(text || '', lang) : text || '');
  const { call, incoming, notice } = state;
  const ringing = !call && incoming.length > 0 ? incoming[0] : null;
  // 7 個畫面以上（自架 SFU 通話最多 20 人）共用 count-7 的可捲動版面
  const tileCount = call ? Math.min(call.peers.length + 1, 7) : 0;
  const tileTotal = call ? call.peers.length + 1 : 0;
  const selectable = tileCount > 1;
  // 放大的人離開了，就自動回到並排
  const focused = selectable && focusedId && (focusedId === 'me' || call.peers.some(peer => String(peer.id) === focusedId)) ? focusedId : null;
  const toggleFocus = id => setFocusedId(current => (current === id ? null : id));
  const popOut = async () => {
    if (pipWindow) { pipWindow.close(); return; } // 已經彈出：移回網頁
    if (pipMode === 'document') {
      try {
        const win = await window.documentPictureInPicture.requestWindow(pipWindowSize(overlayRef.current?.getBoundingClientRect()));
        copyStylesTo(document, win.document);
        win.document.title = show(call.title) || copy.callWindow;
        win.document.documentElement.lang = document.documentElement.lang;
        win.document.body.className = 'hr-call-pip-body';
        // 使用者按彈出視窗的「返回分頁」或關閉：回到網頁裡
        win.addEventListener('pagehide', () => setPipWindow(current => (current === win ? null : current)), { once: true });
        pipRoomRef.current = call.roomId;
        setPosition(null); dragRef.current = null;
        setPipWindow(win);
      } catch { /* 使用者取消，或瀏覽器拒絕（例如不是點擊觸發） */ }
    } else if (pipMode === 'video') {
      try { await pickPipVideo(overlayRef.current)?.requestPictureInPicture(); } catch { /* 沒有影像或瀏覽器拒絕 */ }
    }
  };
  // Safari 只能彈出影像：有對方的影像時才顯示按鈕
  const pipVideoAvailable = !!call?.peers.some(peer => peer.stream?.getVideoTracks?.().some(track => track.readyState === 'live'));
  const showPipButton = pipMode === 'document' || (pipMode === 'video' && pipVideoAvailable);
  const moveTo = (point, width, height) => setPosition(clampCallPosition(point, width, height, window.innerWidth, window.innerHeight));
  const drag = {
    onPointerDown: event => {
      if (pipWindow || event.button !== 0 || !canDragCallWindow() || !overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      dragRef.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top, width: rect.width, height: rect.height };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* 舊瀏覽器 */ }
      event.preventDefault();
    },
    onPointerMove: event => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      moveTo({ x: event.clientX - current.dx, y: event.clientY - current.dy }, current.width, current.height);
    },
    onPointerUp: event => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; },
    onPointerCancel: () => { dragRef.current = null; },
    onDoubleClick: () => { if (!pipWindow) setPosition(null); },
    onKeyDown: event => {
      const offset = keyboardOffset(event.key, event.shiftKey);
      if (pipWindow || !offset || !canDragCallWindow() || !overlayRef.current) return;
      event.preventDefault();
      const rect = overlayRef.current.getBoundingClientRect();
      moveTo({ x: rect.left + offset.x, y: rect.top + offset.y }, rect.width, rect.height);
    },
  };
  const status = !call ? '' : call.phase === 'reconnecting' ? copy.reconnecting : call.phase === 'starting' ? (call.everHadPeer ? copy.connecting : copy.calling)
    : !call.everHadPeer && !call.peers.length ? copy.waiting : call.peers.some(peer => peer.state !== 'connected') && call.peers.every(peer => peer.state !== 'connected') ? copy.connecting : copy.inCall(call.peers.length);
  const overlay = call && <section ref={overlayRef} className={`hr-call-overlay ${focused ? 'has-focus' : ''} ${chatOpen ? 'has-chat' : ''} ${position && !pipWindow ? 'is-moved' : ''} ${pipWindow ? 'in-pip-window' : ''}`} role="dialog" aria-label={copy.callWindow}
      style={position && !pipWindow ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
      {/* 電腦版：按住標題列拖曳移動視窗（彈出到桌面後由系統視窗本身移動） */}
      <header className="hr-call-header hr-call-drag-handle" {...(pipWindow ? {} : { tabIndex: 0, title: copy.moveWindow, 'aria-label': `${show(call.title)} · ${copy.moveWindow}`, ...drag })}><strong>{show(call.title)}</strong><span aria-live="polite">{status}</span></header>
      {/* 所有人並排；點某個人的畫面就放大他，其他人縮成下方一排小畫面。只有自己一個人時不用放大。 */}
      <div className={`hr-call-grid count-${tileCount} ${focused ? 'has-focus' : ''}`} style={focused ? { '--hr-call-others': tileTotal - 1 } : undefined}>
        {call.peers.map(peer => <Tile key={peer.id} stream={peer.stream} name={peer.name} state={peer.state} speakerOff={!call.speakerOn} media={peer.media} copy={copy} focused={focused === String(peer.id)} onSelect={selectable ? () => toggleFocus(String(peer.id)) : null} />)}
        <Tile key="me" stream={call.localStream} name={copy.me} local media={call.media} copy={copy} focused={focused === 'me'} onSelect={selectable ? () => toggleFocus('me') : null} />
      </div>
      <footer className="hr-call-controls">
        {call.hasMic && <button type="button" className={`hr-call-round ${call.micOn ? '' : 'is-off'}`} onClick={actions.toggleMic} aria-pressed={!call.micOn} aria-label={call.micOn ? copy.mute : copy.unmute} title={call.micOn ? copy.mute : copy.unmute}>{call.micOn ? <Mic size={22} /> : <MicOff size={22} />}</button>}
        <button type="button" className={`hr-call-round ${call.speakerOn ? '' : 'is-off'}`} onClick={actions.toggleSpeaker} aria-pressed={!call.speakerOn} aria-label={call.speakerOn ? copy.speakerOff : copy.speakerOn} title={call.speakerOn ? copy.speakerOff : copy.speakerOn}>{call.speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>
        {call.hasCamera && <button type="button" className={`hr-call-round ${call.camOn ? '' : 'is-off'}`} onClick={actions.toggleCamera} aria-pressed={!call.camOn} aria-label={call.camOn ? copy.cameraOff : copy.cameraOn} title={call.camOn ? copy.cameraOff : copy.cameraOn}>{call.camOn ? <Video size={22} /> : <VideoOff size={22} />}</button>}
        <button type="button" className={`hr-call-round hr-call-chat-toggle ${chatOpen ? 'is-active' : ''}`} onClick={() => setChatOpen(open => !open)} aria-pressed={chatOpen}
          aria-label={chatOpen ? copy.closeChat : chatUnread ? `${copy.openChat} · ${copy.chatUnread(chatUnread)}` : copy.openChat} title={chatOpen ? copy.closeChat : copy.openChat}>
          <MessageCircle size={22} />{!chatOpen && chatUnread > 0 && <span className="hr-call-chat-badge" aria-hidden="true">{chatUnread > 99 ? '99+' : chatUnread}</span>}
        </button>
        {showPipButton && <button type="button" className={`hr-call-round hr-call-pip-toggle ${pipWindow ? 'is-active' : ''}`} onClick={() => void popOut()} aria-pressed={!!pipWindow}
          aria-label={pipWindow ? copy.popIn : pipMode === 'video' ? copy.popOutVideo : copy.popOut} title={pipWindow ? copy.popIn : pipMode === 'video' ? copy.popOutVideo : copy.popOut}><PictureInPicture2 size={22} /></button>}
        <button type="button" className="hr-call-round is-hangup" onClick={actions.leave} aria-label={copy.hangUp} title={copy.hangUp}><PhoneOff size={22} /></button>
      </footer>
      <HrCallChat roomId={call.roomId} open={chatOpen} lang={lang} copy={copy} onClose={() => setChatOpen(false)} onUnreadChange={setChatUnread} />
  </section>;
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
    {overlay && (pipWindow ? createPortal(overlay, pipWindow.document.body) : overlay)}
    {/* 彈出到桌面時，網頁裡留一個小提示，可以一鍵移回 */}
    {call && pipWindow && <div className="hr-call-pip-placeholder" role="status"><PictureInPicture2 size={18} aria-hidden="true" /><span>{copy.pipActive}</span><button type="button" onClick={() => pipWindow.close()}>{copy.popIn}</button></div>}
    {notice && <div className="hr-call-toast" role="status"><span>{noticeText(notice, lang)}</span><button type="button" onClick={actions.dismissNotice} aria-label={copy.dismiss}>×</button></div>}
  </>;
}

// 來電鈴聲：[頻率 Hz, 開始秒數, 長度秒數]，每 2.4 秒重複一次，直到接聽、拒接或對方掛斷。
// 與加入／離開提示音共用同一個已啟用的 AudioContext：Safari／iPhone 只允許「使用者操作過的」AudioContext 出聲，
// 來電當下才新建的 AudioContext 會是靜音。頁面還沒被點過時，每一輪鈴聲都會重試，使用者一點畫面就會響。
export const RING_PATTERN = [[784, 0, 0.18], [988, 0.22, 0.18], [784, 0.6, 0.18], [988, 0.82, 0.18]];
export const RING_INTERVAL_MS = 2400;
function startRingtone() {
  const beep = (frequency, start, length) => {
    const context = sharedAudio;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.frequency.value = frequency; oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.0001, context.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + start); oscillator.stop(context.currentTime + start + length + 0.05);
  };
  const ring = () => {
    unlockAudio();
    for (const [frequency, start, length] of RING_PATTERN) beep(frequency, start, length);
    try { navigator.vibrate?.([300, 150, 300]); } catch { /* 不支援震動 */ }
  };
  ring();
  const timer = setInterval(ring, RING_INTERVAL_MS);
  return () => { clearInterval(timer); try { navigator.vibrate?.(0); } catch { /* 不支援震動 */ } };
}

// 撥出方的等待答鈴：撥出後、還沒有人接聽時，播放電話的「嘟—」回鈴音（440＋480 Hz，響 1 秒、停 2 秒），語音、視訊都一樣。
// 撥號是點擊動作，AudioContext 已經啟用，所以 iPhone／Safari 也會響。關掉喇叭時不播放。
export const RINGBACK_FREQUENCIES = [440, 480];
export const RINGBACK_ON_SECONDS = 1;
export const RINGBACK_INTERVAL_MS = 3000;
function startRingback() {
  const ring = () => {
    unlockAudio();
    const context = sharedAudio;
    if (!context || context.state !== 'running') return;
    const start = context.currentTime; const end = start + RINGBACK_ON_SECONDS;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.03);
    gain.gain.setValueAtTime(0.06, end - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(context.destination);
    for (const frequency of RINGBACK_FREQUENCIES) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(start); oscillator.stop(end + 0.05);
    }
  };
  ring();
  const timer = setInterval(ring, RINGBACK_INTERVAL_MS);
  return () => clearInterval(timer);
}

// 通話中的提示音：有人加入（往上兩聲）、有人離開或掛斷（往下兩聲）。
// 瀏覽器要求聲音必須在使用者操作之後才能播放，所以第一次點擊／按鍵時先建立並啟用 AudioContext（撥號、接聽都是點擊）。
let sharedAudio = null;
function unlockAudio() {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!sharedAudio && AudioContextCtor) sharedAudio = new AudioContextCtor();
    void sharedAudio?.resume?.();
  } catch { sharedAudio = null; }
}
export const CALL_TONES = { join: [660, 880], leave: [880, 520] };
export function playCallTone(kind) {
  const notes = CALL_TONES[kind];
  unlockAudio();
  const context = sharedAudio;
  if (!notes || !context || context.state !== 'running') return;
  notes.forEach((frequency, index) => {
    const start = context.currentTime + index * 0.16;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start); oscillator.stop(start + 0.16);
  });
}

export default function HrCallProvider() {
  const { lang } = useLanguage();
  const [state, setState] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const client = new CallClient({ api: callApi, wsUrl, onChange: setState, onSound: playCallTone, loadSfu: () => import('livekit-client') });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    clientRef.current = client;
    client.start();
    const onStart = event => {
      const detail = event.detail || {};
      const roomId = Number(detail.roomId);
      if (Number.isSafeInteger(roomId) && roomId > 0) void client.enter({ roomId, video: !!detail.video, title: String(detail.title || '') });
    };
    window.addEventListener('hr:start-call', onStart);
    return () => { window.removeEventListener('hr:start-call', onStart); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); client.stop(); clientRef.current = null; };
  }, []);

  const ringing = !!state && !state.call && state.incoming.length > 0;
  useEffect(() => {
    if (!ringing) return undefined;
    const original = document.title;
    document.title = `📞 ${original}`;
    const stopRingtone = startRingtone();
    return () => { document.title = original; stopRingtone(); };
  }, [ringing]);

  // 撥出方等待接聽（還沒有任何人加入過）時播放答鈴；有人接聽、掛斷、逾時或關掉喇叭就停止。
  const call = state?.call;
  const waitingForAnswer = !!call && call.phase !== 'reconnecting' && !call.everHadPeer && !call.peers.length && call.speakerOn !== false;
  useEffect(() => {
    if (!waitingForAnswer) return undefined;
    return startRingback();
  }, [waitingForAnswer]);

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
    toggleSpeaker: () => clientRef.current?.toggleSpeaker(),
    dismissNotice: () => clientRef.current?.clearNotice(),
  };
  return <CallView state={state} lang={lang} actions={actions} />;
}
