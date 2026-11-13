#!/usr/bin/env node
// 套用「雇主補充資料／被照顧人／月薪」修改。
// 用法（在專案根目錄）：
//   node scripts/apply-employer-profile.mjs --check   只檢查，不寫入
//   node scripts/apply-employer-profile.mjs           實際套用
// 只做「精確文字替換」：每個替換點必須在原檔剛好出現 1 次，任何一處對不上就整批中止、完全不寫入。
// 重複執行是安全的：已套用過的檔案會自動略過。
import fs from 'node:fs';
import path from 'node:path';

const EDITS = {
 "src/app/api/hr/route.js": [
  {
   "desc": "import",
   "find": "import { LinkedRecordError, normalizeRecordEmail, updateLinkedRecord, updateLinkedMemberProfile } from '@/lib/hr-linked-record-store';",
   "replace": "import { LinkedRecordError, normalizeRecordEmail, updateLinkedRecord, updateLinkedMemberProfile } from '@/lib/hr-linked-record-store';\nimport { cleanCareRecipient, cleanEmployerProfile, employerRecordError, jobOrderExtrasError, needsCareRecipient, parseMonthlySalary } from '@/lib/hr-employer-profile';"
  },
  {
   "desc": "schema columns",
   "find": "await pool.query('ALTER TABLE hr_job_order_agencies ADD COLUMN IF NOT EXISTS broker_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL');",
   "replace": "await pool.query('ALTER TABLE hr_job_order_agencies ADD COLUMN IF NOT EXISTS broker_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL');\n    // 雇主補充資料（性別、年齡、家庭成員、公司資料）與需求單的被照顧人、月薪。只新增欄位，不改動既有資料。\n    await pool.query(\"ALTER TABLE hr_employers ADD COLUMN IF NOT EXISTS employer_profile JSONB NOT NULL DEFAULT '{}'::jsonb\");\n    await pool.query(\"ALTER TABLE hr_job_orders ADD COLUMN IF NOT EXISTS care_recipient JSONB NOT NULL DEFAULT '{}'::jsonb\");\n    await pool.query('ALTER TABLE hr_job_orders ADD COLUMN IF NOT EXISTS monthly_salary INTEGER');"
  },
  {
   "desc": "helper",
   "find": "const validId = value => /^\\d+$/.test(String(value ?? '')) && Number(value) > 0;",
   "replace": "const validId = value => /^\\d+$/.test(String(value ?? '')) && Number(value) > 0;\n// 雇主補充資料：client 沒送 employerProfile 時回傳 { profile: null }（保留資料庫原值）；有送就驗證並整理後轉成 JSON。\nfunction employerProfileFromBody(body) {\n  if (body.employerProfile === undefined) return { profile: null };\n  const error = employerRecordError({ employerType: body.employerType, phone: clean(body.phone, 50), address: clean(body.address, 300), profile: body.employerProfile });\n  if (error) return { error };\n  return { profile: JSON.stringify(cleanEmployerProfile(body.employerProfile)) };\n}"
  },
  {
   "desc": "GET hide profile",
   "find": "const caseIds = new Set(cases.map(item => Number(item.id)));",
   "replace": "// 雇主年齡、性別與家庭成員只提供雇主本人、台灣仲介與管理者；工作者與菲律賓仲介看不到。\n    if (principal.role === 'worker' || (principal.role === 'agency' && principal.agency_type !== 'taiwan')) {\n      employers = employers.map(item => ({ ...item, employer_profile: {} }));\n    }\n    const caseIds = new Set(cases.map(item => Number(item.id)));"
  },
  {
   "desc": "POST job-order validate",
   "find": "if (agencyAssignments.some(item=>item.brokerMemberId!==null&&!validId(item.brokerMemberId))) return NextResponse.json({error:'業務資料格式不正確。'},{status:400});",
   "replace": "const orderSalary=parseMonthlySalary(body.monthlySalary);\n      const orderCare=needsCareRecipient(jobType)?cleanCareRecipient(body.careRecipient):{};\n      const orderExtrasError=jobOrderExtrasError({jobType,monthlySalary:body.monthlySalary,careRecipient:orderCare});\n      if(orderExtrasError)return NextResponse.json({error:orderExtrasError},{status:400});\n      if (agencyAssignments.some(item=>item.brokerMemberId!==null&&!validId(item.brokerMemberId))) return NextResponse.json({error:'業務資料格式不正確。'},{status:400});"
  },
  {
   "desc": "POST job-order insert",
   "find": "INSERT INTO hr_job_orders(employer_id,job_type,headcount,description,expected_start_date) VALUES($1,$2,$3,$4,$5) RETURNING *`,[employerId,jobType,headcount,clean(body.description,3000),body.expectedStartDate||null]",
   "replace": "INSERT INTO hr_job_orders(employer_id,job_type,headcount,description,expected_start_date,monthly_salary,care_recipient) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,[employerId,jobType,headcount,clean(body.description,3000),body.expectedStartDate||null,orderSalary.value,JSON.stringify(orderCare)]"
  },
  {
   "desc": "PATCH job-order validate",
   "find": "return NextResponse.json({error:'工作類型、需求人數或日期格式不正確。'},{status:400});",
   "replace": "return NextResponse.json({error:'工作類型、需求人數或日期格式不正確。'},{status:400});\n      const orderSalary=parseMonthlySalary(body.monthlySalary);\n      const orderCare=needsCareRecipient(jobType)?cleanCareRecipient(body.careRecipient):{};\n      const orderExtrasError=jobOrderExtrasError({jobType,monthlySalary:body.monthlySalary,careRecipient:orderCare});\n      if(orderExtrasError)return NextResponse.json({error:orderExtrasError},{status:400});"
  },
  {
   "desc": "PATCH job-order update",
   "find": "UPDATE hr_job_orders SET job_type=$2,headcount=$3,description=$4,expected_start_date=$5,updated_at=NOW() WHERE id=$1 RETURNING *`,[orderId,jobType,headcount,clean(body.description,3000),body.expectedStartDate||null]",
   "replace": "UPDATE hr_job_orders SET job_type=$2,headcount=$3,description=$4,expected_start_date=$5,monthly_salary=$6,care_recipient=$7::jsonb,updated_at=NOW() WHERE id=$1 RETURNING *`,[orderId,jobType,headcount,clean(body.description,3000),body.expectedStartDate||null,orderSalary.value,JSON.stringify(orderCare)]"
  },
  {
   "desc": "PATCH employer (employer role) validate",
   "find": "if (!name || !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請填寫雇主／客戶名稱並選擇有效類型。' }, { status: 400 });",
   "replace": "if (!name || !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請填寫雇主／客戶名稱並選擇有效類型。' }, { status: 400 });\n      const employerExtra = employerProfileFromBody(body);\n      if (employerExtra.error) return NextResponse.json({ error: employerExtra.error }, { status: 400 });"
  },
  {
   "desc": "PATCH employer (employer role) sql",
   "find": "employer_type=$8,updated_at=NOW()",
   "replace": "employer_type=$8,employer_profile=COALESCE($9::jsonb,employer_profile),updated_at=NOW()"
  },
  {
   "desc": "PATCH employer (employer role) params",
   "find": "body.employerType])).rows[0]);",
   "replace": "body.employerType,employerExtra.profile])).rows[0]);"
  },
  {
   "desc": "PATCH employer (taiwan agency) validate",
   "find": "if (!clean(body.name,160) || !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請填寫名稱並選擇有效的雇主類型。' }, { status: 400 });",
   "replace": "if (!clean(body.name,160) || !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請填寫名稱並選擇有效的雇主類型。' }, { status: 400 });\n      const employerExtra = employerProfileFromBody(body);\n      if (employerExtra.error) return NextResponse.json({ error: employerExtra.error }, { status: 400 });"
  },
  {
   "desc": "PATCH employer (taiwan agency) sql",
   "find": "notes=$8,employer_type=$9,updated_at=NOW()",
   "replace": "notes=$8,employer_type=$9,employer_profile=COALESCE($10::jsonb,employer_profile),updated_at=NOW()"
  },
  {
   "desc": "PATCH employer (taiwan agency) params",
   "find": "body.employerType])).rows[0], principal.agency_id);",
   "replace": "body.employerType,employerExtra.profile])).rows[0], principal.agency_id);"
  },
  {
   "desc": "PATCH employer (admin) validate",
   "find": "if (body.name !== undefined && body.type === 'employer' && !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });",
   "replace": "if (body.name !== undefined && body.type === 'employer' && !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });\n      const employerExtra = body.type === 'employer' && body.name !== undefined ? employerProfileFromBody(body) : { profile: null };\n      if (employerExtra.error) return NextResponse.json({ error: employerExtra.error }, { status: 400 });"
  },
  {
   "desc": "PATCH employer (admin) sql",
   "find": "employer_type=$8,agency_id=$9,updated_at=NOW() WHERE id=$1 RETURNING *'",
   "replace": "employer_type=$8,agency_id=$9,employer_profile=COALESCE($10::jsonb,employer_profile),updated_at=NOW() WHERE id=$1 RETURNING *'"
  },
  {
   "desc": "PATCH employer (admin) params",
   "find": "body.employerType,body.agencyId&&validId(body.agencyId)?Number(body.agencyId):null]",
   "replace": "body.employerType,body.agencyId&&validId(body.agencyId)?Number(body.agencyId):null,employerExtra.profile]"
  },
  {
   "desc": "POST employer (admin) validate",
   "find": "if (isEmployer && !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });",
   "replace": "if (isEmployer && !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });\n      let employerExtra = { profile: null };\n      if (isEmployer) {\n        employerExtra = employerProfileFromBody(body);\n        if (employerExtra.error) return NextResponse.json({ error: employerExtra.error }, { status: 400 });\n      }"
  },
  {
   "desc": "POST employer (admin) columns",
   "find": "INSERT INTO hr_employers(name,contact_name,phone,email,address,notes,employer_type,agency_id)",
   "replace": "INSERT INTO hr_employers(name,contact_name,phone,email,address,notes,employer_type,agency_id,employer_profile)"
  },
  {
   "desc": "POST employer (admin) values",
   "find": "VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [name, clean(body.contactName,120)",
   "replace": "VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::jsonb,'{}'::jsonb)) RETURNING *`, [name, clean(body.contactName,120)"
  },
  {
   "desc": "POST employer (admin) params",
   "find": "body.employerType, agencyId])).rows[0];",
   "replace": "body.employerType, agencyId, employerExtra.profile])).rows[0];"
  }
 ],
 "src/components/HrReminders.jsx": [
  {
   "desc": "import",
   "find": "import styles from './HrReminders.module.css';",
   "replace": "import styles from './HrReminders.module.css';\nimport { employerMissingLabels } from '@/lib/hr-employer-profile';"
  },
  {
   "desc": "missing labels",
   "find": "const missing = EMPLOYER_FIELDS.filter(([field]) => !isFilled(employer[field])).map(([, label]) => label);",
   "replace": "const missing = [...EMPLOYER_FIELDS.filter(([field]) => !isFilled(employer[field])).map(([, label]) => label), ...employerMissingLabels(employer)];"
  }
 ],
 "src/lib/hr-translations.jsx": [
  {
   "desc": "import",
   "find": "import { TRAINING_CENTER_EN, translateTrainingCenterPattern } from '@/lib/hr-translations-training';",
   "replace": "import { TRAINING_CENTER_EN, translateTrainingCenterPattern } from '@/lib/hr-translations-training';\nimport { EMPLOYER_PROFILE_EN, translateEmployerPattern } from '@/lib/hr-translations-employer';"
  },
  {
   "desc": "lookup chain",
   "find": "|| WORKER_STAGE_EN[trimmed] || TRAINING_CENTER_EN[trimmed];",
   "replace": "|| WORKER_STAGE_EN[trimmed] || TRAINING_CENTER_EN[trimmed] || EMPLOYER_PROFILE_EN[trimmed];"
  },
  {
   "desc": "pattern",
   "find": "if (!translated) translated = translateTrainingCenterPattern(trimmed, text => translateHrText(text, 'en')) || undefined;",
   "replace": "if (!translated) translated = translateTrainingCenterPattern(trimmed, text => translateHrText(text, 'en')) || undefined;\n  if (!translated) translated = translateEmployerPattern(trimmed, text => translateHrText(text, 'en')) || undefined;"
  }
 ],
 "src/components/HrMemberPortal.jsx": [
  {
   "desc": "imports",
   "find": "import HrReminders from '@/components/HrReminders';",
   "replace": "import HrReminders from '@/components/HrReminders';\nimport { CareRecipientFields, CareRecipientSummary, EmployerProfileFields, EmployerProfileItems } from '@/components/HrEmployerFields';\nimport { EMPTY_CARE_RECIPIENT, cleanEmployerProfile, employerRecordError, jobOrderExtrasError, needsCareRecipient } from '@/lib/hr-employer-profile';"
  },
  {
   "desc": "employerForm state",
   "find": "const [employerForm, setEmployerForm] = useState({ name: '', employerType: 'home_care', contactName: '', phone: '', email: '', address: '', notes: '' });",
   "replace": "const [employerForm, setEmployerForm] = useState({ name: '', employerType: 'home_care', contactName: '', phone: '', email: '', address: '', notes: '', employerProfile: cleanEmployerProfile({}) });"
  },
  {
   "desc": "orderForm state",
   "find": "const [orderForm,setOrderForm]=useState({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});",
   "replace": "const [orderForm,setOrderForm]=useState({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:'',monthlySalary:'',careRecipient:{...EMPTY_CARE_RECIPIENT}});"
  },
  {
   "desc": "orderEditForm state",
   "find": "const [orderEditForm,setOrderEditForm]=useState({jobType:'',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});",
   "replace": "const [orderEditForm,setOrderEditForm]=useState({jobType:'',headcount:1,description:'',expectedStartDate:'',brokerMemberId:'',monthlySalary:'',careRecipient:{...EMPTY_CARE_RECIPIENT}});"
  },
  {
   "desc": "beginEmployerEdit",
   "find": "setEmployerForm({ name:item.name||'', employerType:item.employer_type||'other', contactName:item.contact_name||'', phone:item.phone||'', email:item.email||'', address:item.address||'', notes:item.notes||'' });",
   "replace": "setEmployerForm({ name:item.name||'', employerType:item.employer_type||'other', contactName:item.contact_name||'', phone:item.phone||'', email:item.email||'', address:item.address||'', notes:item.notes||'', employerProfile:cleanEmployerProfile(item.employer_profile) });\n    window.setTimeout(()=>document.getElementById('employer-edit-form')?.scrollIntoView({behavior:'smooth',block:'start'}),50);"
  },
  {
   "desc": "saveEmployer validate",
   "find": "event.preventDefault(); setEmployerSaving(true); setError('');",
   "replace": "event.preventDefault(); setError('');\n    const profileError=employerRecordError({employerType:employerForm.employerType,phone:employerForm.phone,address:employerForm.address,profile:employerForm.employerProfile});\n    if(profileError){setError(profileError);return;}\n    setEmployerSaving(true);"
  },
  {
   "desc": "editOrder",
   "find": "setOrderEditForm({jobType:order.job_type,headcount:order.headcount,description:order.description||'',",
   "replace": "setOrderEditForm({jobType:order.job_type,headcount:order.headcount,monthlySalary:order.monthly_salary?String(order.monthly_salary):'',careRecipient:{...EMPTY_CARE_RECIPIENT,...(order.care_recipient||{})},description:order.description||'',"
  },
  {
   "desc": "submitOrder validate+payload",
   "find": "if(!agencyId)return;setOrderSubmitting(true);const result=await submitWorkflow({type:'job-order',jobType:orderForm.jobType,headcount:Number(orderForm.headcount),description:orderForm.description,",
   "replace": "if(!agencyId)return;const orderError=jobOrderExtrasError({jobType:orderForm.jobType,monthlySalary:orderForm.monthlySalary,careRecipient:orderForm.careRecipient});if(orderError){setError(orderError);return;}setOrderSubmitting(true);const result=await submitWorkflow({type:'job-order',jobType:orderForm.jobType,headcount:Number(orderForm.headcount),monthlySalary:orderForm.monthlySalary,careRecipient:needsCareRecipient(orderForm.jobType)?orderForm.careRecipient:{},description:orderForm.description,"
  },
  {
   "desc": "submitOrder reset",
   "find": "if(result)setOrderForm({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});",
   "replace": "if(result)setOrderForm({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:'',monthlySalary:'',careRecipient:{...EMPTY_CARE_RECIPIENT}});"
  },
  {
   "desc": "submitOrderEdit",
   "find": "event.preventDefault();setOrderSubmitting(true);const result=await submitWorkflow({type:'job-order-update',id:order.id,...orderEditForm,headcount:Number(orderEditForm.headcount)},'', 'PATCH');",
   "replace": "event.preventDefault();const orderError=jobOrderExtrasError({jobType:orderEditForm.jobType,monthlySalary:orderEditForm.monthlySalary,careRecipient:orderEditForm.careRecipient});if(orderError){setError(orderError);return;}setOrderSubmitting(true);const result=await submitWorkflow({type:'job-order-update',id:order.id,...orderEditForm,careRecipient:needsCareRecipient(orderEditForm.jobType)?orderEditForm.careRecipient:{},headcount:Number(orderEditForm.headcount)},'', 'PATCH');"
  },
  {
   "desc": "create form fields",
   "find": "<label className=\"form-wide\">工作內容／條件<textarea rows=\"3\" value={orderForm.description} onChange={e=>setOrderForm({...orderForm,description:e.target.value})}/></label>",
   "replace": "<label className=\"form-wide\">工作內容／條件<textarea rows=\"3\" value={orderForm.description} onChange={e=>setOrderForm({...orderForm,description:e.target.value})}/></label>\n      <label>預計月薪（新臺幣，選填）<input type=\"number\" min=\"1\" max=\"1000000\" inputMode=\"numeric\" value={orderForm.monthlySalary} onChange={e=>setOrderForm(current=>({...current,monthlySalary:e.target.value}))}/></label>\n      {needsCareRecipient(orderForm.jobType)&&<CareRecipientFields value={orderForm.careRecipient} onChange={careRecipient=>setOrderForm(current=>({...current,careRecipient}))}/>}"
  },
  {
   "desc": "edit form fields",
   "find": "<label className=\"form-wide\">&#x5DE5;&#x4F5C;&#x5167;&#x5BB9;&#xFF0F;&#x689D;&#x4EF6;<textarea rows=\"3\" value={orderEditForm.description} onChange={event=>setOrderEditForm(current=>({...current,description:event.target.value}))}/></label>",
   "replace": "<label className=\"form-wide\">&#x5DE5;&#x4F5C;&#x5167;&#x5BB9;&#xFF0F;&#x689D;&#x4EF6;<textarea rows=\"3\" value={orderEditForm.description} onChange={event=>setOrderEditForm(current=>({...current,description:event.target.value}))}/></label><label>預計月薪（新臺幣，選填）<input type=\"number\" min=\"1\" max=\"1000000\" inputMode=\"numeric\" value={orderEditForm.monthlySalary} onChange={event=>setOrderEditForm(current=>({...current,monthlySalary:event.target.value}))}/></label>{needsCareRecipient(orderEditForm.jobType)&&<CareRecipientFields value={orderEditForm.careRecipient} onChange={careRecipient=>setOrderEditForm(current=>({...current,careRecipient}))}/>}"
  },
  {
   "desc": "order facts (salary)",
   "find": "<div><small>所屬仲介</small><strong>{dispatches[0]?.taiwan_agency_name||'等待指派'}</strong></div></div>",
   "replace": "<div><small>所屬仲介</small><strong>{dispatches[0]?.taiwan_agency_name||'等待指派'}</strong></div>{order.monthly_salary&&<div><small>預計月薪</small><strong>{`NT$ ${Number(order.monthly_salary).toLocaleString('en-US')}`}</strong></div>}</div>"
  },
  {
   "desc": "order care summary (employer)",
   "find": "{order.description&&<p className=\"job-order-description\">{order.description}</p>}<div className=\"candidate-list\"><h5>",
   "replace": "{order.description&&<p className=\"job-order-description\">{order.description}</p>}<CareRecipientSummary value={order.care_recipient}/><div className=\"candidate-list\"><h5>"
  },
  {
   "desc": "order care summary (taiwan agency)",
   "find": "<p>{order.description||'未填工作說明'}</p><p>負責業務：{dispatch.broker_name||'未指定，由機構分派'}</p>",
   "replace": "<p>{order.description||'未填工作說明'}</p><CareRecipientSummary value={order.care_recipient}/><p>負責業務：{dispatch.broker_name||'未指定，由機構分派'}</p>"
  },
  {
   "desc": "order care summary (philippines agency)",
   "find": "<p>{order.description||'未填工作說明'}</p><p>承接機構：",
   "replace": "<p>{order.description||'未填工作說明'}</p><CareRecipientSummary value={order.care_recipient}/><p>承接機構："
  },
  {
   "desc": "basic tab profile",
   "find": "{data.role==='employer'&&data.employers[0]&&<div><dt>雇主／客戶</dt><dd>{data.employers[0].name}</dd></div>}",
   "replace": "{data.role==='employer'&&data.employers[0]&&<div><dt>雇主／客戶</dt><dd>{data.employers[0].name}</dd></div>}{data.role==='employer'&&data.employers[0]&&<EmployerProfileItems employer={data.employers[0]}/>}"
  },
  {
   "desc": "basic tab edit button",
   "find": "?.country||'尚未填寫，請聯絡系統管理者補齊'}</dd></div></>}</dl></section>}",
   "replace": "?.country||'尚未填寫，請聯絡系統管理者補齊'}</dd></div></>}</dl>{data.role==='employer'&&data.employers[0]&&<div className=\"candidate-actions\" style={{marginTop:12}}><button type=\"button\" onClick={()=>beginEmployerEdit(data.employers[0])}>編輯雇主資料</button></div>}</section>}"
  },
  {
   "desc": "edit form id",
   "find": "{editingEmployer && <section className=\"hr-member-card\"><div className=\"card-title\"><h2>編輯雇主</h2>",
   "replace": "{editingEmployer && <section id=\"employer-edit-form\" className=\"hr-member-card\"><div className=\"card-title\"><h2>編輯雇主</h2>"
  },
  {
   "desc": "edit form required",
   "find": "<input type={field==='email'?'email':'text'} value={employerForm[field]}",
   "replace": "<input type={field==='email'?'email':'text'} required={field==='phone'||field==='address'} value={employerForm[field]}"
  },
  {
   "desc": "edit form profile fields",
   "find": "<label className=\"form-wide\">備註<textarea rows=\"3\" value={employerForm.notes}",
   "replace": "<EmployerProfileFields employerType={employerForm.employerType} value={employerForm.employerProfile} onChange={employerProfile=>setEmployerForm(current=>({...current,employerProfile}))}/><label className=\"form-wide\">備註<textarea rows=\"3\" value={employerForm.notes}"
  }
 ],
 "src/components/HrManagement.jsx": [
  {
   "desc": "imports",
   "find": "import HrReminders from '@/components/HrReminders';",
   "replace": "import HrReminders from '@/components/HrReminders';\nimport { CareRecipientSummary, EmployerProfileFields } from '@/components/HrEmployerFields';\nimport { cleanEmployerProfile } from '@/lib/hr-employer-profile';"
  },
  {
   "desc": "classes const",
   "find": "const NAV = [",
   "replace": "const ADMIN_FIELD_CLASSES = { field: styles.field, button: styles.smallButton, actions: styles.rowActions };\nconst NAV = ["
  },
  {
   "desc": "modal state",
   "find": "const [caseEmployerId,setCaseEmployerId]=useState('');",
   "replace": "const [caseEmployerId,setCaseEmployerId]=useState('');\n  const [employerType,setEmployerType]=useState(record?.employer_type||'other');\n  const [employerProfile,setEmployerProfile]=useState(()=>cleanEmployerProfile(record?.employer_profile));"
  },
  {
   "desc": "employerType select controlled",
   "find": "<SelectField name=\"employerType\" label=\"雇主類型\" defaultValue={record?.employer_type||'other'} options=",
   "replace": "<SelectField name=\"employerType\" label=\"雇主類型\" value={employerType} onChange={event=>setEmployerType(event.target.value)} options="
  },
  {
   "desc": "phone/address required + profile fields",
   "find": "<Field name=\"phone\" label=\"聯絡電話\" defaultValue={record?.phone}/><Field name=\"email\" label={record?'登入 Email（同步會員帳號）':'登入 Email（必填，同步建立會員帳號）'} type=\"email\" required defaultValue={record?.email}/>{!record&&<Field name=\"password\" label=\"初始密碼（至少 10 字元）\" type=\"password\" required autoComplete=\"new-password\"/>}<Field name=\"address\" label=\"地址\" defaultValue={record?.address}/></div>",
   "replace": "<Field name=\"phone\" label=\"聯絡電話\" required defaultValue={record?.phone}/><Field name=\"email\" label={record?'登入 Email（同步會員帳號）':'登入 Email（必填，同步建立會員帳號）'} type=\"email\" required defaultValue={record?.email}/>{!record&&<Field name=\"password\" label=\"初始密碼（至少 10 字元）\" type=\"password\" required autoComplete=\"new-password\"/>}<Field name=\"address\" label=\"地址\" required defaultValue={record?.address}/><EmployerProfileFields employerType={employerType} value={employerProfile} onChange={setEmployerProfile} cls={ADMIN_FIELD_CLASSES}/></div>"
  },
  {
   "desc": "payload",
   "find": "if(type==='worker')payload.resumeProfile={...(record?.resume_profile||{}),gender:value.gender};",
   "replace": "if(type==='employer')payload.employerProfile=employerProfile;if(type==='worker')payload.resumeProfile={...(record?.resume_profile||{}),gender:value.gender};"
  },
  {
   "desc": "job order table cell",
   "find": "<small className={styles.cellNote}>{order.description||'未填工作條件'}</small></td>",
   "replace": "<small className={styles.cellNote}>{order.description||'未填工作條件'}</small><CareRecipientSummary value={order.care_recipient}/>{order.monthly_salary&&<small className={styles.cellNote}><span>預計月薪</span>{` · NT$ ${Number(order.monthly_salary).toLocaleString('en-US')}`}</small>}</td>"
  },
  {
   "desc": "job order mobile card",
   "find": "{order.description&&<p className={styles.jobOrderDescription}>{order.description}</p>}",
   "replace": "{order.description&&<p className={styles.jobOrderDescription}>{order.description}</p>}<CareRecipientSummary value={order.care_recipient}/>{order.monthly_salary&&<p className={styles.jobOrderDescription}><span>預計月薪</span>{` · NT$ ${Number(order.monthly_salary).toLocaleString('en-US')}`}</p>}"
  }
 ]
};
const NEW_FILES = ['src/lib/hr-employer-profile.js', 'src/lib/hr-translations-employer.js', 'src/components/HrEmployerFields.jsx'];
const MARKERS = ['hr-employer-profile', 'hr-translations-employer'];
const checkOnly = process.argv.includes('--check');
const root = process.cwd();
let failed = false;

for (const file of NEW_FILES) {
  if (!fs.existsSync(path.join(root, file))) { console.error(`缺少新增檔案：${file}（請先把壓縮檔解壓到專案根目錄）`); failed = true; }
}
const plans = [];
for (const [file, edits] of Object.entries(EDITS)) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { console.error(`找不到檔案：${file}`); failed = true; continue; }
  const original = fs.readFileSync(full, 'utf8');
  if (MARKERS.some(marker => original.includes(marker))) { console.log(`略過（已套用過）：${file}`); continue; }
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const spans = [];
  for (const edit of edits) {
    const first = original.indexOf(edit.find);
    const count = first < 0 ? 0 : original.split(edit.find).length - 1;
    if (count !== 1) { console.error(`✗ ${file}｜${edit.desc}：原文出現 ${count} 次（應為 1 次）`); failed = true; continue; }
    spans.push({ start: first, end: first + edit.find.length, text: edit.replace.replace(/\n/g, eol), desc: edit.desc });
  }
  spans.sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i += 1) {
    if (spans[i].start < spans[i - 1].end) { console.error(`✗ ${file}｜替換點重疊：${spans[i - 1].desc} / ${spans[i].desc}`); failed = true; }
  }
  plans.push({ file, full, original, spans });
}
if (failed) { console.error('\n有替換點對不上，已中止，沒有修改任何檔案。請把上面的訊息貼給我。'); process.exit(1); }
for (const { file, full, original, spans } of plans) {
  let out = ''; let cursor = 0;
  for (const span of spans) { out += original.slice(cursor, span.start) + span.text; cursor = span.end; }
  out += original.slice(cursor);
  if (!checkOnly) fs.writeFileSync(full, out);
  console.log(`${checkOnly ? '可套用' : '已套用'}：${file}（${spans.length} 處）`);
}
console.log(checkOnly ? '\n檢查通過，沒有寫入任何檔案。' : '\n完成。請執行 git diff 檢視，再 npm run build 確認。');
