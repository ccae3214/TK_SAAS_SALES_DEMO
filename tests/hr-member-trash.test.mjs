import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MEMBER_TRASH_COLUMN_SQL, restoreTrashedMember, trashMember } from '../src/lib/hr-member-trash.js';
import { MEMBER_TRASH_EN, MEMBER_TRASH_TEXT_KEYS, memberTrashText } from '../src/lib/hr-member-trash-text.js';

const CJK = /[㐀-鿿＀-￯]/;

function fakeClient(rows) {
  const calls = [];
  return {
    calls,
    async query(sql, args = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), args });
      return sql.trim().startsWith('UPDATE hr_members') ? { rows, rowCount: rows.length } : { rows: [], rowCount: 0 };
    },
  };
}

test('the deleted_at column is added idempotently', () => {
  assert.match(MEMBER_TRASH_COLUMN_SQL, /ALTER TABLE hr_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ/);
});

test('trashMember deactivates + marks deleted, and unlinks the broker from job orders', async () => {
  const client = fakeClient([{ id: 7, role: 'worker', worker_id: 3, employer_id: null }]);
  const result = await trashMember(client, 7);
  assert.deepEqual(result, { id: 7, role: 'worker', worker_id: 3, employer_id: null });
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[0].sql, /SET active=FALSE, deleted_at=NOW\(\)/);
  assert.match(client.calls[0].sql, /WHERE id=\$1 AND deleted_at IS NULL/);
  assert.deepEqual(client.calls[0].args, [7]);
  assert.match(client.calls[1].sql, /UPDATE hr_job_order_agencies SET broker_member_id=NULL WHERE broker_member_id=\$1/);
});

test('trashMember does nothing else when the member is missing or already deleted', async () => {
  const client = fakeClient([]);
  assert.equal(await trashMember(client, 99), null);
  assert.equal(client.calls.length, 1);
});

test('trashMember never deletes any rows', async () => {
  const client = fakeClient([{ id: 1 }]);
  await trashMember(client, 1);
  for (const call of client.calls) assert.doesNotMatch(call.sql, /\bDELETE\b/i);
});

test('restoreTrashedMember reactivates and clears the deleted flag only for deleted accounts', async () => {
  const row = { id: 7, email: 'a@example.invalid', display_name: 'A', role: 'worker', admin_scope: 'none', worker_id: 3, employer_id: null, agency_id: null, active: true };
  const client = fakeClient([row]);
  assert.deepEqual(await restoreTrashedMember(client, 7), row);
  assert.match(client.calls[0].sql, /SET active=TRUE, deleted_at=NULL/);
  assert.match(client.calls[0].sql, /WHERE id=\$1 AND deleted_at IS NOT NULL/);
  assert.equal(await restoreTrashedMember(fakeClient([]), 7), null);
});

test('every message exists in both languages, and the English one has no Chinese left', () => {
  assert.ok(MEMBER_TRASH_TEXT_KEYS.length >= 10);
  const params = { name: 'Maria Santos', warning: 'WARN' };
  for (const key of MEMBER_TRASH_TEXT_KEYS) {
    const zh = memberTrashText(key, 'zh', params);
    const en = memberTrashText(key, 'en', params);
    assert.ok(zh && CJK.test(zh), `${key}: zh text`);
    assert.ok(en && !CJK.test(en.replaceAll('Maria Santos', '')), `${key}: en text must be fully English`);
  }
});

test('confirmation texts name the member and explain that nothing is lost', () => {
  assert.match(memberTrashText('confirmTrash', 'zh', { name: '王小明' }), /「王小明」.*已刪除帳號.*可以隨時還原/);
  assert.match(memberTrashText('confirmTrash', 'en', { name: 'Maria' }), /"Maria".*Deleted accounts.*restore it at any time/);
  assert.match(memberTrashText('purgePrompt', 'en', { name: 'Maria', warning: 'W' }), /cannot be undone.*\nW\n.*Type the member name "Maria"/s);
  assert.throws(() => memberTrashText('nope', 'zh'), /Unknown member trash text key/);
});

test('the English dictionary has no Chinese in its values', () => {
  for (const [zh, en] of Object.entries(MEMBER_TRASH_EN)) {
    assert.ok(CJK.test(zh), `key should be Chinese: ${zh}`);
    assert.ok(!CJK.test(en), `value should be English: ${zh}`);
  }
});

test('dictionary keys match the exact strings used by the server and the admin screen', async () => {
  const route = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
  const screen = await readFile(new URL('../src/components/HrManagement.jsx', import.meta.url), 'utf8');
  for (const key of Object.keys(MEMBER_TRASH_EN)) {
    const used = route.includes(key) || screen.includes(key);
    assert.ok(used, `"${key}" is translated but no longer used anywhere — update the dictionary or the code`);
  }
});

test('permanent deletion is only reachable with ?purge=1 and from the deleted list', async () => {
  const route = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
  assert.match(route, /url\.searchParams\.get\('purge'\)==='1'\|\|!target\.role/);
  assert.match(route, /if\(target\.role&&!target\.deleted_at\)/);
  const screen = await readFile(new URL('../src/components/HrManagement.jsx', import.meta.url), 'utf8');
  const deleteMember = screen.slice(screen.indexOf('async function deleteMember'), screen.indexOf('async function restoreMember'));
  assert.doesNotMatch(deleteMember, /purge=1/, 'the normal delete button must never purge');
  assert.match(screen, /window\.prompt\(memberTrashText\('purgePrompt'/);
});
