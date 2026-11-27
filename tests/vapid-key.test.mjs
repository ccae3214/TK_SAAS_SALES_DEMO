import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVapidPrivateKey, normalizeVapidPublicKey } from '../src/lib/vapid-key.js';
import { NOTIFY_COPY, urlBase64ToUint8Array } from '../src/lib/hr-call-notify-client-core.js';

// 測試用的金鑰（用 prime256v1 隨機產生，只在測試裡使用）
const PUBLIC = 'BKg5vp0EDVRfOXjSIwJShVxLWDiWMd6__CEdpItwtTQL81ZEXbakefRTk-fNuDhX0r-wQ3Y7aGtZvM3yB6Q6rFs';
const PRIVATE = 'LnUPRwnAR2A0TWrk9OsRbozC-bJGU9No1adcFMC4uSc';

test('乾淨的金鑰原樣回傳，解碼後是 65 位元組的未壓縮公鑰', () => {
  assert.equal(normalizeVapidPublicKey(PUBLIC), PUBLIC);
  assert.equal(normalizeVapidPrivateKey(PRIVATE), PRIVATE);
  const bytes = urlBase64ToUint8Array(normalizeVapidPublicKey(PUBLIC));
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 4);
});

test('重現問題：金鑰夾帶引號時 atob 會丟出 InvalidCharacterError，整理後就能解碼', () => {
  const quoted = `"${PUBLIC}"`;
  assert.throws(() => urlBase64ToUint8Array(quoted), { name: 'InvalidCharacterError' });
  assert.equal(urlBase64ToUint8Array(normalizeVapidPublicKey(quoted)).length, 65);
});

test('引號、換行、標籤文字、結尾的 = 與全形括號都能清掉', () => {
  for (const raw of [`'${PUBLIC}'`, `${PUBLIC}\r\n`, `  ${PUBLIC}  `, `Public Key: ${PUBLIC}`, `（${PUBLIC}）`, `${PUBLIC}=`, `${PUBLIC} # 來電通知`]) {
    assert.equal(normalizeVapidPublicKey(raw), PUBLIC, JSON.stringify(raw));
  }
  assert.equal(normalizeVapidPrivateKey(`"${PRIVATE}"\r\n`), PRIVATE);
});

test('一般 base64（+ 與 /）會轉成 URL-safe', () => {
  const standard = PUBLIC.replace(/-/g, '+').replace(/_/g, '/');
  assert.notEqual(standard, PUBLIC);
  assert.equal(normalizeVapidPublicKey(standard), PUBLIC);
});

test('長度不對、不是 B 開頭、空值都回傳空字串（不會硬湊一個壞金鑰）', () => {
  for (const raw of [undefined, null, '', '   ', PUBLIC.slice(1), `${PUBLIC}A`, `A${PUBLIC.slice(1)}`, PRIVATE]) {
    assert.equal(normalizeVapidPublicKey(raw), '', JSON.stringify(raw));
  }
  assert.equal(normalizeVapidPrivateKey(PUBLIC), '');
});

test('金鑰格式錯誤的提示在中文、英文、菲律賓文都有，且都有指出要更新的變數名稱', () => {
  for (const lang of ['zh', 'en', 'tl']) {
    const text = NOTIFY_COPY[lang].errors.badKey;
    assert.ok(text && text.includes('HR_PUSH_VAPID_PUBLIC_KEY') && text.includes('HR_PUSH_VAPID_PRIVATE_KEY'), lang);
  }
  assert.deepEqual(Object.keys(NOTIFY_COPY.en.errors).sort(), Object.keys(NOTIFY_COPY.zh.errors).sort());
  assert.deepEqual(Object.keys(NOTIFY_COPY.tl.errors).sort(), Object.keys(NOTIFY_COPY.zh.errors).sort());
});
