import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureSchema } from '@/app/api/hr/route';
import { getHrPrincipal } from '@/lib/hr-access';
import { recordAdminAction } from '@/lib/hr-audit';
import { detectContentType, documentKey, requestIsSameOrigin } from '@/lib/hr-employer-documents';
import {
  AGENCY_CERTIFICATE_LIMIT, AGENCY_CERTIFICATE_MAX_SIZE, AGENCY_CERTIFICATE_TYPES, canManageAgencyProfile, ensureAgencyProfileSchema,
  normalizeExpiry, resolveAgencyId,
} from '@/lib/hr-agency-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 仲介證書上傳與刪除（列表在 /api/hr/agency-profile，下載在 /api/hr/agency-certificates/[id]）。
// 檔案與工人文件、雇主核准函一樣用 AES-256-GCM 加密存放；只有該仲介管理者與系統管理者可以上傳或刪除。

const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (message, status = 400, code = 'bad_request') => NextResponse.json({ error: message, code }, { status });

let schemaPromise;
function ensureTables() {
  schemaPromise ||= (async () => { await ensureSchema(); await ensureAgencyProfileSchema(pool); })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

async function context() {
  const session = await auth();
  if (!session?.user) return { error: fail('Authentication required', 401, 'auth') };
  await ensureTables();
  const principal = await getHrPrincipal(session);
  if (principal?.role !== 'admin' && principal?.role !== 'agency') return { error: fail('只有仲介管理者可以編輯機構資料與證書。', 403, 'forbidden') };
  return { session, principal };
}

export async function POST(request) {
  if (!requestIsSameOrigin(request)) return fail('請從本站提交文件。', 403, 'origin');
  try {
    const ctx = await context();
    if (ctx.error) return ctx.error;
    const { session, principal } = ctx;
    const key = documentKey();
    if (!key) return fail('文件加密尚未設定，請在伺服器設定 HR_DOCUMENT_ENCRYPTION_KEY（32 bytes Base64）後重啟。', 503, 'no_key');
    let form;
    try { form = await request.formData(); } catch { return fail('上傳資料格式不正確。', 400, 'bad_body'); }
    const agencyId = resolveAgencyId(principal, form.get('agencyId'));
    if (!agencyId) return fail('請指定仲介機構。', 400, 'agency_required');
    if (!canManageAgencyProfile(principal, agencyId)) return fail('只有仲介管理者可以編輯機構資料與證書。', 403, 'forbidden');
    const certType = clean(form.get('certType'), 30) || 'license';
    if (!AGENCY_CERTIFICATE_TYPES[certType]) return fail('不支援的證書類型。', 400, 'bad_type');
    const expiresOn = normalizeExpiry(form.get('expiresOn'));
    if (expiresOn === undefined) return fail('到期日格式不正確。', 400, 'bad_expiry');
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return fail('請先選擇要上傳的檔案。', 400, 'no_file');
    if (file.size <= 0 || file.size > AGENCY_CERTIFICATE_MAX_SIZE) return fail('文件大小需介於 1 byte 到 10 MB。', 400, 'bad_size');
    const plain = Buffer.from(await file.arrayBuffer());
    const contentType = detectContentType(plain);
    if (!contentType) return fail('目前只接受 PDF、JPG 與 PNG 文件。', 415, 'bad_format');
    const agency = (await pool.query('SELECT id,name FROM hr_agencies WHERE id=$1', [agencyId])).rows?.[0];
    if (!agency) return fail('找不到仲介機構。', 404, 'not_found');
    const count = Number((await pool.query('SELECT count(*)::int AS n FROM hr_agency_certificates WHERE agency_id=$1', [agencyId])).rows?.[0]?.n || 0);
    if (count >= AGENCY_CERTIFICATE_LIMIT) return fail(`每個仲介機構最多保存 ${AGENCY_CERTIFICATE_LIMIT} 份證書，請先刪除不需要的舊文件。`, 409, 'limit');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const filename = clean(file.name, 180).replace(/[\\/\x00-\x1f]/g, '_') || '證書';
    const actor = clean(session.user?.name || session.user?.email || session.user?.lineUserId || 'LINE 登入', 254);
    const inserted = await pool.query(`INSERT INTO hr_agency_certificates(agency_id,cert_type,original_filename,content_type,size_bytes,sha256,iv,auth_tag,encrypted_data,expires_on,note,uploaded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12) RETURNING id`,
    [agencyId, certType, filename, contentType, plain.length, createHash('sha256').update(plain).digest('hex'), iv, cipher.getAuthTag(), encrypted, expiresOn, clean(form.get('note')), actor]);
    if (principal.role === 'admin') {
      await recordAdminAction({ principal, session, action: '新增', type: 'agency', id: agencyId, name: agency.name, phrase: `為仲介機構「${agency.name}」上傳了${AGENCY_CERTIFICATE_TYPES[certType].zh}` });
    }
    return NextResponse.json({ ok: true, id: inserted.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('hr_agency_certificate_upload_failed', error?.name || 'Error');
    return fail('文件儲存失敗，請稍後再試。', 500, 'server');
  }
}

export async function DELETE(request) {
  if (!requestIsSameOrigin(request)) return fail('Invalid request origin', 403, 'origin');
  try {
    const ctx = await context();
    if (ctx.error) return ctx.error;
    const { session, principal } = ctx;
    const id = new URL(request.url).searchParams.get('id');
    if (!/^\d+$/.test(id || '')) return fail('文件編號不正確。', 400, 'bad_id');
    const doc = (await pool.query(`SELECT c.id,c.cert_type,c.original_filename,c.agency_id,a.name AS agency_name
      FROM hr_agency_certificates c JOIN hr_agencies a ON a.id=c.agency_id WHERE c.id=$1`, [id])).rows?.[0];
    if (!doc) return fail('找不到這份文件。', 404, 'not_found');
    if (!canManageAgencyProfile(principal, doc.agency_id)) return fail('只有仲介管理者可以編輯機構資料與證書。', 403, 'forbidden');
    await pool.query('DELETE FROM hr_agency_certificates WHERE id=$1', [id]);
    if (principal.role === 'admin') {
      await recordAdminAction({ principal, session, action: '刪除', type: 'agency', id: doc.agency_id, name: doc.agency_name,
        phrase: `刪除了仲介機構「${doc.agency_name}」的${(AGENCY_CERTIFICATE_TYPES[doc.cert_type] || AGENCY_CERTIFICATE_TYPES.other).zh}（${doc.original_filename}）` });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('hr_agency_certificate_delete_failed', error?.name || 'Error');
    return fail('刪除失敗，請稍後再試。', 500, 'server');
  }
}
