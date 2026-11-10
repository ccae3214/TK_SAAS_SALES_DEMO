"use client";

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Send, Users } from 'lucide-react';
import styles from './HrChat.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';

export default function HrChat() {
  const {lang}=useLanguage();
  const localizeError=message=>lang==='en'?translateHrText(message,'en'):message;
  const [rooms,setRooms]=useState([]);
  const [selectedRoomId,setSelectedRoomId]=useState(null);
  const [messages,setMessages]=useState([]);
  const [members,setMembers]=useState([]);
  const [showMembers,setShowMembers]=useState(false);
  const [draft,setDraft]=useState('');
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const messageListRef=useRef(null);
  const followLatestRef=useRef(true);
  const pendingRoomRef=useRef(null);

  async function loadRooms() {
    const response=await fetch('/api/hr/chat',{cache:'no-store'}),body=await response.json();
    if(!response.ok)throw new Error(body.error||'無法載入聊天室');
    setRooms(body.rooms||[]);
    const pending=pendingRoomRef.current;
    setSelectedRoomId(current=>pending&&body.rooms.some(room=>room.id===pending)?pending:(current&&body.rooms.some(room=>room.id===current)?current:(body.rooms[0]?.id||null)));
    if(pending&&body.rooms.some(room=>room.id===pending)){pendingRoomRef.current=null;void markRoomRead(pending);}
  }
  async function loadMessages(roomId) {
    const response=await fetch(`/api/hr/chat?roomId=${roomId}`,{cache:'no-store'}),body=await response.json();
    if(!response.ok)throw new Error(body.error||'無法載入訊息');
    setMessages(body.messages||[]);
    setMembers(body.members||[]);
    setRooms(current=>current.map(room=>room.id===roomId?{...room,lastMessage:body.room?.lastMessage||room.lastMessage,lastMessageAt:body.room?.lastMessageAt||room.lastMessageAt}:room));
  }

  async function markRoomRead(roomId) {
    try {
      const response=await fetch('/api/hr/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'read',roomId})});
      if(!response.ok)return;
      setRooms(current=>current.map(room=>room.id===roomId?{...room,unreadCount:0}:room));
    } catch {}
  }

  useEffect(()=>{let active=true;(async()=>{try{await loadRooms();}catch(err){if(active)setError(localizeError(err.message));}finally{if(active)setLoading(false);}})();const timer=setInterval(()=>{loadRooms().catch(err=>{if(active)setError(localizeError(err.message));});},30000);return()=>{active=false;clearInterval(timer);};},[lang]);
  useEffect(()=>{const openRoom=event=>{const roomId=Number(event.detail?.roomId);if(!Number.isSafeInteger(roomId)||roomId<1)return;pendingRoomRef.current=roomId;setSelectedRoomId(roomId);void markRoomRead(roomId);};window.addEventListener('hr:open-chat-room',openRoom);return()=>window.removeEventListener('hr:open-chat-room',openRoom);},[]);
  useEffect(()=>{if(!selectedRoomId)return;let active=true;const refresh=()=>loadMessages(selectedRoomId).catch(err=>{if(active)setError(localizeError(err.message));});refresh();const timer=setInterval(refresh,8000);return()=>{active=false;clearInterval(timer);};},[selectedRoomId,lang]);
  useEffect(()=>{followLatestRef.current=true;},[selectedRoomId]);
  useEffect(()=>{const panel=messageListRef.current;if(panel&&followLatestRef.current)panel.scrollTop=panel.scrollHeight;},[messages,selectedRoomId]);

  async function send(event){
    event.preventDefault();const message=draft.trim();if(!message||!selectedRoomId||sending)return;
    setSending(true);setError('');
    try{const response=await fetch('/api/hr/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:selectedRoomId,message})});const body=await response.json();if(!response.ok)throw new Error(body.error||'訊息送出失敗');setDraft('');await Promise.all([loadMessages(selectedRoomId),loadRooms()]);}
    catch(err){setError(localizeError(err.message));}finally{setSending(false);}
  }

  async function openDirectChat(memberId){
    if(!selectedRoomId)return;
    setError('');
    try{
      const response=await fetch('/api/hr/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'direct',roomId:selectedRoomId,targetMemberId:memberId})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'無法開啟私訊');
      pendingRoomRef.current=body.roomId;setShowMembers(false);await loadRooms();setSelectedRoomId(body.roomId);void markRoomRead(body.roomId);
    }catch(err){setError(localizeError(err.message));}
  }

  const selectedRoom=rooms.find(room=>room.id===selectedRoomId);
  const text=lang==='en'?{
    label:'Member Chat',title:'Agency and Case Chats',description:'Group chats show their members. Select a member to start a private conversation.',refresh:'Refresh',loading:'Loading chats…',none:'No chats are available yet.',list:'Chat list',agency:'Agency chat',case:'Case chat',agencySubtitle:'Agency staff chat',caseSubtitle:'Case conversation',recent:'Latest 200 messages',empty:'No messages yet. Send the first message to start the conversation.',placeholder:'Write a message…',send:'Send',sending:'Sending…',notFound:'Chat',members:'Group members',privateChat:'Message',direct:'Private chat',
  }:{label:'會員聊天室',title:'機構群組與案件群組',description:'開啟群組可查看群組會員，點選會員即可開始單獨聊天。',refresh:'重新整理',loading:'正在載入聊天室…',none:'目前沒有可參與的聊天室。',list:'聊天室清單',agency:'機構群組',case:'案件群組',agencySubtitle:'機構內部聊天室',caseSubtitle:'案件對話',recent:'最近 200 則訊息',empty:'尚無訊息，送出第一則訊息開始討論。',placeholder:'輸入訊息…',send:'送出',sending:'送出中',notFound:'聊天室',members:'群組會員',privateChat:'單獨聊天',direct:'私訊'};
  function displayRoomTitle(room){return room?.roomType==='agency'?`${room.agencyName} · ${text.agency}`:room?.roomType==='direct'?(room.title||text.direct):room?.caseNumber?`${room.caseNumber} · ${room.workerName} / ${room.employerName}`:text.notFound;}
  return <section id="hr-chat-section" className={styles.chatCard}>
    <header className={styles.heading}><div><span><MessageCircle size={17}/> {text.label}</span><h2>{text.title}</h2><p>{text.description}</p></div><button type="button" className={styles.refresh} onClick={()=>{setError('');loadRooms().then(()=>selectedRoomId&&loadMessages(selectedRoomId)).catch(err=>setError(localizeError(err.message)));}} aria-label={text.refresh}><RefreshCw size={17}/></button></header>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {loading?<div className={styles.empty}>{text.loading}</div>:rooms.length===0?<div className={styles.empty}>{text.none}</div>:
      <div className={styles.layout}>
        <nav className={styles.roomList} aria-label={text.list}>{rooms.map(room=><button type="button" key={room.id} className={`${styles.room} ${selectedRoomId===room.id?styles.roomActive:''}`} onClick={()=>{setSelectedRoomId(room.id);void markRoomRead(room.id);}}><strong>{room.roomType==='agency'?text.agency:room.roomType==='direct'?text.direct:text.case}{room.unreadCount>0&&<i className={styles.unreadBadge}>{room.unreadCount>99?'99+':room.unreadCount}</i>}</strong><span>{displayRoomTitle(room)}</span><small>{room.lastMessage||(room.roomType==='agency'?text.agencySubtitle:room.roomType==='direct'?text.direct:text.caseSubtitle)}</small></button>)}</nav>
        <div className={styles.conversation}>
          <div className={styles.conversationHeader}><div><strong>{selectedRoom&&displayRoomTitle(selectedRoom)}</strong><small>{selectedRoom&&(selectedRoom.roomType==='agency'?text.agencySubtitle:selectedRoom.roomType==='direct'?text.direct:text.caseSubtitle)} · {text.recent}</small></div>{selectedRoom&&selectedRoom.roomType!=='direct'&&<button type="button" className={styles.memberToggle} onClick={()=>setShowMembers(value=>!value)}><Users size={16}/>{text.members} ({members.length})</button>}</div>
          {showMembers&&selectedRoom?.roomType!=='direct'&&<div className={styles.memberList}><strong>{text.members}</strong>{members.length?members.map(member=><div className={styles.member} key={member.id}><span><b>{member.name}</b><small>{member.role==='agency'?(member.agencyName||'仲介'):member.role==='worker'?'工作者':member.role==='employer'?'雇主':member.role||''}</small></span><button type="button" onClick={()=>void openDirectChat(member.id)}>{text.privateChat}</button></div>):<p className={styles.empty}>—</p>}</div>}
          <div className={styles.messageList} aria-live="polite" ref={messageListRef} onScroll={event=>{const panel=event.currentTarget;followLatestRef.current=panel.scrollHeight-panel.scrollTop-panel.clientHeight<80;}}>{messages.length?messages.map(message=><article className={styles.message} key={message.id}><div className={styles.messageMeta}><strong>{message.sender_name}</strong><span>{new Date(message.created_at).toLocaleString(lang==='en'?'en-US':'zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div><p>{message.body}</p></article>):<div className={styles.empty}>{text.empty}</div>}</div>
          <form className={styles.composer} onSubmit={send}><textarea aria-label={text.placeholder} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={3000} rows={2} placeholder={text.placeholder}/><button type="submit" disabled={sending||!draft.trim()}><Send size={16}/>{sending?text.sending:text.send}</button></form>
        </div>
      </div>}
  </section>;
}
