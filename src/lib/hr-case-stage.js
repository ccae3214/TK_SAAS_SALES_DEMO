// 案件階段的資料庫輔助函式：把案件目前的文件、證照、訓練、體檢與申請程序整理後，
// 交給 hr-case-flow.js 的 computeCaseStage 計算，再寫回 hr_cases.stage。
// run(sql, params) 要回傳資料列陣列；在交易中請傳入 async (sql, params) => (await client.query(sql, params)).rows。
import { computeCaseStage, summarizeSteps } from '@/lib/hr-case-flow';

export async function refreshCaseStage(run, caseId) {
  const [state] = await run(`SELECT c.medical_status,c.training_status,
    EXISTS(SELECT 1 FROM hr_worker_documents d WHERE d.worker_id=c.worker_id AND d.entry_gate AND d.applicable AND d.status<>'approved') AS gate_closed,
    EXISTS(SELECT 1 FROM hr_worker_documents d WHERE d.worker_id=c.worker_id AND d.required AND d.applicable AND d.status<>'approved') AS documents_open,
    EXISTS(SELECT 1 FROM hr_case_certifications k WHERE k.case_id=c.id AND k.status<>'obtained') AS certification_open
    FROM hr_cases c WHERE c.id=$1`, [caseId]);
  if (!state) return null;
  const steps = await run('SELECT step_key,completed_on FROM hr_application_steps WHERE case_id=$1 AND completed_on IS NOT NULL', [caseId]);
  const stage = computeCaseStage({
    gateClosed: state.gate_closed,
    documentsOpen: state.documents_open,
    certificationOpen: state.certification_open,
    trainingStatus: state.training_status,
    medicalStatus: state.medical_status,
    ...summarizeSteps(steps),
  });
  await run('UPDATE hr_cases SET stage=$2,updated_at=NOW() WHERE id=$1', [caseId, stage]);
  return stage;
}

// 工人的文件或進度有變動時，重算他所有案件的階段。
export async function refreshWorkerCases(run, workerId) {
  for (const row of await run('SELECT id FROM hr_cases WHERE worker_id=$1', [workerId])) await refreshCaseStage(run, row.id);
}

// 工人層級（尚未建案也能記錄）的「是否已入境」：看工人層級進度或任一案件的實際入境日期。
export async function workerHasArrived(run, workerId) {
  const [row] = await run(`SELECT (
      EXISTS(SELECT 1 FROM hr_worker_progress_steps s WHERE s.worker_id=$1 AND s.step_key='actual_entry' AND s.completed_on IS NOT NULL)
      OR EXISTS(SELECT 1 FROM hr_application_steps s JOIN hr_cases c ON c.id=s.case_id WHERE c.worker_id=$1 AND s.step_key='actual_entry' AND s.completed_on IS NOT NULL)
    ) AS arrived`, [workerId]);
  return Boolean(row?.arrived);
}
