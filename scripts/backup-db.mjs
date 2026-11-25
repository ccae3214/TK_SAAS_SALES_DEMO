#!/usr/bin/env node
// 備份 PostgreSQL 資料庫（HR 資料及選填的 DEMO/NOTE 隔離資料庫）。
//
//   npm run db:backup                     備份到專案資料夾的 backups\
//   npm run db:backup -- --keep 30        保留最新 30 份（預設 14 份）
//   npm run db:backup -- --out D:\backup  改存到其他資料夾
//
// 用 Node 寫是為了 Windows PowerShell 也能安全使用：PowerShell 的 ">" 會把二進位檔案轉壞，
// 這裡改成直接把 pg_dump 的輸出串流寫進檔案。備份完成後會用 pg_restore --list 驗證檔案可以讀取，
// 驗證失敗或中途出錯都不會留下半成品，也不會刪掉舊備份。
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { backupFileName, backupsToPrune, detectCompose, isSafeDbName, parseEnvFile, resolveDbConfig } from './db-backup-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = { out: path.join(root, 'backups'), keep: 14 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') options.out = path.resolve(argv[++index] || '');
    else if (arg === '--keep') options.keep = Number(argv[++index]);
    else throw new Error(`不認得的參數：${arg}（可用：--out <資料夾>、--keep <份數>）`);
  }
  if (!Number.isInteger(options.keep) || options.keep < 1) throw new Error('--keep 必須是 1 以上的整數。');
  return options;
}

const probe = command => spawnSync(command[0], command.slice(1), { cwd: root, stdio: 'ignore' }).status === 0;

// 把指令的 stdout 串流寫進檔案；指令失敗（結束碼不是 0）就丟出錯誤。
async function runToFile(command, file) {
  const child = spawn(command[0], command.slice(1), { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  const output = createWriteStream(file);
  child.stdout.pipe(output);
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command.join(' ')} 失敗（結束碼 ${code}）`))));
  });
  const written = new Promise((resolve, reject) => { output.on('finish', resolve); output.on('error', reject); });
  await Promise.all([exited, written]);
}

// 把檔案餵給指令的 stdin（用來跑 pg_restore --list 驗證備份檔）。
async function runWithFileInput(command, file) {
  const child = spawn(command[0], command.slice(1), { cwd: root, stdio: ['pipe', 'ignore', 'inherit'] });
  child.stdin.on('error', () => {});
  createReadStream(file).pipe(child.stdin);
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error('備份檔驗證失敗：pg_restore 讀不出這份備份。'))));
  });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const envFile = existsSync(path.join(root, '.env')) ? await readFile(path.join(root, '.env'), 'utf8') : '';
  const { user, db } = resolveDbConfig(process.env, envFile);
  const fileEnv = parseEnvFile(envFile);
  const demoNotesDb = process.env.DEMO_NOTES_DATABASE_NAME || fileEnv.DEMO_NOTES_DATABASE_NAME;
  const databases = [...new Set([db, demoNotesDb].filter(Boolean))];
  if (databases.some(database => !isSafeDbName(database))) throw new Error('資料庫名稱只允許小寫英數與底線。');
  const compose = detectCompose(probe, process.env.DOCKER_COMPOSE_CMD || '');
  if (!compose) throw new Error('找不到 docker compose。請確認 Docker Desktop 已啟動。');

  await mkdir(options.out, { recursive: true });
  for (const database of databases) {
    const finalPath = path.join(options.out, backupFileName(database));
    const partialPath = `${finalPath}.partial`;
    try {
      console.log(`備份資料庫 ${database} …`);
      await runToFile([...compose, 'exec', '-T', 'postgres', 'pg_dump', '-U', user, '-d', database, '-Fc'], partialPath);
      const { size } = await stat(partialPath);
      if (size === 0) throw new Error('備份檔是空的，備份失敗。');
      await runWithFileInput([...compose, 'exec', '-T', 'postgres', 'pg_restore', '--list'], partialPath);
      await rename(partialPath, finalPath);
      console.log(`備份完成：${finalPath}（${(size / 1024 / 1024).toFixed(2)} MB）`);
    } catch (error) {
      await rm(partialPath, { force: true });
      throw error;
    }
  }

  // 新備份確定成功之後，才清掉超過保留份數的舊備份。
  const names = await readdir(options.out);
  for (const database of databases) {
    const stale = backupsToPrune(names, database, options.keep);
    for (const name of stale) await rm(path.join(options.out, name), { force: true });
    if (stale.length) console.log(`資料庫 ${database} 已清除 ${stale.length} 份舊備份（保留最新 ${options.keep} 份）。`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`備份失敗：${error.message}`);
    process.exit(1);
  });
}
