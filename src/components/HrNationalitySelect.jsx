"use client";

import { ALL_NATIONALITIES, MIDDLE_EAST_COUNTRIES, MIDDLE_EAST_HEADING, NATIONALITY_OPTIONS, normalizeNationality } from '@/lib/hr-nationalities';

// 工作者「國籍」下拉選單。value 是資料庫目前的文字；onChange 收到選到的選項值（字串）。
// 若資料庫裡是不在清單中的舊值（自由輸入的文字），會多顯示一個該值的選項，不會因為開啟表單而遺失；
// 只有使用者真的改選時才會變更。選項文字交給網站既有的翻譯機制（NATIONALITY_EN 已掛進 translateHrText）。
export default function HrNationalitySelect({ value = '', onChange, label = '國籍', disabled = false }) {
  const raw = String(value ?? '');
  const normalized = normalizeNationality(raw);
  const inList = !normalized || ALL_NATIONALITIES.includes(normalized);
  return (
    <label>{label}
      <select value={inList ? normalized : raw} disabled={disabled} onChange={event => onChange?.(event.target.value)}>
        <option value="">請選擇</option>
        {!inList && <option value={raw}>{raw}</option>}
        {NATIONALITY_OPTIONS.map(name => <option key={name} value={name}>{name}</option>)}
        <option value="__middle_east_heading" disabled>{MIDDLE_EAST_HEADING}</option>
        {MIDDLE_EAST_COUNTRIES.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  );
}
