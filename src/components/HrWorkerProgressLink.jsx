"use client";

import { useLanguage } from '@/context/LanguageContext';
import { progressText } from '@/lib/hr-worker-progress-text';

// 放在仲介端「所屬工作者」列表，連到單一工作者的「文件審核＋進度安排」頁。
export default function HrWorkerProgressLink({ workerId, className = 'table-action' }) {
  const { lang } = useLanguage();
  return <a className={className} href={`/hr/workers/${workerId}`}>{progressText('審文件／排進度', lang)}</a>;
}
