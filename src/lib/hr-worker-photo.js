// 履歷照片的加密儲存。
// 以前照片是 base64 明文放在 hr_workers.resume_profile.photoDataUrl（JSONB）裡，沒有加密、備份檔也看得到。
// 現在改存到 hr_worker_photos：跟其他文件一樣用 HR_DOCUMENT_ENCRYPTION_KEY 做 AES-256-GCM 加密，存原始位元組（不是 base64）。
// - API 對外的格式不變：前端照樣送 / 收 resumeProfile.photoDataUrl（data URL），只是伺服器不再把它寫進 JSONB。
// - 舊資料：啟動遷移時逐筆搬到新表，確認可以解密還原後，才把 JSONB 裡的 photoDataUrl 拿掉。
// - 沒設定金鑰的環境（本機開發）：維持舊做法存在 JSONB，功能不受影響。
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { migrateOnce } from './migrate-once.js';

// cleanWorkerResumeProfile 把照片放在這個 Symbol 上：JSON.stringify 不會輸出 Symbol 屬性，所以照片不會被寫進 JSONB。
export const WORKER_PHOTO = Symbol.for('hr.workerPhoto');
export const PHOTO_KEY_VERSION = 1;
const DATA_URL = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

export function photoEncryptionKey(env = process.env) {
  const key = Buffer.from(env.HR_DOCUMENT_ENCRYPTION_KEY || '', 'base64');
  return key.length === 32 ? key : null;
}

function detectImageType(data) {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return null;
}

// data URL → { contentType, data }；格式不對或內容不是真的 JPEG／PNG 時回傳 null。
export function parsePhotoDataUrl(value) {
  const match = typeof value === 'string' ? DATA_URL.exec(value) : null;
  if (!match) return null;
  const data = Buffer.from(match[2], 'base64');
  const contentType = detectImageType(data);
  return contentType ? { contentType, data } : null;
}

export const photoDataUrl = (contentType, data) => `data:${contentType};base64,${Buffer.from(data).toString('base64')}`;

export function encryptPhoto(key, data) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return { iv, authTag: cipher.getAuthTag(), encrypted, sha256: createHash('sha256').update(data).digest('hex') };
}

export function decryptPhoto(key, row) {
  const decipher = createDecipheriv('aes-256-gcm', key, row.iv);
  decipher.setAuthTag(row.auth_tag);
  const data = Buffer.concat([decipher.update(row.encrypted_data), decipher.final()]);
  const actual = createHash('sha256').update(data).digest();
  const stored = Buffer.from(String(row.sha256 || ''), 'hex');
  if (actual.length !== stored.length || !timingSafeEqual(actual, stored)) throw new Error('photo_integrity_check_failed');
  return data;
}

// 請求路徑也可以呼叫：同一個行程只會真的執行一次（與其他 ensure* 相同的 migrateOnce 機制）。
export function ensureWorkerPhotoSchema(db) {
  return migrateOnce('worker-photos', () => createWorkerPhotoTable(db));
}

export async function createWorkerPhotoTable(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hr_worker_photos (
    worker_id BIGINT PRIMARY KEY REFERENCES hr_workers(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png')),
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    iv BYTEA NOT NULL,
    auth_tag BYTEA NOT NULL,
    encrypted_data BYTEA NOT NULL,
    key_version SMALLINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

async function upsertEncryptedPhoto(runner, key, workerId, parsed) {
  const sealed = encryptPhoto(key, parsed.data);
  await runner.query(`INSERT INTO hr_worker_photos(worker_id,content_type,size_bytes,sha256,iv,auth_tag,encrypted_data,key_version,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (worker_id) DO UPDATE SET content_type=EXCLUDED.content_type,size_bytes=EXCLUDED.size_bytes,sha256=EXCLUDED.sha256,
      iv=EXCLUDED.iv,auth_tag=EXCLUDED.auth_tag,encrypted_data=EXCLUDED.encrypted_data,key_version=EXCLUDED.key_version,updated_at=NOW()`,
  [workerId, parsed.contentType, parsed.data.length, sealed.sha256, sealed.iv, sealed.authTag, sealed.encrypted, PHOTO_KEY_VERSION]);
}

const stripLegacyPhoto = (runner, workerId) => runner.query(
  "UPDATE hr_workers SET resume_profile=resume_profile-'photoDataUrl' WHERE id=$1 AND resume_profile ? 'photoDataUrl'", [workerId]);

// 履歷寫入資料庫之後呼叫（同一個 transaction 的 client 也可以）。
// profile[WORKER_PHOTO]：字串 = 新照片、'' = 移除照片、undefined = 這次沒送照片。
// replace=true 代表這次是「整份履歷覆蓋」（以前會連 JSONB 裡的照片一起清掉），沒送照片時也要移除。
export async function saveWorkerPhoto(runner, workerId, profile, { replace = false, env = process.env } = {}) {
  const value = profile?.[WORKER_PHOTO];
  if (value === undefined && !replace) return;
  const key = photoEncryptionKey(env);
  if (!key) {
    // 沒有金鑰：照舊存在 JSONB（與修改前相同）。
    if (typeof value === 'string') {
      await runner.query("UPDATE hr_workers SET resume_profile=jsonb_set(resume_profile,'{photoDataUrl}',to_jsonb($2::text),true) WHERE id=$1", [workerId, value]);
    }
    return;
  }
  if (typeof value === 'string' && value) {
    const parsed = parsePhotoDataUrl(value);
    if (!parsed) { console.warn('hr_worker_photo_rejected', 'not_jpeg_or_png'); return; }
    await upsertEncryptedPhoto(runner, key, workerId, parsed);
  } else {
    await runner.query('DELETE FROM hr_worker_photos WHERE worker_id=$1', [workerId]);
  }
  await stripLegacyPhoto(runner, workerId);
}

// 讀照片：先讀加密表，沒有再退回舊的 JSONB 值（尚未搬移的資料）。回傳 data URL 或 ''。
export async function readWorkerPhotoDataUrl(runner, workerId, legacyDataUrl = '', { env = process.env } = {}) {
  const rows = (await runner.query('SELECT content_type,sha256,iv,auth_tag,encrypted_data FROM hr_worker_photos WHERE worker_id=$1', [workerId])).rows;
  if (rows.length) {
    const key = photoEncryptionKey(env);
    if (!key) throw new Error('photo_key_missing');
    return photoDataUrl(rows[0].content_type, decryptPhoto(key, rows[0]));
  }
  return legacyDataUrl || '';
}

// 啟動遷移：把 JSONB 裡的舊照片搬進加密表。每筆一個 transaction；
// 先確認加密後能解回一模一樣的內容，才把 JSONB 的 photoDataUrl 拿掉。可重複執行。
export async function migrateLegacyWorkerPhotos(db, { env = process.env } = {}) {
  const key = photoEncryptionKey(env);
  if (!key) return { moved: 0, skipped: 0, reason: 'no_key' };
  const legacy = (await db.query("SELECT id,resume_profile->>'photoDataUrl' AS photo FROM hr_workers WHERE resume_profile ? 'photoDataUrl' ORDER BY id")).rows;
  let moved = 0, skipped = 0;
  for (const row of legacy) {
    const photo = row.photo || '';
    const parsed = photo ? parsePhotoDataUrl(photo) : null;
    if (photo && !parsed) { skipped += 1; console.warn('hr_worker_photo_migration_skipped', row.id); continue; }
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (parsed) {
        const sealed = encryptPhoto(key, parsed.data);
        const check = decryptPhoto(key, { iv: sealed.iv, auth_tag: sealed.authTag, encrypted_data: sealed.encrypted, sha256: sealed.sha256 });
        if (!check.equals(parsed.data)) throw new Error('photo_roundtrip_failed');
        // 新表已經有照片（遷移期間剛好有人存了新照片）就保留新的。
        await client.query(`INSERT INTO hr_worker_photos(worker_id,content_type,size_bytes,sha256,iv,auth_tag,encrypted_data,key_version)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (worker_id) DO NOTHING`,
        [row.id, parsed.contentType, parsed.data.length, sealed.sha256, sealed.iv, sealed.authTag, sealed.encrypted, PHOTO_KEY_VERSION]);
      }
      // 只在照片沒被別人改過時才拿掉（不動 updated_at，這不是使用者的編輯）。
      await client.query("UPDATE hr_workers SET resume_profile=resume_profile-'photoDataUrl' WHERE id=$1 AND resume_profile->>'photoDataUrl' IS NOT DISTINCT FROM $2", [row.id, row.photo]);
      await client.query('COMMIT');
      if (parsed) moved += 1;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      skipped += 1;
      console.error('hr_worker_photo_migration_failed', row.id, error?.message || 'Error');
    } finally { client.release(); }
  }
  return { moved, skipped };
}
