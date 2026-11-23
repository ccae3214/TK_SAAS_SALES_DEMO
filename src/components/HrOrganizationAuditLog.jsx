"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { tcAuditSummaryEn } from '@/lib/hr-tc-audit-shared';
import styles from './HrManagement.module.css';

export default function HrOrganizationAuditLog() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const t = en ? {
    title: 'Agency and training center activity', lead: 'System administrators can review all organizations. Members retain their existing access restrictions.',
    kind: 'Log type', agency: 'Agencies', training: 'Training centers', search: 'Search', placeholder: 'Organization, person, target or activity',
    refresh: 'Search / refresh', more: 'Load earlier entries', loading: 'Loading…', empty: 'No matching activity.', failed: 'Unable to load activity. Please try again.',
    time: 'Time (Taiwan)', organization: 'Organization', actor: 'Person', detail: 'Activity',
  } : {
    title: '仲介與訓練中心操作紀錄', lead: '系統管理員可查閱所有機構的紀錄；機構成員仍依原有權限查看自己的紀錄。',
    kind: '紀錄類型', agency: '仲介機構', training: '訓練中心', search: '搜尋', placeholder: '機構、人員、對象或操作內容',
    refresh: '搜尋／重新整理', more: '載入更早的紀錄', loading: '讀取中…', empty: '沒有符合條件的操作紀錄。', failed: '無法讀取操作紀錄，請稍後再試。',
    time: '時間（台灣）', organization: '機構', actor: '操作人員', detail: '操作內容',
  };
  const [kind, setKind] = useState('agency');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ kind: 'agency', q: '' });
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  const load = useCallback(async before => {
    const mine = ++seq.current;
    setLoading(true); setFailed(false);
    if (!before) { setRows([]); setNext(null); }
    try {
      const params = new URLSearchParams(filters);
      if (before) params.set('before', before);
      const response = await fetch(`/api/hr/organization-audit?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('read_failed');
      const payload = await response.json();
      if (mine !== seq.current) return;
      setRows(previous => before ? [...previous, ...payload.rows] : payload.rows);
      setNext(payload.nextBefore);
    } catch { if (mine === seq.current) setFailed(true); }
    finally { if (mine === seq.current) setLoading(false); }
  }, [filters]);
  useEffect(() => { void load(null); return () => { seq.current += 1; }; }, [load]);
  const changeKind = value => { seq.current += 1; setKind(value); setQ(''); setFilters({ kind: value, q: '' }); };
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><h2>{t.title}</h2><p>{t.lead}</p></div></div>
    <form className={styles.rowActions} style={{ padding: 16, flexWrap: 'wrap' }} onSubmit={event => { event.preventDefault(); setFilters({ kind, q: q.trim() }); }}>
      <label>{t.kind} <select value={kind} onChange={event => changeKind(event.target.value)}><option value="agency">{t.agency}</option><option value="training">{t.training}</option></select></label>
      <label>{t.search} <input value={q} maxLength={80} placeholder={t.placeholder} onChange={event => setQ(event.target.value)} /></label>
      <button type="submit" className={styles.secondaryButton} disabled={loading}>{t.refresh}</button>
    </form>
    {failed && <p role="alert" style={{ padding: 16 }}>{t.failed}</p>}
    {loading && <p role="status" style={{ padding: 16 }}>{t.loading}</p>}
    {!loading && !failed && !rows.length && <p style={{ padding: 16 }}>{t.empty}</p>}
    {!!rows.length && <div className={styles.tableWrap}><table><thead><tr><th>{t.time}</th><th>{t.organization}</th><th>{t.actor}</th><th>{t.detail}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td>{new Date(row.created_at).toLocaleString(en ? 'en-US' : 'zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</td>
        <td>{row.organization_name || '—'}</td><td>{row.actor_name}</td>
        <td>{en ? (filters.kind === 'training' ? tcAuditSummaryEn(row) : row.summary_en || row.summary) : row.summary}</td>
      </tr>)}</tbody></table></div>}
    {next && <button type="button" className={styles.secondaryButton} style={{ margin: 16 }} disabled={loading || failed} onClick={() => void load(next)}>{t.more}</button>}
  </section>;
}
