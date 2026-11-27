// 訓練中心改成獨立的資料表（hr_training_centers）。
//
// 以前「訓練中心」就是 hr_members 裡 role='training_center' 的一個會員帳號，所有 hr_tc_* 資料的 center_id 都指向那個帳號，
// 而且是 ON DELETE CASCADE：永久刪除那個帳號，整個中心的證照、老師、課程、單元、班別都會跟著被刪掉。
//
// 現在：
// - hr_training_centers.id 沿用原本中心帳號的會員編號，所以既有的 center_id 值一個都不用改。
// - hr_tc_* 的 center_id 改成指向 hr_training_centers（ON DELETE RESTRICT），hr_members.training_center_id（成員所屬中心）也一樣。
//   刪除中心帳號不會再連帶刪掉中心資料；owner_member_id 會變成 NULL，中心資料與成員都保留。
// - 會員成為訓練中心（role='training_center' 且不屬於其他中心）時，資料庫 trigger 會自動建立中心資料列，程式的寫入方式不用改。
// - 聊天室（hr_chat_rooms.center_id）暫時維持原樣。
//
// 不刪、不改任何既有資料；可重複執行；整個流程在一個 transaction 裡。
import { migrateOnce } from './migrate-once.js';

export const CENTER_DATA_TABLES = ['hr_tc_certifications', 'hr_tc_teachers', 'hr_tc_courses', 'hr_tc_classes', 'hr_tc_course_units'];

export const CREATE_CENTERS_SQL = `CREATE TABLE IF NOT EXISTS hr_training_centers (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  owner_member_id BIGINT UNIQUE REFERENCES hr_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

// 中心帳號本人，以及任何已經被當成中心使用的編號（hr_tc_* 的 center_id、成員的 training_center_id），都建立中心資料列。
export const BACKFILL_CENTERS_SQL = `INSERT INTO hr_training_centers(id,name,owner_member_id)
  SELECT ids.id, COALESCE(m.display_name,''), m.id
  FROM (
    SELECT id FROM hr_members WHERE role='training_center' AND training_center_id IS NULL
    UNION SELECT training_center_id FROM hr_members WHERE training_center_id IS NOT NULL
    ${CENTER_DATA_TABLES.map(table => `UNION SELECT center_id FROM ${table}`).join('\n    ')}
  ) ids LEFT JOIN hr_members m ON m.id=ids.id
  WHERE ids.id IS NOT NULL
  ON CONFLICT (id) DO NOTHING`;

export const CENTER_TRIGGER_SQL = [
  `CREATE OR REPLACE FUNCTION hr_ensure_training_center() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.role = 'training_center' AND NEW.training_center_id IS NULL THEN
        INSERT INTO hr_training_centers(id,name,owner_member_id) VALUES (NEW.id, NEW.display_name, NEW.id)
        ON CONFLICT (id) DO UPDATE SET owner_member_id=EXCLUDED.owner_member_id, name=EXCLUDED.name, updated_at=NOW()
          WHERE hr_training_centers.owner_member_id IS DISTINCT FROM EXCLUDED.owner_member_id OR hr_training_centers.name IS DISTINCT FROM EXCLUDED.name;
      END IF;
      RETURN NULL;
    END; $$`,
  'DROP TRIGGER IF EXISTS hr_members_ensure_training_center ON hr_members',
  `CREATE TRIGGER hr_members_ensure_training_center AFTER INSERT OR UPDATE OF role,training_center_id,display_name ON hr_members
    FOR EACH ROW EXECUTE FUNCTION hr_ensure_training_center()`,
];

// [資料表, 約束名稱, ON DELETE]：約束名稱沿用原本的，指向的表改成 hr_training_centers。
export const REPOINTED_FOREIGN_KEYS = [
  ...CENTER_DATA_TABLES.map(table => [table, `${table}_center_id_fkey`, 'center_id', 'RESTRICT']),
  ['hr_members', 'hr_members_training_center_id_fkey', 'training_center_id', 'SET NULL'],
];

const referencedTable = async (client, table, name) => (await client.query(
  "SELECT confrelid::regclass::text AS ref FROM pg_constraint WHERE conrelid=to_regclass('public.'||$1) AND conname=$2", [table, name])).rows[0]?.ref || null;

export async function migrateTrainingCenterEntity(pool) {
  const client = await pool.connect();
  const log = [];
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(727004)');
    for (const table of ['hr_members', ...CENTER_DATA_TABLES]) {
      if (!(await client.query('SELECT to_regclass($1) AS t', [`public.${table}`])).rows[0]?.t) { await client.query('ROLLBACK'); return ['skipped:missing_tables']; }
    }
    await client.query(CREATE_CENTERS_SQL);
    const filled = await client.query(BACKFILL_CENTERS_SQL);
    if (filled.rowCount) log.push(`centers_backfilled:${filled.rowCount}`);
    for (const sql of CENTER_TRIGGER_SQL) await client.query(sql);
    for (const [table, name, column, onDelete] of REPOINTED_FOREIGN_KEYS) {
      const ref = await referencedTable(client, table, name);
      if (ref === 'hr_training_centers') continue;
      if (ref) await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${name}`);
      await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${column}) REFERENCES hr_training_centers(id) ON DELETE ${onDelete}`);
      log.push(`repointed:${name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
  if (log.length) console.info('hr_training_center_entity', log.join(' '));
  return log;
}

export function ensureTrainingCenterEntitySchema(pool) {
  return migrateOnce('training-center-entity', () => migrateTrainingCenterEntity(pool));
}
