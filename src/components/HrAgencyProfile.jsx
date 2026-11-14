"use client";

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import HrFilePicker from '@/components/HrFilePicker';
import { AGENCY_CERTIFICATE_TYPES, isCertificateExpired } from '@/lib/hr-agency-profile';
import styles from './HrAgencyProfile.module.css';

// 仲介機構自己的基本資料與仲介證書。仲介管理者可以編輯與上傳；一般仲介成員只能查看。
// 版面沿用會員頁的卡片（hr-member-card），按鈕與輸入框樣式由 .hr-member-shell 提供。
const COPY = {
  zh: {
    profileTitle: '仲介機構資料', profileLead: '這些資料屬於整個仲介機構。名稱與國家／地區會顯示給合作的雇主與仲介；聯絡人、電話、Email、地址與許可字號只有貴機構成員與系統管理者看得到。',
    name: '機構名稱', country: '國家／地區', contactPerson: '聯絡人', phone: '電話', email: 'Email', address: '地址', licenseNumber: '許可字號',
    type: '機構類型', typeTaiwan: '台灣仲介', typePhilippines: '菲律賓仲介', save: '儲存機構資料', saving: '儲存中…', saved: '機構資料已儲存。',
    viewOnly: '只有仲介管理者可以編輯機構資料與證書；您可以在這裡查看。需要修改請聯絡貴機構的仲介管理者。', loading: '讀取中…',
    certTitle: '仲介證書', certLead: '上傳仲介許可證、公司／營業登記證等文件（PDF、JPG 或 PNG，單檔 10 MB 以內）。檔案加密保存，只有貴機構成員與系統管理者可以查看與下載。',
    certNone: '尚未上傳任何證書。', certType: '證書類型', expiresOn: '到期日（選填）', note: '備註（選填）', notePlaceholder: '例如：許可字號、核發日期',
    upload: '上傳證書', uploading: '上傳中…', uploaded: '證書已上傳。', deleted: '證書已刪除。', preview: '預覽', download: '下載', remove: '刪除',
    confirm: name => `確定刪除「${name}」？此操作無法復原。`, expires: '到期日', expired: '已過期', by: '上傳者', pickFirst: '請先選擇要上傳的檔案。',
    types: { license: '仲介許可證', registration: '公司／營業登記證', other: '其他證書' },
    failRead: '無法讀取仲介機構資料。', failSave: '儲存失敗', failUpload: '上傳失敗', failDelete: '刪除失敗',
    errors: {
      name_required: '請填寫仲介機構名稱。', phone_invalid: '電話只能包含數字、空格與 + - ( ) # . 符號。', email_invalid: 'Email 格式不正確。',
      name_taken: '已經有同類型、同名稱的仲介機構，請換一個名稱。', forbidden: '只有仲介管理者可以編輯機構資料與證書。', not_found: '找不到仲介機構。',
      bad_expiry: '到期日格式不正確。', bad_format: '目前只接受 PDF、JPG 與 PNG 文件。', bad_size: '文件大小需介於 1 byte 到 10 MB。',
      limit: '每個仲介機構最多保存 30 份證書，請先刪除不需要的舊文件。', no_key: '文件加密尚未設定，請聯絡系統管理者。', no_file: '請先選擇要上傳的檔案。',
    },
  },
  en: {
    profileTitle: 'Agency profile', profileLead: 'This information belongs to the whole agency. The name and country/region are shown to partner employers and agencies; the contact person, phone, email, address and license number are visible only to your agency’s members and system administrators.',
    name: 'Agency name', country: 'Country / region', contactPerson: 'Contact person', phone: 'Phone', email: 'Email', address: 'Address', licenseNumber: 'License number',
    type: 'Agency type', typeTaiwan: 'Taiwan agency', typePhilippines: 'Philippine agency', save: 'Save agency profile', saving: 'Saving…', saved: 'Agency profile saved.',
    viewOnly: 'Only agency administrators can edit the agency profile and certificates; you can view them here. Please ask your agency administrator to make changes.', loading: 'Loading…',
    certTitle: 'Agency certificates', certLead: 'Upload the agency license, business registration certificate and similar documents (PDF, JPG or PNG, up to 10 MB per file). Files are stored encrypted and can be viewed and downloaded only by your agency’s members and system administrators.',
    certNone: 'No certificates have been uploaded yet.', certType: 'Certificate type', expiresOn: 'Expiry date (optional)', note: 'Note (optional)', notePlaceholder: 'For example: license number or issue date',
    upload: 'Upload certificate', uploading: 'Uploading…', uploaded: 'Certificate uploaded.', deleted: 'Certificate deleted.', preview: 'Preview', download: 'Download', remove: 'Delete',
    confirm: name => `Delete “${name}”? This cannot be undone.`, expires: 'Expires', expired: 'Expired', by: 'Uploaded by', pickFirst: 'Please choose a file to upload first.',
    types: { license: 'Agency license', registration: 'Business registration certificate', other: 'Other certificate' },
    failRead: 'Unable to load the agency profile.', failSave: 'Save failed', failUpload: 'Upload failed', failDelete: 'Delete failed',
    errors: {
      name_required: 'Please enter the agency name.', phone_invalid: 'The phone number may only contain digits, spaces and the symbols + - ( ) # .', email_invalid: 'The email address is not valid.',
      name_taken: 'An agency of the same type and name already exists. Please choose another name.', forbidden: 'Only agency administrators can edit the agency profile and certificates.', not_found: 'Agency not found.',
      bad_expiry: 'The expiry date is not valid.', bad_format: 'Only PDF, JPG and PNG files are accepted.', bad_size: 'The file must be between 1 byte and 10 MB.',
      limit: 'Each agency can keep up to 30 certificates. Please delete old files you no longer need.', no_key: 'File encryption is not set up yet. Please contact a system administrator.', no_file: 'Please choose a file to upload first.',
    },
  },
};

const sizeText = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const toForm = ({ agency, profile }) => ({
  name: agency.name || '', country: agency.country || '', contactPerson: profile.contact_person || '', phone: profile.phone || '',
  email: profile.email || '', address: profile.address || '', licenseNumber: profile.license_number || '',
});
const EMPTY_DRAFT = { certType: 'license', expiresOn: '', note: '', file: null, pickerKey: 0 };

export default function HrAgencyProfile({ onSaved }) {
  const { lang } = useLanguage();
  const t = COPY[lang === 'en' ? 'en' : 'zh'];
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const errorOf = json => t.errors[json?.code] || json?.error;

  // resetForm：只有第一次讀取與儲存成功後才用伺服器資料覆蓋表單，避免上傳證書時蓋掉還沒儲存的修改。
  const load = useCallback(async resetForm => {
    try {
      const response = await fetch('/api/hr/agency-profile', { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorOf(json) || t.failRead);
      setData(json);
      if (resetForm) setForm(toForm(json));
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useEffect(() => { void load(true); }, [load]);

  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const canManage = !!data?.canManage;

  async function save(event) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    try {
      const response = await fetch('/api/hr/agency-profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorOf(json) || t.failSave);
      setData(json); setForm(toForm(json));
      setMessage({ type: 'success', text: t.saved });
      if (onSaved) await onSaved();
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  }

  async function upload() {
    if (!draft.file) { setMessage({ type: 'error', text: t.pickFirst }); return; }
    setBusyId('upload'); setMessage(null);
    try {
      const body = new FormData();
      body.set('certType', draft.certType); body.set('expiresOn', draft.expiresOn); body.set('note', draft.note); body.set('file', draft.file);
      const response = await fetch('/api/hr/agency-certificates', { method: 'POST', body });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorOf(json) || t.failUpload);
      setDraft(current => ({ ...EMPTY_DRAFT, certType: current.certType, pickerKey: current.pickerKey + 1 }));
      await load(false);
      setMessage({ type: 'success', text: t.uploaded });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(null); }
  }

  async function remove(cert) {
    if (!window.confirm(t.confirm(cert.original_filename))) return;
    setBusyId(`d${cert.id}`); setMessage(null);
    try {
      const response = await fetch(`/api/hr/agency-certificates?id=${encodeURIComponent(cert.id)}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorOf(json) || t.failDelete);
      await load(false);
      setMessage({ type: 'success', text: t.deleted });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(null); }
  }

  const feedback = message && <p className={message.type === 'error' ? 'hr-request-error' : 'hr-request-success'} style={{ maxWidth: 'none', margin: '0 0 16px' }} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>;
  if (!data || !form) return <section className="hr-member-card"><h2>{t.profileTitle}</h2>{message ? feedback : <p>{t.loading}</p>}</section>;

  const typeText = data.agency.agency_type === 'philippines' ? t.typePhilippines : t.typeTaiwan;
  const field = (key, label, extra = {}) => <label className={`${styles.field}${extra.wide ? ` ${styles.wide}` : ''}`}><span>{label}</span>
    <input type={extra.type || 'text'} value={form[key]} maxLength={extra.max} disabled={!canManage || saving} onChange={event => setField(key, event.target.value)} /></label>;

  return <>
    <section className="hr-member-card">
      <h2>{t.profileTitle}</h2>
      <p>{t.profileLead}</p>
      {!canManage && <p className={styles.notice}>{t.viewOnly}</p>}
      {feedback}
      <form onSubmit={save}>
        <div className={styles.grid}>
          {field('name', t.name, { max: 160 })}
          <label className={styles.field}><span>{t.type}</span><input type="text" value={typeText} disabled readOnly /></label>
          {field('country', t.country, { max: 80 })}
          {field('licenseNumber', t.licenseNumber, { max: 80 })}
          {field('contactPerson', t.contactPerson, { max: 80 })}
          {field('phone', t.phone, { max: 40, type: 'tel' })}
          {field('email', t.email, { max: 254, type: 'email' })}
          {field('address', t.address, { max: 300, wide: true })}
        </div>
        {canManage && <div className={styles.formActions}><button type="submit" disabled={saving || !form.name.trim()}>{saving ? t.saving : t.save}</button></div>}
      </form>
    </section>

    <section className="hr-member-card">
      <h2>{t.certTitle}</h2>
      <p>{t.certLead}</p>
      {data.certificates.length ? <ul className={styles.list}>{data.certificates.map(cert => {
        const previewable = /^(application\/pdf|image\/(png|jpeg))$/i.test(cert.content_type);
        const expired = isCertificateExpired(cert.expires_on);
        const typeLabel = AGENCY_CERTIFICATE_TYPES[cert.cert_type] ? t.types[cert.cert_type] : t.types.other;
        return <li className={styles.item} key={cert.id}>
          <span className={styles.itemMain}>
            <strong><span className={styles.badge}>{typeLabel}</span>{cert.original_filename}{expired && <span className={`${styles.badge} ${styles.badgeWarn}`}>{t.expired}</span>}</strong>
            <small>{sizeText(cert.size_bytes)} · {new Date(cert.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW')}{cert.expires_on ? ` · ${t.expires}：${cert.expires_on}` : ''}{cert.uploaded_by ? ` · ${t.by}：${cert.uploaded_by}` : ''}</small>
            {cert.note && <small>{cert.note}</small>}
          </span>
          <span className={styles.actions}>
            {previewable && <a href={`/api/hr/agency-certificates/${cert.id}?preview=1`} target="_blank" rel="noreferrer">{t.preview}</a>}
            <a href={`/api/hr/agency-certificates/${cert.id}`}>{t.download}</a>
            {canManage && <button type="button" className={styles.danger} disabled={busyId === `d${cert.id}`} onClick={() => void remove(cert)}>{t.remove}</button>}
          </span>
        </li>;
      })}</ul> : <p>{t.certNone}</p>}
      {canManage && <div className={styles.upload}>
        <label className={styles.field}><span>{t.certType}</span>
          <select value={draft.certType} disabled={busyId === 'upload'} onChange={event => setDraft(current => ({ ...current, certType: event.target.value }))}>
            {Object.keys(AGENCY_CERTIFICATE_TYPES).map(key => <option key={key} value={key}>{t.types[key]}</option>)}
          </select></label>
        <label className={styles.field}><span>{t.expiresOn}</span><input type="date" value={draft.expiresOn} disabled={busyId === 'upload'} onChange={event => setDraft(current => ({ ...current, expiresOn: event.target.value }))} /></label>
        <label className={`${styles.field} ${styles.wide}`}><span>{t.note}</span><input type="text" maxLength={500} placeholder={t.notePlaceholder} value={draft.note} disabled={busyId === 'upload'} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} /></label>
        <div className={`${styles.uploadRow} ${styles.wide}`}>
          <HrFilePicker key={draft.pickerKey} accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" disabled={busyId === 'upload'} onChange={event => { const file = event.currentTarget.files?.[0] || null; setDraft(current => ({ ...current, file })); }} />
          <button type="button" disabled={busyId === 'upload' || !draft.file} onClick={() => void upload()}>{busyId === 'upload' ? t.uploading : t.upload}</button>
        </div>
      </div>}
    </section>
  </>;
}
