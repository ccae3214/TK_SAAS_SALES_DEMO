// Presentation-only projections. These helpers do not grant permissions or mutate records.
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
export function membershipState(data = {}) {
  if (data.role && data.role !== 'pending') return 'ready';
  return ['worker', 'employer', 'agency', 'training_center'].includes(data.requestedRole) ? 'waiting' : 'choose';
}
export const MATCH_STEPS = ['需求建立', '仲介分工', '挑選／推薦人選', '面試確認', '錄用辦件'];
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
    : dispatches.length ? '雇主可挑選符合工作類型的工作者；管理者也可指派合作菲律賓仲介。'
    : '先指定合作台灣仲介，再進行轉介。';
  return { step, actionable, hired, dispatches, routes: forwarded, candidates: people, next };
}
// 雇主「需求與配對」需求單列表的進度篩選。選項對應需求單卡片上的五個進度（MATCH_STEPS），另加「已取消」與「全部」。
export const ORDER_PROGRESS_FILTERS = [
  ['all', '全部'],
  ['created', MATCH_STEPS[0]],
  ['agency', MATCH_STEPS[1]],
  ['candidates', MATCH_STEPS[2]],
  ['interview', MATCH_STEPS[3]],
  ['hired', MATCH_STEPS[4]],
  ['cancelled', '已取消'],
];
const PROGRESS_KEY_BY_STEP = ['created', 'agency', 'candidates', 'interview', 'hired'];
// 需求單目前所在的進度分組；已取消的單獨一組，不看人選狀態。
export function orderProgressGroup(order, assignments = [], routes = [], candidates = []) {
  if (order.status === 'cancelled') return 'cancelled';
  return PROGRESS_KEY_BY_STEP[orderJourney(order, assignments, routes, candidates).step] || 'created';
}
export function orderProgressCounts(orders = [], assignments = [], routes = [], candidates = []) {
  const counts = { all: orders.length, created: 0, agency: 0, candidates: 0, interview: 0, hired: 0, cancelled: 0 };
  for (const order of orders) counts[orderProgressGroup(order, assignments, routes, candidates)] += 1;
  return counts;
}
export function filterOrdersByProgress(orders = [], filter = 'all', assignments = [], routes = [], candidates = []) {
  if (filter === 'all') return orders;
  return orders.filter(order => orderProgressGroup(order, assignments, routes, candidates) === filter);
}
// 雇主只能在「面試確認」之前為需求單挑選人選：已有人選安排面試或錄用（進度 3 以後）、額滿或取消就不能再挑。
export const ORDER_PICK_CLOSED_MESSAGE = '此需求單已進入面試或錄用階段，無法再挑選工作者。';
export function orderAllowsPicking(order, assignments = [], routes = [], candidates = []) {
  const flow = orderJourney(order, assignments, routes, candidates);
  return flow.actionable && flow.step < 3;
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
  if (data.role === 'agency') return { title: data.agencyType === 'taiwan' ? '台灣仲介工作起點' : '菲律賓仲介工作起點', hint: data.agencyType === 'taiwan' ? '確認負責業務，追蹤雇主選工、錄用與來台進度。' : '查看收到的需求、推薦合適工人，再處理文件與申辦進度。', action: '查看需求與配對', tab: 'matching', count: openOrders.length };
  return { title: '工人工作起點', hint: '先完善本人履歷，再查看必要文件與來台程序；送審不等於已核准。', action: '查看必要文件', tab: 'documents', count: (data.requirements || []).filter(row => row.applicable !== false && ['missing', 'returned'].includes(row.status)).length };
}
