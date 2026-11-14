"use client";

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { AUTH_CHECKED_SOURCES } from '@/lib/hr-agency-auth-sources';
import { AUTH_GUIDE_CHECKED_ON, AUTH_ITEMS, AUTH_ROUTES, estimateAuthentication, otherSideOf, pendingItems, progressOf } from '@/lib/hr-agency-auth-guide';
import styles from './HrAgencyAuthProgress.module.css';

// 相互認證的「文件驗證辦理進度」：雙方各自把自己的文件送到對方國家的代表處驗證，這裡讓雙方看到彼此走到哪一關，
// 並顯示每一關的預估規費與時間。只有自己這一邊的仲介管理者可以更新自己的進度。
const COPY = {
  zh: {
    summary: '文件驗證辦理進度', loading: '讀取中…', failRead: '無法讀取辦理進度。', failSave: '儲存失敗',
    intro: '雙方各自把自己簽發的文件，拿到對方國家的代表處驗證；驗證完成後交給對方。這裡記錄每份文件走到哪一關，雙方都看得到。',
    mine: '貴機構', theirs: '對方', needs: name => `${name}需辦理的文件`, route: '辦理路線', progress: (done, total) => `已交付 ${done} / ${total} 份`,
    estimate: '預估規費與時間', docs: '份數', expedited: '速件', perDoc: '每份', total: '合計', days: (min, max) => (min === max ? `約 ${min} 個工作天` : `約 ${min}–${max} 個工作天`),
    excludes: { notary: '不含公證費（依公證處收費）', dfa: '不含菲律賓 DFA 驗證費（依 DFA 公告）' },
    estimated: '其中 MECO 費用為代辦業者公開報價，非官方公告價。', excludedNote: '另不含郵寄與排隊等待時間。',
    readOnly: '只有該機構的仲介管理者可以更新辦理進度。', closed: '這筆認證已拒絕或解除，不需要再辦理。', noPending: '全部文件都已交付。',
    disclaimer: `費用與時間整理自公開網頁（${AUTH_GUIDE_CHECKED_ON}），會隨公告調整，僅供預估；實際請以各機關最新公告為準。清單為建議準備的文件，實際要求請與對方及主管機關確認。`,
    sources: '參考來源', stage: '辦理階段',
    items: { business_registration: '公司／營業登記證明', agency_license: '私立就業服務機構許可證', recruitment_agreement: '招聘協議書（Recruitment Agreement）', spa: '授權書（SPA）', dmw_license: 'DMW 仲介執照', company_registration: '公司登記證明（如 SEC 登記）' },
    stages: { todo: '尚未辦理', notarized: '已公證', boca: '外交部領事事務局已驗證', meco: '菲律賓辦事處（MECO）已驗證', dfa: '菲律賓外交部（DFA）已驗證', teco: '駐菲律賓臺北辦事處（TECO）已驗證', delivered: '已交付對方' },
    routes: { taiwan: '法院／民間公證 → 外交部領事事務局驗證 → 菲律賓馬尼拉經濟文化辦事處（MECO）驗證', philippines: '菲律賓外交部（DFA）驗證 → 駐菲律賓臺北經濟文化辦事處（TECO）驗證' },
    errors: { forbidden: '沒有權限更新辦理進度。', manager_required: '只有仲介管理者可以更新辦理進度。', not_found: '找不到這筆認證紀錄。', not_active: '這筆認證已拒絕或解除，不需要再更新辦理進度。', bad_item: '這份文件不在這一邊的辦理清單中。', bad_stage: '辦理階段不正確。' },
  },
  en: {
    summary: 'Document authentication progress', loading: 'Loading…', failRead: 'Unable to load the progress.', failSave: 'Save failed',
    intro: 'Each agency takes the documents it issued to the other country’s representative office for authentication, then hands them to the other agency. Track how far each document has got here — both agencies can see it.',
    mine: 'Your agency', theirs: 'Partner', needs: name => `Documents ${name} needs to authenticate`, route: 'Route', progress: (done, total) => `${done} of ${total} delivered`,
    estimate: 'Estimated fees and time', docs: 'Documents', expedited: 'Expedited', perDoc: 'per document', total: 'Total', days: (min, max) => (min === max ? `about ${min} working day${min === 1 ? '' : 's'}` : `about ${min}–${max} working days`),
    excludes: { notary: 'excludes the notary fee (set by the notary office)', dfa: 'excludes the Philippine DFA authentication fee (see DFA announcements)' },
    estimated: 'The MECO fee is a public quote from a filing service, not an official announced price.', excludedNote: 'Also excludes postage and waiting or queueing time.',
    readOnly: 'Only the agency administrator of that agency can update the progress.', closed: 'This certification was rejected or ended, so no further work is needed.', noPending: 'All documents have been delivered.',
    disclaimer: `Fees and times are compiled from public web pages (${AUTH_GUIDE_CHECKED_ON}) and change with official announcements, so treat them as estimates and check each office’s latest notice. The list shows suggested documents; confirm the actual requirements with the other agency and the authorities.`,
    sources: 'Sources', stage: 'Stage',
    items: { business_registration: 'Company / business registration certificate', agency_license: 'Private employment service agency permit', recruitment_agreement: 'Recruitment Agreement', spa: 'Special Power of Attorney (SPA)', dmw_license: 'DMW agency license', company_registration: 'Company registration certificate (e.g. SEC registration)' },
    stages: { todo: 'Not started', notarized: 'Notarized', boca: 'Verified by Taiwan Bureau of Consular Affairs', meco: 'Verified by MECO (Philippine office in Taiwan)', dfa: 'Verified by Philippine DFA', teco: 'Verified by TECO in the Philippines', delivered: 'Delivered to the other agency' },
    routes: { taiwan: 'Court or notary public → Bureau of Consular Affairs (Taiwan MOFA) → Manila Economic and Cultural Office (MECO)', philippines: 'Philippine Department of Foreign Affairs (DFA) → Taipei Economic and Cultural Office in the Philippines (TECO)' },
    errors: { forbidden: 'You do not have permission to update the progress.', manager_required: 'Only agency administrators can update the progress.', not_found: 'Certification record not found.', not_active: 'This certification was rejected or ended, so progress can no longer be updated.', bad_item: 'This document is not on the checklist for that side.', bad_stage: 'The stage is not valid.' },
  },
};

const money = (fee, lang) => {
  const symbol = fee.currency === 'TWD' ? 'NT$' : 'PHP ';
  const n = value => value.toLocaleString(lang === 'en' ? 'en-US' : 'zh-TW');
  return fee.min === fee.max ? `${symbol}${n(fee.min)}` : `${symbol}${n(fee.min)}–${n(fee.max)}`;
};

export default function HrAgencyAuthProgress({ certification, mySide, canManage }) {
  const { lang } = useLanguage();
  const t = COPY[lang === 'en' ? 'en' : 'zh'];
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [expedited, setExpedited] = useState(false);
  const live = certification.status === 'pending' || certification.status === 'certified';
  const errorOf = body => t.errors[body?.code] || body?.error;

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/hr/agency-certifications/progress?certificationId=${encodeURIComponent(certification.id)}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorOf(body) || t.failRead);
      setData(body); setError('');
    } catch (err) { setError(err.message); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certification.id, lang]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  async function change(itemKey, stage) {
    setBusyKey(itemKey); setError('');
    try {
      const response = await fetch('/api/hr/agency-certifications/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ certificationId: certification.id, itemKey, stage }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorOf(body) || t.failSave);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusyKey(''); }
  }

  const rowsOf = side => (data?.rows || []).filter(row => row.side === side);
  const nameOf = side => (side === 'taiwan' ? certification.taiwan_agency_name : certification.philippines_agency_name);

  function section(side) {
    const mine = side === mySide;
    const rows = rowsOf(side);
    const stageOf = Object.fromEntries(rows.map(row => [row.item_key, row.stage]));
    const progress = progressOf(side, rows);
    const pending = pendingItems(side, rows);
    const estimate = estimateAuthentication(side, { documents: Math.max(1, pending.length), expedited });
    const editable = mine && data?.canManage && live;
    return <div className={styles.side} key={side}>
      <h4>{t.needs(nameOf(side))}<span className={styles.who}>{mine ? t.mine : t.theirs}</span></h4>
      <div className={styles.bar} role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress.percent}%` }} /></div>
      <p className={styles.count}>{t.progress(progress.done, progress.total)}（{progress.percent}%）</p>
      <p className={styles.route}><b>{t.route}：</b>{t.routes[side]}</p>
      <ul className={styles.items}>{AUTH_ITEMS[side].map(item => {
        const stage = stageOf[item] || 'todo';
        return <li key={item}>
          <span className={styles.itemName}>{t.items[item]}</span>
          {editable
            ? <select aria-label={`${t.items[item]} — ${t.stage}`} value={stage} disabled={busyKey === item} onChange={event => void change(item, event.target.value)}>{AUTH_ROUTES[side].stages.map(s => <option key={s} value={s}>{t.stages[s]}</option>)}</select>
            : <span className={`${styles.stage} ${stage === 'delivered' ? styles.stageDone : ''}`}>{t.stages[stage]}</span>}
        </li>;
      })}</ul>
      {pending.length > 0 && estimate && <div className={styles.estimate}>
        <b>{t.estimate}</b>
        <span>{t.docs}：{estimate.documents} · {t.total} {estimate.fees.map(fee => money(fee, lang)).join(' + ')} · {t.days(estimate.days.min, estimate.days.max)}</span>
        <small>{estimate.excluded.map(key => t.excludes[key]).join('；')}。{t.excludedNote}{estimate.estimated ? ` ${t.estimated}` : ''}</small>
      </div>}
      {pending.length === 0 && <p className={styles.done}>{t.noPending}</p>}
    </div>;
  }

  return <details className={styles.wrap} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t.summary}</summary>
    {!data && !error && <p className={styles.muted}>{t.loading}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {data && <>
      <p className={styles.intro}>{t.intro}</p>
      {!live && <p className={styles.note}>{t.closed}</p>}
      {live && !data.canManage && <p className={styles.note}>{t.readOnly}</p>}
      <label className={styles.toggle}><input type="checkbox" checked={expedited} onChange={event => setExpedited(event.target.checked)} /> {t.expedited}</label>
      <div className={styles.sides}>{[mySide || 'taiwan', otherSideOf(mySide || 'taiwan')].map(section)}</div>
      <p className={styles.disclaimer}>{t.disclaimer}</p>
      <p className={styles.sources}>{t.sources}：{AUTH_CHECKED_SOURCES.map((source, index) => <span key={source.url}>{index ? ' · ' : ''}<a href={source.url} target="_blank" rel="noreferrer">{lang === 'en' ? source.en : source.zh}</a></span>)}</p>
    </>}
  </details>;
}
