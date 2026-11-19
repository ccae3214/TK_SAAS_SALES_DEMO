import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { photoFileError, PHOTO_MAX_BYTES, PHOTO_FORMAT_ERROR, PHOTO_SIZE_ERROR } from '../src/lib/hr-photo-file.js';

const file = (type, name, size = 1000) => ({ type, name, size });

test('JPG、PNG（含 jpg／pjpeg 類型）可通過', () => {
  for (const type of ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'IMAGE/PNG']) assert.equal(photoFileError(file(type, 'a')), '', type);
});
test('HEIC、GIF、PDF 等其他格式被擋', () => {
  for (const [type, name] of [['image/heic', 'a.heic'], ['image/gif', 'a.gif'], ['application/pdf', 'a.pdf']]) assert.equal(photoFileError(file(type, name)), PHOTO_FORMAT_ERROR, type);
});
test('沒有 MIME 類型時看副檔名：.jpg／.jpeg／.png 通過，.heic 被擋', () => {
  for (const name of ['a.jpg', 'a.JPEG', 'a.png']) assert.equal(photoFileError(file('', name)), '', name);
  assert.equal(photoFileError(file('', 'a.heic')), PHOTO_FORMAT_ERROR);
  assert.equal(photoFileError(file('', '')), PHOTO_FORMAT_ERROR);
});
test('30 MB 邊界：剛好 30 MB 通過，多 1 byte 被擋', () => {
  assert.equal(photoFileError(file('image/jpeg', 'a.jpg', PHOTO_MAX_BYTES)), '');
  assert.equal(photoFileError(file('image/jpeg', 'a.jpg', PHOTO_MAX_BYTES + 1)), PHOTO_SIZE_ERROR);
});
test('兩條錯誤訊息都有英文翻譯', async () => {
  const dictionary = await readFile(new URL('../src/lib/hr-translations.jsx', import.meta.url), 'utf8');
  for (const message of [PHOTO_FORMAT_ERROR, PHOTO_SIZE_ERROR]) assert(dictionary.includes(`'${message}':`), message);
});
test('兩個元件都改用共用檢查，不再各自複製規則', async () => {
  for (const name of ['HrManagement', 'HrMemberPortal']) {
    const source = await readFile(new URL(`../src/components/${name}.jsx`, import.meta.url), 'utf8');
    assert.match(source, /photoFileError\(file\)/, name);
    assert.doesNotMatch(source, /pjpeg/, name);
    assert.doesNotMatch(source, /30000000/, name);
  }
});
