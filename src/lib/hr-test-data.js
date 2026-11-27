// 測試資料標記（is_test）。
// 測試階段的假資料和真實資料放在同一個資料庫；先標記起來，上線前才找得到、清得乾淨。
// 這裡只負責「標記」，不提供刪除：要清掉哪些資料由使用者決定（清單見 scripts/report-test-data.sql）。
import { migrateOnce } from './migrate-once.js';

// 前端傳的 target → 資料表
export const TEST_FLAG_TABLES = { worker: 'hr_workers', employer: 'hr_employers', agency: 'hr_agencies', member: 'hr_members' };

export async function addTestFlagColumns(db) {
  for (const table of Object.values(TEST_FLAG_TABLES)) {
    if (!(await db.query('SELECT to_regclass($1) AS t', [`public.${table}`])).rows[0]?.t) continue;
    // 常數預設值：PostgreSQL 11 之後加欄位不會重寫整張表，既有資料都是 FALSE。
    await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.query(`CREATE INDEX IF NOT EXISTS ${table}_is_test_idx ON ${table}(id) WHERE is_test`);
  }
}

export function ensureTestDataFlagSchema(db) {
  return migrateOnce('test-data-flag', () => addTestFlagColumns(db));
}

// 驗證 PATCH { type:'test-flag', target, id, isTest }；回傳 { table, id, isTest } 或 { error }。
export function parseTestFlagRequest(body) {
  const table = TEST_FLAG_TABLES[body?.target];
  const id = Number(body?.id);
  if (!table) return { error: '標記對象不正確。' };
  if (!Number.isSafeInteger(id) || id <= 0) return { error: '資料編號不正確。' };
  if (typeof body.isTest !== 'boolean') return { error: '請指定是否為測試資料。' };
  return { table, id, isTest: body.isTest };
}
