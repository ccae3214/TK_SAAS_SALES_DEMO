import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 來電通知的對話框要有真正的「開關」：看得出目前是開或關，點一下就切換。
test('來電通知用開關（role="switch"）切換開啟與關閉', async () => {
  const source = await read('../src/components/HrCallNotify.jsx');
  assert.ok(source.includes('role="switch" aria-checked={subscribed}'));
  assert.ok(source.includes('onClick={subscribed ? disable : enable}'), '開著時點一下關閉，關著時點一下開啟');
  assert.ok(source.includes('{busy ? t.working : subscribed ? t.stateOn : t.stateOff}'));
  assert.ok(source.includes('disabled={busy}'), '只有處理中才停用');
  assert.ok(!source.includes('!subscribed && !config'), '讀不到伺服器設定時不能默默停用開關（Safari／Firefox 會變成點不動）');
  assert.ok(source.includes('onClick={sendTest}'), '開啟後仍可傳送測試通知');
  assert.ok(!source.includes('{t.disable}'), '不再用獨立的「關閉來電通知」按鈕');
});

test('開關狀態文字有中文、英文、Filipino', async () => {
  const core = await read('../src/lib/hr-call-notify-client-core.js');
  assert.ok(core.includes("stateOn: '開啟', stateOff: '關閉',"));
  assert.ok(core.includes("stateOn: 'On', stateOff: 'Off',"));
  assert.ok(core.includes("stateOn: 'Naka-on', stateOff: 'Naka-off',"));
  assert.equal((core.match(/stateOn:/g) || []).length, 3);
});

test('開關樣式：開著是綠底、旋鈕在右；有鍵盤焦點與停用樣式', async () => {
  const css = await read('../src/components/HrCallNotify.module.css');
  for (const rule of ['.switchRow{', '.switch{', '.switch.switchOn{', '.knob{', '.switch:focus-visible{', '.switch:disabled{']) assert.ok(css.includes(rule), rule);
});

test('Safari／Firefox：先要權限再讀設定、有逾時、錯誤會顯示出來', async () => {
  const source = await read('../src/components/HrCallNotify.jsx');
  assert.ok(source.indexOf('askPermission()') < source.indexOf('await loadConfig()'), '權限詢問要在使用者按下的當下發出');
  assert.ok(source.includes("withTimeout(askPermission(), 60000, 'PermissionTimeout')"));
  assert.ok(source.includes("withTimeout(registerWorker(), 20000, 'ServiceWorkerTimeout')"));
  assert.ok(source.includes('Notification.requestPermission(resolve)'), '支援舊版 Safari 的 callback 寫法');
  const core = await read('../src/lib/hr-call-notify-client-core.js');
  assert.equal((core.match(/permissionHint:/g) || []).length, 3, '中文、英文、Filipino 都要有提示');
  assert.equal((core.match(/permissionTimeout:/g) || []).length, 3);
  assert.equal((core.match(/config: '/g) || []).length, 3);
});
