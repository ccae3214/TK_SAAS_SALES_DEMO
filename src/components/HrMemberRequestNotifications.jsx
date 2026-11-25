'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UserRoundCheck } from 'lucide-react';
import styles from './HrReminders.module.css';

export default function HrMemberRequestNotifications({ onOpen, blocked = false }) {
  const [summary, setSummary] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const controller = useRef(null);
  const rootRef = useRef(null);
  const refresh = useCallback(async () => {
    if (document.visibilityState === 'hidden' || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch('/api/hr/notifications', { cache: 'no-store', signal: request.signal });
      if (!response.ok) throw new Error('notification_summary');
      const body = await response.json();
      setSummary(body);
      setFailed(false);
    } catch { if (!request.signal.aborted || controller.current) setFailed(true); }
    finally { clearTimeout(timeout); if (controller.current === request) controller.current = null; }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const wake = () => void refresh();
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
      const active = controller.current;
      controller.current = null;
      active?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const choose = async id => {
    if (blocked || opening) return;
    setOpening(true);
    try { await onOpen(id); setOpen(false); void refresh(); }
    finally { setOpening(false); }
  };
  return <div className={styles.bellRoot} ref={rootRef} data-testid="member-request-notifications">
    <button type="button" className={styles.bellButton} title="待審會員" aria-label={`會員申請通知，待審 ${summary?.total ?? '讀取中'} 筆`} aria-expanded={open} aria-controls="member-request-notification-panel" onClick={() => setOpen(value => !value)}>
      <UserRoundCheck size={17} aria-hidden="true" />
      {Number(summary?.total) > 0 && <b className={styles.bellBadge} aria-hidden="true">{summary.total > 99 ? '99+' : summary.total}</b>}
    </button>
    {open && <section id="member-request-notification-panel" className={styles.popover} aria-label="會員申請通知">
      <header className={styles.header}><div><span>會員申請</span><h2>待審會員</h2></div>{Number(summary?.total) > 0 && <strong>{summary.total}</strong>}</header>
      {failed && <p role="status" className={styles.note}>更新失敗，保留上次結果。<button type="button" className={styles.linkButton} onClick={() => void refresh()}>重新整理通知</button></p>}
      {!summary ? <p className={styles.empty}>正在讀取…</p> : summary.total === 0 ? <p className={styles.empty}>目前沒有待審會員</p> : <div className={styles.group}>
        <h3>等待審核</h3>
        {summary.items.map(item => <button type="button" key={item.id} className={styles.item} disabled={blocked || opening} onClick={() => void choose(item.id)}>
          <span className={styles.dotDate} /><span className={styles.itemText}><strong>{item.display_name || `會員 #${item.id}`}</strong></span><b>查看申請</b>
        </button>)}
        {summary.total > 10 && <button type="button" className={styles.item} disabled={blocked || opening} onClick={() => void choose(null)}><span className={styles.dotDate} /><span className={styles.itemText}><strong>查看全部待審會員</strong></span></button>}
      </div>}
      {summary && blocked && <p className={styles.note}>請先完成或關閉目前編輯，再開啟會員申請。</p>}
      {summary && (Number(summary.delivery?.retry) > 0 || Number(summary.delivery?.failed) > 0) && <p role="status" className={styles.note}>部分 LINE 提醒尚未成功，會員申請仍可正常審核。</p>}
      {summary && <p className={styles.note}>LINE 僅通知已綁定的系統管理者；發送受理不代表手機已收到。</p>}
    </section>}
  </div>;
}
