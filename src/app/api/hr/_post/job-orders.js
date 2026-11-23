// 工作需求單：雇主建單、管理者指派仲介、菲律賓仲介推薦人選、雇主直接挑選。
// 每個 handler 自己宣告 allow（哪些角色能用）；沒有任何 handler 符合時由 index.js 回 403／400。
import pool, { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { WITHDRAWAL_MARKER } from '@/lib/hr-candidate-withdrawal';
import { isAgencyPairCertified, assertPhilippinesAgenciesCertified } from '@/lib/hr-agency-certification-store';
import { cleanCareRecipient, jobOrderExtrasError, needsCareRecipient, parseIssueDate, parseMonthlySalary, parseWorkPeriod } from '@/lib/hr-employer-profile';
import { clean, validId, validDate } from '../_shared';

export const createJobOrder = {
  types: ["job-order"],
  allow: principal => principal.role === 'employer',
  async run({ principal, session, body, actor }) {
    const employerId = Number(principal.employer_id);
    const agencyAssignments = Array.isArray(body.taiwanAgencyAssignments)
      ? body.taiwanAgencyAssignments.map(item => ({ agencyId:Number(item.agencyId), brokerMemberId:item.brokerMemberId ? Number(item.brokerMemberId) : null }))
      : (Array.isArray(body.taiwanAgencyIds) ? body.taiwanAgencyIds.map(id=>({agencyId:Number(id),brokerMemberId:null})) : []);
    const agencyIds = [...new Set(agencyAssignments.map(item=>item.agencyId))];
    const headcount = Number(body.headcount), jobType = clean(body.jobType,120);
    if (!validId(employerId) || agencyAssignments.length!==1 || !agencyIds.length || !agencyIds.every(validId) || !Number.isInteger(headcount) || headcount < 1 || headcount > 100 || !jobType || !validDate(body.expectedStartDate)) return NextResponse.json({error:'工作需求單只能指定一家所屬台灣仲介，並請填寫工作類型與需求人數。'},{status:400});
    const orderSalary=parseMonthlySalary(body.monthlySalary);
    const orderWorkPeriod=parseWorkPeriod(body.workMonths,body.workDays),orderIssueDate=parseIssueDate(body.issueDate);
    const orderCare=needsCareRecipient(jobType)?cleanCareRecipient(body.careRecipient):{};
    const orderExtrasError=jobOrderExtrasError({jobType,monthlySalary:body.monthlySalary,workMonths:body.workMonths,workDays:body.workDays,issueDate:body.issueDate,careRecipient:orderCare});
    if(orderExtrasError)return NextResponse.json({error:orderExtrasError},{status:400});
    if (agencyAssignments.some(item=>item.brokerMemberId!==null&&!validId(item.brokerMemberId))) return NextResponse.json({error:'業務資料格式不正確。'},{status:400});
    const employerRecord=await query('SELECT id,agency_id,status FROM hr_employers WHERE id=$1',[employerId]);
    if(!employerRecord.length)return NextResponse.json({error:'找不到雇主資料，請聯絡管理者確認會員指派。'},{status:404});
    if(employerRecord[0].status!=='active')return NextResponse.json({error:'雇主資料目前已停用，請聯絡管理者啟用後再建立工作需求單。'},{status:409});
    if(!employerRecord[0].agency_id)return NextResponse.json({error:'雇主資料尚未指派所屬台灣仲介，請聯絡管理者設定。'},{status:400});
    if(Number(employerRecord[0].agency_id)!==agencyIds[0])return NextResponse.json({error:'工作需求單只能送交雇主目前所屬的台灣仲介。'},{status:403});
    const validAgencies = await query("SELECT id FROM hr_agencies WHERE id=ANY($1::bigint[]) AND agency_type='taiwan' AND active=TRUE",[agencyIds]);
    if (validAgencies.length !== agencyIds.length) return NextResponse.json({error:'所選台灣仲介資料無效。'},{status:400});
    const brokerIds=agencyAssignments.map(item=>item.brokerMemberId).filter(Boolean);
    if(brokerIds.length){
      const brokers=await query("SELECT id,agency_id FROM hr_members WHERE id=ANY($1::bigint[]) AND role='agency' AND active=TRUE",[brokerIds]);
      if(brokers.length!==new Set(brokerIds).size||agencyAssignments.some(item=>item.brokerMemberId&&!brokers.some(broker=>Number(broker.id)===item.brokerMemberId&&Number(broker.agency_id)===item.agencyId))) return NextResponse.json({error:'所選業務必須是該台灣仲介機構底下的有效會員。'},{status:400});
    }
    const client=await pool.connect();
    try { await client.query('BEGIN');
      const employer=await client.query('SELECT id,agency_id,status FROM hr_employers WHERE id=$1 FOR UPDATE',[employerId]);
      if(!employer.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到雇主資料。'},{status:404});}
      if(employer.rows[0].status!=='active'){await client.query('ROLLBACK');return NextResponse.json({error:'雇主資料目前已停用，請聯絡管理者啟用後再建立工作需求單。'},{status:409});}
      if(Number(employer.rows[0].agency_id)!==agencyIds[0]){await client.query('ROLLBACK');return NextResponse.json({error:'雇主所屬仲介已變更，請重新整理後再建立需求單。'},{status:409});}
      const order=await client.query(`INSERT INTO hr_job_orders(employer_id,job_type,headcount,description,expected_start_date,monthly_salary,care_recipient,work_months,work_days,issue_date) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) RETURNING *`,[employerId,jobType,headcount,clean(body.description,3000),body.expectedStartDate||null,orderSalary.value,JSON.stringify(orderCare),orderWorkPeriod.months,orderWorkPeriod.days,orderIssueDate.value]);
      for(const assignment of agencyAssignments) await client.query('INSERT INTO hr_job_order_agencies(job_order_id,taiwan_agency_id,broker_member_id) VALUES($1,$2,$3)',[order.rows[0].id,assignment.agencyId,assignment.brokerMemberId]);
      await client.query('COMMIT'); return NextResponse.json(order.rows[0],{status:201});
    } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
  },
};

export const assignTaiwanAgency = {
  types: ["job-order-admin-assignment"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    const jobOrderId=Number(body.jobOrderId),agencyId=Number(body.taiwanAgencyId),brokerMemberId=body.brokerMemberId?Number(body.brokerMemberId):null;
    if(!validId(jobOrderId)||!validId(agencyId)||(brokerMemberId!==null&&!validId(brokerMemberId)))return NextResponse.json({error:'媒合需求或仲介資料不正確。'},{status:400});
    const employerAgency=await query(`SELECT e.agency_id FROM hr_job_orders o JOIN hr_employers e ON e.id=o.employer_id WHERE o.id=$1`,[jobOrderId]);
    if(!employerAgency.length)return NextResponse.json({error:'找不到媒合需求單。'},{status:404});
    if(!validId(employerAgency[0].agency_id)||Number(employerAgency[0].agency_id)!==agencyId)return NextResponse.json({error:'媒合需求只能指派給雇主所屬台灣仲介及其業務。'},{status:403});
    const agency=await query("SELECT id FROM hr_agencies WHERE id=$1 AND agency_type='taiwan' AND active=TRUE",[agencyId]);
    if(!agency.length)return NextResponse.json({error:'請選擇啟用中的台灣仲介。'},{status:400});
    if(brokerMemberId){const broker=await query("SELECT id FROM hr_members WHERE id=$1 AND role='agency' AND agency_id=$2 AND active=TRUE",[brokerMemberId,agencyId]);if(!broker.length)return NextResponse.json({error:'業務必須是該仲介機構底下的啟用會員。'},{status:400});}
    const assignment=await query(`INSERT INTO hr_job_order_agencies(job_order_id,taiwan_agency_id,broker_member_id) SELECT o.id,$2,$3 FROM hr_job_orders o WHERE o.id=$1 ON CONFLICT(job_order_id,taiwan_agency_id) DO UPDATE SET broker_member_id=EXCLUDED.broker_member_id RETURNING *`,[jobOrderId,agencyId,brokerMemberId]);
    if(!assignment.length)return NextResponse.json({error:'找不到媒合需求單。'},{status:404});
    return NextResponse.json(assignment[0],{status:201});
  },
};

export const assignPhilippinesAgencies = {
  types: ["job-order-admin-philippines-assignment"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    const orderAgencyId=Number(body.orderAgencyId),agencyIds=Array.isArray(body.philippinesAgencyIds)?[...new Set(body.philippinesAgencyIds.map(Number))]:[];
    if(!validId(orderAgencyId)||!Array.isArray(body.philippinesAgencyIds)||agencyIds.some(id=>!validId(id)))return NextResponse.json({error:'需求單或菲律賓仲介資料不正確。'},{status:400});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const dispatch=await client.query(`SELECT oa.id,oa.job_order_id,oa.taiwan_agency_id,o.employer_id,e.name AS employer_name,ta.name AS taiwan_agency_name
        FROM hr_job_order_agencies oa JOIN hr_job_orders o ON o.id=oa.job_order_id
        JOIN hr_employers e ON e.id=o.employer_id JOIN hr_agencies ta ON ta.id=oa.taiwan_agency_id
        WHERE oa.id=$1 FOR UPDATE OF oa,o`,[orderAgencyId]);
      if(!dispatch.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到需求單的台灣仲介指派資料。'},{status:404});}
      const philippines=await client.query("SELECT id,name FROM hr_agencies WHERE id=ANY($1::bigint[]) AND active=TRUE AND agency_type='philippines'",[agencyIds]);
      if(philippines.rowCount!==agencyIds.length){await client.query('ROLLBACK');return NextResponse.json({error:'請選擇有效且啟用中的菲律賓仲介。'},{status:400});}
      const uncertifiedAgencies=await assertPhilippinesAgenciesCertified(client,orderAgencyId,dispatch.rows[0].taiwan_agency_id,agencyIds);
      if(uncertifiedAgencies.length){await client.query('ROLLBACK');return NextResponse.json({error:`下列菲律賓仲介尚未與台灣仲介 ${dispatch.rows[0].taiwan_agency_name} 完成相互認證：${uncertifiedAgencies.join('、')}`},{status:409});}
      const removedRoutes=await client.query(`SELECT r.id FROM hr_job_order_routes r
        WHERE r.order_agency_id=$1 AND NOT (r.philippines_agency_id=ANY($2::bigint[]))
          AND EXISTS(SELECT 1 FROM hr_job_order_candidates c WHERE c.route_id=r.id)`,[orderAgencyId,agencyIds]);
      if(removedRoutes.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'已有人選推薦或面試紀錄的菲律賓仲介不可移除。'},{status:409});}
      await client.query('DELETE FROM hr_job_order_routes WHERE order_agency_id=$1 AND NOT (philippines_agency_id=ANY($2::bigint[]))',[orderAgencyId,agencyIds]);
      const newRoutes=[];
      for(const agency of philippines.rows){
        const route=await client.query(`INSERT INTO hr_job_order_routes(order_agency_id,philippines_agency_id,notes)
          VALUES($1,$2,'管理者直接指派') ON CONFLICT(order_agency_id,philippines_agency_id) DO NOTHING RETURNING id,order_agency_id,philippines_agency_id`,[orderAgencyId,agency.id]);
        if(route.rowCount)newRoutes.push({...route.rows[0],philippines_agency_name:agency.name});
      }
      for(const route of newRoutes){
        const message=`管理者已將媒合需求單 #${dispatch.rows[0].job_order_id}（${dispatch.rows[0].employer_name}）直接指派給台灣仲介 ${dispatch.rows[0].taiwan_agency_name} 與菲律賓仲介 ${route.philippines_agency_name}，請雙方直接聯繫媒合。`;
        for(const agencyId of [Number(dispatch.rows[0].taiwan_agency_id),Number(route.philippines_agency_id)]){
          const room=await client.query(`INSERT INTO hr_chat_rooms(room_type,agency_id) VALUES('agency',$1)
            ON CONFLICT(agency_id) WHERE room_type='agency' DO UPDATE SET agency_id=EXCLUDED.agency_id RETURNING id`,[agencyId]);
          await client.query(`INSERT INTO hr_chat_messages(room_id,member_id,sender_name,sender_role,body)
            VALUES($1,$2,$3,'admin',$4)`,[room.rows[0].id,principal.id||null,principal.name||session.user.name||'管理者',message]);
        }
      }
      const routes=await client.query(`SELECT r.id,r.order_agency_id,r.philippines_agency_id,a.name AS philippines_agency_name
        FROM hr_job_order_routes r JOIN hr_agencies a ON a.id=r.philippines_agency_id WHERE r.order_agency_id=$1 ORDER BY a.name`,[orderAgencyId]);
      await client.query('COMMIT');
      return NextResponse.json({routes:routes.rows},{status:201});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },
};

export const recommendCandidate = {
  types: ["job-order-candidate"],
  allow: principal => principal.role === 'agency' && principal.agency_type === 'philippines',
  async run({ principal, session, body, actor }) {
    const routeId=Number(body.routeId),workerId=Number(body.workerId);
    if(String(body.notes||'').includes(WITHDRAWAL_MARKER.trim()))return NextResponse.json({error:'推薦說明包含保留的系統標記。'},{status:400});
    if(!validId(routeId)||!validId(workerId))return NextResponse.json({error:'請選擇工作需求與所屬工作者。'},{status:400});
    const result=await query(`INSERT INTO hr_job_order_candidates(route_id,worker_id,notes,proposed_by) SELECT r.id,w.id,$3,$5 FROM hr_job_order_routes r JOIN hr_workers w ON w.id=$2 JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id JOIN hr_job_orders o ON o.id=oa.job_order_id WHERE r.id=$1 AND r.philippines_agency_id=$4 AND w.agency_id=$4 AND o.status='open' AND w.status='active' AND EXISTS(SELECT 1 FROM hr_agency_certifications ac WHERE ac.taiwan_agency_id=oa.taiwan_agency_id AND ac.philippines_agency_id=r.philippines_agency_id AND ac.status='certified') AND NOT EXISTS(SELECT 1 FROM hr_cases c WHERE c.worker_id=w.id) ON CONFLICT(route_id,worker_id) DO UPDATE SET notes=EXCLUDED.notes,updated_at=NOW() WHERE hr_job_order_candidates.status='proposed' AND hr_job_order_candidates.interview_at IS NULL AND hr_job_order_candidates.case_id IS NULL RETURNING *`,[routeId,workerId,clean(body.notes,2000),principal.agency_id,principal.id]);
    if(!result.length)return NextResponse.json({error:'只能推薦所屬菲律賓仲介、尚未建立任何案件，且已與該台灣仲介完成相互認證的工作者。'},{status:403});return NextResponse.json(result[0],{status:201});
  },
};

export const employerPickCandidate = {
  types: ["job-order-employer-candidate"],
  allow: principal => principal.role === 'employer',
  async run({ principal, session, body, actor }) {
    const orderId=Number(body.orderId),workerId=Number(body.workerId);
    if(!validId(orderId)||!validId(workerId))return NextResponse.json({error:'工作需求或工作者資料不正確。'},{status:400});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const order=await client.query(`SELECT o.id,o.job_type,o.status,e.agency_id,e.name employer_name,
          oa.id order_agency_id,ta.name taiwan_agency_name
        FROM hr_job_orders o JOIN hr_employers e ON e.id=o.employer_id
        JOIN hr_job_order_agencies oa ON oa.job_order_id=o.id AND oa.taiwan_agency_id=e.agency_id
        JOIN hr_agencies ta ON ta.id=oa.taiwan_agency_id AND ta.active=TRUE AND ta.agency_type='taiwan'
        WHERE o.id=$1 AND o.employer_id=$2 FOR UPDATE OF o,e,oa`,[orderId,principal.employer_id]);
      if(!order.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'找不到需求單或尚未指派台灣仲介。'},{status:404});}
      const orderItem=order.rows[0];
      if(orderItem.status!=='open'){await client.query('ROLLBACK');return NextResponse.json({error:'此需求單已額滿或取消，無法再挑選工作者。'},{status:409});}
      const worker=await client.query(`SELECT w.id,w.name,w.agency_id,a.name philippines_agency_name
        FROM hr_workers w JOIN hr_agencies a ON a.id=w.agency_id AND a.active=TRUE AND a.agency_type='philippines'
        WHERE w.id=$1 AND w.status='active' AND w.job_preference=$2
          AND NOT EXISTS(SELECT 1 FROM hr_cases c WHERE c.worker_id=w.id)
        FOR UPDATE OF w`,[workerId,orderItem.job_type]);
      if(!worker.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'此工作者不符合工作類型、已停用或已建立案件。'},{status:409});}
      if(!(await isAgencyPairCertified(client,orderItem.agency_id,worker.rows[0].agency_id))){await client.query('ROLLBACK');return NextResponse.json({error:'您的台灣仲介尚未與此工作者所屬的菲律賓仲介完成相互認證，無法挑選。'},{status:403});}
      const selectedRoute=await client.query(`INSERT INTO hr_job_order_routes(order_agency_id,philippines_agency_id,notes)
        VALUES($1,$2,'雇主直接挑選工作者') ON CONFLICT(order_agency_id,philippines_agency_id)
        DO UPDATE SET notes=hr_job_order_routes.notes RETURNING id`,
      [orderItem.order_agency_id,worker.rows[0].agency_id]);
      const selected=await client.query(`INSERT INTO hr_job_order_candidates(route_id,worker_id,proposed_by,notes)
        VALUES($1,$2,$3,'由雇主直接挑選') ON CONFLICT(route_id,worker_id) DO NOTHING RETURNING *`,
      [selectedRoute.rows[0].id,workerId,principal.id||null]);
      if(!selected.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'這位工作者已加入此需求單。'},{status:409});}

      const message=`雇主 ${orderItem.employer_name} 已從需求單 #${orderId} 挑選工作者 ${worker.rows[0].name}（${orderItem.job_type}）。請台灣仲介與菲律賓仲介聯繫安排後續面試。`;
      for(const agencyId of [Number(orderItem.agency_id),Number(worker.rows[0].agency_id)]){
        const room=await client.query(`INSERT INTO hr_chat_rooms(room_type,agency_id) VALUES('agency',$1)
          ON CONFLICT(agency_id) WHERE room_type='agency' DO UPDATE SET agency_id=EXCLUDED.agency_id RETURNING id`,[agencyId]);
        await client.query(`INSERT INTO hr_chat_messages(room_id,member_id,sender_name,sender_role,body)
          VALUES($1,$2,$3,'employer',$4)`,[room.rows[0].id,principal.id||null,principal.name||session.user.name||'雇主',message]);
      }
      await client.query('COMMIT');
      return NextResponse.json(selected.rows[0],{status:201});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },
};
