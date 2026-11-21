import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

// 瀏覽器原生的「選擇檔案／未選擇任何檔案」文字由瀏覽器自己畫，網站的翻譯機制碰不到。
// 所有上傳欄位都要用 HrFilePicker（自己畫按鈕與檔名，才有中英文切換）。
test('src 裡除了 HrFilePicker 以外，不可以再直接使用原生 <input type="file">', async () => {
  const files = (await readdir(new URL('../src/', import.meta.url), { recursive: true })).filter(file => /\.(jsx|js|tsx|ts)$/.test(file));
  const offenders = [];
  for (const file of files) {
    if (/(^|[\\/])HrFilePicker\.jsx$/.test(file)) continue;
    const source = await read(`../src/${file.replaceAll('\\', '/')}`);
    if (/type\s*=\s*(["'])file\1|type\s*:\s*(["'])file\2/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `這些檔案用了原生檔案欄位，請改用 HrFilePicker：${offenders.join(', ')}`);
});

test('HrFilePicker 可直接放進表單：name、required、onChange 可省略，表單重設時清掉檔名', async () => {
  const picker = await read('../src/components/HrFilePicker.jsx');
  assert.match(picker, /name, required = false \}\)/);
  assert.ok(picker.includes('name={name} required={required}'));
  assert.ok(picker.includes('onChange?.(event)'), 'onChange 沒傳時不能出錯');
  assert.ok(picker.includes("form.addEventListener('reset'"), '表單 reset() 後要清掉檔名');
  assert.ok(picker.includes("'Choose file'") && picker.includes("'No file chosen'"));
  const css = await read('../src/components/HrFilePicker.module.css');
  assert.ok(css.includes('.fileButton .input:disabled{cursor:wait;opacity:0}'), '停用時隱藏的原生欄位不可浮現');
});

test('文件上傳的三個地方都用 HrFilePicker 並保留 name="file" 與 required', async () => {
  for (const path of ['../src/components/HrMemberPortal.jsx', '../src/components/HrWorkerProgress.jsx', '../src/components/HrManagement.jsx']) {
    const source = await read(path);
    assert.ok(source.includes("import HrFilePicker from '@/components/HrFilePicker';"), `${path} 沒有匯入 HrFilePicker`);
    assert.match(source, /<HrFilePicker name="file"[^>]*required|<HrFilePicker name="file" required/, `${path} 的上傳欄位要有 name="file" 與 required`);
  }
});
