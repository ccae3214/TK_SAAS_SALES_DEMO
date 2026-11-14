import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureSchema } from '@/app/api/hr/route';
import { getHrPrincipal } from '@/lib/hr-access';
import { documentKey } from '@/lib/hr-employer-documents';
import { canViewAgencyProfile, ensureAgencyProfileSchema } from '@/lib/hr-agency-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 下載或預覽仲介證書：系統管理者與該仲介機構的成員。
export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: '文件編號不正確。' }, { status: 400 });
  const key = documentKey();
  if (!key) return NextResponse.json({ error: '文件加密金鑰尚未設定。' }, { status: 503 });
  try {
    await ensureSchema();
    await ensureAgencyProfileSchema(pool);
    const principal = await getHrPrincipal(session);
    if (!principal) return NextResponse.json({ error: 'HR membership is not configured for this account' }, { status: 403 });
    const result = await pool.query('SELECT * FROM hr_agency_certificates WHERE id=$1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: '找不到文件。' }, { status: 404 });
    const file = result.rows[0];
    if (!canViewAgencyProfile(principal, file.agency_id)) return NextResponse.json({ error: '此帳號無權下載這份文件。' }, { status: 403 });
    const decipher = createDecipheriv('aes-256-gcm', key, file.iv);
    decipher.setAuthTag(file.auth_tag);
    const data = Buffer.concat([decipher.update(file.encrypted_data), decipher.final()]);
    const actualHash = createHash('sha256').update(data).digest();
    const storedHash = Buffer.from(file.sha256, 'hex');
    if (actualHash.length !== storedHash.length || !timingSafeEqual(actualHash, storedHash)) throw new Error('document_integrity_check_failed');
    const previewable = /^(application\/pdf|image\/(png|jpeg))$/i.test(file.content_type || '');
    const inline = new URL(request.url).searchParams.get('preview') === '1' && previewable;
    return new Response(data, { headers: {
      'Content-Type': inline ? file.content_type : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="document"; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`,
      'Content-Length': String(data.length),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...(inline ? { 'Content-Security-Policy': "frame-ancestors 'self'" } : { 'X-Frame-Options': 'DENY' }),
    } });
  } catch (error) {
    console.error('hr_agency_certificate_download_failed', error?.name || 'Error');
    return NextResponse.json({ error: '無法解密或讀取文件，請確認文件加密金鑰正確。' }, { status: 500 });
  }
}
