import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isMobileDevice, lineLoginMode } from '../src/lib/hr-line-login-mode.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

test('電腦的桌面 App 與瀏覽器都直接做 LINE 網頁登入，不走交接單', () => {
  for (const userAgent of [WINDOWS_CHROME, MAC_SAFARI]) {
    assert.equal(isMobileDevice({ userAgent, maxTouchPoints: 0 }), false);
    assert.equal(lineLoginMode({ standalone: true, userAgent, maxTouchPoints: 0 }), 'web');
    assert.equal(lineLoginMode({ standalone: false, userAgent, maxTouchPoints: 0 }), 'web');
  }
  // 有觸控螢幕的 Windows 筆電仍然是電腦
  assert.equal(lineLoginMode({ standalone: true, userAgent: WINDOWS_CHROME, maxTouchPoints: 10 }), 'web');
});

test('只有手機的桌面圖示 App 走交接單；手機的一般分頁維持原本的 LINE 登入', () => {
  for (const userAgent of [IPHONE, ANDROID]) {
    assert.equal(lineLoginMode({ standalone: true, userAgent, maxTouchPoints: 5 }), 'handoff');
    assert.equal(lineLoginMode({ standalone: false, userAgent, maxTouchPoints: 5 }), 'web');
  }
  // iPadOS 的 Safari 會假裝成 Mac，用觸控點數判斷
  assert.equal(isMobileDevice({ userAgent: MAC_SAFARI, maxTouchPoints: 5 }), true);
  assert.equal(lineLoginMode({ standalone: true, userAgent: MAC_SAFARI, maxTouchPoints: 5 }), 'handoff');
});

test('沒有參數時不會出錯，預設走網頁登入', () => {
  assert.equal(lineLoginMode(), 'web');
  assert.equal(isMobileDevice(), false);
});

test('登入頁：電腦用網頁登入並關閉自動登入，且能接續在別的視窗完成的登入', async () => {
  const page = await read('../src/app/hr/login/page.jsx');
  assert.ok(page.includes("import { isMobileDevice, lineLoginMode } from '@/lib/hr-line-login-mode';"));
  assert.ok(page.includes("const useHandoff = lineLoginMode({ standalone: isStandalone, ...device }) === 'handoff';"));
  assert.ok(page.includes('setDesktop(!isMobileDevice(device));'));
  assert.ok(page.includes("return signIn('line', { callbackUrl: '/' }, desktop ? { disable_auto_login: 'true' } : undefined);"));
  assert.ok(page.includes("onClick={() => (standalone ? startLineHandoff() : startLineWebLogin())}"));
  assert.ok(page.includes("fetch('/api/auth/session', { cache: 'no-store' })"));
  assert.ok(page.includes("window.addEventListener('focus', check);"));
  assert.ok(!page.includes("signIn('line', { callbackUrl: '/' }))}>"), '按鈕不再直接呼叫自動登入');
});
