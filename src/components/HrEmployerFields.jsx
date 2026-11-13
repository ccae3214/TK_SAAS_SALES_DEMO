"use client";

// 雇主補充資料、家庭成員、被照顧人的共用表單欄位與唯讀摘要。
// 會員工作區（HrMemberPortal）與管理端（HrManagement）共用；版面差異用 cls 傳入。
// 顯示文字都是中文，英文由 hr-translations-employer.js 依文字節點自動對照。

import {
  CARE_RELATION_OPTIONS, DORM_OPTIONS, EMPTY_CARE_RECIPIENT, FAMILY_RELATION_OPTIONS, GENDER_OPTIONS,
  HEALTH_CONDITION_OPTIONS, MAX_FAMILY_MEMBERS, cleanEmployerProfile, isHomeEmployer,
} from '@/lib/hr-employer-profile';

// 會員工作區的預設樣式。管理端傳入自己的 CSS module 類別。
const PORTAL_CLASSES = { field: '', button: '', actions: 'candidate-actions' };
const WIDE = { gridColumn: '1 / -1' };
const FIELDSET_STYLE = { ...WIDE, margin: 0, padding: 12, border: '1px solid #d8dee4', borderRadius: 10, minWidth: 0, display: 'grid', gap: 10 };
const ROW_STYLE = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, alignItems: 'end' };
const CHECK_STYLE = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 };
const CHECK_INPUT_STYLE = { width: 'auto', margin: 0 };
const HINT_STYLE = { ...WIDE, margin: 0, fontSize: 12.5, opacity: 0.75 };

const labelOf = (options, key) => options.find(([value]) => value === key)?.[1] || '';

function TextInput({ cls, label, value, onChange, wide, ...rest }) {
  return <label className={cls.field || undefined} style={wide ? WIDE : undefined}>{label}<input value={value ?? ''} onChange={event => onChange(event.target.value)} {...rest} /></label>;
}

function SelectInput({ cls, label, value, onChange, options, wide, ...rest }) {
  return <label className={cls.field || undefined} style={wide ? WIDE : undefined}>{label}<select value={value ?? ''} onChange={event => onChange(event.target.value)} {...rest}><option value="">請選擇</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function CheckInput({ label, checked, onChange }) {
  return <label style={CHECK_STYLE}><input type="checkbox" style={CHECK_INPUT_STYLE} checked={checked} onChange={event => onChange(event.target.checked)} />{label}</label>;
}

function FamilyMembersEditor({ value, set, cls }) {
  const members = value.familyMembers || [];
  const update = (index, patch) => set({ familyMembers: members.map((member, i) => (i === index ? { ...member, ...patch } : member)) });
  return <fieldset style={FIELDSET_STYLE}>
    <legend>家庭成員</legend>
    <p style={{ margin: 0, fontSize: 12.5, opacity: 0.75 }}>家庭看護與家庭幫傭雇主必填，請列出同住或需要照顧的家人。</p>
    <CheckInput label="無其他同住家人（獨居）" checked={Boolean(value.livesAlone)} onChange={livesAlone => set({ livesAlone, familyMembers: livesAlone ? [] : members })} />
    {!value.livesAlone && <>
      {members.map((member, index) => <div style={ROW_STYLE} key={index}>
        <SelectInput cls={cls} label="關係" value={member.relation} options={FAMILY_RELATION_OPTIONS} required onChange={relation => update(index, { relation })} />
        <TextInput cls={cls} label="年齡" type="number" min="0" max="120" inputMode="numeric" required value={member.age} onChange={age => update(index, { age })} />
        <SelectInput cls={cls} label="性別" value={member.gender} options={GENDER_OPTIONS} required onChange={gender => update(index, { gender })} />
        <CheckInput label="同住" checked={member.livesTogether !== false} onChange={livesTogether => update(index, { livesTogether })} />
        <div className={cls.actions}><button type="button" className={cls.button} onClick={() => set({ familyMembers: members.filter((_, i) => i !== index) })}>移除</button></div>
      </div>)}
      {members.length < MAX_FAMILY_MEMBERS && <div className={cls.actions}><button type="button" className={cls.button} onClick={() => set({ familyMembers: [...members, { relation: '', age: '', gender: '', livesTogether: true }] })}>新增家庭成員</button></div>}
    </>}
  </fieldset>;
}

// 雇主補充資料：性別、年齡、家庭成員（家庭類）、公司資料（工廠）。
// 電話與地址是雇主資料表原有欄位，仍由呼叫端的表單負責。放在 CSS grid 容器內使用。
export function EmployerProfileFields({ employerType, value, onChange, cls = PORTAL_CLASSES }) {
  const profile = value || {};
  const set = patch => onChange({ ...profile, ...patch });
  const home = isHomeEmployer(employerType);
  return <>
    <SelectInput cls={cls} label="性別" value={profile.gender} options={GENDER_OPTIONS} required={home} onChange={gender => set({ gender })} />
    <TextInput cls={cls} label="年齡" type="number" min="18" max="120" inputMode="numeric" required={home} value={profile.age} onChange={age => set({ age })} />
    {!home && <p style={HINT_STYLE}>公司或機構請填負責人的性別與年齡。</p>}
    {home && <FamilyMembersEditor value={profile} set={set} cls={cls} />}
    {employerType === 'factory' && <>
      <TextInput cls={cls} label="統一編號" required maxLength={20} value={profile.companyRegNo} onChange={companyRegNo => set({ companyRegNo })} />
      <TextInput cls={cls} label="負責人姓名" required maxLength={120} value={profile.responsiblePerson} onChange={responsiblePerson => set({ responsiblePerson })} />
      <TextInput cls={cls} label="工廠登記證號" maxLength={40} value={profile.factoryRegNo} onChange={factoryRegNo => set({ factoryRegNo })} />
      <TextInput cls={cls} label="工作地點地址" maxLength={300} value={profile.workAddress} onChange={workAddress => set({ workAddress })} />
      <SelectInput cls={cls} label="是否提供宿舍" value={profile.dormProvided} options={DORM_OPTIONS} onChange={dormProvided => set({ dormProvided })} />
      {profile.dormProvided === 'yes' && <TextInput cls={cls} label="宿舍地址" maxLength={300} value={profile.dormAddress} onChange={dormAddress => set({ dormAddress })} />}
    </>}
  </>;
}

// 工作類型為家庭看護、家庭幫傭時，需求單要填的被照顧人資料。放在 CSS grid 容器內使用。
export function CareRecipientFields({ value, onChange, cls = PORTAL_CLASSES }) {
  const care = { ...EMPTY_CARE_RECIPIENT, ...(value || {}) };
  const set = patch => onChange({ ...care, ...patch });
  // 「身體健康」與其他狀況互斥。
  function toggle(key, checked) {
    let next = new Set(care.conditions);
    if (!checked) next.delete(key);
    else if (key === 'healthy') next = new Set(['healthy']);
    else { next.delete('healthy'); next.add(key); }
    set({ conditions: [...next] });
  }
  return <fieldset style={FIELDSET_STYLE}>
    <legend>被照顧人</legend>
    <p style={{ margin: 0, fontSize: 12.5, opacity: 0.75 }}>為保護隱私，不需填寫被照顧人的全名或病歷資料；這些資訊會提供給負責的仲介作為配工參考。</p>
    <div style={ROW_STYLE}>
      <SelectInput cls={cls} label="被照顧人與雇主的關係" value={care.relation} options={CARE_RELATION_OPTIONS} required onChange={relation => set({ relation })} />
      <TextInput cls={cls} label="被照顧人年紀" type="number" min="0" max="120" inputMode="numeric" required value={care.age} onChange={age => set({ age })} />
      <SelectInput cls={cls} label="被照顧人性別" value={care.gender} options={GENDER_OPTIONS} required onChange={gender => set({ gender })} />
    </div>
    <fieldset style={{ ...FIELDSET_STYLE, gridColumn: 'auto' }}>
      <legend>被照顧人身體狀況（可複選）</legend>
      {HEALTH_CONDITION_OPTIONS.map(([key, text]) => <CheckInput key={key} label={text} checked={care.conditions.includes(key)} onChange={checked => toggle(key, checked)} />)}
    </fieldset>
    <label className={cls.field || undefined}>診斷或身體狀況補充說明<textarea rows="3" maxLength={500} value={care.diagnosis} onChange={event => set({ diagnosis: event.target.value })} /></label>
  </fieldset>;
}

// 需求單上的被照顧人摘要（唯讀）。每個片段各自是一個文字節點，英文才翻得到。
export function CareRecipientSummary({ value }) {
  const care = value && typeof value === 'object' ? value : {};
  const conditions = Array.isArray(care.conditions) ? care.conditions : [];
  const hasAge = care.age !== '' && care.age !== undefined && care.age !== null;
  if (!care.relation && !hasAge && !care.gender && conditions.length === 0) return null;
  return <div style={{ margin: '8px 0', fontSize: 13.5 }}>
    <strong>被照顧人</strong>
    <p style={{ margin: '4px 0' }}>
      {care.relation && <span>{labelOf(CARE_RELATION_OPTIONS, care.relation)}</span>}
      {hasAge && <span> · {care.age} 歲</span>}
      {care.gender && <span> · {labelOf(GENDER_OPTIONS, care.gender)}</span>}
    </p>
    {conditions.length > 0 && <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{conditions.map(key => <li key={key}>{labelOf(HEALTH_CONDITION_OPTIONS, key)}</li>)}</ul>}
    {care.diagnosis && <p style={{ margin: '4px 0' }}>{care.diagnosis}</p>}
  </div>;
}

// 「基本資料」頁的雇主欄位（放在 <dl className="workspace-basic-fields"> 裡）。
export function EmployerProfileItems({ employer }) {
  const profile = cleanEmployerProfile(employer?.employer_profile);
  const type = employer?.employer_type;
  const dash = '—';
  const members = profile.familyMembers;
  return <>
    <div><dt>電話</dt><dd>{employer?.phone || dash}</dd></div>
    <div><dt>地址</dt><dd>{employer?.address || dash}</dd></div>
    <div><dt>性別</dt><dd>{profile.gender ? labelOf(GENDER_OPTIONS, profile.gender) : dash}</dd></div>
    <div><dt>年齡</dt><dd>{profile.age ? <>{profile.age} 歲</> : dash}</dd></div>
    {isHomeEmployer(type) && <div><dt>家庭成員</dt><dd>{profile.livesAlone ? '無其他同住家人（獨居）' : members.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{members.map((member, index) => <li key={index}>
      <span>{labelOf(FAMILY_RELATION_OPTIONS, member.relation)}</span><span> · {member.age} 歲</span><span> · {labelOf(GENDER_OPTIONS, member.gender)}</span>{member.livesTogether && <><span> · </span><span>同住</span></>}
    </li>)}</ul> : dash}</dd></div>}
    {type === 'factory' && <>
      <div><dt>統一編號</dt><dd>{profile.companyRegNo || dash}</dd></div>
      <div><dt>負責人姓名</dt><dd>{profile.responsiblePerson || dash}</dd></div>
      <div><dt>工廠登記證號</dt><dd>{profile.factoryRegNo || dash}</dd></div>
      <div><dt>工作地點地址</dt><dd>{profile.workAddress || dash}</dd></div>
      <div><dt>是否提供宿舍</dt><dd>{profile.dormProvided ? labelOf(DORM_OPTIONS, profile.dormProvided) : dash}{profile.dormProvided === 'yes' && profile.dormAddress ? ` · ${profile.dormAddress}` : ''}</dd></div>
    </>}
  </>;
}
