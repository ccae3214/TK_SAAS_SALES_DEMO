"use client";

import { useCallback, useEffect, useState } from 'react';
import { actionLabel } from '@/lib/hr-agency-certification';
import styles from './HrAgencyCertifications.module.css';

const badgeClass = status => (status === 'certified' ? styles.badgeOk : status === 'pending' ? styles.badgeWait : styles.badgeOff);
const dateText = value => (value ? new Date(value).toLocaleDateString('zh-TW') : '—');

// 台灣仲介 ↔ 菲律賓仲介 相互認證面板。
// role: 'agency'（仲介：申請、同意、拒絕、解除）｜'admin'（系統管理者：全部紀錄、直接認證、解除）｜'employer'（雇主：唯讀，看哪些菲律賓仲介可挑選）
export default function HrAgencyCertifications({ role, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [counterpartId, setCounterpartId] = useState('');
  const [taiwanId, setTaiwanId] = useState('');
  const [philippinesId, setPhilippinesId] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/hr/agency-certifications', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '無法讀取相互認證資料。');
      setData(body);
      setError('');
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(payload, success) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/hr/agency-certifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '操作失敗。');
      setMessage(body.already ? '這筆認證已經存在，不需要重複申請。' : body.completed ? '對方先前已提出申請，認證已完成。' : success);
      setCounterpartId(''); setTaiwanId(''); setPhilippinesId('');
      await load();
      if (onChanged) await onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (error && !data) return <section className={styles.panel}><h2>相互認證</h2><p className={styles.error} role="alert">{error}</p></section>;
  if (!data) return <section className={styles.panel}><h2>相互認證</h2><p className={styles.empty}>讀取中…</p></section>;

  const rows = data.certifications || [];
  const feedback = <>{error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={styles.success} role="status">{message}</p>}</>;

  if (role === 'employer' || data.role === 'employer') {
    return <section className={styles.panel} aria-label="可合作的菲律賓仲介">
      <h2>可挑選的菲律賓仲介</h2>
      <p className={styles.lead}>只有與您所屬台灣仲介完成「相互認證」的菲律賓仲介，其工作者才會出現在可挑選名單。</p>
      {rows.length ? <ul className={styles.list}>{rows.map(row => <li className={styles.item} key={row.id}><span className={styles.itemMain}><strong>{row.philippines_agency_name}</strong><small>{row.philippines_agency_country || '菲律賓'} · 認證日期 {dateText(row.updated_at)}</small></span><span className={`${styles.badge} ${styles.badgeOk}`}>已相互認證</span></li>)}</ul>
        : <p className={styles.notice}>您的台灣仲介目前還沒有已認證的菲律賓仲介，所以暫時沒有可挑選的工作者。請聯絡您的台灣仲介協助辦理認證。</p>}
    </section>;
  }

  if (role === 'admin' || data.role === 'admin') {
    return <section className={styles.panel} aria-label="仲介相互認證管理">
      <h2>台灣／菲律賓仲介相互認證</h2>
      <p className={styles.lead}>雙方確認後才算認證完成：雇主只能挑選已與其台灣仲介認證的菲律賓仲介的工人，雙方也只能互相辦件。管理者可直接認證或解除。</p>
      {feedback}
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void send({ action: 'certify', taiwanAgencyId: taiwanId, philippinesAgencyId: philippinesId }, '已直接完成認證。'); }}>
        <label>台灣仲介<select required value={taiwanId} onChange={event => setTaiwanId(event.target.value)}><option value="">請選擇</option>{(data.taiwanAgencies || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>菲律賓仲介<select required value={philippinesId} onChange={event => setPhilippinesId(event.target.value)}><option value="">請選擇</option>{(data.philippinesAgencies || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="submit" className={styles.primary} disabled={busy || !taiwanId || !philippinesId}>直接認證</button>
      </form>
      <h3>所有認證紀錄（{rows.length}）</h3>
      {rows.length ? <ul className={styles.list}>{rows.map(row => <li className={styles.item} key={row.id}>
        <span className={styles.itemMain}><strong>{row.taiwan_agency_name} ⇄ {row.philippines_agency_name}</strong><small>{row.source_label} · 更新 {dateText(row.updated_at)}{row.note ? ` · ${row.note}` : ''}</small></span>
        <span className={`${styles.badge} ${badgeClass(row.status)}`}>{row.status_label}</span>
        <span className={styles.actions}>
          {row.status === 'pending' && <button type="button" className={styles.primary} disabled={busy} onClick={() => void send({ action: 'approve', id: row.id }, '已代為完成認證。')}>代為同意</button>}
          {row.status === 'pending' && <button type="button" disabled={busy} onClick={() => void send({ action: 'reject', id: row.id }, '已拒絕這筆申請。')}>拒絕</button>}
          {(row.status === 'certified' || row.status === 'pending') && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`確定${row.status === 'certified' ? '解除' : '撤回'}「${row.taiwan_agency_name} ⇄ ${row.philippines_agency_name}」？`)) void send({ action: 'revoke', id: row.id }, '已更新認證狀態。'); }}>{row.status === 'certified' ? '解除認證' : '撤回申請'}</button>}
          {(row.status === 'rejected' || row.status === 'revoked') && <button type="button" disabled={busy} onClick={() => void send({ action: 'certify', taiwanAgencyId: row.taiwan_agency_id, philippinesAgencyId: row.philippines_agency_id }, '已重新認證。')}>重新認證</button>}
        </span></li>)}</ul> : <p className={styles.empty}>目前沒有任何認證紀錄。</p>}
    </section>;
  }

  // 仲介（台灣或菲律賓）
  const mySide = data.side;
  const otherName = mySide === 'taiwan' ? '菲律賓仲介' : '台灣仲介';
  const nameOf = row => (mySide === 'taiwan' ? row.philippines_agency_name : row.taiwan_agency_name);
  const incoming = rows.filter(row => row.status === 'pending' && row.requested_by_side !== mySide);
  const outgoing = rows.filter(row => row.status === 'pending' && row.requested_by_side === mySide);
  const certified = rows.filter(row => row.status === 'certified');
  const closed = rows.filter(row => row.status === 'rejected' || row.status === 'revoked');
  const partnerKey = row => (mySide === 'taiwan' ? row.philippines_agency_id : row.taiwan_agency_id);
  const takenIds = new Set(rows.filter(row => row.status === 'pending' || row.status === 'certified').map(row => Number(partnerKey(row))));
  const choices = (data.counterparts || []).filter(item => !takenIds.has(Number(item.id)));
  const canManage = data.canManage !== false;

  return <section className={styles.panel} aria-label="仲介相互認證">
    <h2>{otherName}相互認證</h2>
    <p className={styles.lead}>{mySide === 'taiwan' ? '您的雇主只能挑選已與貴機構完成相互認證的菲律賓仲介的工人。' : '只有與台灣仲介完成相互認證後，才能被其雇主挑選，並與該台灣仲介互相辦件。'}雙方都確認後才會生效，任何一方都可以隨時解除。</p>
    {!canManage && <p className={styles.notice}>提出或回應認證需由貴機構的仲介管理者操作；您可以在這裡查看目前的認證狀態。</p>}
    {feedback}
    {incoming.length > 0 && <><h3>等待您回應（{incoming.length}）</h3><ul className={styles.list}>{incoming.map(row => <li className={styles.item} key={row.id}><span className={styles.itemMain}><strong>{nameOf(row)}</strong><small>申請日期 {dateText(row.created_at)}</small></span><span className={styles.actions}>{canManage && <button type="button" className={styles.primary} disabled={busy} onClick={() => void send({ action: 'approve', id: row.id }, '已同意，雙方相互認證完成。')}>{actionLabel('approve')}</button>}{canManage && <button type="button" disabled={busy} onClick={() => void send({ action: 'reject', id: row.id }, '已拒絕這筆申請。')}>{actionLabel('reject')}</button>}</span></li>)}</ul></>}
    <h3>已相互認證（{certified.length}）</h3>
    {certified.length ? <ul className={styles.list}>{certified.map(row => <li className={styles.item} key={row.id}><span className={styles.itemMain}><strong>{nameOf(row)}</strong><small>{row.source_label} · {dateText(row.updated_at)}</small></span><span className={`${styles.badge} ${styles.badgeOk}`}>已相互認證</span>{canManage && <button type="button" className={styles.actions} disabled={busy} onClick={() => { if (window.confirm(`確定解除與「${nameOf(row)}」的認證？解除後雙方不能再安排新的面試、錄用或辦件。`)) void send({ action: 'revoke', id: row.id }, '已解除認證。'); }}>{actionLabel('revoke', row)}</button>}</li>)}</ul> : <p className={styles.empty}>目前還沒有已認證的{otherName}。</p>}
    {outgoing.length > 0 && <><h3>等待對方確認（{outgoing.length}）</h3><ul className={styles.list}>{outgoing.map(row => <li className={styles.item} key={row.id}><span className={styles.itemMain}><strong>{nameOf(row)}</strong><small>申請日期 {dateText(row.created_at)}</small></span><span className={`${styles.badge} ${styles.badgeWait}`}>等待對方確認</span>{canManage && <button type="button" disabled={busy} onClick={() => void send({ action: 'revoke', id: row.id }, '已撤回申請。')}>{actionLabel('revoke', row)}</button>}</li>)}</ul></>}
    {canManage && <><h3>申請新的認證</h3><form className={styles.form} onSubmit={event => { event.preventDefault(); void send({ action: 'request', counterpartAgencyId: counterpartId }, `已送出申請，等待${otherName}確認。`); }}><label>{otherName}<select required value={counterpartId} onChange={event => setCounterpartId(event.target.value)}><option value="">請選擇</option>{choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="submit" className={styles.primary} disabled={busy || !counterpartId}>申請認證</button></form>{!choices.length && <p className={styles.empty}>沒有可再申請的{otherName}。</p>}</>}
    {closed.length > 0 && <><h3>已拒絕或解除（{closed.length}）</h3><ul className={styles.list}>{closed.map(row => <li className={styles.item} key={row.id}><span className={styles.itemMain}><strong>{nameOf(row)}</strong><small>更新 {dateText(row.updated_at)}</small></span><span className={`${styles.badge} ${styles.badgeOff}`}>{row.status_label}</span></li>)}</ul></>}
  </section>;
}
