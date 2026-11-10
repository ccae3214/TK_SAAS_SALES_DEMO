"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Activity, BriefcaseBusiness, Building2, Check, ChevronRight, CircleAlert, ClipboardList, FileCheck2, HeartPulse, History, LayoutDashboard, LogOut, Menu, MessageCircle, Plus, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import styles from './HrManagement.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { HrLanguageTools, translateHrText } from '@/lib/hr-translations';
import HrFilePicker from '@/components/HrFilePicker';
import HrPhotoCropper from '@/components/HrPhotoCropper';
import PersonNameFields from '@/components/PersonNameFields';
import HrChat from '@/components/HrChat';
import HrReminders from '@/components/HrReminders';
import { useHrDialog } from '@/lib/use-hr-dialog';
import { parseResumePdf } from '@/lib/hr-resume-import';
import HrResumeFieldControl from '@/components/HrResumeFieldControl';

const NAV = [
  { id: 'overview', label: '總覽', icon: LayoutDashboard },
  { id: 'cases', label: '案件管理', icon: BriefcaseBusiness },
  { id: 'chat', label: '會員聊天室', icon: MessageCircle },
  { id: 'job-orders', label: '媒合需求單', icon: ClipboardList },
  { id: 'documents', label: '文件收件與審核', icon: FileCheck2 },
  { id: 'workflow', label: '體檢與訓練', icon: HeartPulse },
  { id: 'tasks', label: '工作待辦', icon: ClipboardList },
  { id: 'employers', label: '雇主／客戶', icon: Building2 },
  { id: 'workers', label: '工作者', icon: UserRound },
  { id: 'agencies', label: '仲介機構', icon: Building2 },
  { id: 'members', label: '會員帳號', icon: UsersRound },
  { id: 'activity', label: '操作紀錄', icon: History },
];
const STAGES = [['intake','需求受理'],['matching','媒合中'],['documents','文件處理'],['medical_training','體檢與訓練'],['application','申請辦理'],['arrangement','後續安排'],['completed','完成']];
const CASE_STATUSES = [['open','進行中'],['on_hold','暫停'],['closed','結案']];
const CASE_JOB_TYPES = [['家庭幫傭','家庭幫傭'],['家庭看護','家庭看護'],['機構看護工','機構看護工'],['工廠技術工','工廠技術工'],['農工','農工']];
const TASK_CATEGORIES = [['document','文件'],['medical','體檢'],['training','訓練'],['other','其他']];
const TASK_STATUSES = [['todo','待處理'],['in_progress','處理中'],['blocked','受阻'],['done','完成']];
const RECORD_STATUSES = [['active','啟用'],['inactive','停用']];
const MEDICAL_STATUSES = [['not_scheduled','未安排'],['scheduled','已安排'],['in_progress','進行中'],['passed','合格'],['retest','複檢'],['failed','未通過']];
const TRAINING_STATUSES = [['not_scheduled','未安排'],['scheduled','已安排'],['in_progress','進行中'],['completed','已完成']];
const RESUME_GROUPS = [
  { title:'基本資料', fields:[['referenceNo','履歷編號'],['birthDate','出生日期'],['gender','性別'],['birthplace','出生地'],['address','地址'],['height','身高（cm）'],['weight','體重（kg）'],['skinComplexion','膚色'],['maritalStatus','婚姻狀況'],['religion','宗教'],['hobby','興趣']] },
  { title:'家庭資料', fields:[['spouseName','配偶姓名'],['spouseOccupation','配偶職業'],['spouseAge','配偶年齡'],['numberOfChildren','子女人數'],['childrenAges','子女年齡'],['fatherName','父親姓名'],['fatherOccupation','父親職業'],['fatherBirthDate','父親出生日期'],['motherName','母親姓名'],['motherOccupation','母親職業'],['motherBirthDate','母親出生日期'],['brotherCount','兄弟人數'],['brotherAges','兄弟年齡'],['sisterCount','姊妹人數'],['sisterAges','姊妹年齡'],['familyRank','家中排行'],['caregiverDuringOverseas','出國工作期間子女照顧者']] },
  { title:'教育與語言', fields:[['educationLevels','教育程度'],['coursesCompleted','完成課程'],['languageOptions','語言'],['languages','語言能力']] },
  { title:'技能與照護經驗', fields:[['cookingSkills','烹飪技能'],['applianceOptions','家電操作'],['applianceSkills','家電操作補充'],['childcareSkills','嬰幼兒照護技能'],['experienceNewborn','新生兒照護經驗'],['experienceChildren','兒童照護經驗'],['experienceElderly','長者照護經驗'],['experienceDisabled','身心障礙者照護經驗']] },
  { title:'個人資料問答', fields:[['hasTattoo','是否有刺青'],['smokes','是否吸菸'],['drinksAlcohol','是否飲酒'],['petExperience','寵物照護經驗與種類'],['willingToWorkWithPets','是否願意在有寵物的家庭工作'],['seriousIllness','是否曾有重大疾病'],['operationLast12Months','過去 12 個月是否接受手術'],['allergies','是否有過敏'],['dayOffChores','休假日是否願意完成家務'],['finishChoresBeforeOuting','外出前是否完成家務'],['returnBy8PM','休假日是否可於晚上 8 點前返家'],['makeupAtWork','工作時是否化妝'],['workOnDaysOff','是否願意於休假日加班'],['workedAbroad','是否曾在海外工作']] },
];
const RESUME_EXPERIENCE_FIELDS = [['overseasExperiences','海外工作經歷'],['employmentExperiences','國內工作經歷']];
const EMPTY_RESUME = Object.fromEntries([...RESUME_GROUPS.flatMap(group=>group.fields.map(([field])=>[field,''])),...RESUME_EXPERIENCE_FIELDS.map(([field])=>[field,[]]),['overseasWorkDetails',''],['employmentHistory',''],['remarks',''],['photoDataUrl','']]);
const stageLabel = value => STAGES.find(([key]) => key === value)?.[1] || value || '—';
const statusLabel = (value, options) => options.find(([key]) => key === value)?.[1] || value || '—';
const dateLabel = value => value ? new Date(value).toLocaleDateString('zh-TW') : '未設定';
const matchesSearch = (values, term) => { const query = String(term || '').trim().toLowerCase(); return !query || values.some(value => String(value ?? '').toLowerCase().includes(query)); };
const MEMBER_ROLE_NAMES = { worker: '工作者', employer: '雇主', agency: '仲介機構員工', training_center: '訓練中心', system_admin: '系統管理者' };
const memberTypeLabel = row => row.admin_scope === 'system' || row.role === 'system_admin' ? '系統管理者' : row.admin_scope === 'agency' ? '仲介管理者' : row.role === 'agency' ? (row.agency_type === 'taiwan' ? '台灣仲介業務' : row.agency_type === 'philippines' ? '菲律賓仲介 Staff' : '仲介機構員工') : MEMBER_ROLE_NAMES[row.role] || '待管理者指派';
const memberStatusLabel = row => !row.role ? '待審核' : row.active ? '啟用' : '停用';
const memberUnitLabel = row => {
  if (row.role === 'system_admin' || row.admin_scope === 'system') return '不需所屬仲介 · 全站最高權限';
  if (!row.role && row.requested_agency_name) return `申請所屬仲介：${row.requested_agency_type === 'taiwan' ? '台灣' : '菲律賓'} · ${row.requested_agency_name}`;
  if (!row.role && row.requested_role === 'training_center') return '不需所屬仲介';
  if (!row.role && row.requested_role) return '尚未選擇所屬仲介';
  if (row.role === 'worker') return row.worker_agency_name ? `菲律賓仲介：${row.worker_agency_name}` : '尚未指派菲律賓仲介';
  if (row.role === 'employer') return row.employer_agency_name ? `台灣仲介：${row.employer_agency_name}` : '尚未指派台灣仲介';
  if (row.role === 'agency' && row.agency_type === 'taiwan') return `台灣仲介機構：${row.agency_name}`;
  if (row.role === 'agency') {
    const partners = row.related_taiwan_agencies || [];
    return `菲律賓仲介機構：${row.agency_name}${partners.length ? `｜合作台灣仲介：${partners.join('、')}` : '｜尚無案件關聯的台灣仲介'}`;
  }
  if (row.role === 'training_center') return '訓練中心';
  return '—';
};

export default function HrManagement({ actor }) {
  const [data, setData] = useState(null);
  const [active, setActive] = useState('overview');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [modal, setModal] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [resumeWorker, setResumeWorker] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/hr', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '無法讀取資料');
      setData(body);
      setSelectedCase(current => current ? body.cases.find(item => item.id === current.id) || null : null);
      setMessage(null);
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openModal(type, record = null) { setEditingRecord(record); setModal(type); }

  async function submit(payload) {
    setSaving(true);
    try {
      const method = editingRecord && modal !== 'submission' ? 'PATCH' : 'POST';
      const bodyPayload = method === 'PATCH' ? { ...payload, id: editingRecord.id } : payload;
      const isFormData = bodyPayload instanceof FormData;
      const response = await fetch(isFormData ? '/api/hr/documents' : '/api/hr', { method, headers: isFormData ? undefined : { 'Content-Type': 'application/json' }, body: isFormData ? bodyPayload : JSON.stringify(bodyPayload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '儲存失敗');
      setModal('');
      setEditingRecord(null);
      await load();
      setMessage({ type: 'success', text: '資料已儲存' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  }

  async function update(payload) {
    setSaving(true);
    try {
      const response = await fetch('/api/hr', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '更新失敗');
      await load();
      setMessage({ type: 'success', text: '變更已儲存' });
      return true;
    } catch (error) { setMessage({ type: 'error', text: error.message }); return false; }
    finally { setSaving(false); }
  }

  async function deleteRecord(type, record) {
    const labels = { employer: '雇主／客戶', worker: '工作者', case: '案件' };
    const name = type === 'case' ? record.case_number : record.name;
    const warning = type === 'case' ? '案件的待辦、體檢訓練與申請程序紀錄會一併刪除（工作者的文件與雇主資料會保留）。' : type === 'worker' ? '工作者的文件與履歷資料會一併刪除。' : '';
    if (!window.confirm(`確定刪除${labels[type]}「${name}」？${warning}此操作無法復原。`)) return false;
    setSaving(true);
    try {
      const response = await fetch(`/api/hr?type=${type}&id=${encodeURIComponent(record.id)}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || '刪除失敗');
      await load();
      setMessage({ type: 'success', text: `已刪除${labels[type]}「${name}」` });
      return true;
    } catch (error) { setMessage({ type: 'error', text: error.message }); return false; }
    finally { setSaving(false); }
  }

  async function deleteMember(member) {
    if (!window.confirm(`確定刪除會員帳號「${member.display_name}」？此操作無法復原；工作者／雇主資料與案件紀錄會保留。`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/hr?type=member&id=${encodeURIComponent(member.id)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '刪除會員帳號失敗');
      await load();
      setMessage({ type: 'success', text: '會員帳號已刪除' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  }

  const filteredCases = useMemo(() => (data?.cases || []).filter(item => [item.case_number,item.worker_name,item.employer_name,item.assigned_member_name,item.job_type].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))), [data,search]);
  const filteredEmployers = useMemo(() => (data?.employers || []).filter(item => [item.name,item.contact_name,item.phone,item.email].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))), [data,search]);
  const filteredWorkers = useMemo(() => (data?.workers || []).filter(item => [item.name,item.nationality,item.phone,item.email,item.job_preference].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))), [data,search]);
  const filteredTasks = useMemo(() => (data?.tasks || []).filter(item => [item.title,item.case_number,item.worker_name,item.notes].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))), [data,search]);
  const filteredMembers = useMemo(() => active !== 'members' ? [] : (data?.members || []).filter(item => matchesSearch([item.display_name, item.email || 'LINE 登入', MEMBER_ROLE_NAMES[item.requested_role], memberTypeLabel(item), memberUnitLabel(item), memberStatusLabel(item)], search)), [data,search,active]);
  const filteredAgencies = useMemo(() => active !== 'agencies' ? [] : (data?.agencies || []).filter(item => matchesSearch([item.name, item.country, item.agency_type === 'taiwan' ? '台灣仲介' : '菲律賓仲介', item.active ? '啟用' : '停用'], search)), [data,search,active]);
  const filteredWorkflow = useMemo(() => active !== 'workflow' ? [] : (data?.cases || []).filter(item => matchesSearch([item.case_number, item.worker_name, item.employer_name, stageLabel(item.stage), statusLabel(item.medical_status || 'not_scheduled', MEDICAL_STATUSES), statusLabel(item.training_status || 'not_scheduled', TRAINING_STATUSES)], search)), [data,search,active]);
  const activeLabel = NAV.find(item => item.id === active)?.label || '總覽';

  return <div className={styles.app} data-hr-translatable-root><HrLanguageTools />
    <aside className={`${styles.sidebar} ${mobileNav ? styles.sidebarOpen : ''}`}>
      <div className={styles.brand}><span className={styles.brandMark}>K</span><span>克雷迅<strong>人力管理</strong></span></div>
      <div className={styles.workspaceLabel}>工作區</div>
      <nav className={styles.nav}>{NAV.filter(item=>!(data?.role==='agency'&&data.isAgencyAdmin&&['agencies','activity'].includes(item.id))).map(({id,label,icon:Icon}) => <button key={id} className={active===id?styles.navActive:''} onClick={()=>{setActive(id);setQuickFilter('');setMobileNav(false);setSearch('');}}><Icon size={18}/><span>{label}</span>{active===id&&<ChevronRight size={15} className={styles.navArrow}/>}</button>)}</nav>
      <div className={styles.sidebarBottom}><div className={styles.signedIn}><span className={styles.avatar}>{(actor.name||'管').slice(0,1)}</span><span><strong>{actor.name}</strong><small>{actor.email}</small>{(data?.role==='admin'||data?.isAgencyAdmin)&&<span className={styles.adminBadge}><ShieldCheck size={13}/>{data.roleName}</span>}</span></div><button className={styles.signout} onClick={()=>signOut({callbackUrl:'/'})}><LogOut size={17}/>登出</button></div>
    </aside>
    {mobileNav&&<button aria-label="關閉導覽" className={styles.scrim} onClick={()=>setMobileNav(false)}/>}
    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} aria-label="開啟導覽" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div><span className={styles.breadcrumb}>克雷迅人力管理</span><span className={styles.breadcrumbSlash}>/</span><strong key={active}>{activeLabel}</strong></div><div className={styles.topActions}>{(data?.role==='admin'||data?.isAgencyAdmin)&&<span className={styles.adminBadge}><ShieldCheck size={14}/>{data.roleName}</span>}<span className={styles.localStatus}><i className={data?styles.connected:''}/>{data?'資料庫連線':'等待連線'}</span><button className={styles.iconButton} aria-label="重新整理資料" onClick={()=>void load()}><Activity size={17}/></button><button className={styles.topAvatar} title={actor.email}>{(actor.name||'管').slice(0,1)}</button></div></header>
      <div className={styles.content}>
        {message&&<div className={`${styles.message} ${message.type==='error'?styles.messageError:styles.messageSuccess}`}><span>{message.type==='error'?<CircleAlert size={17}/>:<Check size={17}/>}</span>{message.text}<button aria-label="關閉訊息" onClick={()=>setMessage(null)}><X size={16}/></button></div>}
        <div className={styles.pageHeading} key={active}><div><p className={styles.kicker}>克雷迅人力仲介管理系統</p><h1>{activeLabel}</h1><p className={styles.subtitle}>{active==='overview'?'掌握案件、文件審核、體檢訓練與待辦進度。':`管理${activeLabel}。`}</p></div>{active!=='overview'&&active!=='tasks'&&active!=='documents'&&active!=='workflow'&&!(active==='members'&&data.role==='agency'&&data.isAgencyAdmin)&&<button className={styles.primaryButton} onClick={()=>openModal(({cases:'case',employers:'employer',workers:'worker',agencies:'agency',members:'member'})[active])}><Plus size={17}/>{({cases:'新增案件',employers:'新增雇主',workers:'新增工作者',agencies:'新增仲介',members:'新增會員帳號'})[active]}</button>}</div>
        {loading&&!data?<div className={styles.loading}>正在讀取管理資料…</div>:!data?<div className={styles.errorState}><h2>目前無法連接資料庫</h2><p>{message?.text||'請確認 Docker PostgreSQL 與網站服務正在執行。'}</p><button className={styles.primaryButton} onClick={()=>void load()}>重新連線</button></div>:<>
          {active==='overview'&&<><HrReminders onOpenChat={roomId=>{setActive('chat');window.setTimeout(()=>window.dispatchEvent(new CustomEvent('hr:open-chat-room',{detail:{roomId}})),250);}} onOpenProgress={workerId=>{const item=data.cases.find(row=>Number(row.worker_id)===Number(workerId));if(item){setActive('cases');setSelectedCase(item);}}} onOpenProfile={item=>{if(item.type==='worker'){const worker=data.workers.find(row=>Number(row.id)===item.entityId);if(worker){setActive('workers');setResumeWorker(worker);}}else if(item.type==='employer'){const employer=data.employers.find(row=>Number(row.id)===item.entityId);if(employer){setActive('employers');openModal('employer',employer);}}else if(item.type==='agency'){const agency=data.agencies.find(row=>Number(row.id)===item.entityId);if(agency){setActive('agencies');openModal('agency',agency);}}}}/><Overview data={data} open={(section,filter='')=>{setActive(section);setQuickFilter(filter);setSearch('');}} selectCase={setSelectedCase} addCase={()=>openModal('case')}/></>}
          {active==='cases'&&<CaseList rows={filteredCases} initialStatus={quickFilter==='openCases'?'open':'all'} search={search} setSearch={setSearch} selectCase={setSelectedCase} add={()=>openModal('case')} clearQuickFilter={()=>setQuickFilter('')} tasks={data.tasks} agencies={data.agencies}/>}
          {active==='chat'&&<HrChat/>}
          {active==='job-orders'&&<JobOrderList orders={data.jobOrders||[]} assignments={data.orderAgencies||[]} routes={data.orderRoutes||[]} candidates={data.orderCandidates||[]} admin={data.role==='admin'} agencies={data.agencies||[]} agencyContacts={data.agencyContacts||[]} submit={submit} update={update}/>}
          {active==='documents'&&<DocumentList rows={quickFilter==='pendingDocuments'?data.requirements.filter(row=>row.status==='submitted'):data.requirements} submissions={data.submissions} cases={data.cases} review={update} addSubmission={row=>openModal('submission',row)} addRequirement={()=>openModal('requirement')} search={search} setSearch={setSearch}/>}
          {active==='workflow'&&<WorkflowList rows={filteredWorkflow} requirements={data.requirements} update={update} saving={saving} search={search} setSearch={setSearch}/>}
          {active==='tasks'&&<TaskList rows={quickFilter==='pendingTasks'?filteredTasks.filter(row=>row.status!=='done'):filteredTasks} cases={data.cases} search={search} setSearch={setSearch} update={update} saving={saving} add={()=>openModal('task')}/>}
          {active==='employers'&&<ContactList kind="雇主／客戶" rows={filteredEmployers} search={search} setSearch={setSearch} update={update} add={()=>openModal('employer')} edit={record=>openModal('employer',record)} remove={data.role==='admin'?record=>deleteRecord('employer',record):undefined}/>}
          {active==='workers'&&<WorkerList rows={filteredWorkers} search={search} setSearch={setSearch} update={update} add={()=>openModal('worker')} edit={record=>openModal('worker',record)} resume={setResumeWorker} remove={data.role==='admin'?record=>deleteRecord('worker',record):undefined}/>}
          {active==='agencies'&&<AgencyList rows={filteredAgencies} search={search} setSearch={setSearch} update={update} edit={record=>openModal('agency',record)}/>}
          {active==='members'&&<MemberList rows={filteredMembers} search={search} setSearch={setSearch} update={update} review={record=>openModal('member-role',record)} edit={record=>openModal(record.modalType||'member-profile',record)} manageAdmin={data.role==='admin'} isRootAdmin={data.isRootAdmin} deleteMember={deleteMember} saving={saving}/>}
          {active==='activity'&&<>{data.role==='admin'&&<AdminAuditList/>}<ActivityList rows={data.activity}/></>}
          <footer className={styles.footer}>克雷迅人力管理</footer>
        </>}
      </div>
    </main>
    {modal&&data&&<EntryModal type={modal} data={data} record={editingRecord} defaultCaseId={selectedCase?.id} isRootAdmin={data.isRootAdmin} close={()=>{setModal('');setEditingRecord(null)}} submit={submit} saving={saving}/>}
    {resumeWorker&&<WorkerResumeModal worker={resumeWorker} update={update} close={()=>setResumeWorker(null)}/>}
    {selectedCase&&data&&<CaseDrawer item={selectedCase} data={data} close={()=>setSelectedCase(null)} update={update} addTask={()=>setModal('task')} saving={saving} remove={data.role==='admin'?async record=>{if(await deleteRecord('case',record))setSelectedCase(null);}:undefined}/>}
  </div>;
}

function Overview({data,open,selectCase,addCase}) {
  const counts=data.counts;
  const cards=[['進行中案件',counts.open_cases,'目前進行中的案件','cases','openCases'],['待審文件',counts.pending_documents,'等待文件審核','documents','pendingDocuments'],['待處理工作',counts.pending_tasks,'尚未完成的工作待辦','tasks','pendingTasks'],['雇主／客戶',counts.employers,'已建立的客戶資料','employers',''],['工作者',counts.workers,'已建立的工作者資料','workers','']];
  const now=new Date();
  const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const attention=data.tasks.filter(task=>task.status!=='done'&&(task.status==='blocked'||(task.due_date&&String(task.due_date).slice(0,10)<=today)))
    .sort((a,b)=>{
      const priority=task=>{const due=task.due_date?String(task.due_date).slice(0,10):'';return due&&due<today?0:due===today?1:2;};
      return priority(a)-priority(b);
    }).slice(0,6);
  const pendingDocuments=(data.requirements||[]).filter(requirement=>requirement.status==='submitted').slice(0,5);
  const recent=data.cases.slice(0,7);
  const needsAttentionCases=(data.cases||[]).filter(item=>item.status==='open'&&(
    !item.assigned_member_id||(data.requirements||[]).some(requirement=>Number(requirement.worker_id)===Number(item.worker_id)&&requirement.required&&requirement.applicable&&['missing','returned'].includes(requirement.status))
  )).slice(0,5);
  return <>
    <div className={styles.dashboardQueues}>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>今日工作佇列</h2><p>逾期、今天到期或受阻的待辦，選取後可直接開啟案件</p></div><button className={styles.linkButton} onClick={()=>open('tasks')}>所有待辦 <ChevronRight size={15}/></button></div>{attention.length?<div className={styles.attentionList}>{attention.map(task=>{const due=task.due_date?String(task.due_date).slice(0,10):'';const daysLate=due&&due<today?Math.floor((Date.parse(`${today}T00:00:00Z`)-Date.parse(`${due}T00:00:00Z`))/86400000):0;const dueText=due===today?'今天到期':daysLate?`逾期 ${daysLate} 天`:'';const dueLabel=task.status==='blocked'?(dueText?`受阻 · ${dueText}`:'受阻'):dueText;return <article className={styles.attentionItem} key={task.id}><span className={task.status==='blocked'?styles.alertDot:styles.warnDot}/><div><strong>{task.title}</strong><small>{task.case_number} · {task.worker_name}</small></div><span>{dueLabel}</span><button type="button" className={styles.smallButton} onClick={()=>{const item=data.cases.find(row=>Number(row.id)===Number(task.case_id));if(item)selectCase(item);}}>查看案件</button></article>})}</div>:<p className={styles.queueEmpty}>今天沒有逾期、到期或受阻的待辦。</p>}</section>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>待我審核的文件</h2><p>{counts.pending_documents} 份文件等待審核</p></div><button className={styles.linkButton} onClick={()=>open('documents','pendingDocuments')}>前往審核 <ChevronRight size={15}/></button></div>{pendingDocuments.length?<div className={styles.attentionList}>{pendingDocuments.map(requirement=><article className={styles.attentionItem} key={requirement.id}><span className={styles.warnDot}/><div><strong>{requirement.name}</strong><small>{requirement.case_number} · {requirement.worker_name}</small></div><span>待審</span><button type="button" className={styles.smallButton} onClick={()=>open('documents','pendingDocuments')}>審核文件</button></article>)}</div>:<p className={styles.queueEmpty}>目前沒有待審文件。</p>}</section>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>待補資料或指派案件</h2><p>先處理缺少必要文件或尚未指派負責業務的案件</p></div><button className={styles.linkButton} onClick={()=>open('cases')}>查看案件 <ChevronRight size={15}/></button></div>{needsAttentionCases.length?<div className={styles.attentionList}>{needsAttentionCases.map(item=>{const missing=(data.requirements||[]).filter(row=>Number(row.case_id)===Number(item.id)&&row.required&&row.applicable&&['missing','returned'].includes(row.status)).length;return <article className={styles.attentionItem} key={item.id}><span className={missing?styles.warnDot:styles.alertDot}/><div><strong>{item.case_number} · {item.worker_name}</strong><small>{missing?`必要文件待補 ${missing} 份`:'尚未指派負責業務'}</small></div><button type="button" className={styles.smallButton} onClick={()=>selectCase(item)}>處理案件</button></article>})}</div>:<p className={styles.queueEmpty}>目前沒有缺件或未指派的進行中案件。</p>}</section>
    </div>
    <section className={styles.panel}><div className={styles.panelHeader}><div><h2>最近更新案件</h2><p>依最後更新時間排序</p></div><button className={styles.linkButton} onClick={()=>open('cases')}>查看全部 <ChevronRight size={15}/></button></div>{recent.length?<div className={styles.tableWrap}><table><thead><tr><th>案件編號</th><th>工作者</th><th>雇主／客戶</th><th>案件階段</th><th>狀態</th><th>操作</th></tr></thead><tbody>{recent.map(row=><tr key={row.id}><td className={styles.caseNumber}>{row.case_number}</td><td>{row.worker_name}</td><td>{row.employer_name}</td><td>{stageLabel(row.stage)}</td><td><Status value={row.status} options={CASE_STATUSES}/></td><td><button type="button" className={styles.smallButton} onClick={()=>selectCase(row)}>查看案件</button></td></tr>)}</tbody></table></div>:<Empty title="尚未建立案件" text="新增第一筆案件後，案件進度會顯示在這裡。" action="新增案件" onClick={addCase}/>}</section>
    <div className={styles.statGrid}>{cards.map(([label,value,caption,section,filter],i)=><button type="button" className={styles.statCard} key={label} onClick={()=>open(section,filter)} aria-label={`前往${label}清單，共 ${value} 筆`}><span className={`${styles.statIcon} ${styles[`statIcon${i}`]}`}>{[<BriefcaseBusiness size={19}/>,<FileCheck2 size={19}/>,<ClipboardList size={19}/>,<Building2 size={19}/>,<UserRound size={19}/>][i]}</span><p>{label}</p><strong>{value}</strong><small>{caption}</small></button>)}</div>
  </>;
}

function SearchBar({value,onChange,placeholder}) {return <label className={styles.searchBox}><Search size={17}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button type="button" onClick={()=>onChange('')} aria-label="清除搜尋"><X size={15}/></button>}</label>}
function CaseList({rows,initialStatus,search,setSearch,selectCase,add,clearQuickFilter,tasks,agencies}) {
  const [stageFilter,setStageFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState(initialStatus);
  const [assigneeFilter,setAssigneeFilter]=useState('all');
  const [agencyFilter,setAgencyFilter]=useState('all');
  const [overdueOnly,setOverdueOnly]=useState(false);
  useEffect(()=>setStatusFilter(initialStatus),[initialStatus]);
  const today=new Date().toLocaleDateString('en-CA');
  const overdueCaseIds=new Set(tasks.filter(task=>task.status!=='done'&&task.due_date&&String(task.due_date).slice(0,10)<today).map(task=>Number(task.case_id)));
  const assignees=[...new Map(rows.filter(row=>row.assigned_member_id).map(row=>[String(row.assigned_member_id),row.assigned_member_name])).entries()];
  const agenciesInCases=[...new Set(rows.flatMap(row=>[row.employer_agency_id,row.worker_agency_id]).filter(Boolean).map(Number))].map(id=>[id,agencies.find(agency=>Number(agency.id)===id)?.name||`仲介 #${id}`]);
  const visible=rows.filter(row=>(stageFilter==='all'||row.stage===stageFilter)&&(statusFilter==='all'||row.status===statusFilter)
    &&(assigneeFilter==='all'||String(row.assigned_member_id||'')===assigneeFilter)
    &&(agencyFilter==='all'||[row.employer_agency_id,row.worker_agency_id].some(id=>Number(id)===Number(agencyFilter)))
    &&(!overdueOnly||overdueCaseIds.has(Number(row.id))));
  const filtersActive=stageFilter!=='all'||statusFilter!=='all'||assigneeFilter!=='all'||agencyFilter!=='all'||overdueOnly||Boolean(search);
  function clearFilters(){setSearch('');setStageFilter('all');setStatusFilter('all');setAssigneeFilter('all');setAgencyFilter('all');setOverdueOnly(false);clearQuickFilter();}
  return <section className={styles.panel}><div className={`${styles.listToolbar} ${styles.filterToolbar}`}><SearchBar value={search} onChange={setSearch} placeholder="搜尋案件編號、人員或職類"/><label className={styles.filterField}>案件階段<select className={styles.inlineSelect} value={stageFilter} onChange={event=>setStageFilter(event.target.value)}><option value="all">全部階段</option>{STAGES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className={styles.filterField}>案件狀態<select className={styles.inlineSelect} value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">全部狀態</option>{CASE_STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className={styles.filterField}>負責業務<select className={styles.inlineSelect} value={assigneeFilter} onChange={event=>setAssigneeFilter(event.target.value)}><option value="all">全部負責人</option><option value="">未指派</option>{assignees.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className={styles.filterField}>仲介<select className={styles.inlineSelect} value={agencyFilter} onChange={event=>setAgencyFilter(event.target.value)}><option value="all">全部仲介</option>{agenciesInCases.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className={styles.filterField}><input type="checkbox" checked={overdueOnly} onChange={event=>setOverdueOnly(event.target.checked)}/>有逾期待辦</label>{filtersActive&&<button type="button" className={styles.smallButton} onClick={clearFilters}>清除全部篩選</button>}<span className={styles.rowCount}>{visible.length} 筆案件</span></div>{visible.length?<><div className={`${styles.tableWrap} ${styles.caseTable}`}><table><thead><tr><th>案件編號</th><th>工作者</th><th>雇主／客戶</th><th>負責業務</th><th>階段</th><th>狀態</th><th>待辦</th><th>操作</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}><td className={styles.caseNumber}>{row.case_number}</td><td>{row.worker_name}</td><td>{row.employer_name}</td><td>{row.assigned_member_name||'未指派'}</td><td>{stageLabel(row.stage)}</td><td><Status value={row.status} options={CASE_STATUSES}/></td><td>{row.open_task_count}/{row.task_count}</td><td><button type="button" className={styles.smallButton} onClick={()=>selectCase(row)}>查看案件</button></td></tr>)}</tbody></table></div><div className={styles.caseMobileList}>{visible.map(row=><article className={styles.caseMobileCard} key={`mobile-${row.id}`}><header><strong>{row.case_number}</strong><Status value={row.status} options={CASE_STATUSES}/></header><dl><div><dt>工作者</dt><dd>{row.worker_name}</dd></div><div><dt>雇主／客戶</dt><dd>{row.employer_name}</dd></div><div><dt>階段</dt><dd>{stageLabel(row.stage)}</dd></div><div><dt>負責業務</dt><dd>{row.assigned_member_name||'未指派'}</dd></div><div><dt>未完成待辦</dt><dd>{row.open_task_count}/{row.task_count}</dd></div></dl><button type="button" className={styles.smallButton} onClick={()=>selectCase(row)}>查看案件</button></article>)}</div></>:<Empty title={filtersActive?'找不到符合的案件':'尚無案件資料'} text={filtersActive?'請調整搜尋條件或清除篩選。':'建立雇主與工作者資料後，即可新增案件。'} action={!filtersActive?'新增案件':null} onClick={add}/>}</section>
}
function JobOrderList({orders,assignments,routes,candidates,admin,agencies,agencyContacts,submit,update}) {return <section className={styles.panel}><div className={styles.listToolbar}><span className={styles.rowCount}>{orders.length} 張需求單</span>{admin&&<span className={styles.cellNote}>管理者可直接指派台灣仲介與菲律賓仲介，並指定台灣業務</span>}</div>{orders.length?<><div className={`${styles.tableWrap} ${styles.jobOrderWrap}`}><table className={styles.jobOrderTable}><thead><tr><th>需求單</th><th>雇主／工作類型</th><th>人數</th><th>台灣仲介機構／業務</th><th>菲律賓仲介</th><th>推薦人選與面試</th><th>狀態</th>{admin&&<th>媒合管理</th>}</tr></thead><tbody>{orders.map(order=>{const oa=assignments.filter(row=>Number(row.job_order_id)===Number(order.id));const routeRows=routes.filter(row=>oa.some(dispatch=>Number(dispatch.id)===Number(row.order_agency_id)));const people=candidates.filter(row=>Number(row.job_order_id)===Number(order.id));return <tr key={order.id}><td>#{order.id}<small className={styles.cellNote}>{dateLabel(order.created_at)}</small></td><td><strong>{order.employer_name}</strong><small className={styles.cellNote}>{order.job_type}</small><small className={styles.cellNote}>{order.description||'未填工作條件'}</small></td><td>{order.headcount}</td><td>{oa.length?oa.map(row=><div key={row.id}>{row.taiwan_agency_name}<small className={styles.cellNote}>{row.broker_name?`業務：${row.broker_name}`:'未指定業務'}</small></div>):'尚未指派台灣仲介'}</td><td>{routeRows.length?routeRows.map(row=><div key={row.id}>{row.philippines_agency_name}</div>):'尚未指派菲律賓仲介'}</td><td>{people.length?people.map(person=><div key={person.id}>{person.worker_name} · {({proposed:'待面試',scheduled:'已安排',passed:'錄用',rejected:'未錄用'})[person.status]}{person.case_id?` · 案件 #${person.case_id}`:''}</div>):'尚無推薦'}</td><td>{admin?<select className={styles.inlineSelect} value={order.status} onChange={event=>update({type:'job-order-admin-status',id:order.id,status:event.target.value})}><option value="open">媒合中</option><option value="filled">已額滿</option><option value="cancelled">已取消</option></select>:({open:'媒合中',filled:'已額滿',cancelled:'已取消'})[order.status]||order.status}</td>{admin&&<td><OrderMatchingControls order={order} assignments={oa} routes={routeRows} agencies={agencies} agencyContacts={agencyContacts} submit={submit}/></td>}</tr>})}</tbody></table></div><div className={styles.jobOrderMobileList}>{orders.map(order=><JobOrderMobileCard key={order.id} order={order} assignments={assignments.filter(row=>Number(row.job_order_id)===Number(order.id))} routes={routes.filter(row=>Number(row.job_order_id)===Number(order.id))} candidates={candidates.filter(row=>Number(row.job_order_id)===Number(order.id))} admin={admin} agencies={agencies} agencyContacts={agencyContacts} submit={submit} update={update}/>)}</div></>:<Empty title="尚無媒合需求單" text="雇主建立需求並分派仲介後，需求單會顯示在這裡。"/>}</section>}
function JobOrderMobileCard({order,assignments,routes,candidates,admin,agencies,agencyContacts,submit,update}) {
  return <article className={styles.jobOrderCard}>
    <header className={styles.jobOrderCardHeader}><div><span>需求單 #{order.id} · {dateLabel(order.created_at)}</span><h3>{order.employer_name}</h3></div>{admin?<select className={styles.inlineSelect} aria-label="需求狀態" value={order.status} onChange={event=>update({type:'job-order-admin-status',id:order.id,status:event.target.value})}><option value="open">媒合中</option><option value="filled">已額滿</option><option value="cancelled">已取消</option></select>:<strong>{({open:'媒合中',filled:'已額滿',cancelled:'已取消'})[order.status]||order.status}</strong>}</header>
    <div className={styles.jobOrderFacts}><span><small>工作類型</small><b>{order.job_type}</b></span><span><small>需求人數</small><b>{order.headcount} 人</b></span>{order.expected_start_date&&<span><small>預計開始</small><b>{dateLabel(order.expected_start_date)}</b></span>}</div>
    {order.description&&<p className={styles.jobOrderDescription}>{order.description}</p>}
    <section className={styles.jobOrderCardSection}><h4>台灣仲介機構／業務</h4>{assignments.length?assignments.map(row=><p key={row.id}>{row.taiwan_agency_name} · {row.broker_name?`業務：${row.broker_name}`:'未指定業務'}</p>):<p>尚未指派台灣仲介</p>}</section>
    <section className={styles.jobOrderCardSection}><h4>菲律賓仲介</h4>{routes.length?routes.map(row=><p key={row.id}>{row.philippines_agency_name}</p>):<p>尚未指派</p>}</section>
    <section className={styles.jobOrderCardSection}><h4>推薦人選與面試</h4>{candidates.length?candidates.map(person=><p key={person.id}>{person.worker_name} · {({proposed:'待面試',scheduled:'已安排',passed:'錄用',rejected:'未錄用'})[person.status]}{person.case_id?` · 案件 #${person.case_id}`:''}</p>):<p>尚無推薦</p>}</section>
    {admin&&<section className={`${styles.jobOrderCardSection} ${styles.jobOrderAdmin}`}><h4>媒合管理</h4><OrderMatchingControls order={order} assignments={assignments} routes={routes} agencies={agencies} agencyContacts={agencyContacts} submit={submit}/></section>}
  </article>;
}
function OrderMatchingControls({order,assignments,routes,agencies,agencyContacts,submit}) {
  const taiwanAgencyId=String(order.employer_agency_id||'');
  const [brokerId,setBrokerId]=useState(String(assignments.find(item=>Number(item.taiwan_agency_id)===Number(order.employer_agency_id))?.broker_id||''));
  const [saving,setSaving]=useState(false);
  const activeTaiwan=agencies.filter(item=>item.active&&item.agency_type==='taiwan'&&Number(item.id)===Number(order.employer_agency_id));
  const activePhilippines=agencies.filter(item=>item.active&&item.agency_type==='philippines');
  const brokers=agencyContacts.filter(item=>Number(item.agency_id)===Number(taiwanAgencyId));
  async function addAgency(event){event.preventDefault();if(!taiwanAgencyId)return;setSaving(true);try{await submit({type:'job-order-admin-assignment',jobOrderId:order.id,taiwanAgencyId,brokerMemberId:brokerId||null});}finally{setSaving(false);}}
  async function addPhilippines(event,dispatch){event.preventDefault();const ids=[...new FormData(event.currentTarget).getAll('philippinesAgencyIds')];setSaving(true);try{await submit({type:'job-order-admin-philippines-assignment',orderAgencyId:dispatch.id,philippinesAgencyIds:ids});}finally{setSaving(false);}}
  return <div className={styles.matchingControls}>
    <form className={styles.matchingForm} onSubmit={addAgency}><strong>指派雇主所屬仲介／業務</strong><select required value={taiwanAgencyId} disabled><option value="">雇主尚未指派台灣仲介</option>{activeTaiwan.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={brokerId} onChange={event=>setBrokerId(event.target.value)} disabled={!taiwanAgencyId}><option value="">不指定業務</option>{brokers.map(item=><option key={item.id} value={item.id}>{item.display_name}</option>)}</select><button className={styles.smallButton} disabled={saving||!taiwanAgencyId}>儲存指派</button><small className={styles.cellNote}>業務僅能選擇雇主所屬仲介的有效會員。</small></form>
    {assignments.map(dispatch=><form className={styles.matchingForm} key={dispatch.id} onSubmit={event=>void addPhilippines(event,dispatch)}><strong>指派菲律賓仲介（台灣仲介：{dispatch.taiwan_agency_name}）</strong><fieldset className={styles.phAgencyChoices}><legend>勾選並儲存需求單所屬菲律賓仲介</legend>{activePhilippines.map(item=><label key={item.id}><input type="checkbox" name="philippinesAgencyIds" value={item.id} defaultChecked={routes.some(route=>Number(route.order_agency_id)===Number(dispatch.id)&&Number(route.philippines_agency_id)===Number(item.id))}/><span>{item.name}</span></label>)}</fieldset><small className={styles.cellNote}>已有人選推薦或面試紀錄的仲介無法移除。</small><button className={styles.smallButton} disabled={saving||(!activePhilippines.length&&!routes.length)}>儲存菲律賓仲介指派</button><small className={styles.cellNote}>{routes.filter(item=>Number(item.order_agency_id)===Number(dispatch.id)).map(item=>item.philippines_agency_name).join('、')||'尚未指派菲律賓仲介'}</small></form>)}
  </div>;
}
function ContactList({kind,rows,search,setSearch,update,add,edit,remove}) {return <section className={styles.panel}><div className={styles.listToolbar}><SearchBar value={search} onChange={setSearch} placeholder="搜尋名稱、聯絡人或電話"/><span className={styles.rowCount}>{rows.length} 筆資料</span></div>{rows.length?<div className={styles.tableWrap}><table><thead><tr><th>名稱</th><th>雇主類型</th><th>聯絡人</th><th>電話</th><th>Email</th><th>狀態</th><th>建立時間</th><th>操作</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong></td><td>{{home_care:'家庭看護',factory:'工廠',domestic_helper:'家庭幫傭',other:'其他'}[row.employer_type]||'其他'}</td><td>{row.contact_name||'—'}</td><td>{row.phone||'—'}</td><td>{row.email||'—'}</td><td><Status value={row.status} options={RECORD_STATUSES}/></td><td>{dateLabel(row.created_at)}</td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={()=>edit(row)}>編輯</button><button className={styles.smallButton} onClick={()=>update({type:'employer',id:row.id,status:row.status==='active'?'inactive':'active'})}>{row.status==='active'?'停用':'啟用'}</button>{remove&&<button className={styles.smallButton} onClick={()=>remove(row)}>刪除</button>}</div></td></tr>)}</tbody></table></div>:<Empty title={`尚無${kind}資料`} text="建立資料後可在新增案件時選用。" action={`新增${kind}`} onClick={add}/>}</section>}
function WorkerList({rows,search,setSearch,update,add,edit,resume,remove}) {
  return <section className={styles.panel}><div className={styles.listToolbar}><SearchBar value={search} onChange={setSearch} placeholder="搜尋姓名、國籍、聯絡方式"/><span className={styles.rowCount}>{rows.length} 位工作者</span></div>{rows.length?<div className={styles.tableWrap}><table><thead><tr><th>姓名</th><th>國籍</th><th>聯絡電話</th><th>Email</th><th>工作意向</th><th>狀態</th><th>操作</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.nationality||'—'}</td><td>{row.phone||'—'}</td><td>{row.email||'—'}</td><td>{row.job_preference||'—'}</td><td><Status value={row.status} options={RECORD_STATUSES}/></td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={()=>resume(row)}>履歷</button><button className={styles.smallButton} onClick={()=>edit(row)}>編輯</button><button className={styles.smallButton} onClick={()=>update({type:'worker',id:row.id,status:row.status==='active'?'inactive':'active'})}>{row.status==='active'?'停用':'啟用'}</button>{remove&&<button className={styles.smallButton} onClick={()=>remove(row)}>刪除</button>}</div></td></tr>)}</tbody></table></div>:<Empty title="尚無工作者資料" text="新增工作者後可建立案件並追蹤進度。" action="新增工作者" onClick={add}/>}</section>;
}
function normalizeResumeExperiences(profile,field) {
  if(Array.isArray(profile?.[field])&&profile[field].length)return profile[field];
  const legacy=String(profile?.[field==='overseasExperiences'?'overseasWorkDetails':'employmentHistory']||'').trim();
  return legacy?legacy.split(/\r?\n/).filter(Boolean).map(content=>({workplace:'',period:'',title:'',content})): [];
}
function WorkerResumeModal({worker,update,close}) {
  const {lang}=useLanguage();
  const dialogRef=useRef(null);
  const handleDialogKeyDown=useHrDialog(dialogRef,close);
  const [profile,setProfile]=useState(()=>({...EMPTY_RESUME,...(worker.resume_profile||{})}));
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [photoCropFile,setPhotoCropFile]=useState(null);
  const [importing,setImporting]=useState(false);
  const [importMessage,setImportMessage]=useState('');
  useEffect(()=>{
    let active=true;
    fetch(`/api/hr/workers/${worker.id}/resume-photo`,{cache:'no-store'}).then(async response=>{
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'無法讀取履歷照片。');
      if(active&&body.photoDataUrl)setProfile(current=>({...current,photoDataUrl:body.photoDataUrl}));
    }).catch(err=>{if(active)setError(err.message);});
    return()=>{active=false;};
  },[worker.id]);
  function setField(field,value){setProfile(current=>({...current,[field]:value}));}
  function setExperiences(field,rows){const legacyField=field==='overseasExperiences'?'overseasWorkDetails':'employmentHistory';setProfile(current=>({...current,[field]:rows,[legacyField]:''}));}
  async function importPdf(event) {
    const input=event.currentTarget,file=input.files?.[0];
    if(!file)return;
    setImportMessage('');setError('');setImporting(true);
    try{
      const {parsed,importedPhoto}=await parseResumePdf(file);
      setProfile(current=>({...current,...parsed}));
      if(importedPhoto)setPhotoCropFile(importedPhoto);
      setImportMessage(importedPhoto?'已讀取履歷文字並自動擷取照片；請檢查資料與照片後再儲存。':'已讀取履歷文字並填入可辨識欄位；未找到可用照片，請確認並手動上傳。');
    }catch(err){setImportMessage(err.message||'無法讀取此 PDF，請確認檔案未加密且格式正確。');}
    finally{setImporting(false);input.value='';}
  }
  async function choosePhoto(event) {
    const input=event.currentTarget,file=input.files?.[0];
    if(!file)return;
    if(!['image/jpeg','image/png'].includes(file.type)||file.size>1500000){setError('履歷照片僅接受 1.5 MB 以下的 JPG 或 PNG。');input.value='';return;}
    setError('');
    setPhotoCropFile(file);
    input.value='';
  }
  async function save(event) {
    event.preventDefault();setSaving(true);setError('');
    const succeeded=await update({type:'worker-resume',id:worker.id,resumeProfile:profile});
    setSaving(false);
    if(succeeded)close();
  }
  async function clearResume() {
    if(!window.confirm(translateHrText(`確定清除「${worker.name}」的整份履歷？工作者資料與案件紀錄不會刪除。`,lang)))return;
    setSaving(true);setError('');
    const succeeded=await update({type:'worker-resume',id:worker.id,clear:true});
    setSaving(false);
    if(succeeded)close();
  }
  const hasResume=Object.entries(profile).some(([field,value])=>field==='photoDataUrl'?Boolean(value):Array.isArray(value)?value.length>0:Boolean(String(value||'').trim()));
  return <div className={styles.modalBackdrop} onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section ref={dialogRef} tabIndex={-1} onKeyDown={handleDialogKeyDown} className={`${styles.modal} ${styles.resumeModal}`} role="dialog" aria-modal="true" aria-labelledby="worker-resume-title"><header className={styles.modalHeader}><div><span className={styles.kicker}>工作者履歷</span><h2 id="worker-resume-title">{worker.name}</h2><p className={styles.formHint}>{worker.job_preference||'尚未設定工作意向'} · {hasResume?'已有履歷資料':'尚未建立履歷'}</p></div><button type="button" className={styles.iconButton} onClick={close} aria-label="關閉履歷">×</button></header>{photoCropFile&&<HrPhotoCropper file={photoCropFile} onCancel={()=>setPhotoCropFile(null)} onConfirm={photoDataUrl=>{setField('photoDataUrl',photoDataUrl);setPhotoCropFile(null);}}/>}
    {editing?<form onSubmit={save}><div className={styles.resumeImportBox}><div className={styles.field}><span>上傳 PDF 履歷並填入欄位</span><HrFilePicker accept="application/pdf,.pdf" onChange={importPdf} disabled={importing||saving} buttonClassName={styles.smallButton}/></div><p className={styles.formHint}>讀取到的欄位會先填入下方表單；確認內容後按「儲存履歷」才會更新。支援可選取文字的 PDF，檔案上限 15 MB。</p>{importing&&<p className={styles.formHint} role="status">正在讀取履歷 PDF…</p>}{importMessage&&<p className={styles.formHint} role="status">{importMessage}</p>}</div><div className={styles.resumePhotoEditor}>{profile.photoDataUrl?<img src={profile.photoDataUrl} alt={`${worker.name}履歷照片`}/>:<span>尚未上傳照片</span>}<div><div className={styles.field}><span>履歷照片</span><HrFilePicker accept="image/jpeg,image/png" onChange={choosePhoto} buttonClassName={styles.smallButton} hasValue={Boolean(profile.photoDataUrl)}/></div>{profile.photoDataUrl&&<><button type="button" className={styles.smallButton} onClick={()=>setPhotoCropFile(profile.photoDataUrl)}>重新裁切照片</button><button type="button" className={styles.smallButton} onClick={()=>setField('photoDataUrl','')}>移除照片</button></>}</div></div>
      {RESUME_GROUPS.map(group=><section className={styles.resumeEditGroup} key={group.title}><h3>{group.title}</h3><div className={styles.formGrid}>{group.fields.map(([field,label])=><HrResumeFieldControl key={field} field={field} label={label} profile={profile} setField={setField}/>)}</div></section>)}
      {RESUME_EXPERIENCE_FIELDS.map(([field,label])=><section className={styles.resumeEditGroup} key={field}><div className={styles.resumeGroupHeading}><h3>{label}</h3><button type="button" className={styles.smallButton} onClick={()=>setExperiences(field,[...normalizeResumeExperiences(profile,field),{workplace:'',period:'',title:'',content:''}])}>新增經歷</button></div>{normalizeResumeExperiences(profile,field).map((row,index)=><fieldset className={styles.resumeExperience} key={`${field}-${index}`}><legend>{label} {index+1}</legend><div className={styles.formGrid}><Field name={`${field}-${index}-workplace`} label="工作地點／雇主" value={row.workplace||''} onChange={event=>setExperiences(field,normalizeResumeExperiences(profile,field).map((item,i)=>i===index?{...item,workplace:event.target.value}:item))}/><Field name={`${field}-${index}-period`} label="工作期間" value={row.period||''} onChange={event=>setExperiences(field,normalizeResumeExperiences(profile,field).map((item,i)=>i===index?{...item,period:event.target.value}:item))}/><Field name={`${field}-${index}-title`} label="職稱" value={row.title||''} onChange={event=>setExperiences(field,normalizeResumeExperiences(profile,field).map((item,i)=>i===index?{...item,title:event.target.value}:item))}/><Field name={`${field}-${index}-content`} label="工作內容" multiline value={row.content||''} onChange={event=>setExperiences(field,normalizeResumeExperiences(profile,field).map((item,i)=>i===index?{...item,content:event.target.value}:item))}/></div><button type="button" className={styles.smallButton} onClick={()=>setExperiences(field,normalizeResumeExperiences(profile,field).filter((_,i)=>i!==index))}>刪除此經歷</button></fieldset>)}</section>)}
      <section className={styles.resumeEditGroup}><h3>備註</h3><Field name="remarks" label="其他說明" multiline value={profile.remarks||''} onChange={event=>setField('remarks',event.target.value)}/></section>
      {error&&<p className={styles.formError} role="alert">{error}</p>}<div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={()=>setEditing(false)}>取消編輯</button><button className={styles.primaryButton} disabled={saving}>{saving?'儲存中':'儲存履歷'}</button></div>
    </form>:<><div className={styles.resumeViewTop}>{profile.photoDataUrl&&<img src={profile.photoDataUrl} alt={`${worker.name}履歷照片`}/>}<span>{profile.photoDataUrl?'履歷照片':'可新增履歷內容與照片'}</span></div>
      {RESUME_GROUPS.map(group=>{const values=group.fields.filter(([field])=>String(profile[field]||'').trim());return values.length?<section className={styles.resumeViewGroup} key={group.title}><h3>{group.title}</h3><dl className={styles.resumeViewGrid}>{values.map(([field,label])=><div key={field}><dt>{label}</dt><dd>{profile[field]}</dd></div>)}</dl></section>:null})}
      {RESUME_EXPERIENCE_FIELDS.map(([field,label])=>{const rows=normalizeResumeExperiences(profile,field).filter(row=>row.workplace||row.period||row.title||row.content);return rows.length?<section className={styles.resumeViewGroup} key={field}><h3>{label}</h3>{rows.map((row,index)=><article className={styles.resumeViewExperience} key={`${field}-${index}`}><strong>{row.workplace||`${label} ${index+1}`}</strong>{row.period&&<span>{row.period}</span>}{row.title&&<span>{row.title}</span>}{row.content&&<p>{row.content}</p>}</article>)}</section>:null})}
      {profile.remarks&&<section className={styles.resumeViewGroup}><h3>備註</h3><p>{profile.remarks}</p></section>}
      {!hasResume&&<Empty title="尚未建立履歷" text="可由管理者建立並維護這位工作者的完整履歷。"/>}
      {error&&<p className={styles.formError} role="alert">{error}</p>}<div className={styles.modalActions}>{hasResume&&<button type="button" className={styles.secondaryButton} disabled={saving} onClick={()=>void clearResume()}>清除整份履歷</button>}<button type="button" className={styles.primaryButton} onClick={()=>setEditing(true)}>編輯履歷</button></div>
    </>}
  </section></div>;
}
function TaskList({rows,cases,search,setSearch,update,saving,add}) {
  const [statusFilter,setStatusFilter]=useState('open');
  const [categoryFilter,setCategoryFilter]=useState('all');
  const [dueFilter,setDueFilter]=useState('all');
  const today=new Date().toLocaleDateString('en-CA');
  const visible=rows.filter(row=>{
    const due=row.due_date?String(row.due_date).slice(0,10):'';
    const matchesDue=dueFilter==='all'||(dueFilter==='overdue'&&due&&due<today&&row.status!=='done')||(dueFilter==='today'&&due===today)||(dueFilter==='upcoming'&&due>today)||(dueFilter==='unscheduled'&&!due);
    return (statusFilter==='all'||(statusFilter==='open'?row.status!=='done':row.status===statusFilter))
      &&(categoryFilter==='all'||row.category===categoryFilter)&&matchesDue;
  });
  const filtersActive=Boolean(search)||statusFilter!=='open'||categoryFilter!=='all'||dueFilter!=='all';
  return <section className={styles.panel}><div className={styles.listToolbar}><SearchBar value={search} onChange={setSearch} placeholder="搜尋待辦、案件編號或工作者"/><label className={styles.filterField}>狀態<select className={styles.inlineSelect} value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="open">未完成</option>{TASK_STATUSES.map(([value,label])=><option value={value} key={value}>{label}</option>)}<option value="all">全部狀態</option></select></label><label className={styles.filterField}>分類<select className={styles.inlineSelect} value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option value="all">全部分類</option>{TASK_CATEGORIES.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label className={styles.filterField}>期限<select className={styles.inlineSelect} value={dueFilter} onChange={event=>setDueFilter(event.target.value)}><option value="all">所有期限</option><option value="overdue">已逾期</option><option value="today">今天到期</option><option value="upcoming">未來到期</option><option value="unscheduled">未設定期限</option></select></label>{filtersActive&&<button type="button" className={styles.smallButton} onClick={()=>{setSearch('');setStatusFilter('open');setCategoryFilter('all');setDueFilter('all')}}>清除全部篩選</button>}<span className={styles.rowCount}>{visible.length} 筆待辦</span><button className={styles.primaryButton} disabled={!cases.length} onClick={add}><Plus size={16}/>新增待辦</button></div>{visible.length?<div className={styles.tableWrap}><table><thead><tr><th>待辦事項</th><th>案件</th><th>工作者</th><th>分類</th><th>期限</th><th>狀態</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><strong>{row.title}</strong>{row.notes&&<small className={styles.cellNote}>{row.notes}</small>}</td><td className={styles.caseNumber}>{row.case_number}</td><td>{row.worker_name}</td><td>{statusLabel(row.category,TASK_CATEGORIES)}</td><td>{dateLabel(row.due_date)}</td><td><select className={styles.inlineSelect} value={row.status} disabled={saving} onChange={event=>update({type:'task',id:row.id,status:event.target.value})}>{TASK_STATUSES.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></td></tr>)}</tbody></table></div>:<Empty title={filtersActive?'找不到符合的待辦':'尚無工作待辦'} text={filtersActive?'請調整搜尋條件或清除篩選。':'在案件中新增文件、體檢、訓練或其他待辦。'} action={!filtersActive&&cases.length?'新增待辦':null} onClick={add}/>}</section>
}
function DocumentList({rows,submissions,cases,review,addSubmission,addRequirement,search,setSearch}) {
  const [filter,setFilter]=useState('all');
  const [applicabilityFilter,setApplicabilityFilter]=useState('all');
  const [previewItems,setPreviewItems]=useState(null);
  const [previewIndex,setPreviewIndex]=useState(0);
  const [rejectRow,setRejectRow]=useState(null);
  const [rejectReason,setRejectReason]=useState('');
  const [rejectError,setRejectError]=useState('');
  const reasonInput=useRef(null);
  const rejectTrigger=useRef(null);
  const rejectDialogRef=useRef(null);
  const previewDialogRef=useRef(null);
  const handleRejectKeyDown=useHrDialog(rejectDialogRef,()=>{setRejectRow(null);setRejectError('')});
  const handlePreviewKeyDown=useHrDialog(previewDialogRef,()=>setPreviewItems(null));
  useEffect(()=>{
    if(rejectRow)reasonInput.current?.focus();
    else if(rejectTrigger.current){rejectTrigger.current.focus();rejectTrigger.current=null;}
  },[rejectRow]);
  const visible=rows.filter(row=>(filter==='all'||(filter==='not-applicable'&&!row.applicable)||(filter!=='not-applicable'&&row.status===filter))
    &&(applicabilityFilter==='all'||(applicabilityFilter==='applicable'&&row.applicable)||(applicabilityFilter==='not-applicable'&&!row.applicable))
    &&(!search||[row.name,row.worker_name,row.review_reason].some(value=>String(value||'').toLowerCase().includes(search.toLowerCase()))));
  const filtersActive=filter!=='all'||applicabilityFilter!=='all'||Boolean(search);
  const decide=(row,decision,trigger)=>{
    if(decision==='returned'){
      rejectTrigger.current=trigger;
      setRejectRow(row);
      setRejectReason('');
      setRejectError('');
      return;
    }
    void review({type:'review',submissionId:row.latest_submission_id,decision,reason:''});
  };
  async function returnForCorrection(event) {
    event.preventDefault();
    const reason=rejectReason.trim();
    if(!reason){setRejectError('請填寫補件原因。');return;}
    const saved=await review({type:'review',submissionId:rejectRow.latest_submission_id,decision:'returned',reason});
    if(saved){setRejectRow(null);setRejectReason('');setRejectError('');}
  }
  const commonReasons=['檔案模糊，請重新上傳清晰版本','資料不完整，請補齊缺漏內容','檔案格式錯誤，請重新上傳 PDF、JPG 或 PNG','文件已過期，請提供有效文件'];
  return <><section className={styles.panel}><div className={styles.listToolbar}><SearchBar value={search} onChange={setSearch} placeholder="搜尋文件、案件、人員或退回原因"/><label className={styles.filterField}>審核狀態<select className={styles.inlineSelect} value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">全部狀態</option><option value="submitted">待審</option><option value="returned">已退回</option><option value="missing">未收件</option><option value="approved">已核准</option></select></label><label className={styles.filterField}>適用狀態<select className={styles.inlineSelect} value={applicabilityFilter} onChange={event=>setApplicabilityFilter(event.target.value)}><option value="all">全部文件</option><option value="applicable">適用</option><option value="not-applicable">不適用</option></select></label>{filtersActive&&<button type="button" className={styles.smallButton} onClick={()=>{setSearch('');setFilter('all');setApplicabilityFilter('all')}}>清除全部篩選</button>}<span className={styles.rowCount}>{visible.length} 項文件要求</span><button className={styles.primaryButton} disabled={!cases.length} onClick={addRequirement}><Plus size={16}/>新增文件要求</button></div>{visible.length?<div className={styles.tableWrap}><table><thead><tr><th>文件項目</th><th>工作者</th><th>必要</th><th>最近收件</th><th>狀態／審核原因</th><th>操作</th></tr></thead><tbody>{visible.map(row=>{const history=submissions.filter(item=>Number(item.requirement_id)===Number(row.id));return <tr key={row.id}><td><strong>{row.name}</strong>{row.applicability&&<small className={styles.cellNote}>{row.applicability}</small>}{row.entry_gate&&<small className={styles.cellNote}>啟動前置文件</small>}</td><td><strong>{row.worker_name}</strong></td><td>{!row.applicable?'不適用':row.required?'必要':'選填'}</td><td>{row.latest_filename||'尚未收件'}{row.latest_submission_at&&<small className={styles.cellNote}>{dateLabel(row.latest_submission_at)}</small>}</td><td><Status value={row.status} options={[["missing","未收件"],["submitted","待審"],["approved","已核准"],["returned","退回補件"]]}/>{row.review_reason&&<small className={styles.cellNote}>{row.review_reason}</small>}</td><td><div className={styles.rowActions}>{history[0]?.original_filename&&<><button className={styles.smallButton} onClick={()=>{setPreviewItems(history);setPreviewIndex(0)}}>預覽 ({history.length})</button><a className={styles.smallButton} href={`/api/hr/documents/${history[0].id}`}>下載</a></>}{row.status!=='approved'&&row.applicable&&<button className={styles.smallButton} onClick={()=>addSubmission(row)}>{row.status==='submitted'?'新增版本':'上傳文件'}</button>}{row.status==='submitted'&&<><button className={styles.smallButton} onClick={()=>decide(row,'approved')}>核准</button><button className={styles.smallButton} onClick={event=>decide(row,'returned',event.currentTarget)}>退回</button></>}</div>{history.length>1&&<small className={styles.cellNote}>共 {history.length} 個版本</small>}</td></tr>})}</tbody></table></div>:<Empty title={filtersActive?'找不到符合條件的文件':'目前沒有文件項目'} text={filtersActive?'請調整篩選條件或清除全部篩選。':'案件建立時會新增完整收件清單；其他文件可在這裡新增。'} action={!filtersActive&&cases.length?'新增文件要求':null} onClick={addRequirement}/>}</section>{rejectRow&&<div className={styles.modalBackdrop} onMouseDown={event=>{if(event.target===event.currentTarget){setRejectRow(null);setRejectError('');}}}><section ref={rejectDialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="return-document-title" onKeyDown={handleRejectKeyDown}><header className={styles.modalHeader}><div><span className={styles.kicker}>文件審核</span><h2 id="return-document-title">退回文件並要求補件</h2><p className={styles.formHint}>{rejectRow.case_number} · {rejectRow.worker_name} · {rejectRow.name}</p></div><button type="button" className={styles.iconButton} onClick={()=>{setRejectRow(null);setRejectError('');}} aria-label="關閉">×</button></header><form onSubmit={returnForCorrection}><p className={styles.formHint}>工作者會看到這段說明，請具體指出需要修正或補交的內容。</p><div className={styles.reasonChoices} aria-label="常用補件原因">{commonReasons.map(reason=><button type="button" key={reason} className={styles.smallButton} onClick={()=>{setRejectReason(reason);setRejectError('');}}>{reason}</button>)}</div><label className={styles.field} htmlFor="document-return-reason">補件原因（必填）<textarea ref={reasonInput} id="document-return-reason" rows="4" maxLength={1000} required value={rejectReason} onChange={event=>{setRejectReason(event.target.value);setRejectError('');}}/></label>{rejectError&&<p className={styles.formError} role="alert">{rejectError}</p>}<div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={()=>{setRejectRow(null);setRejectError('');}}>取消</button><button type="submit" className={styles.primaryButton}>退回並通知</button></div></form></section></div>}{previewItems&&<div className={styles.modalBackdrop} onMouseDown={event=>{if(event.target===event.currentTarget)setPreviewItems(null)}}><section ref={previewDialogRef} tabIndex={-1} className={`${styles.modal} ${styles.documentPreview}`} role="dialog" aria-modal="true" aria-label="文件預覽" onKeyDown={handlePreviewKeyDown}><header className={styles.modalHeader}><div><h2>文件預覽</h2><p className={styles.previewFilename}>{previewItems[previewIndex]?.original_filename} · 第 {previewItems[previewIndex]?.version_number} 版</p></div><button className={styles.iconButton} onClick={()=>setPreviewItems(null)} aria-label="關閉"><X size={18}/></button></header><nav className={styles.previewVersions} aria-label="文件版本">{previewItems.map((item,index)=><button key={item.id} className={index===previewIndex?styles.previewVersionActive:''} onClick={()=>setPreviewIndex(index)}>第 {item.version_number} 版{item.original_filename&&<small>{item.original_filename}</small>}</button>)}</nav>{/^(application\/pdf|image\/)/i.test(previewItems[previewIndex]?.content_type||'')?<iframe className={styles.documentFrame} title={`預覽 ${previewItems[previewIndex]?.original_filename}`} src={`/api/hr/documents/${previewItems[previewIndex].id}?preview=1`}/>:<div className={styles.previewUnsupported}>此檔案格式無法直接預覽。<a className={styles.smallButton} href={`/api/hr/documents/${previewItems[previewIndex].id}`}>下載文件</a></div>}</section></div>}</>;
}
function WorkflowList({rows,requirements,update,saving,search,setSearch}) {
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>體檢與訓練進度</h2><p>新護照與 PSA 出生證明核准後，才能安排體檢與訓練。</p></div><span className={styles.rowCount}>{rows.length} 件案件</span></div><div className={`${styles.listToolbar} ${styles.filterToolbar}`}><SearchBar value={search} onChange={setSearch} placeholder="搜尋案件編號、工作者、雇主或進度狀態"/></div>{rows.length?<div className={styles.tableWrap}><table><thead><tr><th>案件</th><th>工作者／雇主</th><th>前置文件</th><th>體檢</th><th>訓練</th><th>整體階段</th></tr></thead><tbody>{rows.map(row=>{const gates=requirements.filter(item=>Number(item.worker_id)===Number(row.worker_id)&&item.entry_gate&&item.applicable);const gateOpen=gates.length>0&&gates.every(item=>item.status==='approved');return <tr key={row.id}><td className={styles.caseNumber}>{row.case_number}</td><td>{row.worker_name}<small className={styles.cellNote}>{row.employer_name}</small></td><td><Status value={gateOpen?'approved':'missing'} options={[["approved","已放行"],["missing","待護照／PSA"]]}/></td><td><select className={styles.inlineSelect} value={row.medical_status||'not_scheduled'} disabled={saving||!gateOpen} onChange={event=>update({type:'workflow',caseId:row.id,workflowType:'medical',status:event.target.value})}>{MEDICAL_STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td><td><select className={styles.inlineSelect} value={row.training_status||'not_scheduled'} disabled={saving||!gateOpen} onChange={event=>update({type:'workflow',caseId:row.id,workflowType:'training',status:event.target.value})}>{TRAINING_STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td><td>{stageLabel(row.stage)}</td></tr>})}</tbody></table></div>:search.trim()?<Empty title="找不到符合的案件" text="請調整關鍵字或清除搜尋。"/>:<Empty title="尚無案件" text="建立案件後可追蹤體檢與訓練。"/>}</section>;
}
function AgencyList({rows,update,edit,search,setSearch}) {return <section className={styles.panel}><div className={`${styles.listToolbar} ${styles.filterToolbar}`}><SearchBar value={search} onChange={setSearch} placeholder="搜尋仲介名稱、類型或國家／地區"/><p className={styles.panelDescription}>仲介會員只能查看所屬工作者與相關雇主。</p><span className={styles.rowCount}>{rows.length} 間仲介</span></div>{rows.length?<div className={styles.tableWrap}><table><thead><tr><th>仲介名稱</th><th>類型</th><th>國家／地區</th><th>狀態</th><th>建立時間</th><th>操作</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.agency_type==='taiwan'?'台灣仲介':'菲律賓仲介'}</td><td>{row.country||'—'}</td><td>{row.active?'啟用':'停用'}</td><td>{dateLabel(row.created_at)}</td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={()=>edit(row)}>編輯</button><button className={styles.smallButton} onClick={()=>update({type:'agency',id:row.id,active:!row.active})}>{row.active?'停用':'啟用'}</button></div></td></tr>)}</tbody></table></div>:search.trim()?<Empty title="找不到符合的仲介機構" text="請調整關鍵字或清除搜尋。"/>:<Empty title="尚無仲介機構" text="建立仲介後可將工作者或雇主指派給所屬仲介。"/>}</section>}
function MemberList({rows,update,review,edit,manageAdmin,isRootAdmin,deleteMember,saving,search,setSearch}) {
  const {lang}=useLanguage();
  const roleNames=MEMBER_ROLE_NAMES;
  const pending=rows.filter(row=>!row.role).length;
  return <section className={styles.panel}>
    <div className={`${styles.listToolbar} ${styles.filterToolbar}`}><SearchBar value={search} onChange={setSearch} placeholder="搜尋會員、Email、會員類型或所屬仲介"/><p className={styles.panelDescription}>仲介類型會員是仲介機構員工：台灣機構員工稱為「業務」，菲律賓機構員工稱為「Staff」。管理者將會員綁定所屬機構後，該機構可有多位員工帳號。</p><span className={styles.rowCount}>{pending?`${pending} 筆待審 · `:''}{rows.length} 個會員帳號</span></div>
    {rows.length?<div className={styles.tableWrap}><table><thead><tr><th>會員</th><th>登入 Email</th><th>申請類型</th><th>會員類型</th><th>所屬仲介</th><th>狀態</th><th>操作</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>
      <td><strong>{row.display_name}</strong></td><td>{row.email||'LINE 登入'}</td><td>{roleNames[row.requested_role]||'—'}</td><td>{memberTypeLabel(row)}</td>
      <td>{memberUnitLabel(row)}</td><td>{memberStatusLabel(row)}</td>
      <td><div className={styles.rowActions}>{(isRootAdmin||!(row.role==='system_admin'||row.admin_scope==='system'))&&<button className={styles.smallButton} onClick={()=>edit(row)}>編輯資料</button>}{manageAdmin&&(isRootAdmin||!(row.role==='system_admin'||row.admin_scope==='system'))&&<button className={styles.smallButton} onClick={()=>edit({...row,modalType:'member-admin-scope'})}>管理權限</button>}{manageAdmin&&(isRootAdmin||!(row.role==='system_admin'||row.admin_scope==='system'))&&<button className={styles.smallButton} onClick={()=>review(row)}>{row.role?'變更類型':'審核／指派'}</button>}{(isRootAdmin||!(row.role==='system_admin'||row.admin_scope==='system'))&&<button className={styles.smallButton} onClick={()=>update({type:'member',id:row.id,active:!row.active})}>{lang==='en'?(row.active?'Deactivate account':'Activate account'):(row.active?'停用帳號':'啟用帳號')}</button>}{manageAdmin&&!row.protected_admin&&<button className={styles.smallButton} disabled={saving} onClick={()=>deleteMember(row)}>刪除帳號</button>}</div></td>
    </tr>)}</tbody></table></div>:search.trim()?<Empty title="找不到符合的會員帳號" text="請調整關鍵字或清除搜尋。"/>:<Empty title="尚無一般會員帳號" text="會員登入並申請類型後會列於此，管理者可審核並指派所屬仲介。"/>}
  </section>;
}
function AdminAuditList() {
  const [rows,setRows]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;fetch('/api/hr/admin-audit',{cache:'no-store'}).then(async res=>{const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.error||'讀取操作紀錄失敗。');if(live)setRows(json.rows||[]);}).catch(err=>{if(live)setError(err.message);});return()=>{live=false;};},[]);
  return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>系統管理員操作紀錄</h2><p>記錄是哪一位系統管理員對雇主、工作者、仲介、會員與案件做了什麼操作。</p></div><span className={styles.rowCount}>{rows?`最近 ${rows.length} 筆`:''}</span></div>{error?<Empty title="無法讀取操作紀錄" text={error}/>:rows===null?<Empty title="讀取中" text="正在載入操作紀錄。"/>:rows.length?<div className={styles.activityList}>{rows.map(event=><div className={styles.activityRow} key={event.id}><span className={styles.activityDot}/><div><strong>{event.summary}</strong><small>{event.action}{event.actor_email?` · ${event.actor_email}`:''}</small><time>{new Date(event.created_at).toLocaleString('zh-TW')}</time></div></div>)}</div>:<Empty title="尚無系統管理員操作紀錄" text="系統管理員進行新增、修改、啟用、停用或刪除後，會顯示在這裡。"/>}</section>;
}
function ActivityList({rows}) {return <section className={styles.panel}><div className={styles.panelHeader}><div><h2>人力案件操作歷程</h2><p>文件審核、進度變更與文件存取都會記錄在這裡。</p></div><span className={styles.rowCount}>最近 {rows.length} 筆</span></div>{rows.length?<div className={styles.activityList}>{rows.map(event=><div className={styles.activityRow} key={event.id}><span className={styles.activityDot}/><div><strong>{event.action} · {event.case_number}</strong><small>{event.detail} · 操作者 {event.actor_email}</small><time>{new Date(event.created_at).toLocaleString('zh-TW')}</time></div></div>)}</div>:<Empty title="尚無操作紀錄" text="新增或更新案件資料後，操作歷程會顯示在這裡。"/>}</section>}
function Status({value,options}) {return <span className={`${styles.status} ${value==='closed'||value==='done'||value==='active'?styles.statusOpen:value==='blocked'||value==='on_hold'?styles.statusWarn:styles.statusNeutral}`}>{statusLabel(value,options)}</span>}
function Empty({title,text,action,onClick}) {return <div className={styles.empty}><span><ClipboardList size={21}/></span><strong>{title}</strong><p>{text}</p>{action&&<button className={styles.primaryButton} onClick={onClick}><Plus size={16}/>{action}</button>}</div>}

function EntryModal({type,data,record,defaultCaseId,isRootAdmin,close,submit,saving}) {
  const dialogRef=useRef(null);
  const handleDialogKeyDown=useHrDialog(dialogRef,close);
  const [memberRole,setMemberRole]=useState(record?.role||record?.requested_role||'worker');
  const [memberTarget,setMemberTarget]=useState(record?.worker_id||record?.employer_id||record?.agency_id||(record?.requested_role==='agency'?record?.requested_agency_id:'')||'');
  const [memberAgencyId,setMemberAgencyId]=useState(record?.worker_agency_id||record?.employer_agency_id||record?.requested_agency_id||record?.agency_id||'');
  const [memberEmployerType,setMemberEmployerType]=useState('home_care');
  const [caseEmployerId,setCaseEmployerId]=useState('');
  const assignedWorkerIds=new Set((data.members||[]).filter(x=>x.role==='worker'&&Number(x.id)!==Number(record?.id)).map(x=>Number(x.worker_id)));
  const assignedEmployerIds=new Set((data.members||[]).filter(x=>x.role==='employer'&&Number(x.id)!==Number(record?.id)).map(x=>Number(x.employer_id)));
  const memberAgencies=(data.agencies||[]).filter(x=>x.active&&x.agency_type===(memberRole==='worker'?'philippines':'taiwan'));
  const reviewAgencies=(data.agencies||[]).filter(x=>x.active&&(!['worker','employer'].includes(memberRole)||x.agency_type===(memberRole==='worker'?'philippines':'taiwan')));
  const memberTargets=memberRole==='worker'?(data.workers||[]).filter(x=>x.status==='active'&&(!assignedWorkerIds.has(Number(x.id))||Number(x.id)===Number(record?.worker_id))&&memberAgencyId&&(!x.agency_id||Number(x.agency_id)===Number(memberAgencyId))).map(x=>[x.id,x.name]):memberRole==='employer'?(data.employers||[]).filter(x=>x.status==='active'&&(!assignedEmployerIds.has(Number(x.id))||Number(x.id)===Number(record?.employer_id))&&memberAgencyId&&(!x.agency_id||Number(x.agency_id)===Number(memberAgencyId))).map(x=>[x.id,x.name]):(data.agencies||[]).filter(x=>x.active).map(x=>[x.id,x.name]);
  const caseWorkerIds=new Set((data.members||[]).filter(member=>member.role==='worker'&&member.active&&member.worker_id).map(member=>Number(member.worker_id)));
  const caseWorkers=(data.workers||[]).filter(worker=>worker.status==='active'&&(data.role!=='admin'||caseWorkerIds.has(Number(worker.id)))).map(worker=>[worker.id,worker.name]);
  const labels={employer:'雇主／客戶',worker:'工作者',agency:'仲介機構',member:'會員帳號','member-role':'會員類型','member-profile':'會員資料','member-admin-scope':'管理者權限',case:'案件',task:'工作待辦',requirement:'文件要求',submission:'文件收件'};
  const title=type==='submission'?'上傳文件':`${record?'編輯':'新增'}${labels[type]}`;
  async function handle(event) {event.preventDefault();const form=new FormData(event.currentTarget);const value=Object.fromEntries(form.entries());if(type==='submission'){const upload=new FormData();upload.set('requirementId',String(record.id));upload.set('file',form.get('file'));upload.set('note',value.note||'');await submit(upload);return}const payload={type,...value};if(type==='worker')payload.resumeProfile={...(record?.resume_profile||{}),gender:value.gender};if(type==='member-role'){payload.type='member';payload.agencyId=Number(value.agencyId)}if(type==='case'){payload.employerId=value.employerId;payload.workerId=value.workerId;payload.assignedMemberId=value.assignedMemberId||null;payload.expectedStartDate=value.expectedStartDate||''}if(type==='task'){payload.caseId=value.caseId;payload.dueDate=value.dueDate||''}if(type==='requirement'){payload.caseId=value.caseId;payload.required=form.has('required');payload.entryGate=form.has('entryGate')}await submit(payload)}
  return <div className={styles.modalBackdrop} onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><form ref={dialogRef} tabIndex={-1} onKeyDown={handleDialogKeyDown} className={styles.modal} onSubmit={handle} autoComplete="off" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title"><div className={styles.modalHeader}><div><span className={styles.kicker}>人力仲介資料</span><h2 id="entry-modal-title">{title}</h2>{(type==='member'||type==='member-role')&&memberRole==='agency'&&<p className={styles.formHint}>此會員是所屬仲介機構的員工，可有多個員工帳號；台灣員工稱「業務」、菲律賓員工稱「Staff」。</p>}</div><button type="button" className={styles.iconButton} onClick={close} aria-label="關閉"><X size={18}/></button></div>
    {type==='employer'&&<><Field name="name" label="雇主／客戶名稱" required defaultValue={record?.name}/><div className={styles.formGrid}><SelectField name="employerType" label="雇主類型" defaultValue={record?.employer_type||'other'} options={[[ 'domestic_helper','家庭幫傭'],['home_care','家庭看護'],['factory','工廠'],['other','其他']]}/><SelectField name="agencyId" label="所屬台灣仲介" defaultValue={record?.agency_id||''} options={[[ '', '未指定'],...(data.agencies||[]).filter(x=>x.agency_type==='taiwan'&&x.active).map(x=>[x.id,x.name])]}/><PersonNameFields name="contactName" label="聯絡人" value={record?.contact_name||''} className={styles.field} key={`contact-${record?.id||'new'}`}/><Field name="phone" label="聯絡電話" defaultValue={record?.phone}/><Field name="email" label="Email" type="email" defaultValue={record?.email}/><Field name="address" label="地址" defaultValue={record?.address}/></div><Field name="notes" label="備註" multiline defaultValue={record?.notes}/></>}
    {type==='worker'&&<><div className={styles.formGrid}><PersonNameFields name="name" label="姓名" required value={record?.name||''} className={styles.field} key={`worker-${record?.id||'new'}`}/><Field name="nationality" label="國籍" defaultValue={record?.nationality}/><SelectField name="agencyId" label="所屬菲律賓仲介" defaultValue={record?.agency_id||''} options={[[ '', '未指定'],...(data.agencies||[]).filter(x=>x.agency_type==='philippines'&&x.active).map(x=>[x.id,x.name])]}/><Field name="phone" label="聯絡電話" defaultValue={record?.phone}/><Field name="email" label="Email" type="email" defaultValue={record?.email}/><SelectField name="jobPreference" label="工作意向" required defaultValue={record?.job_preference||''} options={[[ '家庭幫傭','家庭幫傭'],['家庭看護','家庭看護'],['工廠技術工','工廠技術工'],['農工','農工'],['機構看護工','機構看護工']]}/><SelectField name="gender" label="性別" required defaultValue={record?.resume_profile?.gender||''} options={[[ 'male','Male'],['female','Female']]}/></div><Field name="notes" label="備註" multiline defaultValue={record?.notes}/><p className={styles.formHint}>請只填寫辦件必要資料，不要在備註放入護照號碼、銀行或醫療等敏感資訊。</p></>}
    {type==='agency'&&<><Field name="name" label="仲介名稱" required defaultValue={record?.name}/><SelectField name="agencyType" label="仲介類型" defaultValue={record?.agency_type||'taiwan'} options={[[ 'taiwan','台灣仲介'],['philippines','菲律賓仲介']]}/><Field name="country" label="國家／地區" defaultValue={record?.country||''}/></>}
    {type==='member'&&<><div className={styles.formGrid}><PersonNameFields name="name" label="會員名稱" required className={styles.field} key="member-new"/><Field name="email" label="登入 Email" type="email" required/><Field name="password" label="初始密碼（至少 10 字元）" type="password" required/><Field name="lineUserId" label="LINE User ID（選填）" autoComplete="new-password"/></div><SelectField name="role" label="會員類型" value={memberRole} onChange={event=>{setMemberRole(event.target.value);setMemberAgencyId('');setMemberTarget('')}} options={[[ 'worker','工作者'],['employer','雇主'],['agency','仲介'],['training_center','訓練中心'],...(isRootAdmin?[['system_admin','系統管理者']]:[])]}/>{memberRole==='worker'||memberRole==='employer'?<><SelectField name="agencyId" label={memberRole==='worker'?'所屬菲律賓仲介':'所屬台灣仲介'} required value={memberAgencyId} onChange={event=>setMemberAgencyId(event.target.value)} options={memberAgencies.map(x=>[x.id,x.name])}/>{memberRole==='worker'?<div className={styles.formGrid}><Field name="nationality" label="國籍" defaultValue="菲律賓"/><SelectField name="jobPreference" label="工作意向" required options={[[ '家庭幫傭','家庭幫傭'],['家庭看護','家庭看護'],['機構看護工','機構看護工'],['工廠技術工','工廠技術工'],['農工','農工']]}/><SelectField name="gender" label="性別" required options={[[ 'male','Male'],['female','Female']]}/></div>:<SelectField name="employerType" label="雇主類型" value={memberEmployerType} onChange={event=>setMemberEmployerType(event.target.value)} options={[[ 'home_care','家庭看護'],['factory','工廠'],['domestic_helper','家庭幫傭'],['other','其他']]}/>}</>:memberRole==='agency'?<SelectField name="targetId" label="所屬仲介" required value={memberTarget} onChange={event=>setMemberTarget(event.target.value)} options={memberTargets}/>:null}{memberRole==='system_admin'?<p className={styles.formHint}>系統管理者擁有全站最高權限，不需綁定仲介；僅 ENV 綁定的 LINE 最高管理者可新增或管理系統管理者。</p>:memberRole==='training_center'?<p className={styles.formHint}>訓練中心會員不需指派所屬仲介。</p>:<p className={styles.formHint}>建立會員時會同步建立對應的{memberRole==='worker'?'工作者':'雇主'}資料並綁定所屬仲介。</p>}</>}
    {type==='member-role'&&<><p className={styles.formHint}>{record?.requested_role?`會員申請類型：${({worker:'工作者',employer:'雇主',agency:'仲介',training_center:'訓練中心'})[record.requested_role]}。`:'管理者可變更會員類型。'}系統管理者擁有全站最高權限且不需綁定仲介；只有 ENV 綁定的 LINE 最高管理者可指派此身分。{record?.requested_agency_name?` 會員申請的所屬仲介：${record.requested_agency_name}。`:''}</p><SelectField name="role" label="會員類型" required value={memberRole} onChange={event=>{setMemberRole(event.target.value);setMemberAgencyId('')}} options={[[ 'worker','工作者'],['employer','雇主'],['agency','仲介'],['training_center','訓練中心'],...(isRootAdmin?[['system_admin','系統管理者']]:[])]}/>{memberRole==='system_admin'?<p className={styles.formHint}>系統管理者不需所屬仲介，並擁有全站最高權限。</p>:memberRole!=='training_center'&&<><SelectField name="agencyId" label={memberRole==='worker'?'所屬菲律賓仲介':memberRole==='employer'?'所屬台灣仲介':'所屬仲介'} required value={memberAgencyId} onChange={event=>setMemberAgencyId(event.target.value)} options={reviewAgencies.map(x=>[x.id,x.name])}/><p className={styles.formHint}>核准後會員會直接綁定此仲介；工作者與雇主對應資料由系統建立，日後可在工作者／雇主頁面編輯。</p></>}</>}
    {type==='member-profile'&&<><div className={styles.formGrid}><PersonNameFields name="displayName" label="會員名稱" required value={record?.display_name||''} className={styles.field} key={`member-profile-${record?.id||'new'}`}/><Field name="email" label="登入 Email" type="email" defaultValue={record?.email||''}/><Field name="lineUserId" label="LINE User ID" autoComplete="new-password" defaultValue={record?.line_user_id||''}/><Field name="password" label="重設密碼（選填，至少 10 字元）" type="password" autoComplete="new-password"/></div><p className={styles.formHint}>LINE User ID 只填 LINE 提供的使用者 ID，請勿填登入 Email；Email 或 LINE User ID 至少要保留一項，密碼留空時會維持原設定。</p></>}
    {type==='member-admin-scope'&&<><SelectField name="adminScope" label="管理者權限" defaultValue={record?.admin_scope||'none'} options={[[ 'none','一般會員'],...(record?.role==='agency'?[['agency','仲介管理者']]:[]),...(isRootAdmin&&!['worker','employer'].includes(record?.role)?[['system','系統管理者']]:[])]}/>{['worker','employer','agency'].includes(record?.role)&&<SelectField name="agencyId" label={record.role==='worker'?'所屬菲律賓仲介':record.role==='employer'?'所屬台灣仲介':'所屬仲介機構（仲介管理者必填）'} required={record.role!=='agency'} value={memberAgencyId} onChange={event=>setMemberAgencyId(event.target.value)} options={[[ '', '請選擇仲介機構'],...(record.role==='worker'||record.role==='employer'?memberAgencies:(data.agencies||[]).filter(item=>item.active)).map(item=>[item.id,item.name])]}/>}<p className={styles.formHint}>變更工作者或雇主會員的仲介會同步更新其工作者／雇主資料；仲介管理者僅適用仲介會員。系統管理者權限只能由 ENV 綁定的 LINE 最高管理者設定。</p></>}
    {type==='case'&&<><div className={styles.formGrid}><SelectField name="employerId" label="雇主／客戶" required value={caseEmployerId} onChange={event=>setCaseEmployerId(event.target.value)} options={data.employers.filter(x=>x.status==='active').map(x=>[x.id,x.name])}/><SelectField name="workerId" label="工作者" required options={caseWorkers}/><SelectField name="assignedMemberId" label="所屬台灣仲介業務" options={[[ '', '不指定業務'],...(data.agencyContacts||[]).filter(member=>Number(member.agency_id)===Number(data.employers.find(x=>Number(x.id)===Number(caseEmployerId))?.agency_id)).map(member=>[member.id,`${member.agency_name} · ${member.display_name}`])]}/><SelectField name="jobType" label="職類" defaultValue={record?.job_type||''} options={CASE_JOB_TYPES}/><Field name="expectedStartDate" label="預計日期" type="date"/></div><Field name="notes" label="案件備註" multiline/><p className={styles.formHint}>工作者僅顯示已啟用的工作者會員；業務由雇主所屬台灣仲介會員擔任，未指定時案件仍歸屬仲介機構。</p></>}
    {type==='task'&&<><SelectField name="caseId" label="所屬案件" required defaultValue={defaultCaseId||''} options={data.cases.filter(x=>x.status!=='closed').map(x=>[x.id,`${x.case_number} · ${x.worker_name}`])}/><Field name="title" label="待辦事項" required/><div className={styles.formGrid}><SelectField name="category" label="分類" options={TASK_CATEGORIES}/><Field name="dueDate" label="期限" type="date"/></div><Field name="notes" label="說明" multiline/></>}
    {type==='requirement'&&<><SelectField name="workerId" label="所屬工作者" required options={data.workers.filter(x=>x.status!=='inactive').map(x=>[x.id,x.name])}/><Field name="name" label="文件名稱" required/><label className={styles.checkField}><input type="checkbox" name="required" defaultChecked/>必要文件</label><label className={styles.checkField}><input type="checkbox" name="entryGate"/>啟動體檢／訓練前必須核准</label><p className={styles.formHint}>護照資料頁與 PSA 出生證明是預設前置文件。這裡新增的文件可與體檢、訓練同步辦理。</p></>}
    {type==='submission'&&<><p className={styles.formHint}>案件：{record.case_number} · {record.worker_name}</p><p className={styles.formHint}>文件項目：{record.name}</p><label className={styles.field}>上傳文件<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required/></label><Field name="note" label="收件備註" multiline/><p className={styles.formHint}>只接受 PDF、JPG、PNG，單檔上限 10 MB。審核與下載均會留下案件活動紀錄。</p></>}
    <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={close}>取消</button><button className={styles.primaryButton} disabled={saving}>{saving?'儲存中':'儲存'}</button></div>
  </form></div>;
}
function Field({name,label,type='text',required=false,multiline=false,value,onChange,defaultValue,autoComplete}) {const props=value!==undefined?{value,onChange}:{defaultValue};return <label className={styles.field}>{label}{multiline?<textarea name={name} rows="3" autoComplete={autoComplete} {...props}/>:<input name={name} type={type} required={required} maxLength={type==='email'?254:500} autoComplete={autoComplete} {...props}/>}</label>}
function SelectField({name,label,options,required=false,value,onChange,defaultValue}) {return <label className={styles.field}>{label}<select name={name} required={required} {...(value!==undefined?{value,onChange}:{defaultValue})}><option value="">請選擇</option>{options.map(([value,text])=><option key={value||'none'} value={value}>{text}</option>)}</select></label>}

function CaseDrawer({item,data,close,update,addTask,saving,remove}) {
  const dialogRef=useRef(null);
  const handleDialogKeyDown=useHrDialog(dialogRef,close);
  const [status,setStatus]=useState(item.status),[assignedMember,setAssignedMember]=useState(item.assigned_member_id||''),[date,setDate]=useState(item.expected_start_date?.slice(0,10)||''),[notes,setNotes]=useState(item.notes||'');
  const tasks=data.tasks.filter(task=>Number(task.case_id)===Number(item.id));
  const requirements=(data.requirements||[]).filter(requirement=>Number(requirement.worker_id)===Number(item.worker_id));
  const certifications=(data.certifications||[]).filter(cert=>Number(cert.case_id)===Number(item.id));
  const applicationSteps=(data.applicationSteps||[]).filter(step=>Number(step.case_id)===Number(item.id));
  const activities=data.activity.filter(event=>Number(event.case_id)===Number(item.id)).slice(0,12);
  const pendingDocuments=requirements.filter(requirement=>requirement.status==='submitted').length;
  const missingDocuments=requirements.filter(requirement=>requirement.required&&requirement.applicable&&requirement.status==='missing').length;
  const incompleteStep=applicationSteps.find(step=>!step.completed_on);
  const nextStep=item.status!=='open'?'先確認案件狀態並恢復處理':pendingDocuments?`審核 ${pendingDocuments} 份待審文件`:missingDocuments?`收取 ${missingDocuments} 份必要文件`:incompleteStep?`完成申請程序：${incompleteStep.label}`:item.stage==='medical_training'?'確認體檢與訓練安排':'查看案件待辦並更新進度';
  useEffect(()=>{setStatus(item.status);setAssignedMember(item.assigned_member_id||'');setDate(item.expected_start_date?.slice(0,10)||'');setNotes(item.notes||'')},[item]);
  const memberOptions=(data.agencyContacts||[]).filter(member=>Number(member.agency_id)===Number(item.employer_agency_id));
  return <div className={styles.drawerBackdrop} onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><aside ref={dialogRef} tabIndex={-1} onKeyDown={handleDialogKeyDown} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="case-drawer-title"><div className={styles.drawerHeader}><div><span className={styles.kicker}>案件工作區</span><h2 id="case-drawer-title">{item.case_number}</h2></div><div className={styles.rowActions}>{remove&&<button className={styles.smallButton} disabled={saving} onClick={()=>remove(item)}>刪除案件</button>}<button className={styles.iconButton} onClick={close} aria-label="關閉"><X size={18}/></button></div></div><div className={styles.drawerScroll}><div className={styles.casePeople}><div><small>工作者</small><strong>{item.worker_name}</strong></div><div><small>雇主／客戶</small><strong>{item.employer_name}</strong></div></div><section className={styles.caseNextStep} aria-label="案件目前狀態與下一步"><strong>目前階段：{stageLabel(item.stage)}｜整體狀態：{statusLabel(item.status,CASE_STATUSES)}</strong><span>下一步：{nextStep}</span></section><div className={styles.caseTimeline} aria-label="案件進度時間軸"><h3>案件進度</h3><ol>{STAGES.map(([key,label])=>{const currentIndex=STAGES.findIndex(([stage])=>stage===item.stage);const index=STAGES.findIndex(([stage])=>stage===key);return <li key={key} className={index<currentIndex?styles.timelineDone:index===currentIndex?styles.timelineCurrent:''}><span>{index<currentIndex?'✓':index+1}</span>{label}</li>})}</ol></div><div className={styles.formGrid}><div className={styles.stageReadOnly}><small>目前階段（依文件、體檢與訓練進度）</small><strong>{stageLabel(item.stage)}</strong></div><SelectField name="status" label="案件狀態" options={CASE_STATUSES} value={status} onChange={event=>setStatus(event.target.value)}/><SelectField name="assignedMemberId" label="負責業務" options={[[ '', '不指定業務'],...memberOptions.map(x=>[x.id,x.display_name])]} value={assignedMember} onChange={event=>setAssignedMember(event.target.value)}/><Field name="expected" label="預計日期" type="date" value={date} onChange={event=>setDate(event.target.value)}/></div><label className={styles.field}>案件備註<textarea rows="4" value={notes} onChange={event=>setNotes(event.target.value)}/></label><button className={styles.primaryButton} disabled={saving} onClick={()=>update({type:'case',id:item.id,status,assignedMemberId:assignedMember,expectedStartDate:date,notes})}>儲存案件變更</button><div className={styles.drawerSection}><div className={styles.drawerSectionHeader}><div><h3>文件進度</h3><p>{pendingDocuments} 份待審 · {missingDocuments} 份必要文件待收</p></div></div>{requirements.length?requirements.map(requirement=><div className={styles.drawerTask} key={requirement.id}><div><strong>{requirement.name}</strong><small>{requirement.latest_filename||'尚未收件'}{requirement.review_reason?` · ${requirement.review_reason}`:''}</small></div><Status value={requirement.status} options={[['missing','未收件'],['submitted','待審'],['approved','已核准'],['returned','退回補件']]}/></div>):<p className={styles.muted}>此案件尚無文件要求。</p>}</div><div className={styles.drawerSection}><h3>申請程序</h3>{applicationSteps.length?applicationSteps.map(step=><div className={styles.drawerTask} key={step.id}><div><strong>{step.label}</strong><small>{step.completed_on?`完成：${dateLabel(step.completed_on)}`:step.started_on?`開始：${dateLabel(step.started_on)}`:'尚未開始'}{step.note?` · ${step.note}`:''}</small></div><Status value={step.completed_on?'done':step.started_on?'in_progress':'todo'} options={TASK_STATUSES}/></div>):<p className={styles.muted}>此案件尚無申請程序。</p>}</div><div className={styles.drawerSection}><div className={styles.drawerSectionHeader}><div><h3>工作待辦</h3><p>{tasks.filter(task=>task.status!=='done').length} 項未完成</p></div><button className={styles.smallPrimary} onClick={addTask}><Plus size={15}/>新增</button></div>{tasks.length?tasks.map(task=><div className={styles.drawerTask} key={task.id}><div><strong>{task.title}</strong><small>{statusLabel(task.category,TASK_CATEGORIES)} · 期限 {dateLabel(task.due_date)}</small></div><select className={styles.inlineSelect} value={task.status} disabled={saving} onChange={event=>update({type:'task',id:task.id,status:event.target.value})}>{TASK_STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>):<p className={styles.muted}>此案件尚無待辦事項。</p>}</div><div className={styles.drawerSection}><h3>案件活動</h3>{activities.length?activities.map(event=><div className={styles.activityRow} key={event.id}><span className={styles.activityDot}/><div><strong>{event.action}</strong><small>{event.detail} · {event.actor_email}</small><time>{new Date(event.created_at).toLocaleString('zh-TW')}</time></div></div>):<p className={styles.muted}>尚無活動紀錄。</p>}</div></div></aside></div>;
}
