import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ORDER_FILTER_EN } from '../src/lib/hr-translations-order-filter.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('需求單只在挑選階段顯示挑選按鈕，按下後進入挑選區子頁面', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(source.includes('const pickAllowed=orderAllowsPicking('));
  assert.ok(source.includes('{pickAllowed?<div className="candidate-actions order-pick-entry"'));
  assert.ok(source.includes('setWorkspaceUrl(`/hr/matching/pick/${Number(order.id)}`)'));
  assert.ok(!source.includes('{pickAllowed?<HrEmployerShortlist'), '挑選區不應內嵌在需求單卡片');
});

test('挑選區子頁面有網址、返回按鈕，且已離開挑選階段時不顯示挑選區', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(source.includes('/^\\/hr\\/matching\\/pick\\/(\\d+)\\/?$/'));
  assert.ok(source.includes('isEmployerOrderPickPage?(()=>{'));
  assert.ok(source.includes('const pickOpen=order?orderAllowsPicking('));
  assert.ok(source.includes('{pickOpen?<HrEmployerShortlist'));
  assert.ok(source.includes('{!isEmployerSubPage&&<nav className="workspace-tabs"'));
  const page = await read('../src/app/hr/matching/[[...view]]/page.jsx');
  assert.ok(page.includes("view[0] === 'pick'"));
});

test('挑選區新增文字有英文翻譯', () => {
  for (const zh of ['挑選人選', '挑選區', '找不到這張需求單。']) {
    assert.ok(ORDER_FILTER_EN[zh], `缺少英文翻譯：${zh}`);
  }
});
