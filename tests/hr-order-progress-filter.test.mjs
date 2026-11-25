import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ORDER_PROGRESS_FILTERS, orderProgressGroup, orderProgressCounts, filterOrdersByProgress } from '../src/lib/hr-workflow.js';
import { ORDER_FILTER_EN } from '../src/lib/hr-translations-order-filter.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 一張需求單走完各進度：建立 → 指派仲介 → 轉介／推薦 → 面試 → 錄用（額滿）；另有已取消。
const orders = [
  { id: 1, status: 'open', headcount: 1 },
  { id: 2, status: 'open', headcount: 1 },
  { id: 3, status: 'open', headcount: 1 },
  { id: 4, status: 'open', headcount: 1 },
  { id: 5, status: 'filled', headcount: 1 },
  { id: 6, status: 'cancelled', headcount: 1 },
];
const assignments = [2, 3, 4, 5].map(id => ({ id: id * 10, job_order_id: id }));
const routes = [{ id: 301, order_agency_id: 30, job_order_id: 3 }];
const candidates = [
  { id: 1, job_order_id: 4, status: 'scheduled' },
  { id: 2, job_order_id: 5, status: 'passed' },
];

test('每張需求單依目前進度分到對應的篩選組', () => {
  const group = id => orderProgressGroup(orders.find(order => order.id === id), assignments, routes, candidates);
  assert.equal(group(1), 'created');
  assert.equal(group(2), 'agency');
  assert.equal(group(3), 'candidates');
  assert.equal(group(4), 'interview');
  assert.equal(group(5), 'hired');
  assert.equal(group(6), 'cancelled');
});

test('已取消的需求單即使有人選也只算在「已取消」', () => {
  const cancelled = { id: 9, status: 'cancelled', headcount: 1 };
  const people = [{ id: 9, job_order_id: 9, status: 'passed' }];
  assert.equal(orderProgressGroup(cancelled, [], [], people), 'cancelled');
});

test('各篩選組的數量加總等於全部', () => {
  const counts = orderProgressCounts(orders, assignments, routes, candidates);
  assert.deepEqual(counts, { all: 6, created: 1, agency: 1, candidates: 1, interview: 1, hired: 1, cancelled: 1 });
  const sum = ORDER_PROGRESS_FILTERS.filter(([key]) => key !== 'all').reduce((total, [key]) => total + counts[key], 0);
  assert.equal(sum, counts.all);
});

test('篩選：全部回傳原清單，其餘只回傳該進度的需求單', () => {
  assert.equal(filterOrdersByProgress(orders, 'all', assignments, routes, candidates), orders);
  assert.deepEqual(filterOrdersByProgress(orders, 'interview', assignments, routes, candidates).map(order => order.id), [4]);
  assert.deepEqual(filterOrdersByProgress(orders, 'cancelled', assignments, routes, candidates).map(order => order.id), [6]);
  assert.deepEqual(filterOrdersByProgress([], 'hired'), []);
});

test('選項依序為：全部、五個進度、已取消，且 key 不重複', () => {
  const keys = ORDER_PROGRESS_FILTERS.map(([key]) => key);
  assert.deepEqual(keys, ['all', 'created', 'agency', 'candidates', 'interview', 'hired', 'cancelled']);
  assert.equal(new Set(keys).size, keys.length);
});

test('雇主需求單列表有進度篩選列，並用篩選後的清單渲染', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(source.includes("const [orderProgressFilter,setOrderProgressFilter]=useState('all');"));
  assert.ok(source.includes('aria-label="需求單進度篩選"'));
  assert.ok(source.includes('filterOrdersByProgress(data.jobOrders,orderProgressFilter,data.orderAgencies,data.orderRoutes,data.orderCandidates).map(order=>{'));
  assert.ok(source.includes('目前沒有符合的需求單。'));
  assert.ok(source.includes('顯示全部需求單'));
});

test('新增的中文介面文字都有英文與菲律賓語翻譯', async () => {
  const tl = await read('../src/data/tl-dictionary.js');
  for (const [zh, en] of Object.entries(ORDER_FILTER_EN)) {
    assert.ok(en && en !== zh, `缺少英文翻譯：${zh}`);
    assert.ok(tl.includes(`"${en}":`), `缺少菲律賓語翻譯：${en}`);
  }
  const translations = await read('../src/lib/hr-translations.jsx');
  assert.ok(translations.includes('ORDER_FILTER_EN[trimmed]'), '翻譯字典未串接');
});

// 雇主只能在面試確認之前挑選人選。
import { orderAllowsPicking, ORDER_PICK_CLOSED_MESSAGE } from '../src/lib/hr-workflow.js';

test('進度 3（面試確認）以後、額滿、取消的需求單不能再挑選人選', () => {
  const allows = id => orderAllowsPicking(orders.find(order => order.id === id), assignments, routes, candidates);
  assert.equal(allows(1), true);
  assert.equal(allows(2), true);
  assert.equal(allows(3), true);
  assert.equal(allows(4), false);
  assert.equal(allows(5), false);
  assert.equal(allows(6), false);
});

test('前端只在可挑選時顯示挑選區，伺服器也拒絕已進入面試的需求單', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(portal.includes('const pickAllowed=orderAllowsPicking('));
  assert.ok(portal.includes('{pickAllowed||order.status!==\'open\'?<HrEmployerShortlist'));
  const api = await read('../src/app/api/hr/_post/job-orders.js');
  assert.ok(api.includes("c.status IN ('scheduled','passed')"));
  assert.ok(api.includes(ORDER_PICK_CLOSED_MESSAGE));
  assert.ok(ORDER_FILTER_EN[ORDER_PICK_CLOSED_MESSAGE], '缺少英文翻譯');
});
