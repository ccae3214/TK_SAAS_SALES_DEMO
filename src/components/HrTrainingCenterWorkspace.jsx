"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import styles from './HrManagement.module.css';
import { useHrDialog } from '@/lib/use-hr-dialog';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';
import HrWorkerLearning from '@/components/HrWorkerLearning';
import { parseVocabularyEntries } from '@/lib/hr-vocabulary';
import HrTrainingCenterAuditLog from '@/components/HrTrainingCenterAuditLog';
import { Award, BookOpen, CalendarDays, CircleHelp, ClipboardCheck, GraduationCap, LayoutDashboard, ScrollText, UserRound } from 'lucide-react';
import { HR_TOUR_START_EVENT } from '@/lib/hr-help-events';
import { buildStudentProgress } from '@/lib/hr-tc-student-progress';
import { QUIZ_PASS_PERCENT } from '@/lib/hr-learning';

// 系統管理者的訓練中心工作區：老師與證照、課程、開班與日期、證照批次。

const TABS = [['overview', '總覽'], ['teachers', '老師與證照'], ['courses', '課程'], ['classes', '開班與日期'], ['batches', '證照批次'], ['students', '學員報名'], ['progress', '學習與成績']];
// 操作紀錄分頁：系統管理者看所選訓練中心的紀錄，訓練中心帳號看自己那一份（伺服器端會依身分擋）。
const AUDIT_TAB = ['audit', '操作紀錄'];
// 訓練中心會員頁的功能選單（和工作者頁面一樣，手機放在畫面底部）用的圖示。
const TAB_ICONS = { overview: LayoutDashboard, teachers: UserRound, courses: BookOpen, classes: CalendarDays, batches: Award, students: GraduationCap, progress: ClipboardCheck, audit: ScrollText };
const BATCH_STATUSES = [['preparing', '準備中'], ['submitted', '已送件'], ['issued', '已發證']];
const CURRENCY_OPTIONS = [['PHP', '菲律賓披索 (PHP)'], ['TWD', '新台幣 (TWD)'], ['USD', '美元 (USD)']];
// 課程費用顯示：幣別代碼 + 千分位，例如「PHP 35,000」；沒填費用顯示「—」。
const feeText = row => row.fee == null ? '—' : `${row.currency || 'PHP'} ${Number(row.fee).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
// 例句每行一句：「中文 | 拼音 | 英文」。拼音與英文可省略。
const exampleLines = text => String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => line.split(/\s*[|｜]\s*/));
const dateText = value => value ? String(value).slice(0, 10) : '—';
// 時間戳記（學習、測驗時間）依瀏覽器所在時區顯示成 YYYY-MM-DD。
const dayText = value => { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '—'; };
const PROGRESS_STATUS = { not_started: ['尚未開始', 'warn'], learning: ['學習中', 'neutral'], done: ['已完成', 'open'], no_units: ['課程尚無單元', 'neutral'] };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// 班別進度由日期推算，不另外存狀態，避免和日期不一致。
function classPhase(item) {
  const now = today();
  const start = dateText(item.training_start_date), end = dateText(item.training_end_date);
  const exam = item.exam_date ? dateText(item.exam_date) : '', issue = item.certificate_issue_date ? dateText(item.certificate_issue_date) : '';
  if (issue && now >= issue) return ['已取證', 'open'];
  if (exam && now >= exam) return ['待取證', 'warn'];
  if (now > end) return ['待考證', 'warn'];
  if (now >= start) return ['訓練中', 'neutral'];
  return ['未開班', 'neutral'];
}

const daysFromToday = value => Math.round((new Date(`${dateText(value)}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000);
const whenText = days => days === 0 ? '今天' : days > 0 ? `${days} 天後` : `已過 ${-days} 天`;

// 在管理者頁面外（訓練中心會員頁）使用時需要自帶這些顏色變數。
const THEME = { '--ink': '#14231d', '--muted': '#6b7c73', '--line': '#e1e9e4', '--green': '#176b54', '--soft': '#f2f9f5' };

function Pill({ tone = 'neutral', children }) {
  const toneClass = tone === 'open' ? styles.statusOpen : tone === 'warn' ? styles.statusWarn : styles.statusNeutral;
  return <span className={`${styles.status} ${toneClass}`}>{children}</span>;
}

function Empty({ title, text }) {
  return <div className={styles.empty}><strong>{title}</strong><p>{text}</p></div>;
}

// 訓練中心介紹影片：影片內已有中英文字幕，不分語言共用同一支。
const TRAINING_INTRO_VIDEO = '/videos/training-center-intro.mp4';
function TrainingIntroVideoModal({ close }) {
  const dialogRef = useRef(null);
  const handleKeyDown = useHrDialog(dialogRef, close);
  return <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown} className={styles.modal} style={{ width: 'min(860px, 100%)' }} role="dialog" aria-modal="true" aria-labelledby="tc-intro-title">
      <header className={styles.modalHeader}><div><span className={styles.kicker}>訓練中心</span><h2 id="tc-intro-title">訓練中心介紹影片</h2></div><button type="button" className={styles.iconButton} onClick={close} aria-label="關閉">×</button></header>
      <video src={TRAINING_INTRO_VIDEO} controls autoPlay playsInline style={{ width: '100%', borderRadius: 12, background: '#102a54', aspectRatio: '16 / 9' }} />
    </section>
  </div>;
}

function FormModal({ title, hint, fields, initial, submitLabel = '儲存', onSubmit, close, saving }) {
  const dialogRef = useRef(null);
  const handleKeyDown = useHrDialog(dialogRef, close);
  const [values, setValues] = useState(initial);
  const setValue = (name, value) => setValues(current => ({ ...current, [name]: value }));
  return <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="tc-modal-title">
      <header className={styles.modalHeader}><div><span className={styles.kicker}>訓練中心</span><h2 id="tc-modal-title">{title}</h2>{hint && <p className={styles.formHint}>{hint}</p>}</div><button type="button" className={styles.iconButton} onClick={close} aria-label="關閉">×</button></header>
      <form onSubmit={event => { event.preventDefault(); void onSubmit(values); }}>
        <div className={styles.formGrid}>
          {fields.map(field => {
            const options = typeof field.options === 'function' ? field.options(values) : field.options;
            return <label className={styles.field} key={field.name}>{field.label}
              {field.type === 'select'
                ? <select name={field.name} required={field.required} value={values[field.name] ?? ''} onChange={event => setValue(field.name, event.target.value)}>{!field.noEmpty && <option value="">{field.emptyLabel || '請選擇'}</option>}{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                : field.type === 'textarea'
                  ? <textarea name={field.name} rows={field.rows || 3} maxLength={field.maxLength || 500} value={values[field.name] ?? ''} onChange={event => setValue(field.name, event.target.value)} />
                  : <input name={field.name} type={field.type || 'text'} required={field.required} min={field.type === 'number' ? 0 : undefined} step={field.step} maxLength={field.type === 'number' || field.type === 'date' ? undefined : 200} value={values[field.name] ?? ''} onChange={event => setValue(field.name, event.target.value)} />}
            </label>;
          })}
        </div>
        <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={close}>取消</button><button className={styles.primaryButton} disabled={saving}>{saving ? '儲存中…' : submitLabel}</button></div>
      </form>
    </section>
  </div>;
}

export default function HrTrainingCenterWorkspace({ self = false }) {
  const { lang } = useLanguage();
  const [data, setData] = useState(null);
  const [centerId, setCenterId] = useState('');
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [unitCourseId, setUnitCourseId] = useState(null);
  // 學習與成績分頁：目前篩選的班別（空字串＝全部）與展開明細的學員。
  const [progressClassId, setProgressClassId] = useState('');
  const [openStudent, setOpenStudent] = useState('');
  // 學習預覽：用工人看到的學習頁預覽課程內容（管理者與訓練中心為唯讀）。
  const [learningCourseId, setLearningCourseId] = useState(null);
  const learningRef = useRef(null);

  const load = useCallback(async id => {
    try {
      const response = await fetch(`/api/hr/training-center${id && !self ? `?centerId=${encodeURIComponent(id)}` : ''}`, { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || '讀取訓練中心資料失敗。');
      setData(json);
      setCenterId(json.center ? String(json.center.id) : '');
    } catch (error) { setMessage({ type: 'error', text: error.message }); setData(current => current || { centers: [], center: null }); }
  }, [self]);
  useEffect(() => { void load(''); }, [load]);
  useEffect(() => { if (learningCourseId) learningRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }, [learningCourseId]);

  async function request(method, body, query = '') {
    const response = await fetch(`/api/hr/training-center${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || '操作失敗');
    return json;
  }
  async function save(method, body, successText) {
    setSaving(true);
    try { await request(method, body); setModal(null); await load(centerId); setMessage({ type: 'success', text: successText }); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  }
  async function remove(resource, id, label) {
    if (!window.confirm(translateHrText(`確定刪除「${label}」？此操作無法復原。`, lang))) return;
    setSaving(true);
    try { await request('DELETE', null, `?resource=${resource}&id=${encodeURIComponent(id)}`); await load(centerId); setMessage({ type: 'success', text: `已刪除「${label}」` }); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  }
  const toggle = (resource, row) => save('PATCH', { resource, id: row.id, toggleActive: true }, `已${row.active ? '停用' : '啟用'}「${row.name}」`);

  if (!data) return <section className={styles.panel}><Empty title="讀取中" text="正在載入訓練中心資料。" /></section>;
  if (!data.center) return <section className={styles.panel} style={THEME}><div className={styles.panelHeader}><div><h2>訓練中心工作區</h2></div></div>{message && <p className={`${styles.message} ${styles.messageError}`}>{message.text}</p>}<Empty title="尚無訓練中心" text="請先到「會員帳號」把會員類型設為訓練中心，再回來管理老師、課程與班別。" /></section>;

  const { center, certifications, teachers, holdings, courses, units = [], classes, batches, enrollments = [], students = [] } = data;
  const unitCourse = courses.find(item => Number(item.id) === Number(unitCourseId)) || null;
  const unitsOf = courseId => units.filter(item => Number(item.course_id) === Number(courseId));
  // 英文介面優先顯示英文欄位，沒填英文就顯示中文。
  const pick = (zh, en) => lang === 'en' && en ? en : zh;
  const activeCerts = certifications.filter(item => item.active);
  const certOptions = activeCerts.map(item => [item.id, item.name]);
  const holdingsOf = teacherId => holdings.filter(item => Number(item.teacher_id) === Number(teacherId));

  const enrollModal = cls => {
    const enrolled = new Set(enrollments.filter(row => Number(row.class_id) === Number(cls.id)).map(row => Number(row.worker_id)));
    const available = students.filter(item => !enrolled.has(Number(item.id)));
    if (!available.length) { setMessage({ type: 'error', text: '符合資格的工人都已報名這個班別，沒有可再報名的工人。' }); return; }
    setModal({
      title: `報名到「${cls.name}」`, hint: '只列出初步文件審核已通過（LCR Form 1-A、PSA 出生證明、護照三項中有兩項核准）或已進入訓練的工人；報名後工人頁面會顯示課程日期與證照辦件日期提醒。',
      fields: [{ name: 'workerId', label: '工人', type: 'select', required: true, options: available.map(item => [item.id, item.name]) }],
      initial: { workerId: '' },
      submit: values => save('POST', { resource: 'enrollment', classId: cls.id, workerId: values.workerId }, '已報名工人'),
    });
  };
  const certModal = record => setModal({
    title: record ? '編輯證照' : '新增證照', fields: [{ name: 'name', label: '證照名稱', required: true }, { name: 'description', label: '說明', type: 'textarea' }],
    initial: { name: record?.name || '', description: record?.description || '' },
    submit: values => record ? save('PATCH', { resource: 'certification', id: record.id, ...values, active: record.active }, '已更新證照') : save('POST', { resource: 'certification', centerId, ...values }, '已新增證照'),
  });
  const teacherModal = record => setModal({
    title: record ? '編輯老師' : '新增老師', fields: [{ name: 'name', label: '老師姓名', required: true }, { name: 'phone', label: '電話' }, { name: 'email', label: 'Email', type: 'email' }],
    initial: { name: record?.name || '', phone: record?.phone || '', email: record?.email || '' },
    submit: values => record ? save('PATCH', { resource: 'teacher', id: record.id, ...values, active: record.active }, '已更新老師') : save('POST', { resource: 'teacher', centerId, ...values }, '已新增老師'),
  });
  const holdingModal = (teacher, record) => setModal({
    title: `${teacher.name}老師持有的證照`, hint: '已登記過的證照再次送出會更新證號與日期。',
    fields: [{ name: 'certificationId', label: '證照', type: 'select', required: true, options: certOptions }, { name: 'certificateNo', label: '證號' }, { name: 'issuedDate', label: '發證日期', type: 'date' }, { name: 'expiresDate', label: '有效期限', type: 'date' }],
    initial: { certificationId: record?.certification_id || '', certificateNo: record?.certificate_no || '', issuedDate: dateText(record?.issued_date) === '—' ? '' : dateText(record?.issued_date), expiresDate: dateText(record?.expires_date) === '—' ? '' : dateText(record?.expires_date) },
    submit: values => save('POST', { resource: 'teacher-certification', centerId, teacherId: teacher.id, ...values }, '已登記老師證照'),
  });
  const courseModal = record => setModal({
    title: record ? '編輯課程' : '新增課程', hint: '課程隸屬於一張證照，開班時會依課程帶入證照。',
    fields: [{ name: 'certificationId', label: '對應證照', type: 'select', required: true, options: certOptions }, { name: 'name', label: '課程名稱', required: true }, { name: 'hours', label: '課程時數', type: 'number' }, { name: 'fee', label: '課程費用', type: 'number', step: '0.01' }, { name: 'currency', label: '幣別', type: 'select', noEmpty: true, options: CURRENCY_OPTIONS }, { name: 'description', label: '說明', type: 'textarea' }],
    initial: { certificationId: record?.certification_id || '', name: record?.name || '', hours: record?.hours ?? '', fee: record?.fee == null ? '' : Number(record.fee), currency: record?.currency || 'PHP', description: record?.description || '' },
    submit: values => record ? save('PATCH', { resource: 'course', id: record.id, ...values, active: record.active }, '已更新課程') : save('POST', { resource: 'course', centerId, ...values }, '已新增課程'),
  });
  const unitModal = record => setModal({
    title: record ? '編輯單元' : '新增單元', hint: '詞彙、例句每行一筆，格式：中文 | 拼音 | 英文；對話每行開頭加 A： 或 B：（多義字用「；」分隔多個英文意思，後面可接造句：[意思編號] 中文 ＝ 拼音 ＝ 英文，例如：是 | shì | am / is / are；to be；yes, true | [1] 我是男生。＝ Wǒ shì nánshēng. ＝ I am a boy.）',
    fields: [
      { name: 'name', label: '單元名稱', required: true }, { name: 'nameEn', label: '英文單元名稱' },
      { name: 'category', label: '場合分類', maxLength: 60 }, { name: 'categoryEn', label: '場合分類（英文）', maxLength: 120 },
      { name: 'position', label: '順序', type: 'number' }, { name: 'hours', label: '課程時數', type: 'number' },
      { name: 'topics', label: '學習重點', type: 'textarea', maxLength: 1000 }, { name: 'topicsEn', label: '學習重點（英文）', type: 'textarea', maxLength: 1000 },
      { name: 'vocabulary', label: '詞彙', type: 'textarea', rows: 8, maxLength: 4000 },
      { name: 'examples', label: '例句', type: 'textarea', rows: 6, maxLength: 2000 },
      { name: 'dialogue', label: '對話', type: 'textarea', rows: 8, maxLength: 4000 },
    ],
    initial: { name: record?.name || '', nameEn: record?.name_en || '', category: record?.category || '', categoryEn: record?.category_en || '', position: record?.position ?? '', hours: record?.hours ?? '', topics: record?.topics || '', topicsEn: record?.topics_en || '', examples: record?.examples || '', vocabulary: record?.vocabulary || '', dialogue: record?.dialogue || '' },
    submit: values => record
      ? save('PATCH', { resource: 'unit', id: record.id, courseId: unitCourse.id, ...values }, '已更新課程單元')
      : save('POST', { resource: 'unit', centerId, courseId: unitCourse.id, ...values }, '已新增課程單元'),
  });
  const classModal = record => {
    const activeCourses = courses.filter(item => item.active || Number(item.id) === Number(record?.course_id));
    setModal({
      title: record ? '編輯班別' : '新增班別', hint: '授課老師必須持有該課程對應的證照。',
      fields: [
        { name: 'name', label: '班別名稱', required: true },
        { name: 'courseId', label: '課程（依證照）', type: 'select', required: true, options: activeCourses.map(item => [item.id, `${item.certification_name}｜${item.name}`]) },
        { name: 'teacherId', label: '授課老師', type: 'select', emptyLabel: '尚未指定', options: values => {
          const course = courses.find(item => String(item.id) === String(values.courseId));
          return teachers.filter(teacher => course && holdingsOf(teacher.id).some(h => Number(h.certification_id) === Number(course.certification_id))).map(teacher => [teacher.id, teacher.name]);
        } },
        { name: 'trainingStartDate', label: '訓練開始日期', type: 'date', required: true },
        { name: 'trainingEndDate', label: '訓練結束日期', type: 'date', required: true },
        { name: 'examDate', label: '考證日期', type: 'date' },
        { name: 'examLocation', label: '考證地點' },
        { name: 'certificateIssueDate', label: '取證日期', type: 'date' },
        { name: 'capacity', label: '招生人數', type: 'number' },
        { name: 'note', label: '備註', type: 'textarea' },
      ],
      initial: {
        name: record?.name || '', courseId: record?.course_id || '', teacherId: record?.teacher_id || '',
        trainingStartDate: dateText(record?.training_start_date) === '—' ? '' : dateText(record?.training_start_date),
        trainingEndDate: dateText(record?.training_end_date) === '—' ? '' : dateText(record?.training_end_date),
        examDate: dateText(record?.exam_date) === '—' ? '' : dateText(record?.exam_date), examLocation: record?.exam_location || '',
        certificateIssueDate: dateText(record?.certificate_issue_date) === '—' ? '' : dateText(record?.certificate_issue_date),
        capacity: record?.capacity ?? '', note: record?.note || '',
      },
      submit: values => record ? save('PATCH', { resource: 'class', id: record.id, ...values }, '已更新班別') : save('POST', { resource: 'class', centerId, ...values }, '已新增班別'),
    });
  };
  const batchModal = record => setModal({
    title: record ? '編輯證照批次' : '新增證照批次', hint: '一個班別可以分多個批次辦理證照。',
    fields: [
      { name: 'classId', label: '班別', type: 'select', required: true, options: classes.map(item => [item.id, `${item.name}（${item.certification_name}）`]) },
      { name: 'batchNo', label: '批次編號或名稱', required: true },
      { name: 'appliedDate', label: '辦理日期', type: 'date' },
      { name: 'studentCount', label: '辦理人數', type: 'number' },
      { name: 'status', label: '辦理狀態', type: 'select', noEmpty: true, options: BATCH_STATUSES },
      { name: 'note', label: '備註', type: 'textarea' },
    ],
    initial: { classId: record?.class_id || '', batchNo: record?.batch_no || '', appliedDate: dateText(record?.applied_date) === '—' ? '' : dateText(record?.applied_date), studentCount: record?.student_count ?? '', status: record?.status || 'preparing', note: record?.note || '' },
    submit: values => record ? save('PATCH', { resource: 'batch', id: record.id, ...values }, '已更新證照批次') : save('POST', { resource: 'batch', ...values }, '已新增證照批次'),
  });

  return <div style={{ ...THEME, display: 'grid', gap: 16 }}>
    {self && <nav className="workspace-tabs" aria-label={lang === 'en' ? 'Workspace tabs' : '工作區分頁'}>
      {[...TABS, AUDIT_TAB].map(([id, label]) => { const Icon = TAB_ICONS[id]; return <button key={id} type="button" data-tour={`tc-tab-${id}`} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={17} aria-hidden="true" />{id === 'audit' && lang === 'en' ? 'Activity log' : label}</button>; })}
    </nav>}
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>{self ? center.display_name : '訓練中心工作區'}</h2><p>管理訓練中心老師持有的證照、證照課程、依證照開班的訓練／考證／取證日期，以及班別的證照批次。</p></div>
        {!self && <label className={styles.filterField}>訓練中心<select className={styles.inlineSelect} value={centerId} onChange={event => { setData(null); setLearningCourseId(null); void load(event.target.value); }}>{data.centers.map(item => <option key={item.id} value={item.id}>{item.display_name}{item.active ? '' : '（停用）'}</option>)}</select></label>}
      </div>
      {message && <p className={`${styles.message} ${message.type === 'error' ? styles.messageError : styles.messageSuccess}`} role="status">{message.text}</p>}
      {!self && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px 4px' }}>
        {[...TABS, AUDIT_TAB].map(([id, label]) => <button key={id} data-tour={`tc-tab-${id}`} className={tab === id ? styles.primaryButton : styles.secondaryButton} onClick={() => setTab(id)}>{id === 'audit' && lang === 'en' ? 'Activity log' : label}</button>)}
      </div>}
    </section>

    {tab === 'overview' && (() => {
      const phases = classes.map(item => classPhase(item)[0]);
      const upcoming = classes.flatMap(item => [['開訓', item.training_start_date], ['考證', item.exam_date], ['取證', item.certificate_issue_date]]
        .filter(([, date]) => date).map(([kind, date]) => ({ key: `${item.id}-${kind}`, kind, date: dateText(date), days: daysFromToday(date), item })))
        .filter(event => event.days >= 0 && event.days <= 60).sort((a, b) => a.days - b.days);
      const expiring = holdings.filter(item => item.expires_date && daysFromToday(item.expires_date) <= 60)
        .map(item => ({ ...item, days: daysFromToday(item.expires_date), teacher: teachers.find(t => Number(t.id) === Number(item.teacher_id)) }))
        .sort((a, b) => a.days - b.days);
      const cards = [
        ['老師', teachers.filter(item => item.active).length, `共登記 ${holdings.length} 筆持證`, 'teachers'],
        ['證照／課程', `${activeCerts.length} / ${courses.filter(item => item.active).length}`, '啟用中的證照與課程', 'courses'],
        ['訓練中班別', phases.filter(item => item === '訓練中').length, `共 ${classes.length} 個班別`, 'classes'],
        ['待考證', phases.filter(item => item === '待考證').length, '訓練結束、尚未到考證日', 'classes'],
        ['待取證', phases.filter(item => item === '待取證').length, `證照批次 ${batches.filter(item => item.status !== 'issued').length} 筆未發證`, 'batches'],
      ];
      return <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {self && <button type="button" className={styles.secondaryButton} onClick={() => window.dispatchEvent(new CustomEvent(HR_TOUR_START_EVENT))}><CircleHelp size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />{lang === 'en' ? 'Quick tour' : '使用導覽'}</button>}
          <button type="button" className={styles.secondaryButton} onClick={() => setIntroOpen(true)}>▶ 介紹影片</button>
        </div>
        <div className={styles.statGrid}>{cards.map(([label, value, caption, target]) => <button type="button" key={label} className={styles.statCard} onClick={() => setTab(target)}><p>{label}</p><strong>{value}</strong><small>{caption}</small></button>)}</div>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>近 60 天日程</h2><p>即將開訓、考證與取證的班別。</p></div><span className={styles.rowCount}>{upcoming.length} 項</span></div>
          {upcoming.length ? <div className={styles.tableWrap}><table><thead><tr><th>日期</th><th>倒數</th><th>事項</th><th>班別</th><th>證照／課程</th><th>授課老師</th></tr></thead><tbody>{upcoming.map(event => <tr key={event.key}><td>{event.date}</td><td>{whenText(event.days)}</td><td><Pill tone={event.kind === '取證' ? 'open' : event.kind === '考證' ? 'warn' : 'neutral'}>{event.kind}</Pill></td><td><strong>{event.item.name}</strong></td><td>{event.item.certification_name}<br /><small>{event.item.course_name}</small></td><td>{event.item.teacher_name || '尚未指定'}</td></tr>)}</tbody></table></div> : <Empty title="近 60 天沒有日程" text="到「開班與日期」排定班別的訓練、考證與取證日期後，會顯示在這裡。" />}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>老師證照到期提醒</h2><p>已到期或 60 天內到期的老師證照，請提早換證。</p></div><span className={styles.rowCount}>{expiring.length} 項</span></div>
          {expiring.length ? <div className={styles.tableWrap}><table><thead><tr><th>老師</th><th>證照</th><th>證號</th><th>有效期限</th><th>狀態</th></tr></thead><tbody>{expiring.map(item => <tr key={item.id}><td><strong>{item.teacher?.name || '—'}</strong></td><td>{item.certification_name}</td><td>{item.certificate_no || '—'}</td><td>{dateText(item.expires_date)}</td><td><Pill tone={item.days < 0 ? 'warn' : 'neutral'}>{item.days < 0 ? `已過期（${whenText(item.days)}）` : whenText(item.days)}</Pill></td></tr>)}</tbody></table></div> : <Empty title="沒有即將到期的證照" text="老師證照有效期限在 60 天內時會提醒你。" />}
        </section>
      </>;
    })()}

    {tab === 'teachers' && <>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>證照</h2><p>{center.display_name}可開課的證照種類。</p></div><button className={styles.primaryButton} onClick={() => certModal(null)}>新增證照</button></div>
        {certifications.length ? <div className={styles.tableWrap}><table><thead><tr><th>證照</th><th>說明</th><th>狀態</th><th>操作</th></tr></thead><tbody>{certifications.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.description || '—'}</td><td><Pill tone={row.active ? 'open' : 'neutral'}>{row.active ? '啟用' : '停用'}</Pill></td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={() => certModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => toggle('certification', row)}>{row.active ? '停用' : '啟用'}</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('certification', row.id, row.name)}>刪除</button></div></td></tr>)}</tbody></table></div> : <Empty title="尚無證照" text="先新增這個訓練中心可開課的證照。" />}
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>老師持有的證照</h2><p>登記每位老師持有哪些證照，開班時只能指定持有該證照的老師。</p></div><button className={styles.primaryButton} onClick={() => teacherModal(null)}>新增老師</button></div>
        {teachers.length ? <div className={styles.tableWrap}><table><thead><tr><th>老師</th><th>聯絡方式</th><th>持有證照</th><th>狀態</th><th>操作</th></tr></thead><tbody>{teachers.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{[row.phone, row.email].filter(Boolean).join(' · ') || '—'}</td><td>{holdingsOf(row.id).length ? holdingsOf(row.id).map(h => <div key={h.id}>{h.certification_name}{h.certificate_no ? `（${h.certificate_no}）` : ''}{h.expires_date ? ` · 有效至 ${dateText(h.expires_date)}` : ''} <button className={styles.smallButton} onClick={() => holdingModal(row, h)}>編輯</button> <button className={styles.smallButton} disabled={saving} onClick={() => remove('teacher-certification', h.id, `${row.name}的${h.certification_name}證照`)}>移除</button></div>) : '尚未登記'}</td><td><Pill tone={row.active ? 'open' : 'neutral'}>{row.active ? '啟用' : '停用'}</Pill></td><td><div className={styles.rowActions}><button className={styles.smallButton} disabled={!activeCerts.length} onClick={() => holdingModal(row, null)}>登記證照</button><button className={styles.smallButton} onClick={() => teacherModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => toggle('teacher', row)}>{row.active ? '停用' : '啟用'}</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('teacher', row.id, row.name)}>刪除</button></div></td></tr>)}</tbody></table></div> : <Empty title="尚無老師" text="新增老師後，再登記他持有的證照。" />}
      </section>
    </>}

    {tab === 'courses' && <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>證照課程</h2><p>每門課程對應一張證照，開班時依課程帶入證照。</p></div><button className={styles.primaryButton} disabled={!activeCerts.length} onClick={() => courseModal(null)}>新增課程</button></div>
      {courses.length ? <div className={styles.tableWrap}><table><thead><tr><th>證照</th><th>課程</th><th>時數</th><th>課程費用</th><th>說明</th><th>狀態</th><th>操作</th></tr></thead><tbody>{courses.map(row => <tr key={row.id}><td>{row.certification_name}</td><td><strong>{row.name}</strong></td><td>{row.hours ?? '—'}</td><td>{feeText(row)}</td><td>{row.description || '—'}</td><td><Pill tone={row.active ? 'open' : 'neutral'}>{row.active ? '啟用' : '停用'}</Pill></td><td><div className={styles.rowActions}><button className={styles.smallButton} disabled={!unitsOf(row.id).length} title={unitsOf(row.id).length ? undefined : (lang === 'en' ? 'Add course units first' : '請先新增課程單元')} onClick={() => setLearningCourseId(Number(learningCourseId) === Number(row.id) ? null : row.id)}>{lang === 'en' ? 'Preview learning' : '學習預覽'}</button><button className={styles.smallButton} onClick={() => setUnitCourseId(Number(unitCourseId) === Number(row.id) ? null : row.id)}>{`課程單元（${unitsOf(row.id).length}）`}</button><button className={styles.smallButton} onClick={() => courseModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => toggle('course', row)}>{row.active ? '停用' : '啟用'}</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('course', row.id, row.name)}>刪除</button></div></td></tr>)}</tbody></table></div> : <Empty title="尚無課程" text={activeCerts.length ? '新增證照對應的課程。' : '請先到「老師與證照」新增證照。'} />}
    </section>}

    {tab === 'courses' && learningCourseId && courses.some(item => Number(item.id) === Number(learningCourseId)) && <div ref={learningRef}><HrWorkerLearning key={learningCourseId} courseId={learningCourseId} onClose={() => setLearningCourseId(null)} /></div>}

    {tab === 'courses' && unitCourse && <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>{`課程單元：${unitCourse.name}`}</h2><p>{unitsOf(unitCourse.id).length ? `單元時數合計：${unitsOf(unitCourse.id).reduce((sum, item) => sum + (item.hours || 0), 0)} 小時` : '把課程內容拆成單元，每個單元可寫學習重點與例句。'}</p></div><div className={styles.rowActions}><button className={styles.primaryButton} onClick={() => unitModal(null)}>新增單元</button><button className={styles.smallButton} onClick={() => setUnitCourseId(null)}>關閉</button></div></div>
      {unitsOf(unitCourse.id).length ? <div className={styles.tableWrap}><table><thead><tr><th>順序</th><th>單元名稱</th><th>場合分類</th><th>課程時數</th><th>詞彙量</th><th>學習重點</th><th>例句</th><th>操作</th></tr></thead><tbody>{unitsOf(unitCourse.id).map(row => <tr key={row.id}><td>{row.position}</td><td><strong>{pick(row.name, row.name_en)}</strong>{lang === 'en' ? null : row.name_en ? <><br /><small>{row.name_en}</small></> : null}</td><td>{pick(row.category, row.category_en) || '—'}</td><td>{row.hours ?? '—'}</td><td>{parseVocabularyEntries(row.vocabulary).length}</td><td>{pick(row.topics, row.topics_en) || '—'}</td><td>{exampleLines(row.examples).length ? exampleLines(row.examples).map((parts, index) => <div key={index}><strong>{parts[0]}</strong>{parts[1] ? ` ${parts[1]}` : ''}{parts[2] ? <><br /><small>{parts[2]}</small></> : null}</div>) : '—'}</td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={() => unitModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('unit', row.id, row.name)}>刪除</button></div></td></tr>)}</tbody></table></div> : <Empty title="尚無單元" text="新增課程的第一個單元。" />}
    </section>}

    {tab === 'classes' && <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>開班與日期</h2><p>依證照排定班別的訓練日期、考證日期與取證日期；進度依日期自動判斷。</p></div><button className={styles.primaryButton} disabled={!courses.some(item => item.active)} onClick={() => classModal(null)}>新增班別</button></div>
      {classes.length ? <div className={styles.tableWrap}><table><thead><tr><th>班別</th><th>證照／課程</th><th>授課老師</th><th>訓練日期</th><th>考證日期</th><th>取證日期</th><th>招生</th><th>進度</th><th>操作</th></tr></thead><tbody>{classes.map(row => { const [phase, tone] = classPhase(row); return <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.certification_name}<br /><small>{row.course_name}</small></td><td>{row.teacher_name || '尚未指定'}</td><td>{dateText(row.training_start_date)} ～ {dateText(row.training_end_date)}</td><td>{dateText(row.exam_date)}{row.exam_location ? <><br /><small>{row.exam_location}</small></> : null}</td><td>{dateText(row.certificate_issue_date)}</td><td>{row.capacity ?? '—'}</td><td><Pill tone={tone}>{phase}</Pill></td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={() => classModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('class', row.id, row.name)}>刪除</button></div></td></tr>; })}</tbody></table></div> : <Empty title="尚無班別" text={courses.some(item => item.active) ? '新增班別並排定訓練、考證與取證日期。' : '請先新增課程，才能開班。'} />}
    </section>}

    {tab === 'batches' && <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>證照批次</h2><p>班別辦理證照的批次與辦理狀態；刪除班別時，該班別的批次會一併刪除。</p></div><button className={styles.primaryButton} disabled={!classes.length} onClick={() => batchModal(null)}>新增批次</button></div>
      {batches.length ? <div className={styles.tableWrap}><table><thead><tr><th>班別</th><th>批次</th><th>辦理日期</th><th>人數</th><th>狀態</th><th>備註</th><th>操作</th></tr></thead><tbody>{batches.map(row => <tr key={row.id}><td>{row.class_name}</td><td><strong>{row.batch_no}</strong></td><td>{dateText(row.applied_date)}</td><td>{row.student_count ?? '—'}</td><td><Pill tone={row.status === 'issued' ? 'open' : row.status === 'submitted' ? 'warn' : 'neutral'}>{(BATCH_STATUSES.find(([value]) => value === row.status) || [])[1] || row.status}</Pill></td><td>{row.note || '—'}</td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={() => batchModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('batch', row.id, `${row.class_name} ${row.batch_no}`)}>刪除</button></div></td></tr>)}</tbody></table></div> : <Empty title="尚無證照批次" text={classes.length ? '為班別新增辦理證照的批次。' : '請先到「開班與日期」建立班別。'} />}
    </section>}

    {tab === 'students' && <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>學員報名</h2><p>把工人排進班別；工人頁面會顯示該班的訓練、考證、取證與證照辦件日期，並在日期接近時提醒。</p></div></div>
      {!students.length && <p className={styles.formHint}>目前沒有可報名的工人：工人需先通過初步文件審核（LCR Form 1-A、PSA 出生證明、護照三項中有兩項核准），才能報名班別。</p>}
      {classes.length ? <div className={styles.tableWrap}><table><thead><tr><th>班別</th><th>訓練日期</th><th>報名人數</th><th>學員</th><th>操作</th></tr></thead><tbody>{classes.map(row => { const list = enrollments.filter(item => Number(item.class_id) === Number(row.id)); const full = Boolean(row.capacity) && list.length >= row.capacity; return <tr key={row.id}><td><strong>{row.name}</strong><br />{row.certification_name}</td><td>{dateText(row.training_start_date)} ~ {dateText(row.training_end_date)}</td><td>{list.length}{row.capacity ? ` / ${row.capacity}` : ''}</td><td>{list.length ? list.map(item => <span key={item.id} style={{ display: 'inline-block', marginRight: 8 }}>{item.worker_name} <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => remove('enrollment', item.id, `${item.worker_name}的報名`)}>取消</button></span>) : '—'}</td><td><button type="button" className={styles.primaryButton} disabled={saving || !students.length || full} onClick={() => enrollModal(row)}>報名工人</button>{full && <><br /><small>已額滿</small></>}</td></tr>; })}</tbody></table></div>
        : <Empty title="還沒有班別" text="請先到「開班與日期」建立班別，再報名工人。" />}
    </section>}

    {tab === 'progress' && (() => {
      const shown = classes.filter(item => !progressClassId || String(item.id) === String(progressClassId));
      const groups = buildStudentProgress({ classes: shown, enrollments, units, progress: data.progress || [], quizzes: data.quizzes || [] });
      const all = groups.flatMap(group => group.students);
      const averages = all.map(item => item.quiz.average).filter(value => value !== null);
      const cards = [
        ['學員人數', all.length],
        ['學習中', all.filter(item => item.status === 'learning').length],
        ['已完成', all.filter(item => item.status === 'done').length],
        ['全體測驗平均', averages.length ? `${Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)}%` : '—'],
      ];
      return <>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>學員學習狀況與測驗成績</h2><p>查看已報名學員的單元學習進度與小測驗成績；測驗成績取每個單元最佳的一次，並顯示作答次數。</p></div>
            <label className={styles.filterField}>班別<select className={styles.inlineSelect} value={progressClassId} onChange={event => { setProgressClassId(event.target.value); setOpenStudent(''); }}><option value="">全部班別</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          <div className={styles.statGrid} style={{ padding: '16px 20px 0', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>{cards.map(([label, value]) => <div key={label} className={styles.statCard} style={{ cursor: 'default', minHeight: 96 }}><p>{label}</p><strong>{value}</strong></div>)}</div>
          <p className={styles.formHint} style={{ padding: '0 20px' }}>{`及格標準為答對 ${QUIZ_PASS_PERCENT}% 以上。`}</p>
        </section>
        {classes.length ? groups.map(({ cls, totalUnits, students: list }) => <section className={styles.panel} key={cls.id}>
          <div className={styles.panelHeader}><div><h2>{cls.name}</h2><p>{`${cls.certification_name} · ${cls.course_name}`}</p></div><span className={styles.rowCount}>{`${list.length} 位學員`}</span></div>
          {!totalUnits && <p className={styles.formHint} style={{ padding: '0 20px' }}>這個班別的課程還沒有單元內容，學員暫時無法學習。</p>}
          {list.length ? <div className={styles.tableWrap}><table><thead><tr><th>學員</th><th>學習進度</th><th>學習時數</th><th>通過測驗</th><th>測驗平均</th><th>最近學習</th><th>狀態</th><th>操作</th></tr></thead><tbody>{list.map(student => {
            const rowKey = `${cls.id}:${student.workerId}`;
            const open = openStudent === rowKey;
            const [statusLabel, statusTone] = PROGRESS_STATUS[student.status];
            return <Fragment key={rowKey}>
              <tr>
                <td><strong>{student.name}</strong></td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
                  <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={student.percent} style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}><div style={{ width: `${student.percent}%`, height: '100%', background: 'var(--green)' }} /></div>
                  <small>{`${student.percent}%`}</small>
                </div><small>{`${student.done} / ${student.total} 個單元`}</small></td>
                <td>{`${student.hoursDone} / ${student.hoursTotal} 小時`}</td>
                <td>{`${student.quiz.passed} / ${student.quiz.taken} 個單元`}</td>
                <td>{student.quiz.average === null ? '—' : `${student.quiz.average}%`}</td>
                <td>{dayText(student.lastActivity)}</td>
                <td><Pill tone={statusTone}>{statusLabel}</Pill></td>
                <td><button type="button" className={styles.smallButton} disabled={!student.total} onClick={() => setOpenStudent(open ? '' : rowKey)}>{open ? '收合明細' : '查看明細'}</button></td>
              </tr>
              {open && <tr><td colSpan={8} style={{ background: '#fafbfb' }}>
                <table style={{ width: '100%' }}><thead><tr><th>單元</th><th>學習狀態</th><th>最佳成績</th><th>作答次數</th><th>最近一次</th><th>測驗結果</th></tr></thead><tbody>{student.units.map(row => <tr key={row.unit.id}>
                  <td><strong>{pick(row.unit.name, row.unit.name_en)}</strong></td>
                  <td>{row.completed ? <>{'已讀完'} <small>{dayText(row.completedAt)}</small></> : '未讀'}</td>
                  <td>{row.quiz ? `${row.quiz.best_percent}%` : '—'}</td>
                  <td>{row.quiz ? row.quiz.attempts : '—'}</td>
                  <td>{row.quiz ? <>{`${row.quiz.last_correct} / ${row.quiz.last_total}`} <small>{dayText(row.quiz.last_at)}</small></> : '—'}</td>
                  <td>{row.quiz ? <Pill tone={row.quiz.passed ? 'open' : 'warn'}>{row.quiz.passed ? '達標' : '未達標'}</Pill> : '尚未測驗'}</td>
                </tr>)}</tbody></table>
              </td></tr>}
            </Fragment>;
          })}</tbody></table></div> : <Empty title="尚無學員" text="這個班別還沒有學員報名。" />}
        </section>) : <section className={styles.panel}><Empty title="尚無班別" text="請先到「開班與日期」建立班別。" /></section>}
      </>;
    })()}

    {tab === 'audit' && <HrTrainingCenterAuditLog key={center.id} centerId={center.id} centerName={center.display_name} />}

    {introOpen && <TrainingIntroVideoModal close={() => setIntroOpen(false)} />}
    {modal && <FormModal key={modal.title} title={modal.title} hint={modal.hint} fields={modal.fields} initial={modal.initial} onSubmit={modal.submit} close={() => setModal(null)} saving={saving} />}
  </div>;
}
