// 案件相關：建立案件、補文件要求、新增待辦。
// 每個 handler 自己宣告 allow（哪些角色能用）；沒有任何 handler 符合時由 index.js 回 403／400。
import pool, { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { insertWorkerDocuments, insertCaseCertifications } from '@/lib/hr-requirements';
import { assertCaseAgenciesCertified } from '@/lib/hr-agency-certification-store';
import { TASK_CATEGORIES, APPLICATION_STEPS, clean, WORKER_JOB_PREFERENCES, validId, validDate, recordActivity, recordWorkerActivity, refreshCaseStage, refreshWorkerCases } from '../_shared';

export const createCase = {
  types: ["case"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    if (!validId(body.employerId) || !validId(body.workerId)) return NextResponse.json({ error: '請選擇雇主與工作者。' }, { status: 400 });
    if (principal.role === 'admin') {
      const workerMember = await query(`SELECT w.id FROM hr_workers w
        JOIN hr_members m ON m.worker_id=w.id
        WHERE w.id=$1 AND w.status='active' AND m.role='worker' AND m.active=TRUE
        LIMIT 1`, [Number(body.workerId)]);
      if (!workerMember.length) return NextResponse.json({ error: '工作者必須是啟用中的工作者類型會員。' }, { status: 400 });
    }
    if (body.assignedMemberId && !validId(body.assignedMemberId)) return NextResponse.json({ error: '所屬業務格式不正確。' }, { status: 400 });
    if (!validDate(body.expectedStartDate)) return NextResponse.json({ error: '預計日期格式不正確。' }, { status: 400 });
    const jobType=clean(body.jobType,120);
    if (jobType && !WORKER_JOB_PREFERENCES.has(jobType)) return NextResponse.json({ error: '請選擇有效的職類。' }, { status: 400 });
    const assignedMemberId=body.assignedMemberId?Number(body.assignedMemberId):null;
    const certificationError=await assertCaseAgenciesCertified(pool,Number(body.employerId),Number(body.workerId));
    if(certificationError)return NextResponse.json({error:certificationError},{status:409});
    if(assignedMemberId){
      const validAssignee=await query(`SELECT m.id FROM hr_members m JOIN hr_employers e ON e.agency_id=m.agency_id
        WHERE m.id=$1 AND m.role='agency' AND m.active=TRUE AND e.id=$2 AND ($3::text='admin' OR m.agency_id=$4)`,[assignedMemberId,Number(body.employerId),principal.role,principal.agency_id||null]);
      if(!validAssignee.length)return NextResponse.json({error:'請選擇該雇主所屬台灣仲介的有效會員。'},{status:400});
    }
    const caseNumber = `HR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomUUID().slice(0,6).toUpperCase()}`;
    const result = await query(`INSERT INTO hr_cases(case_number,employer_id,worker_id,assigned_member_id,job_type,expected_start_date,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [caseNumber,Number(body.employerId),Number(body.workerId),assignedMemberId,jobType,body.expectedStartDate || null,clean(body.notes,4000)]);
    // 文件屬於工人、在工人建立時就已產生；這裡只是保險補齊。案件本身只會依職類多出必備證照（例如看護 → Caregiving NC2）。
    const [caseWorker] = await query('SELECT resume_profile FROM hr_workers WHERE id=$1', [Number(body.workerId)]);
    await insertWorkerDocuments(pool, Number(body.workerId), caseWorker?.resume_profile);
    await insertCaseCertifications(pool, result[0].id, jobType);
    await query(`INSERT INTO hr_application_steps(case_id,step_key,label)
      VALUES ${APPLICATION_STEPS.map((_,index)=>`($1,$${index*2+2},$${index*2+3})`).join(',')}
      ON CONFLICT(case_id,step_key) DO NOTHING`, [result[0].id,...APPLICATION_STEPS.flat()]);
    await recordActivity(result[0].id, actor, '建立案件', caseNumber);
    await refreshCaseStage(result[0].id);
    return NextResponse.json(result[0], { status: 201 });
  },
};

export const addRequirement = {
  types: ["requirement"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    // 額外的文件要求加在工人身上（可傳 workerId，或傳 caseId 由案件找到工人）。
    let workerId = validId(body.workerId) ? Number(body.workerId) : null;
    if (!workerId && validId(body.caseId)) workerId = Number((await query('SELECT worker_id FROM hr_cases WHERE id=$1', [Number(body.caseId)]))[0]?.worker_id) || null;
    if (!workerId) return NextResponse.json({ error: '請選擇工作者。' }, { status: 400 });
    const name = clean(body.name, 160);
    if (!name) return NextResponse.json({ error: '請填寫文件名稱。' }, { status: 400 });
    const result = await query(`INSERT INTO hr_worker_documents(worker_id,name,required,entry_gate,applicability_source)
      VALUES($1,$2,$3,$4,'manual') ON CONFLICT(worker_id,name) DO NOTHING RETURNING *`, [workerId, name, body.required !== false, body.entryGate === true]);
    if (!result.length) return NextResponse.json({ error: '這位工作者已經有同名的文件。' }, { status: 409 });
    await recordWorkerActivity(pool, workerId, actor, '新增文件要求', name);
    await refreshWorkerCases(workerId);
    return NextResponse.json(result[0], { status: 201 });
  },
};

export const addTask = {
  types: ["task"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    if (!validId(body.caseId)) return NextResponse.json({ error: '請選擇案件。' }, { status: 400 });
    const title = clean(body.title,200), category = clean(body.category,30) || 'other';
    if (!title || !TASK_CATEGORIES.has(category) || !validDate(body.dueDate)) return NextResponse.json({ error: '待辦內容或日期不正確。' }, { status: 400 });
    const result = await query(`INSERT INTO hr_case_tasks(case_id,title,category,due_date,notes)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [Number(body.caseId),title,category,body.dueDate || null,clean(body.notes,2000)]);
    await recordActivity(Number(body.caseId), actor, '新增待辦', title);
    return NextResponse.json(result[0], { status: 201 });
  },
};
