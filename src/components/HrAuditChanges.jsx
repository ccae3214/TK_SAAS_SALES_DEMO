"use client";

import { changeRows } from '@/lib/hr-audit-snapshot';
import styles from './HrAuditChanges.module.css';

// 操作紀錄的「改之前 → 改之後」明細（系統管理員與仲介操作紀錄共用）。沒有前後資料的舊紀錄不顯示。
const FIELD_LABELS = {
  name: ['名稱', 'Name'], display_name: ['顯示名稱', 'Display name'], email: ['Email', 'Email'], phone: ['電話', 'Phone'],
  nationality: ['國籍', 'Nationality'], job_preference: ['工作意向', 'Job preference'], notes: ['備註', 'Notes'], status: ['狀態', 'Status'],
  active: ['啟用', 'Active'], role: ['會員類型', 'Member type'], admin_scope: ['管理權限', 'Admin scope'], deleted_at: ['刪除時間', 'Deleted at'],
  requested_role: ['申請類型', 'Requested type'], requested_agency_id: ['申請仲介編號', 'Requested agency ID'],
  worker_id: ['綁定工作者編號', 'Linked worker ID'], employer_id: ['綁定雇主編號', 'Linked employer ID'], agency_id: ['所屬仲介編號', 'Agency ID'],
  training_center_id: ['所屬訓練中心編號', 'Training center ID'], last_worker_id: ['先前的工作者編號', 'Previous worker ID'],
  last_employer_id: ['先前的雇主編號', 'Previous employer ID'], contact_name: ['聯絡人', 'Contact'], address: ['地址', 'Address'],
  employer_type: ['雇主類型', 'Employer type'], agency_type: ['仲介類型', 'Agency type'], country: ['國家', 'Country'],
  case_number: ['案件編號', 'Case number'], stage: ['階段', 'Stage'], job_type: ['職類', 'Job type'], expected_start_date: ['預計開始日', 'Expected start'],
  medical_status: ['體檢狀態', 'Medical status'], training_status: ['訓練狀態', 'Training status'], assigned_member_id: ['負責人編號', 'Assignee ID'],
  resume_profile: ['履歷', 'Resume'], employer_profile: ['雇主補充資料', 'Employer profile'],
};

const COPY = {
  zh: { toggle: '查看變更內容', field: '欄位', before: '改之前', after: '改之後', empty: '（空白）' },
  en: { toggle: 'Show changes', field: 'Field', before: 'Before', after: 'After', empty: '(empty)' },
};

function labelOf(field, lang) {
  const [head, sub] = field.split('.');
  const base = FIELD_LABELS[head]?.[lang === 'zh' ? 0 : 1] || head;
  return sub ? `${base}．${sub}` : base;
}

function show(value, t) {
  if (value === null || value === undefined || value === '') return <span className={styles.empty}>{t.empty}</span>;
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function HrAuditChanges({ before, after, lang = 'zh' }) {
  if (!before && !after) return null;
  const rows = changeRows(before, after);
  if (!rows.length) return null;
  const t = COPY[lang === 'zh' ? 'zh' : 'en'];
  return <details className={styles.changes}>
    <summary>{t.toggle}（{rows.length}）</summary>
    <div className={styles.scroll}>
      <table>
        <thead><tr><th scope="col">{t.field}</th><th scope="col">{t.before}</th><th scope="col">{t.after}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.field}>
          <th scope="row">{labelOf(row.field, lang)}</th>
          <td className={styles.before}>{show(row.before, t)}</td>
          <td className={styles.after}>{show(row.after, t)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </details>;
}
