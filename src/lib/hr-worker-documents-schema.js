// 把「必要文件」從案件層搬到工人層的資料表建立／遷移。
// - 舊：hr_case_requirements（每個案件各一份 22 項清單）
// - 新：hr_worker_documents（每位工人一份）＋ hr_case_certifications（案件專屬的必備證照與取證進度）
// hr_document_submissions.requirement_id 欄位名稱沿用，現在指向 hr_worker_documents.id。
//
// 整個流程包在一個 transaction 裡，可重複執行（每次啟動都會跑，已遷移過就什麼都不做）。
import {
  ENTRY_GATE_DOCUMENTS, WORKER_DOCUMENT_NAMES, backfillWorkerDocuments, backfillCaseCertifications, syncWorkerDocuments,
} from './hr-requirements.js';

const STATUS_RANK = { approved: 3, submitted: 2, returned: 1, missing: 0 };

async function hasColumn(client, table, column) {
  const result = await client.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name=$2', [table, column]);
  return result.rows.length > 0;
}

// 同一位工人在多個案件各有一列同名文件 → 合併成一列，保留所有已上傳版本與審核紀錄。
async function mergeDuplicateDocuments(client) {
  const groups = await client.query(`SELECT worker_id,name FROM hr_worker_documents
    WHERE worker_id IS NOT NULL GROUP BY worker_id,name HAVING count(*)>1`);
  for (const group of groups.rows) {
    const rows = (await client.query(`SELECT d.id,d.status,d.updated_at,d.applicable,
        (SELECT max(s.created_at) FROM hr_document_submissions s WHERE s.requirement_id=d.id) AS latest_at
      FROM hr_worker_documents d WHERE d.worker_id=$1 AND d.name=$2`, [group.worker_id, group.name])).rows;
    rows.sort((a, b) => (b.latest_at ? 1 : 0) - (a.latest_at ? 1 : 0)
      || (b.latest_at ? new Date(b.latest_at) : 0) - (a.latest_at ? new Date(a.latest_at) : 0)
      || (STATUS_RANK[b.status] || 0) - (STATUS_RANK[a.status] || 0)
      || new Date(b.updated_at) - new Date(a.updated_at)
      || Number(b.id) - Number(a.id));
    const keep = rows[0].id;
    const others = rows.slice(1).map(row => row.id);
    // 任何一個案件曾把這份文件標為適用（例如仲介手動確認「曾在台灣工作」），合併後就保持適用，避免漏收文件。
    if (rows.some(row => row.applicable === true || row.applicable === 't')) {
      await client.query('UPDATE hr_worker_documents SET applicable=TRUE WHERE id=$1', [keep]);
    }
    // 先改成各自唯一的負數版本號，避免搬移時撞到 UNIQUE(requirement_id, version_number)，再依上傳時間重新編號。
    await client.query('UPDATE hr_document_submissions SET requirement_id=$1,version_number=-(id::int) WHERE requirement_id=ANY($2::bigint[]) OR (requirement_id=$1 AND version_number>0)',
      [keep, others]);
    await client.query(`UPDATE hr_document_submissions s SET version_number=r.rn FROM (
      SELECT id,ROW_NUMBER() OVER (ORDER BY created_at,id)::int AS rn FROM hr_document_submissions WHERE requirement_id=$1) r WHERE s.id=r.id`, [keep]);
    await client.query('DELETE FROM hr_worker_documents WHERE id=ANY($1::bigint[])', [others]);
  }
}

// 回傳 { migrated, affectedWorkerIds }：migrated 表示這次真的把舊資料搬過；
// affectedWorkerIds 是前置文件旗標被修正的工人，呼叫端要重算他們案件的階段。
export async function migrateWorkerDocuments(pool) {
  const client = await pool.connect();
  let migrated = false;
  const affected = new Set();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(727001)');

    await client.query(`DO $$ BEGIN
      IF to_regclass('hr_worker_documents') IS NULL AND to_regclass('hr_case_requirements') IS NOT NULL THEN
        ALTER TABLE hr_case_requirements RENAME TO hr_worker_documents;
      END IF; END $$`);
    await client.query(`CREATE TABLE IF NOT EXISTS hr_worker_documents (
      id BIGSERIAL PRIMARY KEY, worker_id BIGINT REFERENCES hr_workers(id) ON DELETE CASCADE,
      name TEXT NOT NULL, required BOOLEAN NOT NULL DEFAULT TRUE, entry_gate BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing','submitted','approved','returned')),
      review_reason TEXT NOT NULL DEFAULT '', applicability TEXT NOT NULL DEFAULT '', applicable BOOLEAN NOT NULL DEFAULT TRUE,
      applicability_source TEXT NOT NULL DEFAULT 'auto',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query('ALTER TABLE hr_worker_documents ADD COLUMN IF NOT EXISTS worker_id BIGINT REFERENCES hr_workers(id) ON DELETE CASCADE');
    await client.query("ALTER TABLE hr_worker_documents ADD COLUMN IF NOT EXISTS applicability TEXT NOT NULL DEFAULT ''");
    await client.query('ALTER TABLE hr_worker_documents ADD COLUMN IF NOT EXISTS applicable BOOLEAN NOT NULL DEFAULT TRUE');
    // 舊資料（由人工調整過的）一律視為 manual，不會被履歷自動覆寫。
    await client.query("ALTER TABLE hr_worker_documents ADD COLUMN IF NOT EXISTS applicability_source TEXT NOT NULL DEFAULT 'manual'");

    if (await hasColumn(client, 'hr_worker_documents', 'case_id')) {
      migrated = true;
      await client.query('UPDATE hr_worker_documents d SET worker_id=c.worker_id FROM hr_cases c WHERE c.id=d.case_id AND d.worker_id IS NULL');
      await client.query('DELETE FROM hr_worker_documents WHERE worker_id IS NULL');
      await mergeDuplicateDocuments(client);
      // 還停在預設狀態（條件式文件、不適用、未收件）的舊列，交給履歷自動判斷。
      await client.query("UPDATE hr_worker_documents SET applicability_source='auto' WHERE applicability<>'' AND applicable=FALSE AND status='missing' AND applicability_source='manual'");
      await client.query('ALTER TABLE hr_worker_documents DROP COLUMN case_id');
    }
    await client.query('ALTER TABLE hr_worker_documents ALTER COLUMN worker_id SET NOT NULL');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS hr_worker_documents_worker_name ON hr_worker_documents(worker_id,name)');
    await client.query('CREATE INDEX IF NOT EXISTS hr_worker_documents_worker ON hr_worker_documents(worker_id)');

    await client.query(`CREATE TABLE IF NOT EXISTS hr_case_certifications (
      id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','training','assessment','obtained')),
      target_date DATE, note TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(case_id,name)
    )`);

    // 舊版把改名前的文件名稱也處理掉（沿用原本 ensureSchema 的改名動作）。
    await client.query("UPDATE hr_worker_documents SET name='新護照' WHERE name='護照資料頁' AND NOT EXISTS (SELECT 1 FROM hr_worker_documents o WHERE o.worker_id=hr_worker_documents.worker_id AND o.name='新護照')");
    await client.query("UPDATE hr_worker_documents SET name='PSA出生證明（附收據）' WHERE name='PSA 出生證明' AND NOT EXISTS (SELECT 1 FROM hr_worker_documents o WHERE o.worker_id=hr_worker_documents.worker_id AND o.name='PSA出生證明（附收據）')");

    await backfillWorkerDocuments(client);
    if (migrated) {
      const workers = await client.query('SELECT id FROM hr_workers');
      for (const row of workers.rows) await syncWorkerDocuments(client, row.id);
    }

    // 前置文件只有「新護照」與「PSA出生證明（附收據）」。舊版把所有無條件文件（含體檢 Medical）都設成前置。
    const fixed = await client.query(`UPDATE hr_worker_documents SET entry_gate=(required AND applicable AND name=ANY($1::text[])),updated_at=NOW()
      WHERE name=ANY($2::text[]) AND entry_gate IS DISTINCT FROM (required AND applicable AND name=ANY($1::text[])) RETURNING worker_id`,
    [ENTRY_GATE_DOCUMENTS, WORKER_DOCUMENT_NAMES]);
    fixed.rows.forEach(row => affected.add(Number(row.worker_id)));

    await backfillCaseCertifications(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { migrated, affectedWorkerIds: [...affected] };
}
