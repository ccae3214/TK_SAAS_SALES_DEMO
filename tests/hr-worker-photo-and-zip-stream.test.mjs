import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createZip, createZipStream } from '../src/lib/zip-store.js';
import {
  WORKER_PHOTO, parsePhotoDataUrl, photoDataUrl, encryptPhoto, decryptPhoto, saveWorkerPhoto, readWorkerPhotoDataUrl, migrateLegacyWorkerPhotos,
} from '../src/lib/hr-worker-photo.js';

const env = { HR_DOCUMENT_ENCRYPTION_KEY: randomBytes(32).toString('base64') };
const key = Buffer.from(env.HR_DOCUMENT_ENCRYPTION_KEY, 'base64');
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(2000)]);
const jpegUrl = photoDataUrl('image/jpeg', jpeg);

// 假的資料庫：記住 hr_workers.resume_profile 與 hr_worker_photos，只認得這支模組會用到的 SQL。
function fakeDb(workers = {}) {
  const photos = new Map();
  const log = [];
  const runner = {
    async query(sql, params = []) {
      log.push(sql);
      if (/^INSERT INTO hr_worker_photos/.test(sql)) {
        const [workerId, contentType, size, sha256, iv, authTag, data] = params;
        if (/DO NOTHING/.test(sql) && photos.has(workerId)) return { rows: [] };
        photos.set(workerId, { content_type: contentType, size_bytes: size, sha256, iv, auth_tag: authTag, encrypted_data: data });
        return { rows: [] };
      }
      if (/^DELETE FROM hr_worker_photos/.test(sql)) { photos.delete(params[0]); return { rows: [] }; }
      if (/^SELECT content_type,sha256/.test(sql)) return { rows: photos.has(params[0]) ? [photos.get(params[0])] : [] };
      if (/^SELECT id,resume_profile->>'photoDataUrl'/.test(sql)) {
        return { rows: Object.entries(workers).filter(([, p]) => 'photoDataUrl' in p).map(([id, p]) => ({ id: Number(id), photo: p.photoDataUrl })) };
      }
      if (/resume_profile-'photoDataUrl'/.test(sql)) {
        const profile = workers[params[0]];
        if (profile && 'photoDataUrl' in profile && (params.length < 2 || profile.photoDataUrl === params[1])) delete profile.photoDataUrl;
        return { rows: [] };
      }
      if (/jsonb_set\(resume_profile,'\{photoDataUrl\}'/.test(sql)) { workers[params[0]].photoDataUrl = params[1]; return { rows: [] }; }
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
  return { ...runner, connect: async () => ({ ...runner, release() {} }), photos, workers, log };
}

test('照片 data URL：只接受內容真的是 JPEG／PNG 的檔案', () => {
  assert.equal(parsePhotoDataUrl(jpegUrl).contentType, 'image/jpeg');
  assert.ok(parsePhotoDataUrl(jpegUrl).data.equals(jpeg));
  // 宣稱是 JPEG，內容其實是 PDF：拒絕
  assert.equal(parsePhotoDataUrl(`data:image/jpeg;base64,${Buffer.from('%PDF-1.4').toString('base64')}`), null);
  assert.equal(parsePhotoDataUrl('data:image/gif;base64,R0lGOD'), null);
  assert.equal(parsePhotoDataUrl(''), null);
});

test('照片加密後可還原，被竄改會被發現', () => {
  const sealed = encryptPhoto(key, jpeg);
  const row = { iv: sealed.iv, auth_tag: sealed.authTag, encrypted_data: sealed.encrypted, sha256: sealed.sha256 };
  assert.ok(decryptPhoto(key, row).equals(jpeg));
  assert.ok(!sealed.encrypted.includes(jpeg.subarray(4, 40)));
  const tampered = Buffer.from(sealed.encrypted); tampered[10] ^= 1;
  assert.throws(() => decryptPhoto(key, { ...row, encrypted_data: tampered }));
});

test('JSON.stringify 不會把照片寫進 JSONB', () => {
  const profile = { gender: 'F', [WORKER_PHOTO]: jpegUrl };
  assert.equal(JSON.stringify(profile), '{"gender":"F"}');
});

test('存照片：有金鑰時加密存到新表，並清掉 JSONB 裡的舊照片；讀取時還原成同一個 data URL', async () => {
  const db = fakeDb({ 7: { gender: 'F', photoDataUrl: 'data:image/jpeg;base64,b2xk' } });
  await saveWorkerPhoto(db, 7, { [WORKER_PHOTO]: jpegUrl }, { env });
  assert.equal(db.photos.get(7).content_type, 'image/jpeg');
  assert.equal(db.photos.get(7).size_bytes, jpeg.length);
  assert.ok(!('photoDataUrl' in db.workers[7]));
  assert.equal(await readWorkerPhotoDataUrl(db, 7, '', { env }), jpegUrl);
});

test('存照片：空字串＝移除；整份覆蓋且沒送照片＝移除；一般編輯沒送照片＝保留', async () => {
  const db = fakeDb({ 7: {} });
  await saveWorkerPhoto(db, 7, { [WORKER_PHOTO]: jpegUrl }, { env });
  await saveWorkerPhoto(db, 7, { gender: 'F' }, { env });
  assert.ok(db.photos.has(7));
  await saveWorkerPhoto(db, 7, { gender: 'F' }, { env, replace: true });
  assert.ok(!db.photos.has(7));
  await saveWorkerPhoto(db, 7, { [WORKER_PHOTO]: jpegUrl }, { env });
  await saveWorkerPhoto(db, 7, { [WORKER_PHOTO]: '' }, { env });
  assert.ok(!db.photos.has(7));
  assert.equal(await readWorkerPhotoDataUrl(db, 7, '', { env }), '');
});

test('沒有設定金鑰：照舊存在 JSONB（本機開發不受影響）', async () => {
  const db = fakeDb({ 7: {} });
  await saveWorkerPhoto(db, 7, { [WORKER_PHOTO]: jpegUrl }, { env: {} });
  assert.equal(db.workers[7].photoDataUrl, jpegUrl);
  assert.equal(db.photos.size, 0);
  assert.equal(await readWorkerPhotoDataUrl(db, 7, jpegUrl, { env: {} }), jpegUrl);
});

test('舊照片遷移：搬到加密表後才從 JSONB 移除；格式不對的保留原樣；可重複執行', async () => {
  const db = fakeDb({ 1: { photoDataUrl: jpegUrl, gender: 'F' }, 2: { photoDataUrl: 'data:image/jpeg;base64,AAAA' }, 3: { photoDataUrl: '' }, 4: { gender: 'M' } });
  const first = await migrateLegacyWorkerPhotos(db, { env });
  assert.deepEqual(first, { moved: 1, skipped: 1 });
  assert.deepEqual(db.workers[1], { gender: 'F' });
  assert.equal(db.workers[2].photoDataUrl, 'data:image/jpeg;base64,AAAA');
  assert.deepEqual(db.workers[3], {});
  assert.equal(await readWorkerPhotoDataUrl(db, 1, '', { env }), jpegUrl);
  assert.deepEqual(await migrateLegacyWorkerPhotos(db, { env }), { moved: 0, skipped: 1 });
  assert.deepEqual(await migrateLegacyWorkerPhotos(fakeDb({ 1: { photoDataUrl: jpegUrl } }), { env: {} }), { moved: 0, skipped: 0, reason: 'no_key' });
});

test('遷移：新表已有較新的照片時保留新的', async () => {
  const db = fakeDb({ 1: { photoDataUrl: jpegUrl } });
  const newer = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(50)]);
  await saveWorkerPhoto(db, 1, { [WORKER_PHOTO]: photoDataUrl('image/jpeg', newer) }, { env });
  db.workers[1].photoDataUrl = jpegUrl; // 模擬舊值還在
  await migrateLegacyWorkerPhotos(db, { env });
  assert.equal(await readWorkerPhotoDataUrl(db, 1, '', { env }), photoDataUrl('image/jpeg', newer));
  assert.ok(!('photoDataUrl' in db.workers[1]));
});

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('串流 ZIP：內容與一次產生的版本相同、長度可事先算出，且一次只讀一個檔案', async () => {
  const date = new Date(2026, 10, 28, 10, 30, 0);
  const files = [
    { name: '00_文件清單.txt', data: Buffer.from('hello 你好') },
    { name: '01_新護照.pdf', data: Buffer.from('%PDF-1.4 passport') },
    { name: '02_PSA出生證明（附收據）.jpg', data: randomBytes(70000) },
  ];
  let loading = 0, maxConcurrent = 0;
  const { stream, length } = createZipStream(files.map(file => ({ name: file.name, size: file.data.length, load: async () => {
    loading += 1; maxConcurrent = Math.max(maxConcurrent, loading);
    await new Promise(resolve => setTimeout(resolve, 5));
    loading -= 1;
    return file.data;
  } })), { date });
  const zip = await collect(stream);
  assert.equal(zip.length, length);
  assert.ok(zip.equals(createZip(files, date)));
  assert.equal(maxConcurrent, 1);
  const dir = await mkdtemp(join(tmpdir(), 'zip-stream-'));
  const file = join(dir, 'out.zip');
  await writeFile(file, zip);
  try {
    execFileSync('unzip', ['-tqq', file]);
    assert.equal(execFileSync('unzip', ['-p', file, '00_*']).toString('utf8'), 'hello 你好');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
});

test('串流 ZIP：檔案實際大小與宣告不符、或讀取失敗時中止串流並通知', async () => {
  const errors = [];
  const bad = createZipStream([{ name: 'a.pdf', size: 5, load: async () => Buffer.from('abc') }], { onError: error => errors.push(error.message) });
  await assert.rejects(collect(bad.stream), /zip_size_mismatch/);
  const failing = createZipStream([{ name: 'a.pdf', size: 1, load: async () => { throw new Error('document_integrity_check_failed'); } }], { onError: error => errors.push(error.message) });
  await assert.rejects(collect(failing.stream), /document_integrity_check_failed/);
  assert.deepEqual(errors, ['zip_size_mismatch', 'document_integrity_check_failed']);
  assert.throws(() => createZipStream([]), /zip_requires_entries/);
  assert.throws(() => createZipStream([{ name: '', size: 0, load: async () => Buffer.alloc(0) }]), /zip_invalid_name/);
});

test('串流 ZIP：全部送完才呼叫 onComplete（下載紀錄）', async () => {
  let completed = 0;
  const { stream } = createZipStream([{ name: 'a.txt', size: 1, load: async () => Buffer.from('x') }], { onComplete: () => { completed += 1; } });
  assert.equal(completed, 0);
  await collect(stream);
  assert.equal(completed, 1);
});

test('程式接線：所有履歷寫入都會另存照片、讀照片走加密表、ZIP 改用串流', async () => {
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const [route, people, shared, photoRoute, zipRoute, migrations] = await Promise.all([
    read('../src/app/api/hr/route.js'), read('../src/app/api/hr/_post/people.js'), read('../src/app/api/hr/_shared.js'),
    read('../src/app/api/hr/workers/[id]/resume-photo/route.js'), read('../src/app/api/hr/workers/[id]/documents-zip/route.js'), read('../src/lib/hr-migrations.js'),
  ]);
  // route.js：工人本人、菲律賓仲介編輯、菲律賓仲介履歷、管理者履歷、管理者編輯，共 5 個寫入點
  assert.equal((route.match(/persistWorkerPhoto\(/g) || []).length, 5);
  assert.equal((route.match(/persistWorkerPhoto\(pool, id, resumeProfile, \{ replace: true \}\)/g) || []).length, 2);
  // people.js：兩個「建立工作者」流程（第三個只有性別，沒有照片）
  assert.equal((people.match(/persistWorkerPhoto\(/g) || []).length, 2);
  assert.doesNotMatch(shared, /profile\.photoDataUrl=/);
  assert.match(shared, /profile\[WORKER_PHOTO\]/);
  assert.match(photoRoute, /readWorkerPhotoDataUrl\(pool/);
  assert.match(zipRoute, /createZipStream\(/);
  assert.doesNotMatch(zipRoute, /createZip\(/);
  assert.match(migrations, /migrateLegacyWorkerPhotos\(pool\)/);
});
