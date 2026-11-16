import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bot = await readFile(new URL('../src/lib/hr-line-bot.js', import.meta.url), 'utf8');
const audit = await readFile(new URL('../src/lib/hr-audit.js', import.meta.url), 'utf8');

test('LINE 管理者的新增、編輯、停用都會寫入系統管理員操作紀錄', () => {
  assert.match(bot, /import \{ recordLineAdminAction \} from '@\/lib\/hr-audit';/);
  // 停用：先取名字再停用，成功才記錄
  assert.match(bot, /const result = await deactivateAdminRecord\(type, Number\(id\)\);\s*if \(result\) await auditLineAdmin\(principal, lineUserId, \{ action: '停用'/);
  // 編輯：更新成功後記錄；狀態欄位記為啟用／停用，其他記為編輯
  assert.match(bot, /\['status', 'active'\]\.includes\(session\.key\) \? parseAdminActive\(value\) : null/);
  assert.match(bot, /action: '編輯', type: session\.type, id: session\.id/);
  // 新增：成功建立後記錄
  assert.match(bot, /action: '新增', type: session\.type, id: created\[0\]\.id, name: createdName/);
});

test('操作紀錄一律用中文寫入，且記錄失敗不會影響原本的操作', () => {
  assert.match(bot, /phrase: phrase\(AUDIT_TYPE_LABELS\[type\]\)/);
  assert.match(audit, /export async function recordLineAdminAction/);
  assert.match(audit, /透過 LINE 機器人\$\{phrase\}\$\{lineSuffix\}/);
  assert.match(audit, /catch \(error\) \{ console\.error\('hr_audit_write_failed'/);
});

test('沒有會員資料列的管理者（.env 設定）改記 LINE ID，不寫成「LINE 會員」', () => {
  assert.match(audit, /\(principal\?\.id && principal\?\.name\) \|\| 'LINE 管理者'/);
  assert.match(audit, /LINE ID：/);
});
