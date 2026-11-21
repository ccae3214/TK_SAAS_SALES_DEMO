import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { translateChatSystemMessage, translateChatSystemPattern } from '../src/lib/hr-translations-chat.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const ASSIGNED_ZH = '管理者已將媒合需求單 #12（王大明家）直接指派給台灣仲介 台北人力 與菲律賓仲介 Manila Care Agency，請雙方直接聯繫媒合。';
const PICKED_ZH = '雇主 王大明家 已從需求單 #12 挑選工作者 Santos / Maria / Cruz（家庭幫傭）。請台灣仲介與菲律賓仲介聯繫安排後續面試。';

test('admin assignment system message is translated to English', () => {
  assert.equal(
    translateChatSystemPattern(ASSIGNED_ZH),
    'An administrator assigned job order #12 (王大明家) directly to Taiwan agency 台北人力 and Philippines agency Manila Care Agency. Please contact each other to arrange the match.',
  );
});

test('employer pick system message is translated, and the job type goes through the translate callback', () => {
  assert.equal(
    translateChatSystemPattern(PICKED_ZH, text => (text === '家庭幫傭' ? 'Domestic helper' : text)),
    'Employer 王大明家 selected worker Santos / Maria / Cruz (Domestic helper) from job order #12. The Taiwan and Philippines agencies should get in touch to arrange the next interview.',
  );
  assert.match(translateChatSystemPattern(PICKED_ZH), /\(家庭幫傭\)/);
});

test('names with spaces, slashes and full-width parentheses still match', () => {
  const zh = '雇主 林（北區）工廠 已從需求單 #7 挑選工作者 Dela Cruz（Jr.） / Ana（工廠技術工）。請台灣仲介與菲律賓仲介聯繫安排後續面試。';
  assert.equal(
    translateChatSystemPattern(zh),
    'Employer 林（北區）工廠 selected worker Dela Cruz（Jr.） / Ana (工廠技術工) from job order #7. The Taiwan and Philippines agencies should get in touch to arrange the next interview.',
  );
});

test('only English UI is translated, and ordinary chat text is never changed', () => {
  assert.equal(translateChatSystemMessage(ASSIGNED_ZH, 'zh'), ASSIGNED_ZH);
  assert.notEqual(translateChatSystemMessage(ASSIGNED_ZH, 'en'), ASSIGNED_ZH);
  for (const text of ['大家好', '送出', '雇主 已從需求單', '', '  ']) {
    assert.equal(translateChatSystemMessage(text, 'en'), text);
    assert.equal(translateChatSystemPattern(text), '');
  }
  assert.equal(translateChatSystemMessage(undefined, 'en'), undefined);
  assert.equal(translateChatSystemMessage(null, 'en'), null);
});

test('the server still writes messages that the patterns understand', async () => {
  const source = await read('../src/app/api/hr/_post/job-orders.js');
  function template(marker, samples) {
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `job-orders.js 找不到系統訊息：${marker}`);
    const open = source.indexOf('`', start);
    const close = source.indexOf('`', open + 1);
    let index = 0;
    return source.slice(open + 1, close).replace(/\$\{[^}]+\}/g, () => samples[index++]);
  }
  const assigned = template('const message=`管理者已將媒合需求單', ['5', '測試雇主', '台北仲介', 'Manila Agency']);
  assert.ok(translateChatSystemPattern(assigned), `指派訊息的句型已變更，請同步更新 hr-translations-chat.js：${assigned}`);
  const picked = template('const message=`雇主 ', ['測試雇主', '5', 'Maria Santos', '家庭幫傭']);
  assert.ok(translateChatSystemPattern(picked), `挑選訊息的句型已變更，請同步更新 hr-translations-chat.js：${picked}`);
});

test('chat and reminders show the translated text', async () => {
  const chat = await read('../src/components/HrChat.jsx');
  assert.match(chat, /from '@\/lib\/hr-translations-chat'/);
  assert.ok(chat.includes('<p>{localizeMessage(message.body)}</p>'), '聊天訊息內文要經過 localizeMessage');
  assert.ok(chat.includes('localizeMessage(room.lastMessage)'), '聊天室清單預覽要經過 localizeMessage');
  assert.ok(!chat.includes('<p>{message.body}</p>'), '不可直接輸出 message.body');

  const reminders = await read('../src/components/HrReminders.jsx');
  assert.match(reminders, /from '@\/lib\/hr-translations-chat'/);
  assert.ok(reminders.includes('translateChatSystemMessage(room.lastMessage, lang'), '未讀提醒預覽要經過翻譯');
  assert.ok(reminders.indexOf('useLanguage()') < reminders.indexOf('if (loading || reminderCount === 0) return null;'), 'hook 必須在提早 return 之前');
});
