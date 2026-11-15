// 「做完這一步，下一步該做什麼」：依需求單的媒合狀態與案件的來台程序進度，告訴仲介現在該聯絡誰、確認什麼。
// 純函式（不碰資料庫、不授予權限），只回傳代碼；畫面依語言把代碼轉成中文或英文，所以這裡沒有任何顯示文字。
//
// 角色：taiwan = 台灣仲介、philippines = 菲律賓仲介。
// with（要聯絡的對象）：employer 雇主、taiwan 台灣仲介、philippines 菲律賓仲介、notification 台灣入國通報流程。

const action = (id, withWhom = []) => ({ id, with: withWhom });

// ---- 需求單（雇主下單到錄用）----
export const ORDER_GUIDES = {
  order_placed: { taiwan: [action('confirm_eta', ['philippines'])], philippines: [action('reply_eta', ['taiwan'])] },
  candidate_proposed: { taiwan: [action('remind_employer', ['employer']), action('confirm_candidate_docs', ['philippines'])], philippines: [action('prepare_candidate', ['taiwan'])] },
  interview_scheduled: { taiwan: [action('confirm_interview', ['employer', 'philippines'])], philippines: [action('worker_attend', ['taiwan'])] },
  hired: { taiwan: [action('start_case', ['philippines', 'employer'])], philippines: [action('start_docs', ['taiwan'])] },
};

// flow：hr-workflow.js 的 orderJourney() 回傳值。取消的需求不需要再提醒。
export function orderGuideId(order, flow) {
  if (!order || !flow || order.status === 'cancelled') return null;
  const statuses = (flow.candidates || []).map(row => row.status);
  if (order.status === 'filled') return 'hired';
  if (statuses.includes('scheduled')) return 'interview_scheduled';
  if (statuses.includes('proposed')) return 'candidate_proposed';
  if (Number(flow.hired) > 0) return 'hired';
  return 'order_placed';
}

// ---- 案件的來台程序（配工到入境後在台文件）----
export const CASE_GUIDES = {
  case_started: { taiwan: [action('confirm_eta', ['philippines'])], philippines: [action('reply_eta', ['taiwan'])] },
  match_done: { taiwan: [action('confirm_docs_date', ['philippines'])], philippines: [action('gather_docs', ['taiwan'])] },
  docs_ready: { taiwan: [action('confirm_routes_plan', ['philippines', 'employer'])], philippines: [action('run_routes', ['taiwan'])] },
  one_route_done: { taiwan: [action('confirm_missing_route', ['philippines'])], philippines: [action('finish_missing_route', ['taiwan'])] },
  visa_oec_done: { taiwan: [action('confirm_entry_date', ['employer', 'philippines', 'notification'])], philippines: [action('book_ticket', ['taiwan', 'employer'])] },
  flight_set: { taiwan: [action('prepare_arrival', ['employer', 'notification'])], philippines: [action('confirm_departure', ['taiwan'])] },
  arrived: { taiwan: [action('post_arrival_docs', ['notification'])], philippines: [action('followup_worker', ['taiwan'])] },
  all_done: { taiwan: [], philippines: [] },
};

const TAIWAN_ARRIVAL = ['entry_notification', 'insurance', 'arc'];

// steps：[{ step_key, completed_on }]，沒有 completed_on 的視為還沒完成。
export function caseGuideId(steps = []) {
  const done = new Set((steps || []).filter(step => step && step.completed_on).map(step => step.step_key));
  const has = key => done.has(key);
  if (has('actual_entry') && TAIWAN_ARRIVAL.every(has)) return 'all_done';
  if (has('actual_entry')) return 'arrived';
  const visaAndOec = has('visa') && has('oec');
  if (visaAndOec && (has('ticket') || has('expected_entry'))) return 'flight_set';
  if (visaAndOec) return 'visa_oec_done';
  if (has('visa') || has('oec')) return 'one_route_done';
  if (has('passport') && has('personal_documents') && has('document_arrival')) return 'docs_ready';
  if (has('match_date')) return 'match_done';
  return 'case_started';
}

const isAudience = side => side === 'taiwan' || side === 'philippines';

// 回傳 { id, actions } 或 null（不是台灣／菲律賓仲介、或沒有後續動作）。
export function orderNextSteps(order, flow, agencyType) {
  const id = orderGuideId(order, flow);
  if (!id || !isAudience(agencyType)) return null;
  return { id, actions: ORDER_GUIDES[id][agencyType] };
}
export function caseNextSteps(steps, agencyType) {
  if (!isAudience(agencyType)) return null;
  const id = caseGuideId(steps);
  return { id, actions: CASE_GUIDES[id][agencyType] };
}
