// 備份／還原腳本共用的小工具（沒有任何副作用，方便測試）。

// 讀 .env 的簡單 KEY=VALUE（忽略註解與空行，去掉成對的引號）。
export function parseEnvFile(text = '') {
  const result = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

// 資料庫帳號與名稱：環境變數 > .env > docker-compose.yml 的預設值。
export function resolveDbConfig(env = {}, envFileText = '') {
  const file = parseEnvFile(envFileText);
  return {
    user: env.POSTGRES_USER || file.POSTGRES_USER || 'postgres',
    db: env.POSTGRES_DB || file.POSTGRES_DB || 'saas_demo',
  };
}

// 資料庫名稱只允許小寫英數與底線，避免被拿去組出奇怪的 SQL。
export function isSafeDbName(name) {
  return typeof name === 'string' && /^[a-z][a-z0-9_]{0,62}$/.test(name);
}

const pad = value => String(value).padStart(2, '0');

// 例如 saas_demo_20261116-030000.dump（使用執行這台電腦的本地時間）。
export function backupFileName(db, date = new Date()) {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${db}_${day}-${time}.dump`;
}

// 只保留最新的 keep 份備份，回傳該刪除的檔名。不是備份檔格式的檔案一律不碰。
export function backupsToPrune(names, db, keep) {
  const keepCount = Math.max(1, Math.floor(Number(keep)) || 1);
  const pattern = new RegExp(`^${db.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d{8}-\\d{6}\\.dump$`);
  const backups = names.filter(name => pattern.test(name)).sort();
  return backups.slice(0, Math.max(0, backups.length - keepCount));
}

// 找出可用的 compose 指令：新版 `docker compose`，沒有的話退回舊版 `docker-compose`。
// probe(commandArray) 要回傳這個指令能不能執行成功。
export function detectCompose(probe, override = '') {
  if (override.trim()) return override.trim().split(/\s+/);
  if (probe(['docker', 'compose', 'version'])) return ['docker', 'compose'];
  if (probe(['docker-compose', 'version'])) return ['docker-compose'];
  return null;
}
