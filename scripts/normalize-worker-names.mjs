// One-off cleanup: rewrite existing worker names to "姓氏 / 名字 / 中間名".
//
//   DATABASE_URL=postgresql://... node scripts/normalize-worker-names.mjs           # dry run, changes nothing
//   DATABASE_URL=postgresql://... node scripts/normalize-worker-names.mjs --apply   # write inside one transaction
//
// Also updates the linked member's display_name, but only when it still equals the old worker name.
// Names that cannot be split (a single word, e.g. 王小明) are left unchanged. Safe to run more than once.
import pg from 'pg';
import { normalizePersonName } from '../src/lib/person-name.js';

const apply = process.argv.includes('--apply');
if (!process.env.DATABASE_URL) { console.error('請先設定 DATABASE_URL。'); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query('SELECT id, name FROM hr_workers ORDER BY id FOR UPDATE');
  const changes = rows
    .map(row => ({ id: row.id, before: row.name, after: normalizePersonName(row.name) }))
    .filter(row => row.after && row.after !== row.before);
  let memberChanges = 0;
  for (const change of changes) {
    console.log(`#${change.id}: ${change.before}  ->  ${change.after}`);
    if (!apply) continue;
    await client.query('UPDATE hr_workers SET name=$2, updated_at=NOW() WHERE id=$1', [change.id, change.after]);
    const member = await client.query('UPDATE hr_members SET display_name=$3, updated_at=NOW() WHERE worker_id=$1 AND display_name=$2', [change.id, change.before, change.after]);
    memberChanges += member.rowCount;
  }
  if (apply) {
    await client.query('COMMIT');
    console.log(`已更新 ${changes.length} 位工人、${memberChanges} 個綁定會員的顯示名稱（共 ${rows.length} 位工人）。`);
  } else {
    await client.query('ROLLBACK');
    console.log(`預覽：${changes.length} / ${rows.length} 位工人會被更新。確認無誤後加上 --apply 才會寫入。`);
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('失敗，已全部回復：', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
