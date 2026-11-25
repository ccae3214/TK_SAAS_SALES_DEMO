import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 雇主點「需求與配對」不能換頁：換頁會重建整個會員頁，每次都出現「載入中」再重新抓資料。
test('會員頁不再用 router 換頁，需求與配對只更換網址列', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(!/useRouter/.test(source), '不應再使用 useRouter');
  assert.ok(!/router\.(push|replace)\(/.test(source), '不應再用 router.push／router.replace 換頁');
  assert.ok(source.includes("window.history[replace ? 'replaceState' : 'pushState'](null, '', path);"));
});

test('選單、新增需求單、返回都走 setWorkspaceUrl', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(source.includes("if (data.role === 'employer' && tab === 'matching') setWorkspaceUrl('/hr/matching');"));
  assert.ok(source.includes("else if (isEmployerMatchingRoute) setWorkspaceUrl('/hr', { replace: true });"));
  assert.ok(source.includes("onClick={()=>setWorkspaceUrl('/hr/matching/new')}"));
  assert.ok(source.includes("onClick={()=>setWorkspaceUrl('/hr/matching')}"));
  assert.ok(source.includes("setWorkspaceUrl('/hr/matching');}setOrderSubmitting(false);"), '送出需求單後回到列表');
});

test('瀏覽器上一頁／下一頁時，分頁會跟著網址同步', async () => {
  const source = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(source.includes('const matchingRouteRef = useRef(isEmployerMatchingRoute);'));
  assert.ok(source.includes("setActiveWorkspaceTab(tab => (isEmployerMatchingRoute ? 'matching' : (tab === 'matching' ? 'start' : tab)));"));
});
