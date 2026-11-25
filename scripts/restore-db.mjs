#!/usr/bin/env node
// 把備份檔還原到一個「暫時資料庫」（預設 restore_tmp），讓你可以查看、找回被誤刪的資料。
// 不會碰到正在使用的正式資料庫。
//
//   npm run db:restore -- backups\kolecion_db_20261126-045932.dump
//   npm run db:restore -- backups\xxx.dump --db restore_0501
//
// 還原完成後可以這樣查看：
//   docker compose exec postgres psql -U postgres -d restore_tmp
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detectCompose, isSafeDbName, resolveDbConfig } from './db-backup-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const probe = command => spawnSync(command[0], command.slice(1), { cwd: root, stdio: 'ignore' }).status === 0;

function parseArgs(argv) {
  const options = { file: '', db: 'restore_tmp' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db') options.db = argv[++index] || '';
    else if (arg.startsWith('--')) throw new Error(`不認得的參數：${arg}（可用：--db <暫時資料庫名稱>）`);
    else if (!options.file) options.file = arg;
    else throw new Error('只能指定一個備份檔。');
  }
  if (!options.file) throw new Error('請指定備份檔，例如：npm run db:restore -- backups\\kolecion_db_20261126-045932.dump');
  return options;
}

function run(command, inputFile) {
  const child = spawn(command[0], command.slice(1), { cwd: root, stdio: [inputFile ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  if (inputFile) {
    child.stdin.on('error', () => {});
    createReadStream(inputFile).pipe(child.stdin);
  }
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command.slice(0, 4).join(' ')} … 失敗（結束碼 ${code}）`))));
  });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const envFile = existsSync(path.join(root, '.env')) ? await readFile(path.join(root, '.env'), 'utf8') : '';
  const { user, db: liveDb } = resolveDbConfig(process.env, envFile);
  const file = path.resolve(options.file);
  if (!existsSync(file)) throw new Error(`找不到備份檔：${file}`);
  if (!isSafeDbName(options.db)) throw new Error('暫時資料庫名稱只能用小寫英文、數字與底線，並以英文字母開頭。');
  if (options.db === liveDb || ['postgres', 'template0', 'template1'].includes(options.db)) {
    throw new Error(`不能還原到 ${options.db}：這個腳本只還原到暫時資料庫，避免蓋掉正在使用的資料。`);
  }
  const compose = detectCompose(probe, process.env.DOCKER_COMPOSE_CMD || '');
  if (!compose) throw new Error('找不到 docker compose。請確認 Docker Desktop 已啟動。');

  const psql = sql => [...compose, 'exec', '-T', 'postgres', 'psql', '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql];
  console.log(`還原 ${path.basename(file)} → 暫時資料庫 ${options.db} …`);
  await run(psql(`DROP DATABASE IF EXISTS ${options.db}`));
  await run(psql(`CREATE DATABASE ${options.db}`));
  await run([...compose, 'exec', '-T', 'postgres', 'pg_restore', '-U', user, '-d', options.db, '--no-owner', '--no-privileges', '--exit-on-error'], file);
  console.log(`\n還原完成。正式資料庫 ${liveDb} 完全沒有被更動。`);
  console.log(`查看資料：docker compose exec postgres psql -U ${user} -d ${options.db}`);
  console.log(`用完後可以刪除：docker compose exec postgres psql -U ${user} -d postgres -c "DROP DATABASE ${options.db}"`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`還原失敗：${error.message}`);
    process.exit(1);
  });
}
