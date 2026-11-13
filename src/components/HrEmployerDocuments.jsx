"use client";

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import HrFilePicker from '@/components/HrFilePicker';
import styles from './HrEmployerDocuments.module.css';

// 雇主文件（核准函）：雇主本人、雇主所屬的台灣仲介與系統管理者可以上傳、下載與刪除。
const COPY = {
  zh: {
    title: '雇主核准函', lead: '上傳雇主的核准函（PDF、JPG 或 PNG，單檔 10 MB 以內）。雇主、所屬台灣仲介與系統管理者都可以查看與下載。',
    loading: '讀取中…', none: '尚未上傳核准函。', note: '備註（選填）', notePlaceholder: '例如：核准日期、文號', upload: '上傳核准函', uploading: '上傳中…',
    hint: '重新取得新的核准函時，直接再上傳一份即可；舊的可以刪除。', download: '下載', preview: '預覽', remove: '刪除', badge: '核准函',
    confirm: name => `確定刪除「${name}」？此操作無法復原。`, uploaded: '已上傳核准函。', deleted: '已刪除文件。', noEmployer: '目前沒有可以上傳核准函的雇主。',
    by: '上傳者', failRead: '無法讀取雇主文件。', failUpload: '上傳失敗', failDelete: '刪除失敗', pickFirst: '請先選擇要上傳的檔案。',
  },
  en: {
    title: 'Employer approval letter', lead: 'Upload the employer’s approval letter (PDF, JPG or PNG, up to 10 MB per file). The employer, their Taiwan agency, and system administrators can view and download it.',
    loading: 'Loading…', none: 'No approval letter has been uploaded yet.', note: 'Note (optional)', notePlaceholder: 'For example: approval date or document number', upload: 'Upload approval letter', uploading: 'Uploading…',
    hint: 'When you receive a new approval letter, just upload another one; you can delete the old one.', download: 'Download', preview: 'Preview', remove: 'Delete', badge: 'Approval letter',
    confirm: name => `Delete “${name}”? This cannot be undone.`, uploaded: 'Approval letter uploaded.', deleted: 'Document deleted.', noEmployer: 'There is no employer to upload an approval letter for.',
    by: 'Uploaded by', failRead: 'Unable to load employer documents.', failUpload: 'Upload failed', failDelete: 'Delete failed', pickFirst: 'Please choose a file to upload first.',
  },
};

const sizeText = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function HrEmployerDocuments({ employers = [], embedded = false }) {
  const { lang } = useLanguage();
  const t = COPY[lang === 'en' ? 'en' : 'zh'];
  const [rows, setRows] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const ids = employers.map(item => item.id).join(',');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/hr/employer-documents', { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || t.failRead);
      setRows(json.rows || []);
    } catch (error) { setRows([]); setMessage({ type: 'error', text: error.message }); }
  }, [t.failRead]);
  useEffect(() => { void load(); }, [load, ids]);

  const draftOf = id => drafts[id] || { file: null, note: '', pickerKey: 0 };
  const setDraft = (id, patch) => setDrafts(current => ({ ...current, [id]: { ...draftOf(id), ...patch } }));

  async function upload(employer) {
    const draft = draftOf(employer.id);
    if (!draft.file) { setMessage({ type: 'error', text: t.pickFirst }); return; }
    setBusyId(employer.id); setMessage(null);
    try {
      const form = new FormData();
      form.set('employerId', String(employer.id)); form.set('docType', 'approval_letter'); form.set('note', draft.note); form.set('file', draft.file);
      const response = await fetch('/api/hr/employer-documents', { method: 'POST', body: form });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || t.failUpload);
      setDrafts(current => ({ ...current, [employer.id]: { file: null, note: '', pickerKey: draftOf(employer.id).pickerKey + 1 } }));
      await load();
      setMessage({ type: 'success', text: t.uploaded });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(null); }
  }

  async function remove(doc) {
    if (!window.confirm(t.confirm(doc.original_filename))) return;
    setBusyId(`d${doc.id}`); setMessage(null);
    try {
      const response = await fetch(`/api/hr/employer-documents?id=${encodeURIComponent(doc.id)}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || t.failDelete);
      await load();
      setMessage({ type: 'success', text: t.deleted });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(null); }
  }

  const dateOf = value => new Date(value).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW');

  return <section className={`${styles.panel} ${embedded ? styles.embedded : ''}`} aria-label={t.title}>
    {!embedded && <h2>{t.title}</h2>}
    <p className={styles.lead}>{t.lead}</p>
    {message && <p className={message.type === 'error' ? styles.error : styles.success} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    {!employers.length ? <p className={styles.empty}>{t.noEmployer}</p> : employers.map(employer => {
      const docs = (rows || []).filter(doc => Number(doc.employer_id) === Number(employer.id));
      const draft = draftOf(employer.id);
      const uploading = busyId === employer.id;
      return <div className={styles.employer} key={employer.id}>
        {(!embedded || employers.length > 1) && <h3>{employer.name}</h3>}
        {rows === null ? <p className={styles.empty}>{t.loading}</p> : docs.length ? <ul className={styles.list}>{docs.map(doc => {
          const previewable = /^(application\/pdf|image\/(png|jpeg))$/i.test(doc.content_type);
          return <li className={styles.item} key={doc.id}>
            <span className={styles.itemMain}>
              <strong><span className={styles.badge}>{t.badge}</span>{doc.original_filename}</strong>
              <small>{sizeText(doc.size_bytes)} · {dateOf(doc.created_at)}{doc.uploaded_by ? ` · ${t.by}：${doc.uploaded_by}` : ''}</small>
              {doc.note && <small>{doc.note}</small>}
            </span>
            <span className={styles.actions}>
              {previewable && <a href={`/api/hr/employer-documents/${doc.id}?preview=1`} target="_blank" rel="noreferrer">{t.preview}</a>}
              <a href={`/api/hr/employer-documents/${doc.id}`}>{t.download}</a>
              <button type="button" disabled={busyId === `d${doc.id}`} onClick={() => void remove(doc)}>{t.remove}</button>
            </span>
          </li>;
        })}</ul> : <p className={styles.empty}>{t.none}</p>}
        <div className={styles.upload}>
          <HrFilePicker key={draft.pickerKey} accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" disabled={uploading}
            onChange={event => setDraft(employer.id, { file: event.currentTarget.files?.[0] || null })} />
          <label>{t.note}<input type="text" maxLength={500} placeholder={t.notePlaceholder} value={draft.note} disabled={uploading} onChange={event => setDraft(employer.id, { note: event.target.value })} /></label>
          <button type="button" className={styles.primary} disabled={uploading || !draft.file} onClick={() => void upload(employer)}>{uploading ? t.uploading : t.upload}</button>
          <p className={styles.hint}>{t.hint}</p>
        </div>
      </div>;
    })}
  </section>;
}
