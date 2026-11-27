import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ORDER_FILTER_EN } from '../src/lib/hr-translations-order-filter.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('雇主需求單卡片可整張收合，並有全部收合／全部展開', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(portal.includes('const [collapsedOrders,setCollapsedOrders]=useState({})'), '缺少收合狀態');
  assert.ok(portal.includes('className="job-order-toggle"') && portal.includes('aria-expanded={!orderCollapsed}'), '標題列需為可開合按鈕');
  assert.ok(portal.includes('editingOrderId!==Number(order.id)'), '編輯中的需求單不可被收起');
  assert.ok(portal.includes('全部收合') && portal.includes('全部展開'));
});

test('需求內容與仲介／推薦人選為可開合區塊，預設展開', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  assert.equal((portal.match(/<details className="order-fold" open>/g) || []).length, 2);
  assert.ok(portal.includes('<summary>需求內容</summary>') && portal.includes('<summary>仲介與推薦人選</summary>'));
});

test('開合相關文字都有英文翻譯', () => {
  for (const key of ['全部收合', '全部展開', '需求內容', '仲介與推薦人選']) {
    assert.ok(ORDER_FILTER_EN[key], `缺少英文：${key}`);
  }
});
