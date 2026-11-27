// 管理端總覽「行事曆」用的純函式（不碰資料庫與 React，方便用 node:test 測試）。
//   案件進度日期 ← hr_application_steps 的 started_on / completed_on
//   待辦到期     ← hr_case_tasks 尚未完成、有 due_date 的待辦
//   需求單開始日 ← hr_job_orders 的 expected_start_date

export const EVENT_KINDS = ['step', 'task', 'order'];

const pad = value => String(value).padStart(2, '0');
export const toDateKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

// 取前 10 碼並確認是真的存在的日期（例如 2026-02-30 不算），否則回傳 ''。
export function normalizeDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : '';
}

const joinDetail = (...parts) => parts.filter(Boolean).join(' · ');

// 案件進度：開始與完成各一筆；同一天只算一筆。
function stepEvents(applicationSteps, caseById) {
  const events = [];
  for (const step of applicationSteps) {
    const item = caseById.get(Number(step.case_id));
    if (!item) continue;
    const start = normalizeDate(step.started_on), done = normalizeDate(step.completed_on);
    const both = Boolean(start && done && start !== done);
    const base = { kind: 'step', title: step.label || step.step_key || '', detail: joinDetail(item.worker_name, item.case_number), caseId: Number(item.id) };
    const id = phase => `step:${step.case_id}:${step.step_key}:${phase}`;
    if (start) events.push({ ...base, id: id('start'), date: start, phase: both ? 'start' : '' });
    if (done && done !== start) events.push({ ...base, id: id('done'), date: done, phase: both ? 'done' : '' });
  }
  return events;
}

// 待辦：尚未完成、有到期日。
const taskEvents = tasks => tasks
  .map(task => ({ task, date: normalizeDate(task.due_date) }))
  .filter(({ task, date }) => date && task.status !== 'done')
  .map(({ task, date }) => ({
    id: `task:${task.id}`, date, kind: 'task', phase: '', title: task.title || '',
    detail: joinDetail(task.worker_name, task.case_number), caseId: Number(task.case_id) || null,
  }));

// 需求單：有預計開始日、沒有取消或結案。
const CLOSED_ORDER_STATUSES = new Set(['cancelled', 'closed']);
const orderEvents = jobOrders => jobOrders
  .map(order => ({ order, date: normalizeDate(order.expected_start_date) }))
  .filter(({ order, date }) => date && !CLOSED_ORDER_STATUSES.has(order.status))
  .map(({ order, date }) => ({
    id: `order:${order.id}`, date, kind: 'order', phase: '', title: order.job_type || '',
    detail: order.employer_name || '', caseId: null,
  }));

const rank = kind => EVENT_KINDS.indexOf(kind);
const compareEvents = (a, b) => a.date.localeCompare(b.date) || rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title);

// 回傳依日期、再依種類排序的事件陣列：{ id, date, kind, title, detail, caseId, phase }
//   phase：同一個進度項目有開始與完成兩個不同日期時，分別標成 'start' / 'done'，其餘為 ''。
export function buildCalendarEvents({ applicationSteps = [], cases = [], tasks = [], jobOrders = [] } = {}) {
  const caseById = new Map(cases.map(item => [Number(item.id), item]));
  return [...stepEvents(applicationSteps, caseById), ...taskEvents(tasks), ...orderEvents(jobOrders)].sort(compareEvents);
}

export function groupEventsByDate(events) {
  const map = new Map();
  for (const event of events) {
    if (!map.has(event.date)) map.set(event.date, []);
    map.get(event.date).push(event);
  }
  return map;
}

// 月曆格子：每週從星期日開始，補滿前後週，回傳 5 或 6 週。month 為 0–11。
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(Date.UTC(year, month, 1 - first.getUTCDay()));
  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      const cell = new Date(start.getTime() + (week * 7 + day) * 86400000);
      days.push({ date: toDateKey(cell.getUTCFullYear(), cell.getUTCMonth(), cell.getUTCDate()), day: cell.getUTCDate(), inMonth: cell.getUTCMonth() === month });
    }
    if (week === 5 && !days.some(cell => cell.inMonth)) break;
    weeks.push(days);
  }
  return weeks;
}

export function shiftMonth(year, month, delta) {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}
