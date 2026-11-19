'use client';

import { Fragment, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// 「訓練與來台進度」：每位工作者一個小元件，點開後同時看到【訓練中心的訓練】與【仲介的進度】。
// 一次只展開一位（點別人會收起原本的）。訓練中心的班別資料唯讀，訓練狀態與仲介的各項日期可直接在這裡編輯。

// 仲介辦理的項目：OEC、簽證由菲律賓仲介；實際入境、入國通報、勞健保、居留證由台灣仲介。
const AGENCY_STEPS = [
  ['oec', 'OEC（出境許可）', '菲律賓仲介'],
  ['visa', '簽證 VISA', '菲律賓仲介'],
  ['actual_entry', '實際入境', '台灣仲介'],
  ['entry_notification', '入國通報', '台灣仲介'],
  ['insurance', '勞健保加保', '台灣仲介'],
  ['arc', '居留證 ARC', '台灣仲介'],
];
const TRAINING_BADGES = { not_scheduled: '訓練未安排', scheduled: '訓練已安排', in_progress: '訓練進行中' };
const BATCH_LABELS = { preparing: '籌備中', submitted: '已送件', issued: '已核發' };
const dateText = value => (value ? String(value).slice(0, 10) : '');

function stepKeyOf(caseId, key) { return `${caseId}:${key}`; }

function progressCount(row, doneMap) {
  const agencyDone = AGENCY_STEPS.filter(([key]) => doneMap[key]).length;
  return agencyDone + (row.training_status === 'completed' ? 1 : 0) + (row.medical_status === 'passed' ? 1 : 0);
}
export const WORKFLOW_PROGRESS_TOTAL = AGENCY_STEPS.length + 2;

function EnrollmentCard({ item }) {
  const range = item.training_start_date || item.training_end_date
    ? `${item.training_start_date || '未設定'} → ${item.training_end_date || '未設定'}` : '未設定';
  return <div className="wf-enrollment">
    <strong>{item.class_name}</strong>
    <span className="wf-muted">{`${item.certification_name} · ${item.course_name}`}{item.hours ? <span>{' · '}<span>{`${item.hours} 小時`}</span></span> : null}</span>
    <dl className="wf-facts">
      <div><dt>訓練中心</dt><dd>{item.center_name || '未設定'}</dd></div>
      <div><dt>開訓／結訓</dt><dd>{range}</dd></div>
      <div><dt>考證日期</dt><dd>{item.exam_date ? `${item.exam_date}${item.exam_location ? ` · ${item.exam_location}` : ''}` : '未設定'}</dd></div>
      <div><dt>取證日期</dt><dd>{item.certificate_issue_date || '未設定'}</dd></div>
      <div><dt>證照辦件</dt><dd>{item.batch_status ? <><span>{BATCH_LABELS[item.batch_status] || item.batch_status}</span>{item.batch_applied_date ? ` · ${item.batch_applied_date}` : ''}</> : '尚未辦件'}</dd></div>
    </dl>
  </div>;
}

export default function HrWorkflowProgress({
  rows, requirements, steps, enrollments, certifications, update, saving, search, setSearch,
  stageLabel, nextActionForStage, trainingStatuses, medicalStatuses,
}) {
  const [openId, setOpenId] = useState(undefined);
  const [drafts, setDrafts] = useState({});
  const needle = String(search || '').trim();

  const view = rows.map(row => {
    const stepRows = steps.filter(item => Number(item.case_id) === Number(row.id));
    const stepMap = Object.fromEntries(stepRows.map(item => [item.step_key, item]));
    const doneMap = Object.fromEntries(stepRows.map(item => [item.step_key, item.completed_on]));
    const docs = requirements.filter(item => Number(item.worker_id) === Number(row.worker_id) && item.required && item.applicable);
    const missing = docs.filter(item => item.status !== 'approved').length;
    return {
      row, stepMap, doneMap, docs, missing,
      documentsReady: docs.length > 0 && missing === 0,
      classes: enrollments.filter(item => Number(item.worker_id) === Number(row.worker_id)),
      certs: certifications.filter(item => Number(item.case_id) === Number(row.id)),
    };
  });

  async function saveStep(caseId, key, stepRow) {
    const draftKey = stepKeyOf(caseId, key);
    const completedOn = drafts[draftKey] ?? dateText(stepRow?.completed_on);
    const ok = await update({
      type: 'application-step', caseId, stepKey: key,
      startedOn: dateText(stepRow?.started_on), completedOn, note: stepRow?.note || '',
    });
    if (ok) setDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; });
  }

  const defaultId = view.length === 1 ? view[0].row.id : null;

  return <div className="doc-review wf-progress">
    <label className="doc-search">
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜尋案件編號、工作者、雇主或進度狀態" aria-label="搜尋工作者" />
    </label>
    {view.length === 0
      ? <p className="doc-review-empty">{needle ? '找不到符合的案件，請調整關鍵字或清除搜尋。' : '尚無案件，建立案件後可追蹤訓練與來台進度。'}</p>
      : <div className="doc-worker-grid">
        {view.map(({ row, stepMap, doneMap, docs, missing, documentsReady, classes, certs }) => {
          const expanded = (openId === undefined ? defaultId : openId) === row.id;
          const done = progressCount(row, doneMap);
          const complete = done === WORKFLOW_PROGRESS_TOTAL;
          const arrived = Boolean(doneMap.actual_entry);
          const next = nextActionForStage(row.stage);
          return <Fragment key={row.id}>
            <button type="button" className={`doc-worker-tile${expanded ? ' is-open' : ''}${complete ? ' is-done' : ''}`}
              aria-expanded={expanded} aria-controls={`wf-panel-${row.id}`}
              onClick={() => setOpenId(expanded ? null : row.id)}>
              <span className="doc-worker-name">{row.worker_name}</span>
              <span className="doc-worker-progress" title="已完成進度項目">{`${done}/${WORKFLOW_PROGRESS_TOTAL}`}</span>
              <ChevronDown size={16} aria-hidden="true" className="doc-worker-chevron" />
              <span className="doc-worker-badges">
                <span className="doc-badge">{stageLabel(row.stage)}</span>
                {row.training_status === 'completed'
                  ? <span className="doc-badge doc-badge-done">訓練完成</span>
                  : <span className="doc-badge doc-badge-submitted">{TRAINING_BADGES[row.training_status || 'not_scheduled'] || '訓練未安排'}</span>}
              </span>
            </button>
            {expanded && <section className="doc-worker-panel doc-worker-body wf-panel" id={`wf-panel-${row.id}`}>
              <h3 className="doc-worker-panel-title">{row.worker_name}</h3>
              <p className="wf-case-line">{`${row.case_number} · ${row.employer_name || ''}`}</p>
              {next && <p className="wf-next"><b>下一步</b>{next}</p>}

              <section className="wf-section">
                <h4>訓練中心的訓練</h4>
                <div className="wf-row">
                  <span>訓練狀態</span>
                  <select className="wf-input" value={row.training_status || 'not_scheduled'} disabled={saving || !documentsReady}
                    title={documentsReady ? '' : '必要文件全部核准後，才能安排訓練。'}
                    onChange={event => update({ type: 'workflow', caseId: row.id, workflowType: 'training', status: event.target.value })}>
                    {trainingStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="wf-row">
                  <span>必要文件</span>
                  <b className={documentsReady ? 'wf-ok' : 'wf-warn'}>{documentsReady ? '已備齊' : docs.length ? `缺 ${missing} 份` : '尚無文件'}</b>
                </div>
                {classes.length === 0
                  ? <p className="wf-empty">尚未報名訓練中心的班別。</p>
                  : classes.map(item => <EnrollmentCard key={item.id} item={item} />)}
                {certs.length > 0 && <div className="wf-row wf-certs">
                  <span>必備證照</span>
                  <span className="wf-cert-list">{certs.map(item => <span className="wf-cert" key={item.id || item.name}>{item.name}<i>{item.status === 'obtained' ? '已取得' : '取證中'}</i></span>)}</span>
                </div>}
              </section>

              <section className="wf-section">
                <h4>仲介的進度</h4>
                {AGENCY_STEPS.map(([key, label, owner]) => {
                  const stepRow = stepMap[key];
                  const draftKey = stepKeyOf(row.id, key);
                  const saved = dateText(stepRow?.completed_on);
                  const value = drafts[draftKey] ?? saved;
                  const changed = value !== saved;
                  return <div className="wf-row wf-step" key={key}>
                    <span>{label}<small>{owner}</small></span>
                    <input className="wf-input" type="date" value={value} disabled={saving}
                      aria-label={label}
                      onChange={event => setDrafts(current => ({ ...current, [draftKey]: event.target.value }))} />
                    <button type="button" className="wf-save" disabled={saving || !changed}
                      onClick={() => saveStep(row.id, key, stepRow)}>儲存</button>
                  </div>;
                })}
                <div className="wf-row">
                  <span>抵台體檢<small>台灣仲介</small></span>
                  <select className="wf-input" value={row.medical_status || 'not_scheduled'} disabled={saving || !arrived}
                    title={arrived ? '' : '登錄實際入境日期後，才能安排抵台體檢。'}
                    onChange={event => update({ type: 'workflow', caseId: row.id, workflowType: 'medical', status: event.target.value })}>
                    {medicalStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </section>
            </section>}
          </Fragment>;
        })}
      </div>}
  </div>;
}
