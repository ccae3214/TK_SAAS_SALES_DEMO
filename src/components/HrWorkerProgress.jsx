"use client";

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { HrLanguageTools } from '@/lib/hr-translations';
import { progressText } from '@/lib/hr-worker-progress-text';
import {
  CASE_STAGE_LABELS, DOCUMENT_STATUS_LABELS, HEALTH_TRAINING_STEP_KEYS, SINGLE_DATE_STEPS, STATUS_LABELS, STEP_DATE_LABELS, allowedNextStatuses,
} from '@/lib/hr-worker-progress';
import styles from './HrWorkerProgress.module.css';

const shortDate = value => value ? String(value).slice(0, 10) : '—';
const TONES = { submitted: 'warn', returned: 'danger', missing: 'muted', approved: 'ok', na: 'muted' };
const STATUS_TONES = { passed: 'ok', completed: 'ok', failed: 'danger', retest: 'warn', in_progress: 'warn', scheduled: 'info', not_scheduled: 'muted' };

function StepForm({ step, t, disabled, onSave }) {
  const single = SINGLE_DATE_STEPS.has(step.step_key);
  return (
    <form className={styles.stepForm} onSubmit={event => onSave(event, step)}>
      {single ? (
        <label>{t(STEP_DATE_LABELS[step.step_key] || '辦理日期')}<input type="date" name="completedOn" defaultValue={step.completed_on || ''} disabled={disabled} /></label>
      ) : (
        <>
          <label>{t('開始日期')}<input type="date" name="startedOn" defaultValue={step.started_on || ''} disabled={disabled} /></label>
          <label>{t('完成日期')}<input type="date" name="completedOn" defaultValue={step.completed_on || ''} disabled={disabled} /></label>
        </>
      )}
      <label className={styles.noteField}>{t('備註')}<input name="note" maxLength={1000} defaultValue={step.note || ''} disabled={disabled} /></label>
      <button type="submit" className={styles.primary} disabled={disabled}>{t('儲存')}</button>
    </form>
  );
}

function HealthCard({ kind, title, status, gateClosed, step, t, disabled, onStatus, onSaveStep }) {
  const next = allowedNextStatuses(kind, status);
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <h3>{t(title)}</h3>
        <span className={`${styles.pill} ${styles[`tone_${STATUS_TONES[status] || 'muted'}`]}`}>{t(STATUS_LABELS[kind][status] || status)}</span>
      </header>
      {next.length > 0 && (
        <div className={styles.actions}>
          <span className={styles.hint}>{t('更新狀態：')}</span>
          {next.map(value => (
            <button key={value} type="button" disabled={disabled || gateClosed} onClick={() => onStatus(kind, value)}>{t(STATUS_LABELS[kind][value])}</button>
          ))}
        </div>
      )}
      {gateClosed && status === 'not_scheduled' && <p className={styles.gateNote}>{t('護照資料頁與 PSA 出生證明核准後，才能安排體檢及訓練。')}</p>}
      <StepForm key={step.updated_at || 'new'} step={step} t={t} disabled={disabled} onSave={onSaveStep} />
    </section>
  );
}

function DocumentCard({ doc, viewer, t, disabled, onReview, onApplicability, onUpload }) {
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const state = doc.applicable ? doc.status : 'na';
  const canReview = doc.applicable && doc.status === 'submitted' && doc.latest_submission_id;
  const canToggle = (doc.applicability || viewer.is_admin) && doc.status !== 'submitted';
  return (
    <article className={styles.doc}>
      <header className={styles.docHeader}>
        <div>
          <strong>{t(doc.name)}</strong>
          {doc.entry_gate && <span className={styles.gate}>{t('前置文件')}</span>}
          {doc.applicability && <small>{t(doc.applicability)}</small>}
        </div>
        <span className={`${styles.pill} ${styles[`tone_${TONES[state] || 'muted'}`]}`}>{t(state === 'na' ? '不適用' : DOCUMENT_STATUS_LABELS[doc.status] || doc.status)}</span>
      </header>
      {doc.applicable && doc.status === 'returned' && doc.review_reason && <p className={styles.returnNote}>{t('補件原因：')}{doc.review_reason}</p>}
      {doc.submissions.length > 0 && (
        <ul className={styles.history}>
          {doc.submissions.map(sub => (
            <li key={sub.id}>
              <span>{t('第')}{sub.version_number}{t('版')} · {sub.original_filename || sub.filename} · {shortDate(sub.created_at)}</span>
              <span>{sub.decision === 'approved' ? t('合格') : sub.decision === 'returned' ? `${t('退件：')}${sub.review_reason || ''}` : t('審核中')}</span>
              <a href={`/api/hr/documents/${sub.id}?preview=1`} target="_blank" rel="noreferrer">{t('檢視')}</a>
            </li>
          ))}
        </ul>
      )}
      {canReview && !returning && (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={disabled} onClick={() => onReview(doc, 'approved', '')}>{t('核准')}</button>
          <button type="button" className={styles.danger} disabled={disabled} onClick={() => { setReturning(true); setReason(''); }}>{t('退回')}</button>
        </div>
      )}
      {canReview && returning && (
        <form className={styles.returnForm} onSubmit={event => { event.preventDefault(); if (!reason.trim()) return; onReview(doc, 'returned', reason.trim()); setReturning(false); }}>
          <label>{t('退回原因（工作者會看到）')}<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} required autoFocus /></label>
          <div className={styles.actions}>
            <button type="submit" className={styles.danger} disabled={disabled}>{t('確認退回')}</button>
            <button type="button" onClick={() => setReturning(false)}>{t('取消')}</button>
          </div>
        </form>
      )}
      {doc.applicable && (
        <form className={styles.uploadRow} onSubmit={event => onUpload(event, doc)}>
          <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required disabled={disabled} />
          <input name="note" placeholder={t('補件說明（選填）')} maxLength={300} disabled={disabled} />
          <button type="submit" disabled={disabled}>{t(doc.status === 'returned' ? '重新上傳' : doc.status === 'missing' ? '上傳文件' : '上傳新版本')}</button>
        </form>
      )}
      {canToggle && (
        <div className={styles.actions}>
          <button type="button" disabled={disabled} onClick={() => onApplicability(doc)}>{t(doc.applicable ? '標示為不適用' : '改為適用')}</button>
        </div>
      )}
    </article>
  );
}

export function WorkerProgressView({ data, message, busy, t, onReview, onApplicability, onUpload, onSaveStep, onStatus }) {
  const { worker, documents, steps, cases, health, viewer } = data;
  const required = documents.filter(doc => doc.required && doc.applicable);
  const counts = {
    approved: required.filter(doc => doc.status === 'approved').length,
    submitted: required.filter(doc => doc.status === 'submitted').length,
    returned: required.filter(doc => doc.status === 'returned').length,
    missing: required.filter(doc => doc.status === 'missing').length,
  };
  const stepOf = key => steps.find(step => step.step_key === key) || { step_key: key };
  const programSteps = steps.filter(step => !HEALTH_TRAINING_STEP_KEYS.has(step.step_key));
  const groups = [
    ['待審核', documents.filter(doc => doc.applicable && doc.status === 'submitted')],
    ['退件待修正', documents.filter(doc => doc.applicable && doc.status === 'returned')],
    ['待收件', documents.filter(doc => doc.applicable && doc.status === 'missing')],
  ];
  const approved = documents.filter(doc => doc.applicable && doc.status === 'approved');
  const notApplicable = documents.filter(doc => !doc.applicable);
  const cardProps = { viewer, t, disabled: busy, onReview, onApplicability, onUpload };
  return (
    <div className={styles.page}>
      <nav className={styles.topBar}>
        <a href="/hr" className={styles.back}>← {t('返回管理介面')}</a>
        <HrLanguageTools />
      </nav>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{t('工作者文件與進度')}</span>
          <h1>{worker.name}</h1>
          <p>{[worker.reference_no, worker.nationality, t(worker.job_preference), worker.agency_name].filter(Boolean).join(' · ')}</p>
        </div>
        <span className={`${styles.pill} ${worker.status === 'active' ? styles.tone_ok : styles.tone_muted}`}>{t(worker.status === 'active' ? '啟用' : '停用')}</span>
      </header>
      <div className={styles.summary} aria-label={t('文件摘要')}>
        <div><strong>{counts.approved}/{required.length}</strong><span>{t('必要文件已合格')}</span></div>
        <div><strong>{counts.submitted}</strong><span>{t('待審核')}</span></div>
        <div><strong>{counts.returned}</strong><span>{t('退件待修正')}</span></div>
        <div><strong>{counts.missing}</strong><span>{t('待收件')}</span></div>
      </div>
      {message && <p className={message.type === 'error' ? styles.error : styles.success} role="status">{t(message.text)}</p>}

      <section id="documents" className={styles.section}>
        <h2>{t('文件審核')}</h2>
        {documents.length === 0 && <p className={styles.empty}>{t('目前沒有必要文件項目。')}</p>}
        {groups.map(([title, list]) => list.length > 0 && (
          <div key={title} className={styles.group}>
            <h3>{t(title)} <small>{list.length}</small></h3>
            {list.map(doc => <DocumentCard key={doc.id} doc={doc} {...cardProps} />)}
          </div>
        ))}
        {approved.length > 0 && (
          <details className={styles.group}>
            <summary>{t('已合格')} <small>{approved.length}</small></summary>
            {approved.map(doc => <DocumentCard key={doc.id} doc={doc} {...cardProps} />)}
          </details>
        )}
        {notApplicable.length > 0 && (
          <details className={styles.group}>
            <summary>{t('不適用')} <small>{notApplicable.length}</small></summary>
            {notApplicable.map(doc => <DocumentCard key={doc.id} doc={doc} {...cardProps} />)}
          </details>
        )}
      </section>

      <section id="progress" className={styles.section}>
        <h2>{t('進度安排')}</h2>
        <p className={styles.hint}>{t('這裡的進度屬於工作者本人，尚未有案件也可以先安排；已有案件時會同步更新案件的申請程序。')}</p>
        <div className={styles.twoColumns}>
          <HealthCard kind="medical" title="體檢" status={health.medical_status} gateClosed={health.gate_closed} step={stepOf('medical')} t={t} disabled={busy} onStatus={onStatus} onSaveStep={onSaveStep} />
          <HealthCard kind="training" title="訓練" status={health.training_status} gateClosed={health.gate_closed} step={stepOf('training')} t={t} disabled={busy} onStatus={onStatus} onSaveStep={onSaveStep} />
        </div>
        <div className={styles.group}>
          <h3>{t('赴台申請程序')}</h3>
          {programSteps.map(step => (
            <div key={step.step_key} className={styles.stepRow}>
              <strong>{t(step.label)}</strong>
              <StepForm key={step.updated_at || 'new'} step={step} t={t} disabled={busy} onSave={onSaveStep} />
            </div>
          ))}
        </div>
      </section>

      {cases.length > 0 && (
        <section id="cases" className={styles.section}>
          <h2>{t('案件中的狀態')}</h2>
          <p className={styles.hint}>{t('案件的體檢與訓練狀態由台灣仲介或管理者維護，這裡僅供參考。')}</p>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>{t('案件編號')}</th><th>{t('雇主')}</th><th>{t('階段')}</th><th>{t('體檢')}</th><th>{t('訓練')}</th></tr></thead>
              <tbody>
                {cases.map(item => (
                  <tr key={item.id}>
                    <td>{item.case_number}</td><td>{item.employer_name}</td>
                    <td>{t(CASE_STAGE_LABELS[item.stage] || item.stage || '—')}</td>
                    <td>{t(STATUS_LABELS.medical[item.medical_status] || item.medical_status || '—')}</td>
                    <td>{t(STATUS_LABELS.training[item.training_status] || item.training_status || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default function HrWorkerProgress({ workerId }) {
  const { lang } = useLanguage();
  const t = useCallback(text => progressText(text, lang), [lang]);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/hr/agency-workers/${workerId}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || '無法讀取工作者的文件與進度，請稍後再試。');
      setData(body);
      setLoadError('');
    } catch (error) { setLoadError(error.message); }
  }, [workerId]);

  useEffect(() => { void load(); }, [load]);

  async function send(url, options, successText, fallbackError) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(url, options);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || fallbackError);
      await load();
      setMessage({ type: 'success', text: successText });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  const patchJson = body => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const onReview = (doc, decision, reason) => send('/api/hr', patchJson({ type: 'review', submissionId: doc.latest_submission_id, decision, reason }),
    decision === 'returned' ? '已退回文件並通知工作者補件。' : '文件已核准。', '文件審核失敗');
  const onApplicability = doc => send('/api/hr', patchJson({ type: 'requirement-applicability', requirementId: doc.id, applicable: !doc.applicable }),
    '文件適用狀態已更新。', '更新文件適用狀態失敗');
  const onUpload = (event, doc) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set('requirementId', String(doc.id));
    event.currentTarget.reset();
    return send('/api/hr/documents', { method: 'POST', body: form }, '文件已上傳，已送交審核。', '文件上傳失敗');
  };
  const onSaveStep = (event, step) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return send(`/api/hr/agency-workers/${workerId}`, patchJson({
      type: 'step', stepKey: step.step_key, startedOn: form.get('startedOn') || '', completedOn: form.get('completedOn') || '', note: form.get('note') || '',
    }), '進度已儲存。', '儲存失敗，請稍後再試。');
  };
  const onStatus = (kind, status) => send(`/api/hr/agency-workers/${workerId}`, patchJson({ type: 'status', workflowType: kind, status }),
    '體檢與訓練安排已更新。', '儲存失敗，請稍後再試。');

  if (loadError) return <main className={styles.page}><p className={styles.error} role="alert">{t(loadError)}</p><a href="/hr" className={styles.back}>← {t('返回管理介面')}</a></main>;
  if (!data) return <main className={styles.page}><p className={styles.hint}>{t('載入中…')}</p></main>;
  return <main><WorkerProgressView data={data} message={message} busy={busy} t={t} onReview={onReview} onApplicability={onApplicability} onUpload={onUpload} onSaveStep={onSaveStep} onStatus={onStatus} /></main>;
}
