"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './HrManagement.module.css';
import { useHrDialog } from '@/lib/use-hr-dialog';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';

// 系統管理者的訓練中心工作區：老師與證照、課程、開班與日期、證照批次。

const TABS = [['overview', '總覽'], ['teachers', '老師與證照'], ['courses', '課程'], ['classes', '開班與日期'], ['batches', '證照批次']];
const BATCH_STATUSES = [['preparing', '準備中'], ['submitted', '已送件'], ['issued', '已發證']];
const dateText = value => value ? String(value).slice(0, 10) : '—';
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
                  ? <textarea name={field.name} rows="3" maxLength="500" value={values[field.name] ?? ''} onChange={event => setValue(field.name, event.target.value)} />
                  : <input name={field.name} type={field.type || 'text'} required={field.required} min={field.type === 'number' ? 0 : undefined} maxLength={field.type === 'number' || field.type === 'date' ? undefined : 200} value={values[field.name] ?? ''} onChange={event => setValue(field.name, event.target.value)} />}
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

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

  const { center, certifications, teachers, holdings, courses, classes, batches } = data;
  const activeCerts = certifications.filter(item => item.active);
  const certOptions = activeCerts.map(item => [item.id, item.name]);
  const holdingsOf = teacherId => holdings.filter(item => Number(item.teacher_id) === Number(teacherId));

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
    fields: [{ name: 'certificationId', label: '對應證照', type: 'select', required: true, options: certOptions }, { name: 'name', label: '課程名稱', required: true }, { name: 'hours', label: '課程時數', type: 'number' }, { name: 'description', label: '說明', type: 'textarea' }],
    initial: { certificationId: record?.certification_id || '', name: record?.name || '', hours: record?.hours ?? '', description: record?.description || '' },
    submit: values => record ? save('PATCH', { resource: 'course', id: record.id, ...values, active: record.active }, '已更新課程') : save('POST', { resource: 'course', centerId, ...values }, '已新增課程'),
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
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>{self ? center.display_name : '訓練中心工作區'}</h2><p>管理訓練中心老師持有的證照、證照課程、依證照開班的訓練／考證／取證日期，以及班別的證照批次。</p></div>
        {!self && <label className={styles.filterField}>訓練中心<select className={styles.inlineSelect} value={centerId} onChange={event => { setData(null); void load(event.target.value); }}>{data.centers.map(item => <option key={item.id} value={item.id}>{item.display_name}{item.active ? '' : '（停用）'}</option>)}</select></label>}
      </div>
      {message && <p className={`${styles.message} ${message.type === 'error' ? styles.messageError : styles.messageSuccess}`} role="status">{message.text}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px 4px' }}>
        {TABS.map(([id, label]) => <button key={id} data-tour={`tc-tab-${id}`} className={tab === id ? styles.primaryButton : styles.secondaryButton} onClick={() => setTab(id)}>{label}</button>)}
      </div>
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
      {courses.length ? <div className={styles.tableWrap}><table><thead><tr><th>證照</th><th>課程</th><th>時數</th><th>說明</th><th>狀態</th><th>操作</th></tr></thead><tbody>{courses.map(row => <tr key={row.id}><td>{row.certification_name}</td><td><strong>{row.name}</strong></td><td>{row.hours ?? '—'}</td><td>{row.description || '—'}</td><td><Pill tone={row.active ? 'open' : 'neutral'}>{row.active ? '啟用' : '停用'}</Pill></td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={() => courseModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => toggle('course', row)}>{row.active ? '停用' : '啟用'}</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('course', row.id, row.name)}>刪除</button></div></td></tr>)}</tbody></table></div> : <Empty title="尚無課程" text={activeCerts.length ? '新增證照對應的課程。' : '請先到「老師與證照」新增證照。'} />}
    </section>}

    {tab === 'classes' && <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>開班與日期</h2><p>依證照排定班別的訓練日期、考證日期與取證日期；進度依日期自動判斷。</p></div><button className={styles.primaryButton} disabled={!courses.some(item => item.active)} onClick={() => classModal(null)}>新增班別</button></div>
      {classes.length ? <div className={styles.tableWrap}><table><thead><tr><th>班別</th><th>證照／課程</th><th>授課老師</th><th>訓練日期</th><th>考證日期</th><th>取證日期</th><th>招生</th><th>進度</th><th>操作</th></tr></thead><tbody>{classes.map(row => { const [phase, tone] = classPhase(row); return <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.certification_name}<br /><small>{row.course_name}</small></td><td>{row.teacher_name || '尚未指定'}</td><td>{dateText(row.training_start_date)} ～ {dateText(row.training_end_date)}</td><td>{dateText(row.exam_date)}{row.exam_location ? <><br /><small>{row.exam_location}</small></> : null}</td><td>{dateText(row.certificate_issue_date)}</td><td>{row.capacity ?? '—'}</td><td><Pill tone={tone}>{phase}</Pill></td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={() => classModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('class', row.id, row.name)}>刪除</button></div></td></tr>; })}</tbody></table></div> : <Empty title="尚無班別" text={courses.some(item => item.active) ? '新增班別並排定訓練、考證與取證日期。' : '請先新增課程，才能開班。'} />}
    </section>}

    {tab === 'batches' && <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>證照批次</h2><p>班別辦理證照的批次與辦理狀態；刪除班別時，該班別的批次會一併刪除。</p></div><button className={styles.primaryButton} disabled={!classes.length} onClick={() => batchModal(null)}>新增批次</button></div>
      {batches.length ? <div className={styles.tableWrap}><table><thead><tr><th>班別</th><th>批次</th><th>辦理日期</th><th>人數</th><th>狀態</th><th>備註</th><th>操作</th></tr></thead><tbody>{batches.map(row => <tr key={row.id}><td>{row.class_name}</td><td><strong>{row.batch_no}</strong></td><td>{dateText(row.applied_date)}</td><td>{row.student_count ?? '—'}</td><td><Pill tone={row.status === 'issued' ? 'open' : row.status === 'submitted' ? 'warn' : 'neutral'}>{(BATCH_STATUSES.find(([value]) => value === row.status) || [])[1] || row.status}</Pill></td><td>{row.note || '—'}</td><td><div className={styles.rowActions}><button className={styles.smallButton} onClick={() => batchModal(row)}>編輯</button><button className={styles.smallButton} disabled={saving} onClick={() => remove('batch', row.id, `${row.class_name} ${row.batch_no}`)}>刪除</button></div></td></tr>)}</tbody></table></div> : <Empty title="尚無證照批次" text={classes.length ? '為班別新增辦理證照的批次。' : '請先到「開班與日期」建立班別。'} />}
    </section>}

    {modal && <FormModal key={modal.title} title={modal.title} hint={modal.hint} fields={modal.fields} initial={modal.initial} onSubmit={modal.submit} close={() => setModal(null)} saving={saving} />}
  </div>;
}
