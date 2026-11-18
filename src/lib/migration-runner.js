// 啟動遷移的通用執行器：用 PostgreSQL advisory lock 排隊，依序執行各步驟，連線失敗時重試。
// 不依賴專案內其他模組，方便單獨測試；實際的步驟清單在 hr-migrations.js。
export const MIGRATION_LOCK_KEY = 727402; // 任意固定整數；和 hr-access.js 裡 trigger 用的 727401 錯開

async function runOnce({ db, steps, log }) {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    const started = Date.now();
    for (const [name, run] of steps) {
      const at = Date.now();
      await run();
      log.log(JSON.stringify({ event: 'hr_migration_step', step: name, ms: Date.now() - at }));
    }
    log.log(JSON.stringify({ event: 'hr_migrations_done', ms: Date.now() - started }));
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]); } catch { /* 連線關閉時鎖會自動釋放 */ }
    client.release();
  }
}

export async function runMigrationSteps({ db, steps, attempts = 5, delayMs = 3000, log = console }) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { await runOnce({ db, steps, log }); return true; }
    catch (error) {
      log.error(JSON.stringify({ event: 'hr_migration_failed', attempt, attempts, code: error?.code || error?.name || 'Error', message: error?.message || '' }));
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
