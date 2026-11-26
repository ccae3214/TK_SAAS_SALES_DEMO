import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { trainingCenterIdOf } from '../src/lib/hr-training-center-scope.js';
import { TC_MEMBER_EN } from '../src/lib/hr-translations-training-center-member.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('訓練中心成員用所屬中心，中心本人用自己的編號，其他角色沒有', () => {
  assert.equal(trainingCenterIdOf({ role: 'training_center', id: 7, training_center_id: 3 }), 3);
  assert.equal(trainingCenterIdOf({ role: 'training_center', id: 7, training_center_id: null }), 7);
  assert.equal(trainingCenterIdOf({ role: 'agency', id: 7, training_center_id: 3 }), null);
  assert.equal(trainingCenterIdOf(null), null);
});

test('變更會員類型選訓練中心時，表單顯示所屬訓練中心選單（只列中心本人，不含自己）', async () => {
  const ui = await read('../src/components/HrManagement.jsx');
  assert.ok(ui.includes('memberRole===\'training_center\'?<><SelectField name="trainingCenterId" label="所屬訓練中心"'));
  assert.ok(ui.includes("x.role==='training_center'&&!x.training_center_id&&x.active&&Number(x.id)!==Number(record?.id)"));
  assert.ok(ui.includes("payload.trainingCenterId=value.role==='training_center'&&value.trainingCenterId&&value.trainingCenterId!=='self'"));
});

test('伺服器驗證所屬訓練中心，並擋下仍有成員或已有資料的中心', async () => {
  const api = await read('../src/app/api/hr/route.js');
  assert.ok(api.includes("role='training_center' AND training_center_id IS NULL AND active=TRUE FOR SHARE"));
  assert.ok(api.includes('training_center_id=CASE WHEN $2=\'training_center\' THEN $8::bigint ELSE NULL END'));
  assert.ok(api.includes('SELECT 1 FROM hr_members WHERE training_center_id=$1 LIMIT 1'));
  assert.ok(api.includes('hr_tc_certifications WHERE center_id=$1'));
  assert.ok(api.includes('m.training_center_id,(SELECT tc.display_name'));
});

test('成員與中心共用工作區與聊天室；成員不會各自變成一個中心', async () => {
  const tc = await read('../src/app/api/hr/training-center/route.js');
  assert.ok(tc.includes('centerId: trainingCenterIdOf(principal)'));
  assert.ok(tc.includes("role='training_center' AND training_center_id IS NULL ORDER BY"));
  for (const file of ['chat', 'call']) {
    const source = await read(`../src/app/api/hr/${file}/route.js`);
    assert.ok(source.includes('m.id=$1 OR m.training_center_id=$1'), `${file}：群組成員要包含中心成員`);
    assert.ok(source.includes("principal.role==='training_center'?trainingCenterIdOf(principal)"), `${file}：成員用所屬中心的群組`);
  }
  assert.ok((await read('../src/app/api/hr/chat/route.js')).includes("role='training_center' AND training_center_id IS NULL AND active=TRUE ON CONFLICT"));
  assert.ok((await read('../src/lib/hr-schema.js')).includes("role='training_center' AND training_center_id IS NULL AND active=TRUE ON CONFLICT"));
  assert.ok((await read('../src/lib/hr-access.js')).includes('ADD COLUMN IF NOT EXISTS training_center_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL'));
});

test('新增的中文介面文字都有英文與菲律賓語翻譯', async () => {
  const tl = await read('../src/data/tl-dictionary.js');
  for (const [zh, en] of Object.entries(TC_MEMBER_EN)) {
    assert.ok(en && en !== zh, `缺少英文翻譯：${zh}`);
    assert.ok(tl.includes(`"${en}":`), `缺少菲律賓語翻譯：${en}`);
  }
  assert.ok((await read('../src/lib/hr-translations.jsx')).includes('TC_MEMBER_EN[trimmed]'));
});
