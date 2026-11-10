import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureHrIdentitySchema, getHrPrincipal } from '@/lib/hr-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { submissionId: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: '文件編號不正確。' }, { status: 400 });
  const key = Buffer.from(process.env.HR_DOCUMENT_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) return NextResponse.json({ error: '文件加密金鑰尚未設定。' }, { status: 503 });
  try {
    await ensureHrIdentitySchema();
    const principal = await getHrPrincipal(session);
    if (!principal) return NextResponse.json({ error: 'HR membership is not configured for this account' }, { status: 403 });
    // 文件屬於工人：本人、所屬菲律賓仲介、管理者可下載；雇主與台灣仲介只能下載已與自己建案的工人的文件。
    const result = await pool.query(`SELECT f.*,s.requirement_id,r.worker_id,w.agency_id AS worker_agency_id,
      COALESCE(array_agg(DISTINCT c.employer_id) FILTER (WHERE c.id IS NOT NULL),ARRAY[]::bigint[]) AS employer_ids,
      COALESCE(array_agg(DISTINCT e.agency_id) FILTER (WHERE e.agency_id IS NOT NULL),ARRAY[]::bigint[]) AS employer_agency_ids
      FROM hr_document_files f
      JOIN hr_document_submissions s ON s.id=f.submission_id JOIN hr_worker_documents r ON r.id=s.requirement_id
      JOIN hr_workers w ON w.id=r.worker_id LEFT JOIN hr_cases c ON c.worker_id=w.id LEFT JOIN hr_employers e ON e.id=c.employer_id
      WHERE f.submission_id=$1 GROUP BY f.submission_id,s.requirement_id,r.worker_id,w.agency_id`, [id]);
    if (!result.rowCount) return NextResponse.json({ error: '找不到文件。' }, { status: 404 });
    const file = result.rows[0];
    const allowed = principal.role === 'admin' ||
      (principal.role === 'worker' && Number(principal.worker_id) === Number(file.worker_id)) ||
      (principal.role === 'employer' && file.employer_ids.map(Number).includes(Number(principal.employer_id))) ||
      (principal.role === 'agency' && (Number(principal.agency_id) === Number(file.worker_agency_id) || file.employer_agency_ids.map(Number).includes(Number(principal.agency_id))));
    if (!allowed) return NextResponse.json({ error: '此帳號無權下載這份文件。' }, { status: 403 });
    const decipher = createDecipheriv('aes-256-gcm', key, file.iv);
    decipher.setAuthTag(file.auth_tag);
    const data = Buffer.concat([decipher.update(file.encrypted_data),decipher.final()]);
    const actualHash = createHash('sha256').update(data).digest();
    const storedHash = Buffer.from(file.sha256, 'hex');
    if (actualHash.length !== storedHash.length || !timingSafeEqual(actualHash, storedHash)) {
      throw new Error('document_integrity_check_failed');
    }
        await pool.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) SELECT id,$2,$3,$4 FROM hr_cases WHERE worker_id=$1', [file.worker_id, session.user?.email || session.user?.lineUserId || '登入會員','下載文件',`文件版本 ${id}`]);
    const preview = new URL(request.url).searchParams.get('preview') === '1';
    const previewableType = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/i.test(file.content_type || '');
    const inline = preview && previewableType;
    return new Response(data, { headers: {
      'Content-Type': inline ? file.content_type : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="document"; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`,
      'Content-Length': String(data.length),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...(inline ? { 'Content-Security-Policy': "frame-ancestors 'self'" } : { 'X-Frame-Options': 'DENY' }),
    } });
  } catch (error) {
    console.error('hr_document_download_failed', error?.name || 'Error');
    return NextResponse.json({ error: '無法解密或讀取文件，請確認文件加密金鑰正確。' }, { status: 500 });
  }
}
