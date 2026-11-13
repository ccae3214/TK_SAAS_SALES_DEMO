import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { recordAdminAction } from '@/lib/hr-audit';
import {
  EMPLOYER_DOCUMENT_LIMIT_PER_EMPLOYER, EMPLOYER_DOCUMENT_MAX_SIZE, EMPLOYER_DOCUMENT_TYPES, canManageEmployerDocuments,
  detectContentType, documentKey, ensureEmployerDocumentsSchema, requestIsSameOrigin,
} from '@/lib/hr-employer-documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

async function context() {
  const session = await auth();
  if (!session?.user) return { error: fail('Authentication required', 401) };
  await ensureEmployerDocumentsSchema();
  const principal = await getHrPrincipal(session);
  const allowedRole = principal?.role === 'admin' || principal?.role === 'employer' || (principal?.role === 'agency' && principal.agency_type === 'taiwan');
  if (!allowedRole) return { error: fail('只有系統管理者、雇主與台灣仲介可以管理雇主文件。', 403) };
  return { session, principal };
}

// 列出目前身分可以看到的雇主文件（不含檔案內容）。
export async function GET(request) {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  try {
    const { principal } = ctx;
    const employerId = new URL(request.url).searchParams.get('employerId');
    const where = [], params = [];
    if (principal.role === 'employer') { params.push(principal.employer_id); where.push(`d.employer_id=$${params.length}`); }
    else if (principal.role === 'agency') { params.push(principal.agency_id); where.push(`e.agency_id=$${params.length}`); }
    if (employerId) {
      if (!/^\d+$/.test(employerId)) return fail('雇主編號不正確。');
      params.push(employerId); where.push(`d.employer_id=$${params.length}`);
    }
    const rows = await query(`SELECT d.id, d.employer_id, d.doc_type, d.original_filename, d.content_type, d.size_bytes, d.note,
        d.uploaded_by, d.uploaded_by_role, d.created_at, e.name AS employer_name
      FROM hr_employer_documents d JOIN hr_employers e ON e.id=d.employer_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY d.created_at DESC, d.id DESC`, params);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error('hr_employer_documents_read_failed', error?.name || 'Error');
    return fail('讀取雇主文件失敗，請稍後再試。', 500);
  }
}

export async function POST(request) {
  if (!requestIsSameOrigin(request)) return fail('請從本站提交文件。', 403);
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const { session, principal } = ctx;
  const key = documentKey();
  if (!key) return fail('文件加密尚未設定，請在伺服器設定 HR_DOCUMENT_ENCRYPTION_KEY（32 bytes Base64）後重啟。', 503);
  let form;
  try { form = await request.formData(); } catch { return fail('上傳資料格式不正確。'); }
  const employerId = Number(form.get('employerId'));
  const docType = clean(form.get('docType'), 40) || 'approval_letter';
  const file = form.get('file');
  const note = clean(form.get('note'));
  if (!Number.isSafeInteger(employerId) || employerId <= 0 || !file || typeof file.arrayBuffer !== 'function') return fail('請選擇雇主並選擇要上傳的文件。');
  if (!EMPLOYER_DOCUMENT_TYPES[docType]) return fail('不支援的文件類型。');
  if (file.size <= 0 || file.size > EMPLOYER_DOCUMENT_MAX_SIZE) return fail('文件大小需介於 1 byte 到 10 MB。');
  const plain = Buffer.from(await file.arrayBuffer());
  const contentType = detectContentType(plain);
  if (!contentType) return fail('目前只接受 PDF、JPG 與 PNG 文件。', 415);
  const filename = clean(file.name, 180).replace(/[\\/\x00-\x1f]/g, '_') || '文件';
  try {
    const rows = await query('SELECT id, name, agency_id FROM hr_employers WHERE id=$1', [employerId]);
    const employer = rows[0];
    if (!employer) return fail('找不到這位雇主。', 404);
    if (!canManageEmployerDocuments(principal, employer)) return fail('此帳號無權為這位雇主上傳文件。', 403);
    const count = Number((await query('SELECT count(*)::int AS n FROM hr_employer_documents WHERE employer_id=$1', [employerId]))[0]?.n || 0);
    if (count >= EMPLOYER_DOCUMENT_LIMIT_PER_EMPLOYER) return fail(`每位雇主最多保存 ${EMPLOYER_DOCUMENT_LIMIT_PER_EMPLOYER} 份文件，請先刪除不需要的舊文件。`, 409);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const sha256 = createHash('sha256').update(plain).digest('hex');
    const actor = clean(session.user?.name || session.user?.email || session.user?.lineUserId || 'LINE 登入', 254);
    const inserted = await pool.query(`INSERT INTO hr_employer_documents(employer_id,doc_type,original_filename,content_type,size_bytes,sha256,iv,auth_tag,encrypted_data,note,uploaded_by,uploaded_by_role)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [employerId, docType, filename, contentType, plain.length, sha256, iv, authTag, encrypted, note, actor, principal.role === 'agency' ? 'taiwan_agency' : principal.role]);
    if (principal.role === 'admin') {
      await recordAdminAction({ principal, session, action: '新增', type: 'employer-document', id: inserted.rows[0].id, name: employer.name,
        phrase: `為${employer.name}雇主上傳了${EMPLOYER_DOCUMENT_TYPES[docType].zh}` });
    }
    return NextResponse.json({ ok: true, id: inserted.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('hr_employer_document_upload_failed', error?.name || 'Error');
    return fail('文件儲存失敗，請稍後再試。', 500);
  }
}

export async function DELETE(request) {
  if (!requestIsSameOrigin(request)) return fail('Invalid request origin', 403);
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const { session, principal } = ctx;
  const id = new URL(request.url).searchParams.get('id');
  if (!/^\d+$/.test(id || '')) return fail('文件編號不正確。');
  try {
    const rows = await query(`SELECT d.id, d.doc_type, d.original_filename, d.employer_id, e.name AS employer_name, e.agency_id
      FROM hr_employer_documents d JOIN hr_employers e ON e.id=d.employer_id WHERE d.id=$1`, [id]);
    const doc = rows[0];
    if (!doc) return fail('找不到這份文件。', 404);
    if (!canManageEmployerDocuments(principal, { id: doc.employer_id, agency_id: doc.agency_id })) return fail('此帳號無權刪除這份文件。', 403);
    await pool.query('DELETE FROM hr_employer_documents WHERE id=$1', [id]);
    if (principal.role === 'admin') {
      await recordAdminAction({ principal, session, action: '刪除', type: 'employer-document', id: doc.id, name: doc.employer_name,
        phrase: `刪除了${doc.employer_name}雇主的${(EMPLOYER_DOCUMENT_TYPES[doc.doc_type] || EMPLOYER_DOCUMENT_TYPES.approval_letter).zh}（${doc.original_filename}）` });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('hr_employer_document_delete_failed', error?.name || 'Error');
    return fail('刪除失敗，請稍後再試。', 500);
  }
}
