import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGIN_CODE_REPLY, buildLineAuthorizeUrl, extractLoginCode, handoffRedirectUri, hashChatCode, hashConfirmCode, hashToken, isConfirmCode, isToken,
  loginMessageText, newChatCode, newConfirmCode, newToken, normalizeConfirmCode, officialAccountMessageUrl, renderHandoffPage, safeEqual,
} from '../src/lib/hr-line-handoff-core.js';
import { HANDOFF_COPY } from '../src/lib/hr-line-handoff-copy.js';

test('tokens are 43-char url-safe random strings and only well-formed ones pass', () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a, b);
  assert.ok(isToken(a));
  for (const bad of ['', 'short', `${a}x`, `${a.slice(0, 42)}!`, null, undefined, 123, {}]) assert.equal(isToken(bad), false);
});

test('confirm codes are six digits, tolerate spaces, and are bound to the handoff state', () => {
  for (let i = 0; i < 200; i += 1) assert.match(newConfirmCode(), /^\d{6}$/);
  assert.equal(normalizeConfirmCode(' 123 456 '), '123456');
  assert.ok(isConfirmCode('123 456'));
  for (const bad of ['12345', '1234567', 'abcdef', '', null]) assert.equal(isConfirmCode(bad), false);
  const stateA = newToken();
  const stateB = newToken();
  assert.equal(hashConfirmCode(stateA, '123456'), hashConfirmCode(stateA, '123 456'));
  assert.notEqual(hashConfirmCode(stateA, '123456'), hashConfirmCode(stateB, '123456'));
  assert.notEqual(hashConfirmCode(stateA, '123456'), hashConfirmCode(stateA, '123457'));
});

test('safeEqual and hashToken compare without throwing on different lengths', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual(hashToken('x'), hashToken('x')), true);
  assert.equal(hashToken('x').length, 64);
});

test('authorize URL carries state, nonce, scope and the registered callback', () => {
  const url = new URL(buildLineAuthorizeUrl({ channelId: '1234', redirectUri: 'https://kolecion.cc/api/hr/line-handoff/callback', state: 'S', nonce: 'N' }));
  assert.equal(url.origin + url.pathname, 'https://access.line.me/oauth2/v2.1/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), '1234');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://kolecion.cc/api/hr/line-handoff/callback');
  assert.equal(url.searchParams.get('state'), 'S');
  assert.equal(url.searchParams.get('nonce'), 'N');
  assert.equal(url.searchParams.get('scope'), 'openid profile');
});

test('redirect URI uses the configured public origin before the (internal) request URL', () => {
  assert.equal(handoffRedirectUri({ NEXTAUTH_URL: 'https://kolecion.cc/' }, 'http://app:3000/api/x'), 'https://kolecion.cc/api/hr/line-handoff/callback');
  assert.equal(handoffRedirectUri({ APP_ORIGIN: 'https://a.example', NEXTAUTH_URL: 'https://b.example' }, 'http://app:3000/api/x'), 'https://a.example/api/hr/line-handoff/callback');
  assert.equal(handoffRedirectUri({}, 'http://localhost:3000/api/x'), 'http://localhost:3000/api/hr/line-handoff/callback');
});

test('result page shows the code in all three languages and sends no script', () => {
  const ok = renderHandoffPage({ ok: true, code: '482913' });
  assert.match(ok, />482913</);
  assert.match(ok, /LINE 驗證完成/);
  assert.match(ok, /LINE verification complete/);
  assert.match(ok, /Tapos na ang pag-verify sa LINE/);
  assert.doesNotMatch(ok, /<script/i);
  const failed = renderHandoffPage({ ok: false });
  assert.doesNotMatch(failed, /class="code"/);
  assert.match(failed, /LINE sign-in was not completed/);
  assert.equal(renderHandoffPage({ ok: true, code: '<b>1</b>' }).includes('<b>1</b>'), false);
});

test('handoff screen copy has the same keys in zh, en and tl', () => {
  const keys = Object.keys(HANDOFF_COPY.zh).sort();
  assert.ok(keys.length > 10);
  for (const lang of ['en', 'tl']) {
    assert.deepEqual(Object.keys(HANDOFF_COPY[lang]).sort(), keys);
    for (const key of keys) assert.ok(HANDOFF_COPY[lang][key].trim(), `${lang}.${key} is empty`);
  }
  for (const key of keys) assert.notEqual(HANDOFF_COPY.en[key], HANDOFF_COPY.zh[key], `en.${key} was not translated`);
});

test('chat codes are 10 unambiguous characters and survive the message round trip', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i += 1) {
    const code = newChatCode();
    assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{10}$/);
    seen.add(code);
    assert.equal(extractLoginCode(loginMessageText('zh', code)), code);
    assert.equal(extractLoginCode(loginMessageText('en', code)), code);
  }
  assert.equal(seen.size, 300);
  assert.equal(hashChatCode('abcdefghjk'), hashChatCode('ABCDEFGHJK'));
  assert.notEqual(hashChatCode('ABCDEFGHJK'), hashChatCode('ABCDEFGHJM'));
});

test('only an exact login-code message is treated as a login; everything else goes to the normal bot', () => {
  const code = 'MJ7HQURBD7';
  assert.equal(extractLoginCode(`  登入驗證碼：${code}  `), code);
  assert.equal(extractLoginCode(`LOGIN CODE ${code.toLowerCase()}`), code);
  for (const text of ['', '說明', '登入', `我的登入驗證碼 ${code}`, `登入驗證碼 ${code} 謝謝`, '登入驗證碼 MJ7HQURBD', '登入驗證碼 MJ7HQURBD70', '登入驗證碼 0OIL000000', null, undefined]) assert.equal(extractLoginCode(text), null, String(text));
});

test('official account chat link pre-fills the message and rejects malformed basic IDs', () => {
  const url = officialAccountMessageUrl('@abc123', '登入驗證碼 MJ7HQURBD7');
  assert.equal(url, 'https://line.me/R/oaMessage/@abc123/?%E7%99%BB%E5%85%A5%E9%A9%97%E8%AD%89%E7%A2%BC%20MJ7HQURBD7');
  for (const bad of ['abc123', '@', '@a/b', '@a b', '', null, 'https://evil.example']) assert.equal(officialAccountMessageUrl(bad, 'x'), null);
});

test('bot replies cover zh, en and tl for both outcomes', () => {
  for (const reply of Object.values(LOGIN_CODE_REPLY)) {
    assert.match(reply, /克雷迅/);
    assert.match(reply, /Kolecion/);
    assert.match(reply, /Kolecion app/);
    assert.ok(reply.split('\n\n').length === 3);
  }
});
