import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

// Windows PowerShell 預設用 ANSI 讀檔，SQL 腳本裡的中文會變成 ?? 並吃掉後面的引號，讓 SQL 斷掉。
// 所以要給人手動執行的資料轉換腳本（scripts/migrate-*.sql）只能有 ASCII 字元，中文請用 U&'\XXXX' 寫。
test('scripts/migrate-*.sql 只能有 ASCII 字元', async () => {
  const dir = new URL('../scripts/', import.meta.url);
  for (const name of (await readdir(dir)).filter(file => file.startsWith('migrate-') && file.endsWith('.sql'))) {
    const text = await readFile(new URL(name, dir), 'utf8');
    const bad = [...text].find(char => char.charCodeAt(0) > 127);
    assert.equal(bad, undefined, `${name} 有非 ASCII 字元「${bad}」`);
  }
});

test('膚色腳本：棕＝U+68D5、黃＝U+9EC3', async () => {
  const sql = await readFile(new URL('../scripts/migrate-skin-complexion-brown.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes("to_jsonb(U&'\\68D5'::text)") && sql.includes("IN (U&'\\9EC3', 'Yellow', 'yellow')"));
  assert.equal(String.fromCodePoint(0x68D5), '棕');
  assert.equal(String.fromCodePoint(0x9EC3), '黃');
});
