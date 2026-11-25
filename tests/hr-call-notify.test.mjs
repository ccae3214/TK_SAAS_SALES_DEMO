import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RING_WINDOW_SECONDS, buildCallNotice, buildTestNotice, createRateLimiter, dispatchCallNotifications, isAllowedPushEndpoint,
  lineModeFrom, normalizeLanguage, normalizeSubscription, publicOrigin, vapidSubject,
} from '../src/lib/hr-call-notify-core.js';
import { NOTIFY_COPY, detectNotifyEnvironment, urlBase64ToUint8Array } from '../src/lib/hr-call-notify-client-core.js';

const KEY = 'B'.repeat(87); // 真實的 p256dh 是 87 個 base64url 字元
const AUTH = 'a'.repeat(22);

test('只接受主流推播服務的 https 網址（避免讓伺服器連任意網址）', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/QZ12', 'https://wns2-par02p.notify.windows.com/w/?token=x', 'https://us-east-1.push.apple.com/x'])
    assert.equal(isAllowedPushEndpoint(ok), true, ok);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.example/x', 'https://fcm.googleapis.com.evil.example/x', 'https://notfcm.googleapis.com/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://127.0.0.1/x', 'https://localhost/x', 'not a url', '', null])
    assert.equal(isAllowedPushEndpoint(bad), false, String(bad));
});

test('訂閱資料格式檢查', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc';
  assert.deepEqual(normalizeSubscription({ endpoint, keys: { p256dh: KEY, auth: AUTH } }), { endpoint, p256dh: KEY, auth: AUTH });
  for (const bad of [null, {}, { endpoint }, { endpoint, keys: { p256dh: KEY } }, { endpoint, keys: { p256dh: 'short', auth: AUTH } }, { endpoint, keys: { p256dh: KEY, auth: 'bad auth!' } },
    { endpoint: 'https://evil.example/x', keys: { p256dh: KEY, auth: AUTH } }, { endpoint: `${endpoint}${'x'.repeat(1000)}`, keys: { p256dh: KEY, auth: AUTH } }])
    assert.equal(normalizeSubscription(bad), null);
});

test('設定值：語言、VAPID 聯絡資訊、網站網址、LINE 模式', () => {
  assert.equal(normalizeLanguage('tl'), 'tl'); assert.equal(normalizeLanguage('fr'), 'zh'); assert.equal(normalizeLanguage(undefined, 'en'), 'en');
  assert.equal(vapidSubject({ HR_PUSH_SUBJECT: 'mailto:a@b.co' }), 'mailto:a@b.co');
  assert.equal(vapidSubject({ HR_PUSH_SUBJECT: 'javascript:1', APP_ORIGIN: 'https://hr.example.com/path' }), 'https://hr.example.com');
  assert.equal(vapidSubject({ APP_ORIGIN: 'http://localhost:8080' }), 'https://kolecion.cc');
  assert.equal(publicOrigin({ NEXTAUTH_URL: 'https://x.example.com/a' }), 'https://x.example.com');
  assert.equal(publicOrigin({ APP_ORIGIN: 'http://localhost:8080' }), 'https://kolecion.cc');
  assert.equal(lineModeFrom({}), 'fallback'); assert.equal(lineModeFrom({ HR_CALL_LINE_NOTIFY: 'ALWAYS' }), 'always'); assert.equal(lineModeFrom({ HR_CALL_LINE_NOTIFY: 'off' }), 'off'); assert.equal(lineModeFrom({ HR_CALL_LINE_NOTIFY: 'x' }), 'fallback');
});

test('通知文字：中文、英文、菲律賓語；私訊不重複顯示名稱；帶網址與響鈴時間', () => {
  const base = { from: 'Alice', title: 'C-001 · Maria / ABC', video: true, roomId: 9, callId: 'c1', origin: 'https://hr.example.com' };
  const zh = buildCallNotice({ ...base, lang: 'zh' });
  assert.equal(zh.push.title, '📞 Alice 來電'); assert.equal(zh.push.body, '視訊通話 · C-001 · Maria / ABC，點開接聽');
  assert.equal(zh.push.tag, 'hr-call-9'); assert.equal(zh.push.url, '/hr');
  assert.ok(zh.line.includes('https://hr.example.com/hr') && zh.line.includes(String(RING_WINDOW_SECONDS)));
  const en = buildCallNotice({ ...base, lang: 'en', video: false });
  assert.equal(en.push.title, '📞 Incoming call from Alice'); assert.equal(en.push.body, 'Voice call · C-001 · Maria / ABC. Tap to answer.');
  assert.ok(buildCallNotice({ ...base, lang: 'tl' }).push.title.includes('Alice'));
  const direct = buildCallNotice({ ...base, title: 'Alice', lang: 'zh', video: false });
  assert.equal(direct.push.body, '語音通話，點開接聽', '私訊的聊天室名稱就是撥號的人，不重複');
  assert.equal(buildCallNotice({ lang: 'zh' }).push.title, '📞 有人來電');
  assert.equal(buildCallNotice({ ...base, from: 'x'.repeat(200) }).push.title.length < 80, true, '名稱過長要截斷');
  assert.ok(buildTestNotice('en').title.includes('test'));
});

test('頻率限制：同一個收件人一段時間內最多 3 則', () => {
  let time = 0;
  const limiter = createRateLimiter({ windowMs: 60000, max: 3, now: () => time });
  assert.deepEqual([1, 2, 3, 4].map(() => limiter.allow('member:1')), [true, true, true, false]);
  assert.equal(limiter.allow('member:2'), true, '不同收件人各自計算');
  time = 61000;
  assert.equal(limiter.allow('member:1'), true, '過了時間窗口就恢復');
});

// ---------------------------------------------------------------- 派送
function makeDeps({ subs = {}, lines = {}, failPush = {} } = {}) {
  const log = { push: [], line: [], removed: [] };
  return {
    log,
    deps: {
      subscriptionsFor: async keys => new Map(keys.filter(key => subs[key]).map(key => [key, subs[key]])),
      lineTargetsFor: async keys => new Map(keys.filter(key => lines[key]).map(key => [key, lines[key]])),
      sendPush: async (sub, payload, options) => {
        if (failPush[sub.endpoint]) throw Object.assign(new Error('x'), { statusCode: failPush[sub.endpoint] });
        log.push.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), options });
      },
      pushLine: async (lineUserId, text) => { log.line.push({ lineUserId, text }); },
      removeSubscription: async endpoint => { log.removed.push(endpoint); },
    },
  };
}
const call = { from: 'Alice', title: 'Room', video: false, roomId: 5, callId: 'c' };
const sub = (endpoint, lang = 'zh') => ({ endpoint, p256dh: KEY, auth: AUTH, lang });

test('網頁推播送達：預設不再用 LINE（省 LINE 的每月額度）；推播帶 TTL 與高優先', async () => {
  const { deps, log } = makeDeps({ subs: { 'member:1': [sub('e1', 'en')] }, lines: { 'member:1': { lineUserId: 'U1', language: 'zh' } } });
  const result = await dispatchCallNotifications({ keys: ['member:1'], call, deps, origin: 'https://h.example' });
  assert.deepEqual(result, { push: 1, line: 0, failed: 0, removed: 0, recipients: 1 });
  assert.deepEqual(log.push[0].options, { TTL: RING_WINDOW_SECONDS, urgency: 'high' });
  assert.equal(log.push[0].payload.title, '📞 Incoming call from Alice', '用訂閱時的語言');
  assert.equal(log.line.length, 0);
});

test('沒有網頁推播的人改用 LINE（用他的 LINE 語言）；沒有任何管道的人略過', async () => {
  const { deps, log } = makeDeps({ lines: { 'member:2': { lineUserId: 'U2', language: 'tl' } } });
  const result = await dispatchCallNotifications({ keys: ['member:2', 'member:3'], call, deps, origin: 'https://h.example' });
  assert.deepEqual(result, { push: 0, line: 1, failed: 0, removed: 0, recipients: 1 });
  assert.equal(log.line[0].lineUserId, 'U2'); assert.ok(log.line[0].text.includes('May tawag mula kay Alice'));
});

test('網頁推播送失敗：一般錯誤改用 LINE；訂閱失效（410／404）會移除並改用 LINE', async () => {
  const { deps, log } = makeDeps({
    subs: { 'member:1': [sub('gone'), sub('broken')] }, lines: { 'member:1': { lineUserId: 'U1', language: 'zh' } }, failPush: { gone: 410, broken: 500 },
  });
  const result = await dispatchCallNotifications({ keys: ['member:1'], call, deps });
  assert.deepEqual(result, { push: 0, line: 1, failed: 1, removed: 1, recipients: 1 });
  assert.deepEqual(log.removed, ['gone']);
});

test('LINE 模式：always 兩種都送；off 不送 LINE；伺服器沒設定推播金鑰（pushEnabled=false）只用 LINE', async () => {
  const setup = () => makeDeps({ subs: { 'member:1': [sub('e1')] }, lines: { 'member:1': { lineUserId: 'U1', language: 'zh' } } });
  let { deps, log } = setup();
  assert.deepEqual(await dispatchCallNotifications({ keys: ['member:1'], call, deps, lineMode: 'always' }), { push: 1, line: 1, failed: 0, removed: 0, recipients: 1 });
  ({ deps, log } = setup());
  assert.equal((await dispatchCallNotifications({ keys: ['member:1'], call, deps, lineMode: 'off' })).line, 0);
  ({ deps, log } = setup());
  const onlyLine = await dispatchCallNotifications({ keys: ['member:1'], call, deps, pushEnabled: false });
  assert.deepEqual([onlyLine.push, onlyLine.line, log.push.length], [0, 1, 0]);
});

test('派送：重複的人只通知一次、空名單直接結束、人數有上限', async () => {
  const { deps, log } = makeDeps({ subs: { 'member:1': [sub('e1')] } });
  assert.equal((await dispatchCallNotifications({ keys: ['member:1', 'member:1', '', null], call, deps })).push, 1);
  assert.equal(log.push.length, 1);
  assert.equal((await dispatchCallNotifications({ keys: [], call, deps })).recipients, 0);
  const many = Array.from({ length: 500 }, (_, index) => `member:${index}`);
  const seen = [];
  await dispatchCallNotifications({ keys: many, call, deps: { ...deps, subscriptionsFor: async keys => { seen.push(keys.length); return new Map(); } } });
  assert.deepEqual(seen, [300]);
});

// ---------------------------------------------------------------- 瀏覽器端：環境判斷與文字
test('來電通知按鈕的環境判斷', () => {
  const chrome = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const line = `${safari} Line/14.0.0`;
  assert.equal(detectNotifyEnvironment({ userAgent: chrome }), 'available');
  assert.equal(detectNotifyEnvironment({ userAgent: chrome, permission: 'denied' }), 'denied');
  assert.equal(detectNotifyEnvironment({ userAgent: chrome, isSecureContext: false }), 'insecure');
  assert.equal(detectNotifyEnvironment({ userAgent: chrome, hasPushManager: false }), 'unsupported');
  assert.equal(detectNotifyEnvironment({ userAgent: line }), 'inapp');
  assert.equal(detectNotifyEnvironment({ userAgent: safari, hasPushManager: false, standalone: false }), 'ios-install', 'iPhone 一般分頁沒有推播功能，要引導加到主畫面');
  assert.equal(detectNotifyEnvironment({ userAgent: safari, standalone: true }), 'available', '從主畫面圖示開啟後可以開啟通知');
  assert.equal(detectNotifyEnvironment({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 5 }), 'ios-install', 'iPad 的桌面版 Safari 也算 iOS');
});

test('公開金鑰轉換成瀏覽器要的格式', () => {
  const bytes = urlBase64ToUint8Array('BAUG-w');
  assert.deepEqual([...bytes], [4, 5, 6, 251]);
});

test('通知按鈕的中文、英文、菲律賓語文字結構一致，菲律賓語不是英文原文', () => {
  const shape = value => (value && typeof value === 'object' ? (Array.isArray(value) ? value.length : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))) : typeof value);
  assert.deepEqual(shape(NOTIFY_COPY.zh), shape(NOTIFY_COPY.en));
  assert.deepEqual(shape(NOTIFY_COPY.tl), shape(NOTIFY_COPY.en), '菲律賓語要和英文有同樣的欄位');
  for (const [key, value] of Object.entries(NOTIFY_COPY.en)) {
    if (typeof value === 'string' && value.length > 12) assert.notEqual(NOTIFY_COPY.tl[key], value, `${key} 的菲律賓語不能只是英文`);
  }
});

test('通知按鈕依語言取文字（含菲律賓語），伺服器錯誤訊息非中文時用英文', async () => {
  const { readFile } = await import('node:fs/promises');
  const component = await readFile(new URL('../src/components/HrCallNotify.jsx', import.meta.url), 'utf8');
  assert.ok(component.includes('copyFor(NOTIFY_COPY, language)'));
  assert.ok(component.includes("language === 'zh' ? data?.error : data?.en"));
});
