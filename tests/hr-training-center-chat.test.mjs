import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

// 訓練中心的聊天室：每個訓練中心一個群組，成員是訓練中心、已報名其班別的工人、以及這些工人所屬的仲介（管理員看得到全部）。
test('資料表：聊天室可屬於訓練中心，每個訓練中心只有一間', async () => {
  const schema = await read('../src/lib/hr-schema.js');
  assert.ok(schema.includes('ADD COLUMN IF NOT EXISTS center_id BIGINT REFERENCES hr_members(id) ON DELETE CASCADE'));
  assert.ok(schema.includes("pg_get_constraintdef(oid) LIKE '%training_center%'"), '舊的限制式要升級成含 training_center');
  assert.ok(schema.includes("(room_type='training_center' AND center_id IS NOT NULL AND agency_id IS NULL AND case_id IS NULL)"));
  assert.ok(schema.includes("CREATE UNIQUE INDEX IF NOT EXISTS hr_chat_rooms_center_unique ON hr_chat_rooms(center_id) WHERE room_type='training_center'"));
  assert.ok(schema.includes("INSERT INTO hr_chat_rooms(room_type,center_id) SELECT 'training_center',id FROM hr_members WHERE role='training_center' AND training_center_id IS NULL AND active=TRUE ON CONFLICT DO NOTHING"));
});

for (const [name, path] of [['聊天室 API', '../src/app/api/hr/chat/route.js'], ['通話 API', '../src/app/api/hr/call/route.js']]) {
  test(`${name}：只有管理員、該訓練中心、已報名的工人與其仲介進得去，雇主不行`, async () => {
    const source = await read(path);
    assert.ok(source.includes("import { ensureTrainingCenterSchema } from '@/lib/hr-training-center';"));
    assert.ok(source.includes("OR ($2::text='training_center' AND r.room_type='training_center' AND r.center_id=$7)"));
    assert.ok(source.includes("OR ($2::text='worker' AND r.room_type='training_center' AND EXISTS(SELECT 1 FROM hr_tc_enrollments en JOIN hr_tc_classes cl ON cl.id=en.class_id"));
    assert.ok(source.includes("WHERE cl.center_id=r.center_id AND en.worker_id=$4))"));
    assert.ok(source.includes("WHERE cl.center_id=r.center_id AND tw.agency_id=$3))"));
    assert.ok(!/employer'[^\n]*r\.room_type='training_center'/.test(source), '雇主不能進訓練中心群組');
    assert.ok(source.includes('await ensureTrainingCenterSchema();'), '查報名資料前要先確定訓練中心資料表存在');
  });
}

test('聊天室 API：同步聊天室、列表、成員、私訊都支援訓練中心群組', async () => {
  const source = await read('../src/app/api/hr/chat/route.js');
  assert.ok(source.includes("INSERT INTO hr_chat_rooms(room_type,center_id) SELECT 'training_center',id FROM hr_members WHERE role='training_center' AND training_center_id IS NULL AND active=TRUE ON CONFLICT DO NOTHING"));
  assert.ok(source.includes("OR ($1::text='training_center' AND r.room_type='training_center' AND r.center_id=$6)"), '列表：訓練中心');
  assert.ok(source.includes("OR ($1::text='worker' AND r.room_type='training_center' AND EXISTS("), '列表：已報名的工人');
  assert.ok(source.includes("OR ($1::text='agency' AND r.room_type='training_center' AND EXISTS("), '列表：工人所屬仲介');
  assert.ok(source.includes('LEFT JOIN hr_members cm ON cm.id=r.center_id'));
  assert.ok(source.includes("title:`${room.center_name||''} · 訓練中心群組`"));
  assert.ok(source.includes("room.room_type==='training_center'\n        ? await query(`SELECT DISTINCT m.id,m.display_name,m.role,a.name agency_name FROM hr_members m"), '群組會員清單');
  assert.ok(source.includes("source.room_type==='training_center'\n        ? await query(`SELECT m.id,m.display_name FROM hr_members m WHERE m.active=TRUE AND m.id=$2 AND (${TRAINING_CENTER_MEMBER_SQL})`"), '只能私訊群組內的會員');
});

test('通話 API：訓練中心群組的標題與響鈴對象', async () => {
  const source = await read('../src/app/api/hr/call/route.js');
  assert.ok(source.includes("room.room_type==='training_center'?`${room.center_name} · 訓練中心群組`"));
  assert.ok(source.includes("room.room_type==='training_center'\n    ? await query(`SELECT DISTINCT m.id FROM hr_members m WHERE m.active=TRUE AND (${TRAINING_CENTER_MEMBER_SQL})`,[room.center_id])"));
});

test('聊天室 API 與通話 API 的訓練中心成員條件相同', async () => {
  const grab = source => source.match(/const TRAINING_CENTER_MEMBER_SQL=`[\s\S]*?`;/)?.[0];
  const chat = grab(await read('../src/app/api/hr/chat/route.js')), call = grab(await read('../src/app/api/hr/call/route.js'));
  assert.ok(chat && chat === call);
});

test('訓練中心選單多了「聊天室」，排在操作紀錄前面，切換分頁不會卸載', async () => {
  const workspace = await read('../src/components/HrTrainingCenterWorkspace.jsx');
  assert.ok(workspace.includes('MessagesSquare'));
  assert.ok(workspace.includes('arrangement: ClipboardList, chat: MessagesSquare };'));
  assert.ok(workspace.includes("...endTabs.map(item => [item.id, item.label]), AUDIT_TAB];"));
  assert.ok(workspace.includes("item.keepMounted ? <div key={item.id} hidden={tab !== item.id}>{item.render()}</div>"));
  assert.ok(workspace.includes("['arrangement', 'chat'].includes(event.detail?.tab)"));
  const portal = await read('../src/components/HrMemberPortal.jsx');
  assert.ok(portal.includes("{ id: 'chat', label: '聊天室', position: 'end', keepMounted: true, render: () => <section className=\"workspace-chat-page\"><HrChat /></section> }"));
  assert.ok(portal.includes("detail:{tab:'chat'}"), '通知鈴點聊天提醒時要切到聊天室分頁');
});

test('聊天室畫面：訓練中心群組有中英文文字，並補上缺少的 localeFor 匯入', async () => {
  const chat = await read('../src/components/HrChat.jsx');
  assert.ok(chat.includes("trainingCenter:'Training center chat',trainingCenterSubtitle:'Training center group chat'"));
  assert.ok(chat.includes("trainingCenter:'訓練中心群組',trainingCenterSubtitle:'訓練中心聊天室'"));
  assert.ok(chat.includes("room?.roomType==='training_center'?`${room.centerName} · ${text.trainingCenter}`"));
  assert.ok(chat.includes("member.role==='training_center'?'訓練中心'"));
  assert.ok(chat.includes("import { localeFor, mapLeaves, tlText } from '@/lib/language';"));
});
