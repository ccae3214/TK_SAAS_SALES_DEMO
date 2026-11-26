import assert from 'node:assert/strict';
import test from 'node:test';
import { tlText } from '../src/lib/language.js';

// 通話畫面上「麥克風／鏡頭／喇叭」狀態的菲律賓語翻譯（中文、英文在 HrCallProvider.jsx 的 COPY）
const EXPECTED = {
  'Microphone on': 'Naka-on ang mikropono',
  'Microphone off': 'Naka-off ang mikropono',
  'No microphone': 'Walang mikropono',
  'Camera on': 'Naka-on ang camera',
  'Camera off': 'Naka-off ang camera',
  'No camera': 'Walang camera',
  'Speaker on': 'Naka-on ang speaker',
  'Speaker off': 'Naka-off ang speaker',
};

test('通話狀態文字有菲律賓語翻譯', () => {
  for (const [english, filipino] of Object.entries(EXPECTED)) assert.equal(tlText(english), filipino, english);
});
