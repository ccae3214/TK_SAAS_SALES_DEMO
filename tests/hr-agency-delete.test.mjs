import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('只有系統管理者能刪除仲介機構，且有關聯資料時拒絕刪除', async () => {
  const route = await read('../src/app/api/hr/route.js');
  assert.match(route, /\['employer','worker','case','agency'\]\.includes\(deleteType\)/);
  assert.match(route, /principal\.role!=='admin'\)return NextResponse\.json\(\{error:'僅系統管理者可刪除雇主、工作者、案件與仲介機構。'/);
  for (const table of ['hr_members WHERE agency_id', 'hr_members WHERE requested_agency_id', 'hr_workers WHERE agency_id', 'hr_employers WHERE agency_id', 'hr_job_order_agencies WHERE taiwan_agency_id', 'hr_job_order_routes WHERE philippines_agency_id']) {
    assert.ok(route.includes(table), `刪除前要檢查 ${table}`);
  }
  assert.match(route, /DELETE FROM hr_agencies WHERE id=\$1/);
});

test('仲介機構刪除會寫入操作紀錄，並只在管理者介面顯示刪除按鈕', async () => {
  const { describeAdminOperation } = await import('../src/lib/hr-admin-audit-core.js');
  assert.deepEqual(describeAdminOperation('DELETE', 'agency', {}, '甲仲介', null, null), { action: '刪除', name: '甲仲介', phrase: '刪除了甲仲介仲介機構' });
  assert.match(await read('../src/components/HrManagement.jsx'), /remove=\{data\.role==='admin'\?record=>deleteRecord\('agency',record\):undefined\}/);
  assert.match(await read('../src/components/HrAgencyDirectory.jsx'), /\{remove && <button/);
});

test('刪除仲介機構的訊息都有英文翻譯', async () => {
  const en = await read('../src/lib/hr-translations-employer.js');
  for (const text of ["'找不到仲介機構。': 'Agency not found.'", 'This agency still has', 'Delete agency “', 'Deleted agency “', "成員帳號: 'member accounts'", "需求單: 'job orders'"]) {
    assert.ok(en.includes(text), `缺少英文翻譯：${text}`);
  }
  // 伺服器的拒絕訊息要與翻譯規則的中文原文一致。
  const route = await read('../src/app/api/hr/route.js');
  assert.ok(route.includes('，請先移轉或刪除後再刪除機構；若只是暫停使用，請改用「停用」。'));
  assert.ok(en.includes('，請先移轉或刪除後再刪除機構；若只是暫停使用，請改用「停用」。'));
});
