import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WORKER_DOCUMENTS, WORKER_DOCUMENT_KEYS, WORKER_DOCUMENT_TYPES } from '../src/lib/hr-requirements.js';
import { MEDICAL_STATUSES, TRAINING_STATUSES } from '../src/lib/hr-worker-progress.js';
import { ARCHIVED_TABLES, FOREIGN_KEY_INDEXES, STATUS_CHECKS, normalizeSchema } from '../src/lib/hr-schema-normalize.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('每種文件都有固定代碼，代碼不重複且只用小寫英數字與底線', () => {
  const keys = WORKER_DOCUMENTS.map(([name]) => WORKER_DOCUMENT_KEYS[name]);
  assert.ok(keys.every(Boolean), 'missing key');
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every(key => /^[a-z0-9_]+$/.test(key)));
  assert.equal(Object.keys(WORKER_DOCUMENT_KEYS).length, WORKER_DOCUMENTS.length);
  assert.deepEqual(WORKER_DOCUMENT_TYPES.find(type => type.key === 'visa'), { key: 'visa', name: '簽證 Visa', applicability: '', required: false, sortOrder: 24 });
  assert.equal(WORKER_DOCUMENT_TYPES.find(type => type.key === 'arc').applicability, '曾在台灣工作者');
});

test('狀態約束與程式允許的值一致（程式能寫入的值都不會被擋）', () => {
  const byName = Object.fromEntries(STATUS_CHECKS.map(([, name, condition]) => [name, condition]));
  for (const status of MEDICAL_STATUSES) {
    assert.match(byName.hr_cases_medical_status_check, new RegExp(`'${status}'`));
    assert.match(byName.hr_worker_health_training_medical_status_check, new RegExp(`'${status}'`));
  }
  for (const status of TRAINING_STATUSES) {
    assert.match(byName.hr_cases_training_status_check, new RegExp(`'${status}'`));
    assert.match(byName.hr_worker_health_training_training_status_check, new RegExp(`'${status}'`));
  }
  for (const type of ['home_care', 'factory', 'domestic_helper', 'nursing_home', 'other']) assert.match(byName.hr_employers_employer_type_check, new RegExp(`'${type}'`));
  assert.equal(byName.hr_worker_documents_applicability_source_check, "applicability_source IN ('auto','manual')");
});

test('外鍵索引清單沒有重複，也不含已移除的 assigned_staff_id', () => {
  const names = FOREIGN_KEY_INDEXES.map(([table, column]) => `${table}.${column}`);
  assert.equal(new Set(names).size, names.length);
  assert.ok(!names.includes('hr_cases.assigned_staff_id'));
  assert.deepEqual(ARCHIVED_TABLES, ['hr_case_requirements', 'hr_staff', 'schema_migrations']);
});

// 假的資料庫：只回答整理流程會問的問題，並記下執行過的 SQL。
function fakePool({ staffRefs = 0 } = {}) {
  const sql = [];
  const tables = new Set(['public.hr_case_requirements', 'public.hr_staff', 'public.schema_migrations', 'public.hr_worker_documents',
    'public.hr_employers', 'public.hr_cases', 'public.hr_worker_health_training']);
  let hasStaffColumn = true;
  const client = {
    async query(text, params = []) {
      sql.push(text);
      if (/FROM pg_tables WHERE schemaname=\$1 AND tablename=\$2/.test(text)) return { rows: tables.has(`${params[0]}.${params[1]}`) ? [{}] : [] };
      if (/information_schema\.columns/.test(text)) {
        if (params[0] === 'hr_cases' && params[1] === 'assigned_staff_id') return { rows: hasStaffColumn ? [{}] : [] };
        return { rows: [{}] };
      }
      if (/count\(\*\)::int AS n FROM hr_cases WHERE assigned_staff_id IS NOT NULL/.test(text)) return { rows: [{ n: staffRefs }] };
      if (/DROP COLUMN assigned_staff_id/.test(text)) { hasStaffColumn = false; return { rows: [] }; }
      const move = /ALTER TABLE public\.(\w+) SET SCHEMA hr_archive/.exec(text);
      if (move) { tables.delete(`public.${move[1]}`); tables.add(`hr_archive.${move[1]}`); return { rows: [] }; }
      if (/pg_get_serial_sequence/.test(text)) return { rows: [{ name: 'public.hr_worker_documents_id_seq' }] };
      if (/SELECT convalidated/.test(text)) return { rows: [{ convalidated: true }] };
      if (/FROM pg_constraint|FROM pg_class/.test(text)) return { rows: [{}] };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  return { connect: async () => client, sql };
}

test('整理流程：舊表用 SET SCHEMA 封存（不刪資料），全程在 transaction 裡', async () => {
  const pool = fakePool();
  const log = await normalizeSchema(pool);
  assert.ok(log.includes('archived:hr_case_requirements') && log.includes('archived:hr_staff') && log.includes('archived:schema_migrations'));
  assert.equal(pool.sql[0], 'BEGIN');
  assert.equal(pool.sql.at(-1), 'COMMIT');
  assert.ok(!pool.sql.some(text => /DROP TABLE|TRUNCATE|DELETE FROM/i.test(text)), 'must not delete data');
});

test('還有案件指向 hr_staff 時：不移除欄位、也不封存 hr_staff', async () => {
  const pool = fakePool({ staffRefs: 2 });
  const log = await normalizeSchema(pool);
  assert.ok(log.includes('keep_hr_staff:2_cases'));
  assert.ok(!log.includes('archived:hr_staff'));
  assert.ok(!pool.sql.some(text => /DROP COLUMN assigned_staff_id/.test(text)));
});

test('接線：啟動遷移最後才跑整理；hr-schema.js 不再建立 hr_staff', async () => {
  const [migrations, schema] = await Promise.all([read('../src/lib/hr-migrations.js'), read('../src/lib/hr-schema.js')]);
  const steps = [...migrations.matchAll(/\['([\w-]+)', \(\) =>/g)].map(match => match[1]);
  assert.equal(steps.at(-1), 'schema-normalize');
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS hr_staff/);
  assert.doesNotMatch(schema, /assigned_staff_id/);
});
