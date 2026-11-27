"use client";

import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { readJson } from '@/lib/hr-read-json';
import { translateHrText } from '@/lib/hr-translations';
import { translateChatSystemMessage } from '@/lib/hr-translations-chat';
import { localeFor } from '@/lib/language';
import { CALL_CHAT_POLL_MS, countUnread, latestMessageId, mergeMessages, shouldSendOnKey } from '@/lib/hr-call-chat';

// 通話視窗裡的文字聊天。用的是這個聊天室本身的訊息，所以：
// - 通話中打的字，聊天室裡也看得到（掛斷後還在）
// - 沒有開聊天面板時也會在背景拿新訊息，在「聊天」按鈕上顯示未讀數
// 加入通話以前的舊訊息不算未讀。
export default function HrCallChat({ roomId, open, lang, copy, onClose, onUnreadChange }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const seenIdRef = useRef(null); // null：還沒載入過
  const mineRef = useRef(new Set());
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const followRef = useRef(true);
  const readSentRef = useRef(0);

  const localizeError = err => (lang !== 'zh' ? translateHrText(err.en || translateHrText(err.message, 'en'), lang) : err.message);
  const localizeMessage = body => translateChatSystemMessage(body, lang, text => translateHrText(text, 'en'));

  // 換聊天室（不同通話）就重來
  useEffect(() => {
    setMessages([]); setDraft(''); setError('');
    seenIdRef.current = null; mineRef.current = new Set(); readSentRef.current = 0;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return undefined;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/hr/chat?roomId=${roomId}`, { cache: 'no-store' });
        const body = await readJson(response);
        if (!response.ok) { const err = new Error(body.error || '無法載入訊息'); err.en = body.en; throw err; }
        if (!active) return;
        const incoming = body.messages || [];
        if (seenIdRef.current === null) seenIdRef.current = latestMessageId(incoming);
        setMessages(current => mergeMessages(current, incoming));
        setError(current => (current === copy.chatLoadFailed ? '' : current));
      } catch {
        if (active) setError(copy.chatLoadFailed);
      }
    };
    void load();
    const timer = setInterval(load, CALL_CHAT_POLL_MS);
    return () => { active = false; clearInterval(timer); };
    // copy 只用在錯誤文字，語言切換時下一輪就會更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const latestId = latestMessageId(messages);

  // 打開面板時：全部算已讀，也同步到聊天室的已讀（聊天室清單的未讀數會跟著歸零）
  useEffect(() => {
    if (!open || seenIdRef.current === null) return;
    seenIdRef.current = Math.max(seenIdRef.current, latestId);
    if (latestId > readSentRef.current) {
      readSentRef.current = latestId;
      fetch('/api/hr/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'read', roomId }) }).catch(() => {});
    }
  }, [open, latestId, roomId]);

  const unread = open || seenIdRef.current === null ? 0 : countUnread(messages, seenIdRef.current, mineRef.current);
  useEffect(() => { onUnreadChange?.(unread); }, [unread, onUnreadChange]);

  useEffect(() => { if (open) { followRef.current = true; inputRef.current?.focus({ preventScroll: true }); } }, [open]);
  useEffect(() => {
    const panel = listRef.current;
    if (open && panel && followRef.current) panel.scrollTop = panel.scrollHeight;
  }, [messages, open]);

  async function send(event) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true); setError('');
    try {
      const response = await fetch('/api/hr/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, message }) });
      const body = await readJson(response);
      if (!response.ok) { const err = new Error(body.error || copy.chatSendFailed); err.en = body.en || (body.error ? undefined : copy.chatSendFailed); throw err; }
      if (body?.id) { mineRef.current.add(Number(body.id)); setMessages(current => mergeMessages(current, [body])); }
      followRef.current = true;
      setDraft('');
    } catch (err) {
      setError(err?.message ? localizeError(err) : copy.chatSendFailed);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;
  return <aside className="hr-call-chat" aria-label={copy.chatTitle}>
    <header className="hr-call-chat-header">
      <strong>{copy.chatTitle}</strong>
      <button type="button" className="hr-call-chat-close" onClick={onClose} aria-label={copy.closeChat} title={copy.closeChat}><X size={18} /></button>
    </header>
    <div className="hr-call-chat-list" ref={listRef} aria-live="polite"
      onScroll={event => { const panel = event.currentTarget; followRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 60; }}>
      {messages.length ? messages.map(message => {
        const mine = mineRef.current.has(Number(message.id));
        return <article key={message.id} className={`hr-call-chat-message ${mine ? 'is-mine' : ''}`}>
          <div className="hr-call-chat-meta">
            <strong>{mine ? copy.me : message.sender_name}</strong>
            <span>{new Date(message.created_at).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p>{localizeMessage(message.body)}</p>
        </article>;
      }) : <p className="hr-call-chat-empty">{copy.chatEmpty}</p>}
    </div>
    {error && <p className="hr-call-chat-error" role="alert">{error}</p>}
    <form className="hr-call-chat-composer" onSubmit={send}>
      <textarea ref={inputRef} rows={1} maxLength={3000} value={draft} placeholder={copy.chatPlaceholder} aria-label={copy.chatPlaceholder}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (shouldSendOnKey(event)) { event.preventDefault(); void send(); } }} />
      <button type="submit" disabled={sending || !draft.trim()} aria-label={sending ? copy.chatSending : copy.chatSend} title={copy.chatSend}><Send size={16} /></button>
    </form>
  </aside>;
}
