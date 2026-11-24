import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('手機版聊天室：清單與對話分頁切換，有返回鈕（中英文）', async () => {
  const chat = await read('../src/components/HrChat.jsx');
  assert.ok(chat.includes("useState(false)") && chat.includes('mobileChat'));
  assert.ok(chat.includes("back:'Back to chat list'"), '缺英文返回文字');
  assert.ok(chat.includes("back:'返回聊天室清單'"), '缺中文返回文字');
  assert.ok(chat.includes('aria-label={text.back}'));
  // 點聊天室、從通知開啟聊天室、開啟私訊，都要切到對話畫面
  assert.equal(chat.split('setMobileChat(true)').length - 1, 3);
  assert.ok(chat.includes('setMobileChat(false)'));
});

test('手機版聊天室：樣式只在手機寬度生效，桌機的返回鈕隱藏，輸入框字級不會讓 iPhone 放大', async () => {
  const css = await read('../src/components/HrChat.module.css');
  const mobileStart = css.indexOf('@media(max-width:680px)');
  assert.ok(mobileStart > 0);
  const desktop = css.slice(0, mobileStart);
  assert.ok(desktop.includes('.backButton{display:none}'));
  for (const name of ['.showChat', '.showList', '.chatOpen']) assert.ok(!desktop.includes(name), `${name} 只能出現在手機樣式`);
  const mobile = css.slice(mobileStart);
  assert.ok(/\.composer textarea\{[^}]*font-size:16px/.test(mobile));
  assert.ok(mobile.includes('.showChat .roomList{display:none}') && mobile.includes('.showList .conversation{display:none}'));
});

test('通話與送出按鈕在手機只顯示圖示，仍保留無障礙名稱（中英文）', async () => {
  const chat = await read('../src/components/HrChat.jsx');
  for (const label of ['callText.voice', 'callText.video', 'text.members', 'text.send']) assert.ok(chat.includes(`aria-label={${label}}`), `${label} 缺 aria-label`);
  assert.ok(chat.includes("callText=lang==='en'?{voice:'Voice call',video:'Video call'}"));
});
