import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INSTALL_COPY, detectInstallEnvironment, installGuideKey, shouldShowInstallButton } from '../src/lib/hr-install-app-core.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.5.0';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const ANDROID_LINE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Line/14.5.0';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

test('判斷各種瀏覽器該顯示哪一種「加到桌面」方式', () => {
  assert.equal(detectInstallEnvironment({ userAgent: IPHONE_SAFARI }), 'ios');
  assert.equal(detectInstallEnvironment({ userAgent: IPHONE_LINE }), 'ios-inapp');
  assert.equal(detectInstallEnvironment({ userAgent: ANDROID_CHROME }), 'android');
  assert.equal(detectInstallEnvironment({ userAgent: ANDROID_CHROME, canPrompt: true }), 'prompt');
  assert.equal(detectInstallEnvironment({ userAgent: ANDROID_LINE, canPrompt: true }), 'android-inapp');
  assert.equal(detectInstallEnvironment({ userAgent: DESKTOP }), 'desktop');
  assert.equal(detectInstallEnvironment({ userAgent: DESKTOP, canPrompt: true }), 'prompt');
  assert.equal(detectInstallEnvironment({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15', maxTouchPoints: 5 }), 'ios');
  assert.equal(detectInstallEnvironment({ userAgent: IPHONE_SAFARI, standalone: true }), 'installed');
  assert.equal(detectInstallEnvironment(), 'desktop');
});

test('只有需要的環境才顯示按鈕', () => {
  for (const env of ['prompt', 'ios', 'ios-inapp', 'android', 'android-inapp']) assert.equal(shouldShowInstallButton(env), true, env);
  for (const env of ['installed', 'desktop', null]) assert.equal(shouldShowInstallButton(env), false, String(env));
  assert.equal(installGuideKey('ios-inapp'), 'inapp');
  assert.equal(installGuideKey('prompt'), null);
});

test('中英文說明文字完整且結構一致', () => {
  const shape = value => (Array.isArray(value) ? value.map(() => 'item') : typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value);
  assert.deepEqual(shape(INSTALL_COPY.en), shape(INSTALL_COPY.zh));
  for (const language of ['zh', 'en']) {
    const copy = INSTALL_COPY[language];
    assert.ok(copy.button && copy.close && copy.done);
    for (const key of ['ios', 'android', 'inapp']) {
      assert.equal(copy[key].steps.length, 3);
      assert.ok(copy[key].title && copy[key].note && copy[key].steps.every(Boolean));
    }
  }
  assert.doesNotMatch(JSON.stringify(INSTALL_COPY.en), /[\u4e00-\u9fff]/);
});

test('manifest 與圖示符合安裝條件', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name);
  const sizes = manifest.icons.map(icon => icon.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const file = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(file.subarray(1, 4).toString('latin1'), 'PNG', icon.src);
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.equal(file.readUInt32BE(16), w, icon.src);
    assert.equal(file.readUInt32BE(20), h, icon.src);
  }
});

test('iPhone 桌面圖示用 PNG，且按鈕放在每個會員頁首', () => {
  assert.match(read('src/app/layout.jsx'), /rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  const portal = read('src/components/HrMemberPortal.jsx');
  const headers = portal.match(/hr-member-header-actions"/g).length;
  assert.equal(portal.match(/hr-member-header-actions"><HrInstallApp \/>/g).length, headers);
  assert.match(portal, /import HrInstallApp from '@\/components\/HrInstallApp'/);
});
