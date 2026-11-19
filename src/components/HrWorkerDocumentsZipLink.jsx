"use client";

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { zipText } from '@/lib/hr-worker-documents-zip-text';

// 已配對到雇主的工作者：一次下載「已審核通過」的全部文件（ZIP）。
// 雇主與仲介入境、送件時使用；權限與是否有文件由 /api/hr/workers/[id]/documents-zip 驗證，
// 失敗時（沒有已核准文件、無權限…）把原因顯示在按鈕旁，而不是下載一個壞掉的檔案。
export default function HrWorkerDocumentsZipLink({ workerId, className = 'table-action' }) {
  const { lang } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/hr/workers/${workerId}/documents-zip`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || '無法產生文件壓縮檔，請稍後再試。');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      let name = 'approved-documents.zip';
      if (encoded) { try { name = decodeURIComponent(encoded[1]); } catch { /* 用預設檔名 */ } }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className={className} disabled={busy} onClick={() => void download()}>{zipText(busy ? '打包中…' : '打包下載已核准文件', lang)}</button>
    {error && <small role="alert" style={{ display: 'block', color: '#b42318' }}>{zipText(error, lang)}</small>}
  </>;
}
