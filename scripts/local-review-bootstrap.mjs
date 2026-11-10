// Explicitly authorized, isolated fictional local review database only.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { hashPassword } from '../src/lib/passwords.js';
import { migrateWorkerDocuments } from '../src/lib/hr-worker-documents-schema.js';
const require = createRequire('/app/package.json');
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (process.env.LOCAL_REVIEW_ONLY !== '1' || url.hostname !== 'review-postgres' || url.pathname !== '/tk_saas_review' || !process.env.REVIEW_LOGIN_PASSWORD) {
  throw new Error('Refusing non-review database or missing review password');
}
const pool = new Pool({ connectionString: url.toString(), ssl: false });
try {
  const existing = await pool.query("SELECT to_regclass('public.hr_members') AS name");
  if (existing.rows[0].name) {
    const members = await pool.query('SELECT count(*)::int AS count FROM hr_members');
    if (members.rows[0].count > 0) throw new Error('Review database already has members; refusing to reseed or reset passwords');
  }
  const accessSource = (await readFile(new URL('../src/lib/hr-access.js', import.meta.url), 'utf8')).replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
  const makeAccess = vm.runInNewContext(`(function(pool,get){${accessSource};return {ensureHrIdentitySchema};})`, { process: { env: process.env } });
  const get = async (sql, args) => (await pool.query(sql, args)).rows[0] || null;
  const { ensureHrIdentitySchema } = makeAccess(pool, get);
  const source = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
  // Execute the exact checked-out schema initializer, not a second divergent schema.
  const section = (start, end) => {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    if (from < 0 || to <= from) throw new Error('Schema extraction markers changed; refusing incomplete initializer');
    return source.slice(from, to);
  };
  const constants = section('const CASE_STATUSES', 'export async function ensureSchema');
  const initializer = section('export async function ensureSchema', '\nconst clean =').replace('export async function', 'async function');
  const stageRefresh = section('async function refreshCaseStage(', '\n// 工人的文件有變動時');
  const runQuery = async (sql, args) => (await pool.query(sql, args)).rows;
  const makeSchema = vm.runInNewContext(`(function(pool,ensureHrIdentitySchema,migrateWorkerDocuments,query){${constants}\n${initializer}\n${stageRefresh};return ensureSchema;})`, { Date });
  await makeSchema(pool, ensureHrIdentitySchema, migrateWorkerDocuments, runQuery)();
  const seed = spawnSync(process.execPath, [new URL('./seed-hr-role-tests.js', import.meta.url).pathname], {
    env: { ...process.env, PG_MODULE_PATH: '/app/node_modules/pg/lib/index.js' }, encoding: 'utf8',
  });
  // The existing seed prints a fixed password; do not relay its stdout.
  if (seed.status !== 0) throw new Error(`Fictional seed failed: ${seed.stderr}`);
  const hash = await hashPassword(process.env.REVIEW_LOGIN_PASSWORD);
  await pool.query("UPDATE hr_members SET password_hash=$1 WHERE email LIKE 'test.%@example.com'", [hash]);
  for (const [email, name] of [['review.admin@example.invalid', '本機測試管理者'], ['review.new@example.invalid', '待申請的新會員']]) {
    await pool.query(`INSERT INTO hr_members(email,display_name,password_hash,role,active)
      VALUES($1,$2,$3,NULL,TRUE) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash`, [email, name, hash]);
  }
  const counts = await pool.query('SELECT role, count(*)::int AS count FROM hr_members GROUP BY role ORDER BY role NULLS FIRST');
  console.log(JSON.stringify({ scope: 'isolated-fictional-local-review-only', members: counts.rows }));
} finally { await pool.end(); }
