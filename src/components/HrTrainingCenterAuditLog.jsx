"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './HrManagement.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { TC_AUDIT_ACTION_ZH, TC_AUDIT_ACTION_EN, TC_AUDIT_TYPE_ZH, TC_AUDIT_TYPE_EN, tcAuditSummaryEn } from '@/lib/hr-tc-audit-shared';

// 訓練中心的操作紀錄（系統管理者與該訓練中心自己看得到）：列出這個訓練中心的新增、編輯、停用、刪除與報名等操作。
// 這個畫面的中英文都寫在下面的 TEXT（zh／en）；紀錄內容的英文由欄位組出來，不依賴全站翻譯字典。

const TEXT = {
  zh: {
    title: '操作紀錄',
    desc: '這個訓練中心的新增、編輯、停用、刪除與報名操作，包含系統管理者與訓練中心自己的操作。只有系統管理者與該訓練中心自己看得到，紀錄無法修改或刪除。',
    time: '時間', action: '動作', item: '項目', details: '內容',
    refresh: '重新整理', loadMore: '載入更早的紀錄', loading: '讀取中…', loadingText: '正在載入操作紀錄。',
    empty: '還沒有操作紀錄', emptyText: '這個訓練中心有新增、編輯、停用、刪除或報名操作後，會顯示在這裡。',
    forbidden: '僅系統管理者或該訓練中心自己可查看操作紀錄。', failed: '讀取操作紀錄失敗，請稍後再試。',
    count: n => `${n} 筆`,
  },
  en: {
    title: 'Activity log',
    desc: 'Additions, edits, deactivations, deletions and enrollments for this training center, by system administrators and by the training center itself. Visible only to system administrators and this training center; entries cannot be edited or deleted.',
    time: 'Time', action: 'Action', item: 'Item', details: 'Details',
    refresh: 'Refresh', loadMore: 'Load earlier entries', loading: 'Loading…', loadingText: 'Loading the activity log.',
    empty: 'No activity yet', emptyText: 'Actions such as adding, editing, deactivating, deleting or enrolling will appear here.',
    forbidden: 'Only system administrators and this training center can view the activity log.', failed: 'Failed to load the activity log. Please try again later.',
    count: n => `${n} ${n === 1 ? 'entry' : 'entries'}`,
  },
};

const GOOD = new Set(['create', 'enroll', 'activate', 'register']);
const WARN = new Set(['delete', 'unenroll', 'deactivate']);

function Pill({ action, children }) {
  const toneClass = GOOD.has(action) ? styles.statusOpen : WARN.has(action) ? styles.statusWarn : styles.statusNeutral;
  return <span className={`${styles.status} ${toneClass}`}>{children}</span>;
}

function Empty({ title, text }) {
  return <div className={styles.empty}><strong>{title}</strong><p>{text}</p></div>;
}

export default function HrTrainingCenterAuditLog({ centerId, centerName }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const t = TEXT[en ? 'en' : 'zh'];
  const [rows, setRows] = useState(null);
  const [next, setNext] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async before => {
    const mine = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ centerId: String(centerId) });
      if (before) params.set('before', String(before));
      const response = await fetch(`/api/hr/training-center/audit?${params}`, { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!response.ok) {
        setError(response.status === 403 ? 'forbidden' : 'failed');
        setRows(current => current || []);
        return;
      }
      setRows(current => before ? [...(current || []), ...(json.rows || [])] : (json.rows || []));
      setNext(json.nextBefore || null);
    } catch {
      if (mine === seq.current) { setError('failed'); setRows(current => current || []); }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [centerId]);

  useEffect(() => { setRows(null); setNext(null); void load(null); }, [load]);

  const timeText = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString(en ? 'en-US' : 'zh-TW', { hour12: false });
  };

  return <section className={styles.panel}>
    <div className={styles.panelHeader}>
      <div><h2>{t.title}</h2><p>{centerName ? `${centerName}｜` : ''}{t.desc}</p></div>
      <div className={styles.rowActions}>
        {rows && !error && <span className={styles.rowCount}>{t.count(rows.length)}</span>}
        <button type="button" className={styles.secondaryButton} disabled={loading} onClick={() => void load(null)}>{loading ? t.loading : t.refresh}</button>
      </div>
    </div>
    {error && <p className={`${styles.message} ${styles.messageError}`} role="alert">{t[error]}</p>}
    {rows === null && !error && <Empty title={t.loading} text={t.loadingText} />}
    {rows && rows.length > 0 && <div className={styles.tableWrap}><table>
      <thead><tr><th>{t.time}</th><th>{t.action}</th><th>{t.item}</th><th>{t.details}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td style={{ whiteSpace: 'nowrap' }}>{timeText(row.created_at)}</td>
        <td><Pill action={row.action}>{(en ? TC_AUDIT_ACTION_EN : TC_AUDIT_ACTION_ZH)[row.action] || row.action}</Pill></td>
        <td>{(en ? TC_AUDIT_TYPE_EN : TC_AUDIT_TYPE_ZH)[row.target_type] || row.target_type || '—'}</td>
        <td>{en ? tcAuditSummaryEn(row) : row.summary}</td>
      </tr>)}</tbody>
    </table></div>}
    {rows && rows.length === 0 && !error && <Empty title={t.empty} text={t.emptyText} />}
    {next && <div style={{ padding: '12px 4px' }}><button type="button" className={styles.secondaryButton} disabled={loading} onClick={() => void load(next)}>{t.loadMore}</button></div>}
  </section>;
}
