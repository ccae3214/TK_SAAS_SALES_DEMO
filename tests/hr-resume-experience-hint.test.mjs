import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TL_DICTIONARY } from '../src/data/tl-dictionary.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const ZH = '請填寫完整的工作經歷，有助於雇主和仲介了解工作者的經驗與能力。';
const EN = 'Please fill in the complete work history. It helps employers and agencies understand the worker’s experience and skills.';

test('工作者履歷與後台履歷的國內外工作經歷都有醒目提醒', async () => {
  const portal = await read('../src/components/HrMemberPortal.jsx');
  const admin = await read('../src/components/HrManagement.jsx');
  assert.ok(portal.includes(`<p className="resume-experience-hint" role="note"><Lightbulb size={16} aria-hidden="true"/><span>${ZH}</span></p>`));
  assert.ok(admin.includes(`<p className={styles.resumeExperienceHint} role="note"><Lightbulb size={16} aria-hidden="true"/><span>${ZH}</span></p>`));
  assert.ok((await read('../src/app/globals.css')).includes('.resume-experience-hint{'));
  assert.ok((await read('../src/components/HrManagement.module.css')).includes('.resumeExperienceHint{'));
});

test('提醒文字有英文與 Filipino', async () => {
  const translations = await read('../src/lib/hr-translations.jsx');
  assert.ok(translations.includes(`'${ZH}': '${EN}',`));
  assert.ok(TL_DICTIONARY[EN]);
});
