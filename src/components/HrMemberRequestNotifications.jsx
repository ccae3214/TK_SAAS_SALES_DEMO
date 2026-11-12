'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './HrMemberRequestNotifications.module.css';

export default function HrMemberRequestNotifications({ onOpen, blocked = false }) {
  const [summary, setSummary] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const controller = useRef(null);
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
  const choose = async id => {
    if (blocked || opening) return;
    setOpening(true);
    try { await onOpen(id); setOpen(false); void refresh(); }
    finally { setOpening(false); }
  };
  return <div className={styles.root} data-testid="member-request-notifications">
    <button type="button" className={styles.trigger} aria-label={`會員申請通知，待審 ${summary?.total ?? '讀取中'} 筆`} aria-expanded={open} aria-controls="member-request-notification-panel" onClick={() => setOpen(value => !value)}>
      待審會員 <span aria-live="polite">{summary?.total ?? '…'}</span>{failed && <span title="更新失敗，保留上次結果">！</span>}
    </button>
    {open && <section id="member-request-notification-panel" className={styles.panel} aria-label="會員申請通知">
      <header><strong>會員申請通知</strong><button type="button" onClick={() => setOpen(false)} aria-label="關閉會員通知">關閉</button></header>
      {failed && <p role="status">更新失敗，保留上次結果。<button type="button" onClick={() => void refresh()}>重新整理通知</button></p>}
      {!summary ? <p>正在讀取…</p> : <><p>目前有 {summary.total} 位會員等待審核。</p>
        {summary.items.map(item => <button type="button" key={item.id} className={styles.item} disabled={blocked || opening} onClick={() => void choose(item.id)}>
          <strong>{item.display_name || `會員 #${item.id}`}</strong><span>查看申請</span>
        </button>)}
        {summary.total > 10 && <button type="button" disabled={blocked || opening} onClick={() => void choose(null)}>查看全部待審會員</button>}
        {blocked && <p>請先完成或關閉目前編輯，再開啟會員申請。</p>}
        {(Number(summary.delivery?.retry) > 0 || Number(summary.delivery?.failed) > 0) && <p role="status">部分 LINE 提醒尚未成功，會員申請仍可正常審核。</p>}
        <small>LINE 僅通知已綁定的系統管理者；發送受理不代表手機已收到。</small>
      </>}
    </section>}
  </div>;
}
