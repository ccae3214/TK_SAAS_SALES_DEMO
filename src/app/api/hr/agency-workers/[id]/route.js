import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import {
  WORKER_PROGRESS_STEPS, allowedNextStatuses, isValidDateText, pickLatestStep, statusSetFor,
} from '@/lib/hr-worker-progress';

// 菲律賓仲介（與系統管理者）管理「底下工作者」的文件審核與進度安排。
// 文件的審核、適用性切換、上傳與預覽沿用既有 API（/api/hr、/api/hr/documents）；
// 這裡負責：讀取單一工作者的文件＋進度，以及儲存工作者層級的進度（不需要案件）。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
const DOCUMENT_ORDER = { submitted: 0, returned: 1, missing: 2, approved: 3 };

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) {
      if (value) allowed.add(new URL(value).origin);
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1);
    if (host) allowed.add(`${protocol.split(',')[0].trim()}://${host}`);
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}

let schemaPromise;
async function ensureWorkerProgressSchema() {
  if (!schemaPromise) schemaPromise = (async () => {
    // 先確保既有資料表（工作者、文件、案件…）已建立；匯入失敗時不阻擋，因為正常使用時 /api/hr 早已建立。
    try {
      const base = await import('@/app/api/hr/route');
      if (typeof base.ensureSchema === 'function') await base.ensureSchema();
    } catch (error) { console.error('hr_worker_progress_base_schema_skipped', error?.name || 'Error'); }
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_worker_progress_steps (
      worker_id BIGINT NOT NULL REFERENCES hr_workers(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL, started_on DATE, completed_on DATE,
      note TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (worker_id, step_key)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_worker_health_training (
      worker_id BIGINT PRIMARY KEY REFERENCES hr_workers(id) ON DELETE CASCADE,
      medical_status TEXT NOT NULL DEFAULT 'not_scheduled',
      training_status TEXT NOT NULL DEFAULT 'not_scheduled',
      updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

// 回傳 { worker } 或 { response }（錯誤回應）。
async function authorize(principal, workerId) {
  if (!principal || !principal.role) return { response: NextResponse.json({ error: 'HR membership required' }, { status: 403 }) };
  const isPhilippinesAgency = principal.role === 'agency' && principal.agency_type === 'philippines';
  if (principal.role !== 'admin' && !isPhilippinesAgency) {
    return { response: NextResponse.json({ error: '僅菲律賓仲介與系統管理者可以管理工作者的文件與進度。' }, { status: 403 }) };
  }
  const rows = await query(`SELECT w.id,w.name,w.nationality,w.job_preference,w.status,w.agency_id,
    w.resume_profile->>'referenceNo' AS reference_no,a.name AS agency_name
    FROM hr_workers w LEFT JOIN hr_agencies a ON a.id=w.agency_id WHERE w.id=$1`, [workerId]);
  if (!rows.length) return { response: NextResponse.json({ error: '找不到工作者資料。' }, { status: 404 }) };
  const worker = rows[0];
  if (principal.role !== 'admin' && Number(worker.agency_id) !== Number(principal.agency_id)) {
    return { response: NextResponse.json({ error: '只能管理所屬仲介的工作者。' }, { status: 403 }) };
  }
  return { worker, isAdmin: principal.role === 'admin' };
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { id: rawId } = await params;
  if (!validId(rawId)) return NextResponse.json({ error: '工作者編號不正確。' }, { status: 400 });
  const workerId = Number(rawId);
  try {
    await ensureWorkerProgressSchema();
    const principal = await getHrPrincipal(session);
    const access = await authorize(principal, workerId);
    if (access.response) return access.response;

    const [documents, submissions, workerSteps, caseSteps, health, cases, gate] = await Promise.all([
      query('SELECT d.* FROM hr_worker_documents d WHERE d.worker_id=$1 ORDER BY d.id', [workerId]),
      query(`SELECT s.id,s.requirement_id,s.version_number,s.filename,s.note,s.submitted_by,s.created_at,
          v.decision,v.reason AS review_reason,v.reviewer,v.created_at AS reviewed_at,
          f.original_filename,f.size_bytes,f.content_type
        FROM hr_document_submissions s JOIN hr_worker_documents d ON d.id=s.requirement_id
        LEFT JOIN hr_document_reviews v ON v.submission_id=s.id LEFT JOIN hr_document_files f ON f.submission_id=s.id
        WHERE d.worker_id=$1 ORDER BY s.requirement_id,s.version_number DESC`, [workerId]),
      query(`SELECT step_key,to_char(started_on,'YYYY-MM-DD') AS started_on,to_char(completed_on,'YYYY-MM-DD') AS completed_on,
          note,updated_by,updated_at FROM hr_worker_progress_steps WHERE worker_id=$1`, [workerId]),
      query(`SELECT DISTINCT ON (s.step_key) s.step_key,to_char(s.started_on,'YYYY-MM-DD') AS started_on,
          to_char(s.completed_on,'YYYY-MM-DD') AS completed_on,s.note,s.updated_by,s.updated_at
        FROM hr_application_steps s JOIN hr_cases c ON c.id=s.case_id
        WHERE c.worker_id=$1 AND (s.started_on IS NOT NULL OR s.completed_on IS NOT NULL OR s.note<>'')
        ORDER BY s.step_key,s.updated_at DESC`, [workerId]),
      query('SELECT medical_status,training_status FROM hr_worker_health_training WHERE worker_id=$1', [workerId]),
      query(`SELECT c.id,c.case_number,c.stage,c.status,c.medical_status,c.training_status,e.name AS employer_name
        FROM hr_cases c JOIN hr_employers e ON e.id=c.employer_id WHERE c.worker_id=$1 ORDER BY c.updated_at DESC`, [workerId]),
      query(`SELECT EXISTS(SELECT 1 FROM hr_worker_documents d WHERE d.worker_id=$1 AND d.entry_gate AND d.status<>'approved') AS gate_closed`, [workerId]),
    ]);

    const submissionsByDocument = new Map();
    for (const item of submissions) {
      const row = access.isAdmin ? item : { ...item, submitted_by: undefined, reviewer: undefined };
      const list = submissionsByDocument.get(Number(item.requirement_id)) || [];
      list.push(row);
      submissionsByDocument.set(Number(item.requirement_id), list);
    }
    const documentRows = documents.map(item => {
      const history = submissionsByDocument.get(Number(item.id)) || [];
      return { ...item, submissions: history, latest_submission_id: history[0]?.id || null };
    }).sort((a, b) => (a.applicable === b.applicable ? 0 : a.applicable ? -1 : 1)
      || (DOCUMENT_ORDER[a.status] ?? 9) - (DOCUMENT_ORDER[b.status] ?? 9)
      || Number(Boolean(b.entry_gate)) - Number(Boolean(a.entry_gate)) || Number(a.id) - Number(b.id));

    const workerStepMap = new Map(workerSteps.map(item => [item.step_key, item]));
    const caseStepMap = new Map(caseSteps.map(item => [item.step_key, item]));
    const steps = WORKER_PROGRESS_STEPS.map(([stepKey, label]) => {
      const picked = pickLatestStep(workerStepMap.get(stepKey), caseStepMap.get(stepKey));
      return {
        step_key: stepKey, label,
        started_on: picked?.started_on || '', completed_on: picked?.completed_on || '', note: picked?.note || '',
        updated_at: picked?.updated_at || null, source: picked?.source || null,
        updated_by: access.isAdmin ? (picked?.updated_by || '') : undefined,
      };
    });

    return NextResponse.json({
      worker: access.worker, documents: documentRows, steps, cases, viewer: { is_admin: access.isAdmin },
      health: {
        medical_status: health[0]?.medical_status || 'not_scheduled',
        training_status: health[0]?.training_status || 'not_scheduled',
        gate_closed: Boolean(gate[0]?.gate_closed),
      },
    });
  } catch (error) {
    console.error('hr_worker_progress_read_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '無法讀取工作者的文件與進度，請稍後再試。' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。' }, { status: 403 });
  const { id: rawId } = await params;
  if (!validId(rawId)) return NextResponse.json({ error: '工作者編號不正確。' }, { status: 400 });
  const workerId = Number(rawId);
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: '表單資料格式不正確。' }, { status: 400 }); }
  const actor = clean(session.user?.email || session.user?.lineUserId || 'LINE 登入', 254);
  try {
    await ensureWorkerProgressSchema();
    const principal = await getHrPrincipal(session);
    const access = await authorize(principal, workerId);
    if (access.response) return access.response;

    if (body.type === 'step') {
      const stepKey = clean(body.stepKey, 60);
      const step = WORKER_PROGRESS_STEPS.find(([key]) => key === stepKey);
      const startedOn = clean(body.startedOn, 10), completedOn = clean(body.completedOn, 10);
      if (!step || !isValidDateText(startedOn) || !isValidDateText(completedOn)) return NextResponse.json({ error: '申請程序日期或項目不正確。' }, { status: 400 });
      if (startedOn && completedOn && completedOn < startedOn) return NextResponse.json({ error: '完成日不能早於開始日。' }, { status: 400 });
      const note = clean(body.note, 1000);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO hr_worker_progress_steps(worker_id,step_key,started_on,completed_on,note,updated_by,updated_at)
          VALUES($1,$2,$3::date,$4::date,$5,$6,NOW())
          ON CONFLICT(worker_id,step_key) DO UPDATE SET started_on=EXCLUDED.started_on,completed_on=EXCLUDED.completed_on,
            note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
        [workerId, stepKey, startedOn || null, completedOn || null, note, actor]);
        // 同步到這位工作者尚未結案的案件，讓案件頁（台灣仲介、雇主、工作者）看到同一份進度。
        await client.query(`INSERT INTO hr_application_steps(case_id,step_key,label,started_on,completed_on,note,updated_by,updated_at)
          SELECT c.id,$2,$3,$4::date,$5::date,$6,$7,NOW() FROM hr_cases c WHERE c.worker_id=$1 AND c.status<>'closed'
          ON CONFLICT(case_id,step_key) DO UPDATE SET started_on=EXCLUDED.started_on,completed_on=EXCLUDED.completed_on,
            note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
        [workerId, stepKey, step[1], startedOn || null, completedOn || null, note, actor]);
        await client.query(`INSERT INTO hr_case_activity(case_id,actor_email,action,detail)
          SELECT c.id,$2,'更新申請程序',$3 FROM hr_cases c WHERE c.worker_id=$1 AND c.status<>'closed'`,
        [workerId, actor, `${step[1]} · ${completedOn || startedOn || '更新備註'}`]);
        await client.query('COMMIT');
        return NextResponse.json({ ok: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }

    if (body.type === 'status') {
      const kind = clean(body.workflowType, 20), status = clean(body.status, 30);
      const statuses = statusSetFor(kind);
      if (!statuses.has(status)) return NextResponse.json({ error: '體檢或訓練狀態不正確。' }, { status: 400 });
      const column = kind === 'medical' ? 'medical_status' : 'training_status';
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO hr_worker_health_training(worker_id) VALUES($1) ON CONFLICT(worker_id) DO NOTHING', [workerId]);
        const current = await client.query(`SELECT ${column} AS current_status FROM hr_worker_health_training WHERE worker_id=$1 FOR UPDATE`, [workerId]);
        const gate = await client.query(`SELECT EXISTS(SELECT 1 FROM hr_worker_documents d WHERE d.worker_id=$1 AND d.entry_gate AND d.status<>'approved') AS gate_closed`, [workerId]);
        const currentStatus = current.rows[0]?.current_status || 'not_scheduled';
        if (gate.rows[0]?.gate_closed && status !== 'not_scheduled') {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: '護照資料頁與 PSA 出生證明核准後，才能安排體檢及訓練。' }, { status: 409 });
        }
        if (!allowedNextStatuses(kind, currentStatus).includes(status) && currentStatus !== status) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: '此狀態不能直接跳轉，請依流程逐步更新。' }, { status: 409 });
        }
        await client.query(`UPDATE hr_worker_health_training SET ${column}=$2,updated_by=$3,updated_at=NOW() WHERE worker_id=$1`, [workerId, status, actor]);
        await client.query(`INSERT INTO hr_case_activity(case_id,actor_email,action,detail)
          SELECT c.id,$2,$3,$4 FROM hr_cases c WHERE c.worker_id=$1 AND c.status<>'closed'`,
        [workerId, actor, kind === 'medical' ? '更新體檢安排' : '更新訓練安排', status]);
        await client.query('COMMIT');
        return NextResponse.json({ ok: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }

    return NextResponse.json({ error: '更新項目不正確。' }, { status: 400 });
  } catch (error) {
    console.error('hr_worker_progress_update_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '儲存失敗，請稍後再試。' }, { status: 500 });
  }
}
