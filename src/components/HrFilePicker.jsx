"use client";

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './HrFilePicker.module.css';
import { pickLang } from '@/lib/language';

// name／required 讓它可以直接放進 <form> 用 FormData 送出；onChange 可省略。
export default function HrFilePicker({ accept, onChange, disabled = false, buttonClassName = '', hasValue = false, name, required = false }) {
  const { lang } = useLanguage();
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);
  const chooseFile = pickLang(lang, '選擇檔案', 'Choose file');

  // 表單 reset()（例如上傳完成後）時，檔名顯示也要一起清掉。
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return undefined;
    const clear = () => setFileName('');
    form.addEventListener('reset', clear);
    return () => form.removeEventListener('reset', clear);
  }, []);

  return <span className={styles.filePicker}>
    <span className={`${styles.fileButton}${disabled ? ` ${styles.disabled}` : ''}`}><span className={buttonClassName || styles.defaultButton}>{chooseFile}</span><input ref={inputRef} className={styles.input} type="file" name={name} required={required} accept={accept} disabled={disabled} aria-label={chooseFile} onChange={event => {
      setFileName(event.currentTarget.files?.[0]?.name || '');
      onChange?.(event);
    }}/></span>
    <span className={styles.fileName}>{fileName || (hasValue ? (pickLang(lang, '已載入照片', 'Photo loaded')) : pickLang(lang, '未選擇檔案', 'No file chosen'))}</span>
  </span>;
}
