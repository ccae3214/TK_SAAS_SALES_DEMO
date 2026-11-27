import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createZip, crc32 } from '../src/lib/zip-store.js';
import { documentEntryName, documentsManifest, safeFileName, workerDocumentsAccessError } from '../src/lib/hr-worker-documents-zip.js';

const route = await readFile(new URL('../src/app/api/hr/workers/[id]/documents-zip/route.js', import.meta.url), 'utf8');
const link = await readFile(new URL('../src/components/HrWorkerDocumentsZipLink.jsx', import.meta.url), 'utf8');
const portal = await readFile(new URL('../src/components/HrMemberPortal.jsx', import.meta.url), 'utf8');
const textSource = await readFile(new URL('../src/lib/hr-worker-documents-zip-text.js', import.meta.url), 'utf8');

// 用系統上的 Python zipfile 獨立驗證 ZIP。WSL／Linux 是 python3，Windows 常是 python 或 py -3；
// Windows 的 Microsoft Store 假 python 會執行失敗，所以實際跑 --version 確認。
const python = [['python3'], ['python'], ['py', '-3']].find(([cmd, ...args]) => {
  try { execFileSync(cmd, [...args, '--version'], { stdio: 'ignore' }); return true; } catch { return false; }
});

const worker = { agency_id: 20 };
const cases = [{ employer_id: 1, employer_agency_id: 10 }];

test('CRC32 與標準值一致', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(crc32(Buffer.alloc(0)), 0);
});

test('ZIP 可被系統 unzip 驗證並還原內容（含中文檔名與二進位資料）', { skip: python ? false : '找不到可執行的 Python（python3／python／py -3）' }, async () => {
  const binary = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 31 + 7) % 256));
  const zip = createZip([
    { name: '01_新護照.pdf', data: Buffer.from('%PDF-1.4 passport') },
    { name: '02_PSA出生證明（附收據）.jpg', data: binary },
    { name: '00_文件清單.txt', data: Buffer.from('hello 你好') },
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'zip-test-'));
  const file = join(dir, 'out.zip');
  await writeFile(file, zip);
  let unzipOk = true;
  try { execFileSync('unzip', ['-tqq', file]); } catch (error) { if (error.code === 'ENOENT') unzipOk = false; else throw error; }
  const [pyCmd, ...pyArgs] = python;
  const py = execFileSync(pyCmd, [...pyArgs, '-I', '-c', `
import zipfile, sys
sys.stdout.reconfigure(encoding='utf-8')
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
print('|'.join(sorted(z.namelist())))
print(len(z.read('02_PSA出生證明（附收據）.jpg')))
print(z.read('00_文件清單.txt').decode('utf-8'))
`, file]).toString('utf8').split(/\r?\n/);
  assert.equal(py[0], ['00_文件清單.txt', '01_新護照.pdf', '02_PSA出生證明（附收據）.jpg'].join('|'));
  assert.equal(py[1], '5000');
  assert.equal(py[2], 'hello 你好');
  assert.ok(unzipOk || py.length > 0);
  assert.ok((await readdir(dir)).includes('out.zip'));
});

test('ZIP 沒有檔案或檔名不合法時拒絕', () => {
  assert.throws(() => createZip([]), /zip_requires_entries/);
  assert.throws(() => createZip([{ name: '', data: Buffer.from('x') }]), /zip_invalid_name/);
});

test('只有已配對到雇主（已建案）的工作者才能打包下載', () => {
  assert.equal(workerDocumentsAccessError({ role: 'admin' }, worker, cases), null);
  assert.equal(workerDocumentsAccessError({ role: 'admin' }, worker, []), null);
  // 雇主：自己的案件才可以
  assert.equal(workerDocumentsAccessError({ role: 'employer', employer_id: 1 }, worker, cases), null);
  assert.equal(workerDocumentsAccessError({ role: 'employer', employer_id: 2 }, worker, cases)?.status, 403);
  // 台灣仲介：雇主所屬仲介；菲律賓仲介：工作者所屬仲介
  assert.equal(workerDocumentsAccessError({ role: 'agency', agency_id: 10, agency_type: 'taiwan' }, worker, cases), null);
  assert.equal(workerDocumentsAccessError({ role: 'agency', agency_id: 20, agency_type: 'philippines' }, worker, cases), null);
  assert.equal(workerDocumentsAccessError({ role: 'agency', agency_id: 99 }, worker, cases)?.status, 403);
  // 還沒配對（沒有案件）：有關係的仲介得到說明，不是 403
  assert.equal(workerDocumentsAccessError({ role: 'agency', agency_id: 20 }, worker, [])?.status, 409);
  assert.equal(workerDocumentsAccessError({ role: 'employer', employer_id: 1 }, worker, [])?.status, 403);
  // 工作者本人、訓練中心、未登記會員不可使用打包下載
  assert.equal(workerDocumentsAccessError({ role: 'worker', worker_id: 5 }, worker, cases)?.status, 403);
  assert.equal(workerDocumentsAccessError({ role: 'training_center' }, worker, cases)?.status, 403);
  assert.equal(workerDocumentsAccessError(null, worker, cases)?.status, 403);
});

test('檔名清理與 ZIP 內檔名', () => {
  assert.equal(safeFileName('a/b\\c:d*e?"<>|'), 'a_b_c_d_e_____');
  assert.equal(safeFileName('   '), 'file');
  assert.equal(safeFileName('../../etc/passwd'), '.._.._etc_passwd'.replace(/^\.+/, ''));
  assert.equal(documentEntryName(0, 'PSA出生證明（附收據）', 'application/pdf'), '01_PSA出生證明（附收據）.pdf');
  assert.equal(documentEntryName(11, '照片 2x2', 'image/jpeg'), '12_照片 2x2.jpg');
  assert.equal(documentEntryName(2, 'NBI', 'image/png'), '03_NBI.png');
  assert.ok(!documentEntryName(0, '../x', 'application/pdf').includes('/'));
  const manifest = documentsManifest('Maria', [{ entryName: '01_新護照.pdf', name: '新護照', version: 2, originalFilename: 'p.pdf', sha256: 'abc' }], new Date('2026-11-20T00:00:00Z'));
  assert.match(manifest, /Worker \/ 工作者: Maria/);
  assert.match(manifest, /01_新護照\.pdf\t新護照\t2\tp\.pdf\tabc/);
});

test('API：只取適用且已核准文件的最新核准版本，驗證完整性、記錄活動並禁止快取', () => {
  assert.match(route, /r\.applicable AND r\.status='approved'/);
  assert.match(route, /v\.decision='approved'/);
  assert.match(route, /ORDER BY s\.version_number DESC LIMIT 1/);
  assert.match(route, /workerDocumentsAccessError\(principal, worker, caseRows\)/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /打包下載已核准文件/);
  assert.match(route, /'Cache-Control': 'private, no-store, max-age=0'/);
  assert.match(route, /MAX_ZIP_SOURCE_BYTES/);
  // 不能繞過權限：沒有登入先回 401，權限檢查在讀取加密檔案之前
  const callSite = route.indexOf('workerDocumentsAccessError(principal');
  assert.ok(callSite > 0);
  assert.ok(route.indexOf('Authentication required') < callSite);
  assert.ok(callSite < route.indexOf('SELECT iv,auth_tag,encrypted_data'));
});

test('畫面：雇主與仲介的工作者列表都有打包下載按鈕，且有英文翻譯', () => {
  assert.equal((portal.match(/<HrWorkerDocumentsZipLink /g) || []).length, 3);
  assert.match(portal, /import HrWorkerDocumentsZipLink from/);
  assert.match(link, /documents-zip/);
  for (const text of [
    '打包下載已核准文件', '打包中…', '無法產生文件壓縮檔，請稍後再試。', '這位工作者尚未配對到雇主，無法打包下載文件。',
    '此帳號無權下載這位工作者的文件。', '這位工作者目前沒有已審核通過的文件可以下載。', '已核准文件的總大小超過打包上限，請改為逐份下載。',
  ]) assert.ok(textSource.includes(`'${text}':`), `missing English translation: ${text}`);
  assert.match(link, /zipText\(/);
});
