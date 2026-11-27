import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 操作紀錄的寫法（中文摘要、LINE ID、失敗只記錄）改由 tests/hr-admin-audit-core.test.mjs 實際產生欄位來驗證。
const bot = await readFile(new URL('../src/lib/hr-line-bot.js', import.meta.url), 'utf8');

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

test('LINE 機器人的操作紀錄用中文類型名稱組出敘述', () => {
  assert.match(bot, /phrase: phrase\(AUDIT_TYPE_LABELS\[type\]\)/);
});
