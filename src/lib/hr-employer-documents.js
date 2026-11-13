import pool from '@/lib/db';
import { ensureHrIdentitySchema } from '@/lib/hr-access';

// 雇主文件（目前是「核准函」）。檔案用和工人文件相同的 AES-256-GCM 加密存放。
// 誰可以管理：系統管理者、雇主本人、雇主所屬的台灣仲介。

export const EMPLOYER_DOCUMENT_TYPES = { approval_letter: { zh: '核准函', en: 'Approval letter' } };
export const EMPLOYER_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;
export const EMPLOYER_DOCUMENT_LIMIT_PER_EMPLOYER = 30;

let schemaPromise;
export function ensureEmployerDocumentsSchema() {
  schemaPromise ||= (async () => {
    await ensureHrIdentitySchema();
    await pool.query(`CREATE TABLE IF NOT EXISTS hr_employer_documents (
      id BIGSERIAL PRIMARY KEY,
      employer_id BIGINT NOT NULL REFERENCES hr_employers(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL DEFAULT 'approval_letter',
      original_filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      iv BYTEA NOT NULL,
      auth_tag BYTEA NOT NULL,
      encrypted_data BYTEA NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL DEFAULT '',
      uploaded_by_role TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS hr_employer_documents_employer ON hr_employer_documents(employer_id, created_at DESC)');
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

// employer 需有 id 與 agency_id。
export function canManageEmployerDocuments(principal, employer) {
  if (!principal || !employer) return false;
  if (principal.role === 'admin') return true;
  if (principal.role === 'employer') return Number(principal.employer_id) === Number(employer.id);
  if (principal.role === 'agency' && principal.agency_type === 'taiwan') return Number(principal.agency_id) === Number(employer.agency_id);
  return false;
}

export function documentKey() {
  const key = Buffer.from(process.env.HR_DOCUMENT_ENCRYPTION_KEY || '', 'base64');
  return key.length === 32 ? key : null;
}

export function detectContentType(data) {
  if (data.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return null;
}

export function requestIsSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) { if (value) allowed.add(new URL(value).origin); }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1);
    if (host) allowed.add(`${protocol.split(',')[0].trim()}://${host}`);
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}
