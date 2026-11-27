"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, MessageCircle, Phone, RefreshCw, Send, Users, Video } from 'lucide-react';
import styles from './HrChat.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';
import { translateChatSystemMessage } from '@/lib/hr-translations-chat';
import { readJson } from '@/lib/hr-read-json';
import { pickLang } from '@/lib/language';
import { localeFor, mapLeaves, tlText } from '@/lib/language';
import HrCallNotify from '@/components/HrCallNotify';
import { chatRoomFromUrl, stripChatLinkParams } from '@/lib/hr-chat-link';

export default function HrChat() {
  const {lang}=useLanguage();
  const localizeError=error=>lang!=='zh'?translateHrText(error.en||translateHrText(error.message,'en'),lang):error.message;
  // 系統訊息（指派／挑選）由伺服器以中文存入，英文介面在顯示時翻譯；使用者自己輸入的訊息不會被改動。
  const localizeMessage=body=>translateChatSystemMessage(body,lang,text=>translateHrText(text,'en'));
  const [rooms,setRooms]=useState([]);
  const [selectedRoomId,setSelectedRoomId]=useState(null);
  const [messages,setMessages]=useState([]);
  const [members,setMembers]=useState([]);
  const [showMembers,setShowMembers]=useState(false);
  // 好友：在群組裡單獨聊天過的人會自動加入；系統管理員彼此也在名單裡。
  const [friends,setFriends]=useState([]);
  const [showFriends,setShowFriends]=useState(false);
  // 手機版：先看聊天室清單，點進去才開啟對話（桌機版兩欄並排，不受影響）。
  const [mobileChat,setMobileChat]=useState(false);
  const [draft,setDraft]=useState('');
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const messageListRef=useRef(null);
  const followLatestRef=useRef(true);
  const pendingRoomRef=useRef(null);

  async function loadRooms() {
    const response=await fetch('/api/hr/chat',{cache:'no-store'}),body=await readJson(response);
    if(!response.ok)throw new Error(body.error||'無法載入聊天室');
    setError('');
    setRooms(body.rooms||[]);
    void loadFriends();
    const pending=pendingRoomRef.current;
    setSelectedRoomId(current=>pending&&body.rooms.some(room=>room.id===pending)?pending:(current&&body.rooms.some(room=>room.id===current)?current:(body.rooms[0]?.id||null)));
    if(pending&&body.rooms.some(room=>room.id===pending)){pendingRoomRef.current=null;void markRoomRead(pending);}
  }
  async function loadFriends() {
    try {
      const response=await fetch('/api/hr/chat?friends=1',{cache:'no-store'}),body=await readJson(response);
      if(response.ok)setFriends(body.friends||[]);
    } catch {}
  }
  async function loadMessages(roomId) {
    const response=await fetch(`/api/hr/chat?roomId=${roomId}`,{cache:'no-store'}),body=await readJson(response);
    if(!response.ok)throw new Error(body.error||'無法載入訊息');
    setError('');
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

  useEffect(()=>{let active=true;(async()=>{try{await loadRooms();}catch(err){if(active)setError(localizeError(err));}finally{if(active)setLoading(false);}})();const timer=setInterval(()=>{loadRooms().catch(err=>{if(active)setError(localizeError(err));});},30000);return()=>{active=false;clearInterval(timer);};},[lang]);
  // 從來電通知（LINE／推播）的連結進來：/hr?chatRoom=<id> 直接打開該聊天室，打開後把網址參數拿掉
  useEffect(()=>{const roomId=chatRoomFromUrl(window.location.href);const cleaned=stripChatLinkParams(window.location.href);if(cleaned)window.history.replaceState(window.history.state,'',cleaned);if(!roomId)return;pendingRoomRef.current=roomId;setSelectedRoomId(roomId);setMobileChat(true);void markRoomRead(roomId);window.requestAnimationFrame(()=>document.getElementById('hr-chat-section')?.scrollIntoView({block:'start'}));},[]);
  useEffect(()=>{const openRoom=event=>{const roomId=Number(event.detail?.roomId);if(!Number.isSafeInteger(roomId)||roomId<1)return;pendingRoomRef.current=roomId;setSelectedRoomId(roomId);setMobileChat(true);void markRoomRead(roomId);};window.addEventListener('hr:open-chat-room',openRoom);return()=>window.removeEventListener('hr:open-chat-room',openRoom);},[]);
  useEffect(()=>{if(!selectedRoomId)return;let active=true;const refresh=()=>loadMessages(selectedRoomId).catch(err=>{if(active)setError(localizeError(err));});refresh();const timer=setInterval(refresh,8000);return()=>{active=false;clearInterval(timer);};},[selectedRoomId,lang]);
  useEffect(()=>{followLatestRef.current=true;},[selectedRoomId,mobileChat]);
  useEffect(()=>{const panel=messageListRef.current;if(panel&&followLatestRef.current)panel.scrollTop=panel.scrollHeight;},[messages,selectedRoomId,mobileChat]);

  async function send(event){
    event.preventDefault();const message=draft.trim();if(!message||!selectedRoomId||sending)return;
    setSending(true);setError('');
    try{const response=await fetch('/api/hr/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:selectedRoomId,message})});const body=await readJson(response);if(!response.ok)throw new Error(body.error||'訊息送出失敗');setDraft('');await Promise.all([loadMessages(selectedRoomId),loadRooms()]);}
    catch(err){setError(localizeError(err));}finally{setSending(false);}
  }

  async function openDirect(payload){
    setError('');
    try{
      const response=await fetch('/api/hr/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'direct',...payload})});
      const body=await readJson(response);if(!response.ok){const failure=new Error(body.error||'無法開啟私訊');failure.en=body.en;throw failure;}
      pendingRoomRef.current=body.roomId;setShowMembers(false);setMobileChat(true);await loadRooms();setSelectedRoomId(body.roomId);void markRoomRead(body.roomId);
    }catch(err){setError(localizeError(err));}
  }
  // 從群組會員清單開私訊（需要先選一個群組）；從好友列表開私訊用 type:'friend'。
  function openDirectChat(memberId){return selectedRoomId?openDirect({roomId:selectedRoomId,targetMemberId:memberId}):undefined;}
  function openFriendChat(friend){return openDirect({type:'friend',targetKey:friend.key});}

  const selectedRoom=rooms.find(room=>room.id===selectedRoomId);
  // 通話：只發出事件，由 HrCallProvider（整個 /hr 頁面一個）負責撥號與通話視窗。
  const callBase=lang!=='zh'?{voice:'Voice call',video:'Video call'}:{voice:'語音通話',video:'視訊通話'};
  const callText=lang==='tl'?mapLeaves(callBase,tlText):callBase;
  const startCall=video=>{if(selectedRoomId)window.dispatchEvent(new CustomEvent('hr:start-call',{detail:{roomId:selectedRoomId,video,title:selectedRoom?.title||''}}));};
  const textBase=lang!=='zh'?{
    label:'Member Chat',title:'Agency and Case Chats',description:'Group chats show their members. Select a member to start a private conversation.',refresh:'Refresh',loading:'Loading chats…',none:'No chats are available yet.',list:'Chat list',agency:'Agency chat',case:'Case chat',agencySubtitle:'Agency staff chat',caseSubtitle:'Case conversation',recent:'Latest 200 messages',empty:'No messages yet. Send the first message to start the conversation.',back:'Back to chat list',placeholder:'Write a message…',send:'Send',sending:'Sending…',notFound:'Chat',members:'Group members',privateChat:'Message',direct:'Private chat',trainingCenter:'Training center chat',trainingCenterSubtitle:'Training center group chat',friends:'Friends',noFriends:'No friends yet. People you chat with privately are added automatically.',roleAdmin:'System administrator',roleWorker:'Worker',roleEmployer:'Employer',roleAgency:'Agency',roleTrainingCenter:'Training center',
  }:{label:'會員聊天室',title:'機構群組與案件群組',description:'開啟群組可查看群組會員，點選會員即可開始單獨聊天。',refresh:'重新整理',loading:'正在載入聊天室…',none:'目前沒有可參與的聊天室。',list:'聊天室清單',agency:'機構群組',case:'案件群組',agencySubtitle:'機構內部聊天室',caseSubtitle:'案件對話',recent:'最近 200 則訊息',empty:'尚無訊息，送出第一則訊息開始討論。',back:'返回聊天室清單',placeholder:'輸入訊息…',send:'送出',sending:'送出中',notFound:'聊天室',members:'群組會員',privateChat:'單獨聊天',direct:'私訊',trainingCenter:'訓練中心群組',trainingCenterSubtitle:'訓練中心聊天室',friends:'好友列表',noFriends:'還沒有好友。在群組裡單獨聊天過的人會自動加入好友。',roleAdmin:'系統管理員',roleWorker:'工作者',roleEmployer:'雇主',roleAgency:'仲介',roleTrainingCenter:'訓練中心'};
  const text=lang==='tl'?mapLeaves(textBase,tlText):textBase;
  const friendRole=friend=>friend.role==='admin'?text.roleAdmin:friend.role==='agency'?(friend.agencyName||text.roleAgency):friend.role==='worker'?text.roleWorker:friend.role==='employer'?text.roleEmployer:friend.role==='training_center'?text.roleTrainingCenter:'';
  function displayRoomTitle(room){return room?.roomType==='agency'?`${room.agencyName} · ${text.agency}`:room?.roomType==='direct'?(room.title||text.direct):room?.roomType==='training_center'?`${room.centerName} · ${text.trainingCenter}`:room?.caseNumber?`${room.caseNumber} · ${room.workerName} / ${room.employerName}`:text.notFound;}
  return <section id="hr-chat-section" className={`${styles.chatCard} ${mobileChat?styles.chatOpen:''}`}>
    <header className={styles.heading}><div><span><MessageCircle size={17}/> {text.label}</span><h2>{text.title}</h2><p>{text.description}</p></div><div className={styles.headingActions}><HrCallNotify/><button type="button" className={styles.refresh} onClick={()=>{setError('');loadRooms().then(()=>selectedRoomId&&loadMessages(selectedRoomId)).catch(err=>setError(localizeError(err)));}} aria-label={text.refresh}><RefreshCw size={17}/></button></div></header>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {loading?<div className={styles.empty}>{text.loading}</div>:rooms.length===0?<div className={styles.empty}>{text.none}</div>:
      <div className={`${styles.layout} ${mobileChat?styles.showChat:styles.showList}`}>
        <nav className={styles.roomList} aria-label={text.list}><div className={styles.friends}><button type="button" className={styles.friendsToggle} onClick={()=>setShowFriends(value=>!value)} aria-expanded={showFriends}><Users size={15}/><span>{text.friends} ({friends.length})</span></button>{showFriends&&(friends.length?friends.map(friend=><div className={styles.friend} key={friend.key}><span><b>{friend.name}</b><small>{friendRole(friend)}</small></span><button type="button" onClick={()=>void openFriendChat(friend)}>{text.privateChat}</button></div>):<p className={styles.friendsEmpty}>{text.noFriends}</p>)}</div>{rooms.map(room=><button type="button" key={room.id} className={`${styles.room} ${selectedRoomId===room.id?styles.roomActive:''}`} onClick={()=>{setSelectedRoomId(room.id);setMobileChat(true);void markRoomRead(room.id);}}><strong>{room.roomType==='agency'?text.agency:room.roomType==='direct'?text.direct:room.roomType==='training_center'?text.trainingCenter:text.case}{room.unreadCount>0&&<i className={styles.unreadBadge}>{room.unreadCount>99?'99+':room.unreadCount}</i>}</strong><span>{displayRoomTitle(room)}</span><small>{localizeMessage(room.lastMessage)||(room.roomType==='agency'?text.agencySubtitle:room.roomType==='direct'?text.direct:room.roomType==='training_center'?text.trainingCenterSubtitle:text.caseSubtitle)}</small></button>)}</nav>
        <div className={styles.conversation}>
          <div className={styles.conversationHeader}><button type="button" className={styles.backButton} onClick={()=>{setShowMembers(false);setMobileChat(false);}} aria-label={text.back}><ChevronLeft size={22}/></button><div className={styles.headerText}><strong>{selectedRoom&&displayRoomTitle(selectedRoom)}</strong><small>{selectedRoom&&(selectedRoom.roomType==='agency'?text.agencySubtitle:selectedRoom.roomType==='direct'?text.direct:selectedRoom.roomType==='training_center'?text.trainingCenterSubtitle:text.caseSubtitle)}<span className={styles.recentNote}> · {text.recent}</span></small></div>{selectedRoom&&<div className={`hr-call-actions ${styles.headerActions}`}><button type="button" className="hr-call-start" onClick={()=>startCall(false)} aria-label={callText.voice} title={callText.voice}><Phone size={16}/><span className={styles.actionLabel}>{callText.voice}</span></button><button type="button" className="hr-call-start" onClick={()=>startCall(true)} aria-label={callText.video} title={callText.video}><Video size={16}/><span className={styles.actionLabel}>{callText.video}</span></button>{selectedRoom.roomType!=='direct'&&<button type="button" className={styles.memberToggle} onClick={()=>setShowMembers(value=>!value)} aria-label={text.members} title={text.members}><Users size={16}/><span className={styles.actionLabel}>{text.members}</span> <span>({members.length})</span></button>}</div>}</div>
          {showMembers&&selectedRoom?.roomType!=='direct'&&<div className={styles.memberList}><strong>{text.members}</strong>{members.length?members.map(member=><div className={styles.member} key={member.id}><span><b>{member.name}</b><small>{member.role==='agency'?(member.agencyName||'仲介'):member.role==='worker'?'工作者':member.role==='employer'?'雇主':member.role==='training_center'?'訓練中心':member.role||''}</small></span><button type="button" onClick={()=>void openDirectChat(member.id)}>{text.privateChat}</button></div>):<p className={styles.empty}>—</p>}</div>}
          <div className={styles.messageList} aria-live="polite" ref={messageListRef} onScroll={event=>{const panel=event.currentTarget;followLatestRef.current=panel.scrollHeight-panel.scrollTop-panel.clientHeight<80;}}>{messages.length?messages.map(message=><article className={styles.message} key={message.id}><div className={styles.messageMeta}><strong>{message.sender_name}</strong><span>{new Date(message.created_at).toLocaleString(localeFor(lang),{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div><p>{localizeMessage(message.body)}</p></article>):<div className={styles.empty}>{text.empty}</div>}</div>
          <form className={styles.composer} onSubmit={send}><textarea aria-label={text.placeholder} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={3000} rows={2} placeholder={text.placeholder}/><button type="submit" disabled={sending||!draft.trim()} aria-label={text.send}><Send size={16}/><span className={styles.sendLabel}>{sending?text.sending:text.send}</span></button></form>
        </div>
      </div>}
  </section>;
}
