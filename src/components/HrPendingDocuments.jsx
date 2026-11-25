'use client';

import { useEffect, useRef, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import styles from './HrReminders.module.css';

// 頁首的「待審核文件」小圖示：樣式與提醒相同，點開只列出狀態為「已送出、待審核」的文件（依工作者分組）。
export default function HrPendingDocuments({ rows = [], onOpenWorker, onOpenAll }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const pending = rows.filter(row => row.status === 'submitted');
  const groups = [...pending.reduce((map, row) => {
    const key = Number(row.worker_id);
    const group = map.get(key) || { id: row.worker_id, name: row.worker_name || `工作者 #${row.worker_id}`, docs: [] };
    group.docs.push(row.name);
    return map.set(key, group);
  }, new Map()).values()];

  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return <div className={styles.bellRoot} ref={rootRef}>
    <button type="button" className={styles.bellButton} aria-label="待我審核的文件" title="待我審核的文件" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(current => !current)}>
      <FileCheck2 size={17} />{pending.length > 0 && <b className={styles.bellBadge}>{pending.length > 99 ? '99+' : pending.length}</b>}
    </button>
    {open && <section className={styles.popover} role="dialog" aria-label="待我審核的文件">
      <header className={styles.header}><div><span>文件審核</span><h2>待審核文件</h2></div>{pending.length > 0 && <strong>{pending.length}</strong>}</header>
      {pending.length === 0 ? <p className={styles.empty}>目前沒有待審核文件</p> : <div className={styles.group}>
        <h3>等待審核</h3>
        {groups.map(group => <button type="button" className={styles.item} key={group.id} onClick={() => { setOpen(false); onOpenWorker?.(group); }}>
          <span className={styles.dotDate} /><span className={styles.itemText}><strong>{group.name}</strong><small>{group.docs.join('、')}</small></span><b>審核</b>
        </button>)}
        <button type="button" className={styles.item} onClick={() => { setOpen(false); onOpenAll?.(); }}><span className={styles.dotProfile} /><span className={styles.itemText}><strong>前往文件收件與審核</strong></span></button>
      </div>}
    </section>}
  </div>;
}
