import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureHrIdentitySchema, getHrPrincipal } from '@/lib/hr-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SIZE = 10 * 1024 * 1024;
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function requestIsSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) {
      if (value) allowed.add(new URL(value).origin);
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1);
    if (host) allowed.add(`${protocol.split(',')[0].trim()}://${host}`);
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}

function documentKey() {
  const key = Buffer.from(process.env.HR_DOCUMENT_ENCRYPTION_KEY || '', 'base64');
  return key.length === 32 ? key : null;
}

function detectContentType(data) {
  if (data.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return null;
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  await ensureHrIdentitySchema();
  const principal = await getHrPrincipal(session);
  if (!principal || !['admin','worker','agency'].includes(principal.role)) return NextResponse.json({ error: 'HR membership required' }, { status: 403 });
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: '請從本站提交文件。' }, { status: 403 });

  const key = documentKey();
  if (!key) return NextResponse.json({ error: '文件加密尚未設定，請在伺服器設定 HR_DOCUMENT_ENCRYPTION_KEY（32 bytes Base64）後重啟。' }, { status: 503 });

  let form;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: '上傳資料格式不正確。' }, { status: 400 }); }
  const requirementId = Number(form.get('requirementId'));
  const file = form.get('file');
  const note = clean(form.get('note'));
  if (!Number.isSafeInteger(requirementId) || requirementId <= 0 || !file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: '請選擇案件文件並重新提交。' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: '文件大小需介於 1 byte 到 10 MB。' }, { status: 400 });

  const plain = Buffer.from(await file.arrayBuffer());
  const contentType = detectContentType(plain);
  if (!contentType) return NextResponse.json({ error: '目前只接受 PDF、JPG 與 PNG 文件。' }, { status: 415 });
  const rawName = clean(file.name, 180).replace(/[\\/\x00-\x1f]/g, '_');
  const originalFilename = rawName || '文件';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const sha256 = createHash('sha256').update(plain).digest('hex');
  const actor = clean(session.user?.email || session.user?.lineUserId || 'LINE 登入', 254);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query(`SELECT r.id,r.name,r.applicable,r.worker_id,w.agency_id
      FROM hr_worker_documents r JOIN hr_workers w ON w.id=r.worker_id
      WHERE r.id=$1 FOR UPDATE OF r`, [requirementId]);
    if (!target.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: '找不到文件要求。' }, { status: 404 });
    }
    const requirement = target.rows[0];
    if (!requirement.applicable) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: '此文件已標示為不適用，無法上傳。' }, { status: 409 });
    }
    const ownsWorker = principal.role === 'worker' && Number(principal.worker_id) === Number(requirement.worker_id);
    const ownsAgencyWorker = principal.role === 'agency' && Number(principal.agency_id) === Number(requirement.agency_id);
    if (principal.role !== 'admin' && !ownsWorker && !ownsAgencyWorker) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: '此帳號無權為這位工作者上傳文件。' }, { status: 403 });
    }
    const inserted = await client.query(`INSERT INTO hr_document_submissions(requirement_id,version_number,filename,note,submitted_by)
      SELECT $1,COALESCE(MAX(version_number),0)+1,$2,$3,$4 FROM hr_document_submissions WHERE requirement_id=$1 RETURNING id,version_number`,
      [requirementId, originalFilename, note, actor]);
    const submission = inserted.rows[0];
    await client.query(`INSERT INTO hr_document_files(submission_id,original_filename,content_type,size_bytes,sha256,iv,auth_tag,encrypted_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [submission.id,originalFilename,contentType,plain.length,sha256,iv,authTag,encrypted]);
    await client.query("UPDATE hr_worker_documents SET status='submitted',review_reason='',updated_at=NOW() WHERE id=$1", [requirementId]);
    await client.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) SELECT id,$2,$3,$4 FROM hr_cases WHERE worker_id=$1', [requirement.worker_id,actor,'收到文件',`${requirement.name} · 第 ${submission.version_number} 版`]);
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, submissionId: submission.id, version: submission.version_number }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('hr_document_upload_failed', error?.name || 'Error');
    return NextResponse.json({ error: '文件儲存失敗，請稍後再試。' }, { status: 500 });
  } finally { client.release(); }
}
