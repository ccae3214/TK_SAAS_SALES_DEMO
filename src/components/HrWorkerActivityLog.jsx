"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { WORKER_LOG_ACTIONS, WORKER_LOG_ACTOR_ROLES } from '@/lib/hr-worker-log-core';
import styles from './HrWorkerActivityLog.module.css';

// 工人會員的活動紀錄。
//   self（工人本人）：只看得到自己的紀錄。
//   staff（系統管理者）：可以選工人；給 workerId 時固定看那一位。
// 誰能看由後端 /api/hr/worker-log 驗證，這裡只是決定畫面長相。
const COPY = {
  zh: {
    titleSelf: '我的活動紀錄', titleStaff: '工人活動紀錄',
    leadSelf: '這裡記錄你在系統中做過的事，以及仲介、管理者對你的資料所做的處理，最新的在最上面。紀錄只有你自己與系統管理者看得到，無法修改或刪除。',
    leadStaff: '這裡記錄每一位工人會員在系統中的操作（登入、上傳文件、學習、編輯資料），以及仲介、管理者、雇主對工人所做的處理，最新的在最上面。紀錄無法修改或刪除。',
    worker: '工人', allWorkers: '全部工人', search: '搜尋', searchPlaceholder: '輸入工人、操作人員或內容關鍵字', apply: '搜尋', clear: '清除',
    loading: '讀取中…', empty: '目前沒有符合條件的活動紀錄。', more: '載入更多', you: '你',
    failRead: '無法讀取活動紀錄，請稍後再試。', forbidden: '你沒有權限查看這份活動紀錄。',
  },
  en: {
    titleSelf: 'My activity log', titleStaff: 'Worker activity log',
    leadSelf: 'This log lists what you did in the system and what your agency or administrators did with your information. The newest entries are first. Only you and system administrators can see it, and entries cannot be edited or deleted.',
    leadStaff: 'This log records what each worker member did in the system (sign-ins, document uploads, learning, profile edits) and what agencies, administrators and employers did for the worker. The newest entries are first. Entries cannot be edited or deleted.',
    worker: 'Worker', allWorkers: 'All workers', search: 'Search', searchPlaceholder: 'Worker, person or keyword', apply: 'Search', clear: 'Clear',
    loading: 'Loading…', empty: 'No activity matches these filters.', more: 'Load more', you: 'You',
    failRead: 'Unable to load the activity log. Please try again later.', forbidden: 'You do not have permission to view this activity log.',
  },
};

const timeText = (value, lang) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-TW', { hour12: false, timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function HrWorkerActivityLog({ self = false, workerId = null }) {
  const { lang } = useLanguage();
  const language = lang === 'en' ? 'en' : 'zh';
  const t = COPY[language];
  const [rows, setRows] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState('');
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState({ worker: '', q: '' });
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const seq = useRef(0);
  const fixedWorker = workerId ? String(workerId) : '';

  const load = useCallback(async (filters, before) => {
    const mine = ++seq.current;
    setState(before ? 'more' : 'loading');
    setError('');
    try {
      const params = new URLSearchParams();
      const target = fixedWorker || filters.worker;
      if (!self && target) params.set('workerId', target);
      if (filters.q) params.set('q', filters.q);
      if (before) params.set('before', String(before));
      const response = await fetch(`/api/hr/worker-log?${params}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!response.ok) { setError(response.status === 403 ? t.forbidden : t.failRead); setState('error'); return; }
      setRows(prev => before ? [...prev, ...(payload.rows || [])] : (payload.rows || []));
      setWorkers(payload.workers || []);
      setHasMore(!!payload.hasMore);
      setState('ready');
    } catch {
      if (mine !== seq.current) return;
      setError(t.failRead); setState('error');
    }
  }, [self, fixedWorker, t.failRead, t.forbidden]);

  useEffect(() => { load(applied, null); }, [applied, load]);

  const submit = event => { event.preventDefault(); setApplied({ worker: selected, q: q.trim() }); };
  const clear = () => { setSelected(''); setQ(''); setApplied({ worker: '', q: '' }); };
  const last = rows[rows.length - 1];
  const showWorkerPicker = !self && !fixedWorker;

  return <section className={styles.card} id="worker-activity-log">
    <h2>{self ? t.titleSelf : t.titleStaff}</h2>
    <p className={styles.lead}>{self ? t.leadSelf : t.leadStaff}</p>
    {!self && <form className={styles.filters} onSubmit={submit}>
      {showWorkerPicker && <label className={styles.field}>{t.worker}
        <select value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">{t.allWorkers}</option>
          {workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
        </select>
      </label>}
      <label className={`${styles.field} ${styles.search}`}>{t.search}
        <input value={q} maxLength={80} placeholder={t.searchPlaceholder} onChange={event => setQ(event.target.value)} />
      </label>
      <button type="submit">{t.apply}</button>
      <button type="button" onClick={clear}>{t.clear}</button>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {state === 'loading' && <p className={styles.empty}>{t.loading}</p>}
    {state !== 'loading' && !error && rows.length === 0 && <p className={styles.empty}>{t.empty}</p>}
    {rows.length > 0 && <ul className={styles.list}>
      {rows.map(row => {
        const action = WORKER_LOG_ACTIONS[row.action];
        const role = WORKER_LOG_ACTOR_ROLES[row.actor_role] || WORKER_LOG_ACTOR_ROLES.system;
        const mine = self && row.actor_role === 'worker';
        const actorName = mine ? t.you : row.actor_name;
        return <li key={row.id} className={styles.item}>
          <div className={styles.head}>
            {!self && row.worker_name && <strong>{row.worker_name}</strong>}
            {actorName && <span>{actorName}</span>}
            <span className={`${styles.badge} ${mine ? styles.badgeSelf : styles.badgeRole}`}>{mine ? t.you : role[language]}</span>
            {action && <span className={styles.badge}>{action[language]}</span>}
            <time dateTime={new Date(row.created_at).toISOString()}>{timeText(row.created_at, language)}</time>
          </div>
          <p className={styles.summary}>{(language === 'en' ? row.summary_en : '') || row.summary_zh}</p>
        </li>;
      })}
    </ul>}
    {hasMore && last && <div className={styles.more}><button type="button" disabled={state === 'more'} onClick={() => load(applied, last.id)}>{state === 'more' ? t.loading : t.more}</button></div>}
  </section>;
}
