import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profileLocaleToBotLanguage, webLanguageForBotLanguage } from '../src/lib/hr-line-language.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('LINE 個人資料語言轉成機器人語言：中文、英文、Filipino，其他不動', () => {
  for (const locale of ['zh', 'zh-Hant', 'zh_TW', 'ZH-hans']) assert.equal(profileLocaleToBotLanguage(locale), 'zh', locale);
  for (const locale of ['en', 'en-US', 'en_GB']) assert.equal(profileLocaleToBotLanguage(locale), 'en', locale);
  for (const locale of ['tl', 'fil', 'fil-PH']) assert.equal(profileLocaleToBotLanguage(locale), 'tl', locale);
  for (const locale of ['ja', 'th', 'ko', '', null, undefined]) assert.equal(profileLocaleToBotLanguage(locale), null, String(locale));
});

test('網站只有中文與英文：Filipino 用英文，其他語言不動', () => {
  assert.equal(webLanguageForBotLanguage('zh'), 'zh');
  assert.equal(webLanguageForBotLanguage('en'), 'en');
  assert.equal(webLanguageForBotLanguage('tl'), 'en');
  assert.equal(webLanguageForBotLanguage(null), null);
  assert.equal(webLanguageForBotLanguage('ja'), null);
});

test('同步只做一次：用「尚未同步」條件原子寫入，且已同步就直接略過', async () => {
  const source = await read('../src/lib/hr-line-language-sync.js');
  assert.match(source, /WHERE hr_line_member_settings\.line_language_synced_at IS NULL\s*RETURNING line_user_id/);
  assert.match(source, /if \(rows\[0\]\?\.line_language_synced_at\) return \{ applied: false \}/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS line_language_synced_at TIMESTAMPTZ/);
  // 查不到 LINE 語言時不能標成已同步（之後還要再試）
  assert.match(source, /if \(!botLanguage\) return \{ applied: false \};\s*\/\/ 只有第一個/);
});

test('webhook 在產生回覆之前先同步語言', async () => {
  const source = await read('../src/app/api/line/webhook/route.js');
  const sync = source.indexOf('await syncLanguageForEvent(event);');
  const reply = source.indexOf('await replyForHrLineEvent(');
  assert.ok(sync > 0 && reply > sync);
});

test('網站 API 需同源與登入，前端經事件切換語言並同步菲律賓仲介偏好', async () => {
  const route = await read('../src/app/api/hr/line-language/route.js');
  assert.match(route, /requestIsSameOrigin\(request\)/);
  assert.match(route, /Authentication required/);
  const component = await read('../src/components/LineLanguageSync.jsx');
  assert.match(component, /kolecion:set-language/);
  assert.match(component, /hr-language:philippines-agency/);
  const context = await read('../src/context/LanguageContext.jsx');
  assert.match(context, /addEventListener\('kolecion:set-language'/);
});

test('遷移已登記到啟動清單', async () => {
  const registry = await read('../src/lib/hr-migrations.js');
  assert.match(registry, /\['line-language-sync', \(\) => ensureLineLanguageSyncSchema\(\)\]/);
});
