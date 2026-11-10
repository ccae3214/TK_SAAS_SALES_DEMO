"use client";

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './HrFilePicker.module.css';

export default function HrFilePicker({ accept, onChange, disabled = false, buttonClassName = '', hasValue = false }) {
  const { lang } = useLanguage();
  const [fileName, setFileName] = useState('');
  const chooseFile = lang === 'en' ? 'Choose file' : '選擇檔案';

  return <span className={styles.filePicker}>
    <span className={`${styles.fileButton}${disabled ? ` ${styles.disabled}` : ''}`}><span className={buttonClassName || styles.defaultButton}>{chooseFile}</span><input className={styles.input} type="file" accept={accept} disabled={disabled} aria-label={chooseFile} onChange={event => {
      setFileName(event.currentTarget.files?.[0]?.name || '');
      onChange(event);
    }}/></span>
    <span className={styles.fileName}>{fileName || (hasValue ? (lang === 'en' ? 'Photo loaded' : '已載入照片') : lang === 'en' ? 'No file chosen' : '未選擇檔案')}</span>
  </span>;
}
