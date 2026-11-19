"use client";

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';
import { DEPOSIT_MESSAGES, depositDateLabel, formatDeposit, parseDepositAmount } from '@/lib/hr-candidate-deposit';
import styles from './HrCandidateDeposit.module.css';

// 雇主錄用後的訂金狀態與金額。canEdit（台灣仲介）可登記已付訂金，登記後此人選就是「已結單」；
// 沒有 canEdit 時只顯示。菲律賓仲介與工作者收不到金額，所以只會看到「已付」。
export default function HrCandidateDeposit({ candidate, canEdit = false, onChanged }) {
  const { lang } = useLanguage();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (candidate?.status !== 'passed') return null;
  const paid = !!candidate.deposit_paid_at;

  async function send(payload, confirmText) {
    if (!window.confirm(translateHrText(confirmText, lang))) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/hr', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'job-order-candidate-deposit', candidateId: candidate.id, ...payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || DEPOSIT_MESSAGES.failed); return; }
      setAmount('');
      if (onChanged) await onChanged();
    } catch {
      setError(DEPOSIT_MESSAGES.failed);
    } finally {
      setBusy(false);
    }
  }

  function record() {
    const parsed = parseDepositAmount(amount);
    if (parsed === null) { setError(DEPOSIT_MESSAGES.badAmount); return; }
    void send({ paid: true, amount: parsed }, `確定登記「${candidate.worker_name}」的雇主已付訂金 ${formatDeposit(parsed)}？登記後此人選狀態會設為「已結單」。`);
  }

  return <div className={styles.box}>
    <span className={styles.label}>雇主訂金：</span>
    {paid ? <>
      <strong className={styles.paid}>已付</strong>
      {candidate.deposit_amount != null && <><span className={styles.label}>訂金金額：</span><strong>{formatDeposit(candidate.deposit_amount)}</strong></>}
      <span className={styles.label}>付款日期：</span><span className={styles.date}>{depositDateLabel(candidate.deposit_paid_at)}</span>
      {canEdit && <button type="button" className={styles.button} disabled={busy} onClick={() => void send({ paid: false }, `確定取消「${candidate.worker_name}」的訂金登記？取消後此人選會回到「已錄用」狀態。`)}>取消訂金登記</button>}
    </> : <>
      <strong className={styles.unpaid}>尚未付款</strong>
      {canEdit && <>
        <input className={styles.amountInput} type="number" inputMode="numeric" min="1" max="10000000" step="1" value={amount} aria-label="訂金金額（新臺幣）" placeholder="訂金金額（新臺幣）" onChange={event => setAmount(event.target.value)} />
        <button type="button" className={styles.button} disabled={busy} onClick={record}>登記已付訂金並結單</button>
      </>}
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
