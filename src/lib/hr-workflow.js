// Presentation-only projections. These helpers do not grant permissions or mutate records.
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
export function membershipState(data = {}) {
  if (data.role && data.role !== 'pending') return 'ready';
  return ['worker', 'employer', 'agency'].includes(data.requestedRole) ? 'waiting' : 'choose';
}
export const MATCH_STEPS = ['需求建立', '仲介轉介', '推薦人選', '面試確認', '錄用辦件'];
export function orderJourney(order, assignments = [], routes = [], candidates = []) {
  const dispatches = assignments.filter(row => sameId(row.job_order_id, order.id));
  const forwarded = routes.filter(row => dispatches.some(item => sameId(item.id, row.order_agency_id)));
  const people = candidates.filter(row => sameId(row.job_order_id, order.id) || forwarded.some(item => sameId(item.id, row.route_id)));
  const hired = people.filter(row => row.status === 'passed').length;
  const actionable = order.status === 'open' && hired < Number(order.headcount);
  const step = order.status === 'filled' ? 4 : people.some(row => row.status === 'scheduled' || row.status === 'passed') ? 3 : people.some(row => row.status !== 'rejected') ? 2 : forwarded.length ? 2 : dispatches.length ? 1 : 0;
  const next = order.status === 'cancelled' ? '需求已取消，保留歷史供查閱。'
    : !actionable ? '已完成錄用，請到來台程序追蹤後續辦件。'
    : step >= 3 ? '雇主確認面試結果；錄用後會建立正式案件。'
    : people.some(row => row.status === 'proposed') ? '等待雇主安排面試或確認人選。'
    : forwarded.length ? '等待菲律賓仲介推薦合適工人。'
    : dispatches.length ? '台灣仲介選擇合作菲律賓仲介並轉交需求。'
    : '先指定合作台灣仲介，再進行轉介。';
  return { step, actionable, hired, dispatches, routes: forwarded, candidates: people, next };
}
export function agencySnapshot(agency, data) {
  const members = (data.members || []).filter(row => sameId(row.agency_id, agency.id));
  const employers = (data.employers || []).filter(row => sameId(row.agency_id, agency.id));
  const workers = (data.workers || []).filter(row => sameId(row.agency_id, agency.id));
  const dispatches = (data.orderAgencies || []).filter(row => sameId(row.taiwan_agency_id, agency.id));
  const routes = (data.orderRoutes || []).filter(row => sameId(row.philippines_agency_id, agency.id) || dispatches.some(item => sameId(item.id, row.order_agency_id)));
  const orders = (data.jobOrders || []).filter(row => dispatches.some(item => sameId(item.job_order_id, row.id)) || routes.some(item => sameId(item.job_order_id, row.id)));
  const cases = (data.cases || []).filter(row => sameId(row.employer_agency_id, agency.id) || sameId(row.worker_agency_id, agency.id) || employers.some(item => sameId(item.id, row.employer_id)) || workers.some(item => sameId(item.id, row.worker_id)) || (data.orderCandidates || []).some(item => sameId(item.case_id, row.id) && routes.some(route => sameId(route.id, item.route_id))));
  return { members, employers, workers, orders, cases, unassigned: dispatches.filter(row => !row.broker_member_id && orders.some(order => sameId(order.id, row.job_order_id) && order.status === 'open')).length };
}
export function workspaceTasks(data) {
  const openOrders = (data.jobOrders || []).filter(order => orderJourney(order, data.orderAgencies, data.orderRoutes, data.orderCandidates).actionable);
  if (data.role === 'employer') return { title: '雇主工作起點', hint: '先建立需求，再由合作仲介推薦人選；錄用後進入辦件。', action: '前往需求與配對', tab: 'matching', count: openOrders.length };
  if (data.role === 'agency') return { title: data.agencyType === 'taiwan' ? '台灣仲介工作起點' : '菲律賓仲介工作起點', hint: data.agencyType === 'taiwan' ? '確認負責業務、轉交需求，並追蹤工人錄用與來台進度。' : '查看收到的需求、推薦合適工人，再處理文件與申辦進度。', action: '查看需求與配對', tab: 'matching', count: openOrders.length };
  return { title: '工人工作起點', hint: '先完善本人履歷，再查看必要文件與來台程序；送審不等於已核准。', action: '查看必要文件', tab: 'documents', count: (data.requirements || []).filter(row => row.applicable !== false && ['missing', 'returned'].includes(row.status)).length };
}
