import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { entryGateClosedSql } from '../src/lib/hr-requirements.js';

const route = await readFile(new URL('../src/app/api/hr/training-center/route.js', import.meta.url), 'utf8');
const hrRoute = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../src/components/HrTrainingCenterWorkspace.jsx', import.meta.url), 'utf8');
const { TRAINING_CENTER_EN, translateTrainingCenterPattern } = await import('../src/lib/hr-translations-training.js');

// 取出報名資格 SQL，並用真正的 entryGateClosedSql 展開，確認實際送進資料庫的內容。
const eligibleSql = new Function('entryGateClosedSql', `${route.match(/const ELIGIBLE_WORKERS_SQL = `[\s\S]*?`;\n/)[0]}; return ELIGIBLE_WORKERS_SQL;`)(entryGateClosedSql);

test('學員報名資格：初步文件審核（三取二）通過，或已進入訓練', () => {
  assert.match(eligibleSql, /d\.entry_gate AND d\.applicable/);
  assert.ok(eligibleSql.includes(`NOT ${entryGateClosedSql('w.id')}`));
  assert.match(eligibleSql, /COALESCE\(h\.training_status,'not_scheduled'\)<>'not_scheduled'/);
  // 不能再要求「全部必要文件核准」，否則訓練中心名單上的工人會報名不了班別。
  assert.doesNotMatch(eligibleSql, /d\.required AND d\.applicable AND d\.status<>'approved'/);
});

test('報名資格與訓練中心名單（trainingRoster）使用同一條件', () => {
  const roster = hrRoute.match(/trainingRoster = await query\(`([\s\S]*?)`\);/)[1];
  assert.match(roster, /d\.entry_gate AND d\.applicable/);
  assert.match(roster, /COALESCE\(h\.training_status,'not_scheduled'\)<>'not_scheduled' OR NOT \$\{entryGateClosedSql\('w\.id'\)\}/);
  assert.match(route, /import \{ entryGateClosedSql \} from '@\/lib\/hr-requirements';/);
});

test('報名畫面：沒有可報名工人時說明原因，額滿班別停用報名，說明文字有英文翻譯', () => {
  assert.match(ui, /const full = Boolean\(row\.capacity\) && list\.length >= row\.capacity;/);
  assert.match(ui, /disabled=\{saving \|\| !students\.length \|\| full\}/);
  assert.match(ui, /\{!students\.length && <p className=\{styles\.formHint\}>/);
  assert.match(ui, /if \(!available\.length\)/);
  for (const text of [
    '只列出初步文件審核已通過（LCR Form 1-A、PSA 出生證明、護照三項中有兩項核准）或已進入訓練的工人；報名後工人頁面會顯示課程日期與證照辦件日期提醒。',
    '目前沒有可報名的工人：工人需先通過初步文件審核（LCR Form 1-A、PSA 出生證明、護照三項中有兩項核准），才能報名班別。',
    '符合資格的工人都已報名這個班別，沒有可再報名的工人。',
    '這位工人尚未通過初步文件審核，暫時不能報名班別。',
    '請選擇工人。',
    '這個班別已額滿。',
  ]) {
    assert.ok(TRAINING_CENTER_EN[text], `missing English translation: ${text}`);
    assert.ok(ui.includes(text) || route.includes(text), `text not used in code: ${text}`);
  }
  assert.equal(translateTrainingCenterPattern('報名到「初級看護班」'), 'Enroll in "初級看護班"');
});
