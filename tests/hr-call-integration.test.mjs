import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Windows 的工作目錄可能是 CRLF 換行，先統一成 LF 再比對。
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 聊天室通話的權限必須和聊天室一致：通話 API 裡的 getReaderKey / accessibleRoom 是從聊天室 API 複製來的，
// 以後改聊天室權限時，這個測試會提醒你兩邊要一起改。
test('通話 API 的聊天室權限檢查與聊天室 API 完全相同', async () => {
  const chat = await read('../src/app/api/hr/chat/route.js');
  const call = await read('../src/app/api/hr/call/route.js');
  const grab = (source, name) => {
    const start = source.indexOf(name);
    assert.ok(start >= 0, `找不到 ${name}`);
    const end = source.indexOf('\n}\n', start);
    return source.slice(start, end + 3);
  };
  assert.equal(grab(call, 'function getReaderKey('), grab(chat, 'function getReaderKey('));
  assert.equal(grab(call, 'async function accessibleRoom('), grab(chat, 'async function accessibleRoom('));
});

test('瀏覽器的麥克風與鏡頭權限在 nginx 與 Next 的標頭都有開放（同源）', async () => {
  for (const path of ['../nginx.conf', '../next.config.js']) {
    const source = await read(path);
    assert.ok(source.includes('microphone=(self), camera=(self)'), `${path} 要允許本站使用麥克風與鏡頭`);
    assert.ok(!source.includes('microphone=()'), `${path} 不能再把麥克風關掉`);
  }
});

test('nginx 轉送通話 WebSocket，且逾時夠長', async () => {
  const nginx = await read('../nginx.conf');
  const start = nginx.indexOf('location = /api/hr/call/ws {');
  assert.ok(start > 0);
  const block = nginx.slice(start, nginx.indexOf('\n        }', start));
  assert.ok(block.includes('proxy_set_header Upgrade $http_upgrade;'));
  assert.ok(block.includes('proxy_set_header Connection "upgrade";'));
  assert.match(block, /proxy_read_timeout 3600s;/);
});

test('CSP 允許連到通話的 WebSocket，且 Host 有先驗證格式', async () => {
  const middleware = await read('../src/middleware.js');
  assert.ok(middleware.includes('connect-src \'self\'${callSocket}'));
  assert.ok(middleware.includes('wss://${host}'));
  assert.ok(middleware.includes('/^[a-z0-9.-]+(:\\d+)?$/i.test(host)'), 'Host 標頭必須先驗證格式，不能直接寫進 CSP');
});

test('server.js 掛上信令、Docker 映像有帶需要的檔案', async () => {
  const server = await read('../server.js');
  assert.ok(server.includes('attachCallSignaling(httpServer, { secret: callSigningSecret })'));
  const dockerfile = await read('../Dockerfile');
  for (const file of ['hr-call-ticket.js', 'hr-call-signaling.js']) assert.ok(dockerfile.includes(`/app/src/lib/${file} ./src/lib/${file}`), `Dockerfile 要複製 ${file}`);
  // server.js 直接 import 的檔案不能再 import 其他沒被複製進映像的檔案
  const signaling = await read('../src/lib/hr-call-signaling.js');
  const imports = [...signaling.matchAll(/from '(\.[^']+)'/g)].map(match => match[1]);
  assert.deepEqual(imports, ['./hr-call-ticket.js']);
  const ticket = await read('../src/lib/hr-call-ticket.js');
  assert.deepEqual([...ticket.matchAll(/from '(\.[^']+)'/g)], []);
});

test('docker-compose 有通話的環境變數與選配的 coturn', async () => {
  const compose = await read('../docker-compose.yml');
  for (const name of ['HR_CALL_SECRET', 'HR_CALL_STUN_URLS', 'HR_CALL_TURN_URLS', 'HR_CALL_TURN_SECRET']) assert.ok(compose.includes(`- ${name}=`), name);
  assert.ok(compose.includes('coturn/coturn'));
  assert.ok(compose.includes('--use-auth-secret'));
  assert.ok(compose.includes('--denied-peer-ip=192.168.0.0-192.168.255.255'));
});

test('聊天室有語音與視訊通話按鈕（中英文），/hr 頁面所有角色都掛通話元件', async () => {
  const chat = await read('../src/components/HrChat.jsx');
  assert.ok(chat.includes("{voice:'Voice call',video:'Video call'}"));
  assert.ok(chat.includes("{voice:'語音通話',video:'視訊通話'}"));
  assert.ok(chat.includes("new CustomEvent('hr:start-call'"));
  const page = await read('../src/app/hr/page.jsx');
  assert.equal(page.split('<HrCallProvider />').length - 1, 2, '管理者與會員兩個分支都要有');
  assert.ok(page.includes("import '@/components/hr-call.css';"));
  const provider = await read('../src/components/HrCallProvider.jsx');
  assert.ok(provider.includes("addEventListener('hr:start-call'"));
});

test('找不到麥克風時改為僅收聽加入：中英文提示都有，沒有麥克風就不顯示靜音鈕', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  assert.ok(provider.includes("'no-mic': '找不到麥克風"), '缺中文提示');
  assert.ok(provider.includes("'no-mic': 'No microphone was found."), '缺英文提示');
  assert.ok(provider.includes('{call.hasMic && <button'), '沒有麥克風時不顯示靜音鈕');
});

test('連不上通話連線的原因有中英文提示（登入逾時、服務無法使用、連不上伺服器）', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  for (const key of ['session', 'service', "'ws-failed'"]) assert.equal(provider.split(`${key}:`).length - 1, 2, `${key} 要有中文與英文各一句`);
});

test('不支援通話的原因（非 https、應用程式內建瀏覽器）有中英文提示', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  for (const key of ['insecure', "'in-app'"]) assert.equal(provider.split(`${key}:`).length - 1, 2, `${key} 要有中文與英文各一句`);
});

test('通話音效與一對一掛斷提示：畫面層有加入／離開音效，中英文都有「對方已掛斷」', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  assert.ok(provider.includes('onSound: playCallTone'));
  assert.ok(provider.includes('CALL_TONES = { join:') && provider.includes('leave:'));
  assert.ok(provider.includes("addEventListener('pointerdown', unlockAudio"), '第一次點擊時要先啟用音效');
  assert.equal(provider.split("'peer-hangup':").length - 1, 2, '要有中文與英文各一句');
});
