// 資料表遷移（CREATE／ALTER）只跑一次：同一個 key 在整個 Node 行程只會執行一次，失敗時會清掉記錄，下次再試。
// 記錄放在 globalThis，而不是模組變數：Next.js 會把啟動程式（instrumentation）和各個 API 路由分開打包，
// 模組變數不會共用，用 globalThis 才能讓「啟動時跑過的遷移」被請求路徑看見而不再重跑。
const registry = (globalThis.__hrMigrationJobs ||= new Map());

export function migrateOnce(key, run) {
  let job = registry.get(key);
  if (!job) {
    job = Promise.resolve().then(run).catch(error => { registry.delete(key); throw error; });
    registry.set(key, job);
  }
  return job;
}

// 測試用：清掉記錄。
export function resetMigrationJobs() { registry.clear(); }
