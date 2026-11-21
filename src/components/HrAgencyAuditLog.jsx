"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { AGENCY_AUDIT_ACTIONS } from '@/lib/hr-agency-audit-core';
import styles from './HrAgencyAuditLog.module.css';

// 仲介機構的操作紀錄（只有該機構的仲介管理者看得到；後端另外驗證，這裡只是不顯示入口）。
const COPY = {
  zh: {
    title: '操作紀錄', lead: '這裡記錄貴機構成員在系統中的新增、修改、刪除與上傳操作，最新的在最上面。紀錄只有貴機構的仲介管理者可以查看，無法修改或刪除。',
    member: '操作人員', all: '全部成員', search: '搜尋', searchPlaceholder: '輸入人員、對象或內容關鍵字', apply: '搜尋', clear: '清除',
    loading: '讀取中…', empty: '目前沒有符合條件的操作紀錄。', more: '載入更多', admin: '管理者',
    failRead: '無法讀取操作紀錄，請稍後再試。', forbidden: '只有該仲介機構的仲介管理者可以查看操作紀錄。',
  },
  en: {
    title: 'Activity log', lead: 'This log records the create, edit, delete and upload actions taken by members of your agency. The newest entries are first. Only your agency administrators can view it, and entries cannot be edited or deleted.',
    member: 'Member', all: 'All members', search: 'Search', searchPlaceholder: 'Member, target or keyword', apply: 'Search', clear: 'Clear',
    loading: 'Loading…', empty: 'No activity matches these filters.', more: 'Load more', admin: 'Admin',
    failRead: 'Unable to load the activity log. Please try again later.', forbidden: 'Only administrators of this agency can view the activity log.',
  },
};

const timeText = (value, lang) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-TW', { hour12: false, timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function HrAgencyAuditLog() {
  const { lang } = useLanguage();
  const language = lang === 'en' ? 'en' : 'zh';
  const t = COPY[language];
  const [rows, setRows] = useState([]);
  const [actors, setActors] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [actorId, setActorId] = useState('');
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState({ actor: '', q: '' });
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (filters, before) => {
    const mine = ++seq.current;
    setState(before ? 'more' : 'loading');
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.actor) params.set('actor', filters.actor);
      if (filters.q) params.set('q', filters.q);
      if (before) params.set('before', String(before));
      const response = await fetch(`/api/hr/agency-audit?${params}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!response.ok) { setError(response.status === 403 ? t.forbidden : t.failRead); setState('error'); return; }
      setRows(prev => before ? [...prev, ...(payload.rows || [])] : (payload.rows || []));
      setActors(payload.actors || []);
      setHasMore(!!payload.hasMore);
      setState('ready');
    } catch {
      if (mine !== seq.current) return;
      setError(t.failRead); setState('error');
    }
  }, [t.failRead, t.forbidden]);

  useEffect(() => { load(applied, null); }, [applied, load]);

  const submit = event => { event.preventDefault(); setApplied({ actor: actorId, q: q.trim() }); };
  const clear = () => { setActorId(''); setQ(''); setApplied({ actor: '', q: '' }); };
  const last = rows[rows.length - 1];

  return <section className="hr-member-card">
    <h2>{t.title}</h2>
    <p>{t.lead}</p>
    <form className={styles.filters} onSubmit={submit}>
      <label className={styles.field}>{t.member}
        <select value={actorId} onChange={event => setActorId(event.target.value)}>
          <option value="">{t.all}</option>
          {actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
        </select>
      </label>
      <label className={`${styles.field} ${styles.search}`}>{t.search}
        <input value={q} maxLength={80} placeholder={t.searchPlaceholder} onChange={event => setQ(event.target.value)} />
      </label>
      <button type="submit">{t.apply}</button>
      <button type="button" onClick={clear}>{t.clear}</button>
    </form>
    {error && <p className="hr-request-error" role="alert">{error}</p>}
    {state === 'loading' && <p className={styles.empty}>{t.loading}</p>}
    {state !== 'loading' && !error && rows.length === 0 && <p className={styles.empty}>{t.empty}</p>}
    {rows.length > 0 && <ul className={styles.list}>
      {rows.map(row => {
        const action = AGENCY_AUDIT_ACTIONS[row.action];
        return <li key={row.id} className={styles.item}>
          <div className={styles.head}>
            <strong>{row.actor_name}</strong>
            {row.actor_is_admin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>{t.admin}</span>}
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
