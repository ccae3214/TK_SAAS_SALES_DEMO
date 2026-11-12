import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureSchema } from '@/app/api/hr/route';
import { getHrPrincipal } from '@/lib/hr-access';
import { ensureAuditSchema } from '@/lib/hr-audit';
import { applyCertificationAction, ensureCertificationSchema, listCertifications } from '@/lib/hr-agency-certification-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 台灣仲介 ↔ 菲律賓仲介 相互認證：
//   GET  取得與目前身分相關的認證紀錄（仲介：自己的；雇主：所屬台灣仲介已認證的菲律賓仲介；管理者：全部）。
//   POST { action: 'request' | 'approve' | 'reject' | 'revoke' | 'certify', ... }

let schemaPromise;
function ensureCertificationTables() {
  schemaPromise ||= (async () => {
    await ensureSchema(); // 需求單、案件等資料表必須先存在（認證表會沿用既有合作關係）
    await ensureCertificationSchema(pool);
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

function sameOrigin(request) {
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

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    await ensureCertificationTables();
    const principal = await getHrPrincipal(session);
    if (!principal?.role) return NextResponse.json({ error: 'HR membership required' }, { status: 403 });
    const result = await listCertifications(pool, principal);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('hr_agency_certification_read_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '無法讀取相互認證資料，請稍後再試。' }, { status: 503 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '表單資料格式不正確。' }, { status: 400 }); }
  try {
    await ensureCertificationTables();
    const principal = await getHrPrincipal(session);
    if (!principal?.role) return NextResponse.json({ error: 'HR membership required' }, { status: 403 });
    const result = await applyCertificationAction(pool, principal, body);
    // 系統管理員的操作寫入既有的「系統管理員操作紀錄」；記錄失敗不影響操作結果。
    if (principal.role === 'admin' && result.audit && result.status >= 200 && result.status < 300) {
      try {
        await ensureAuditSchema();
        const actorName = String(principal.name || session.user.name || session.user.email || '系統管理員').slice(0, 160);
        await pool.query(
          `INSERT INTO hr_admin_audit_log(actor_member_id,actor_name,actor_email,action,target_type,target_id,target_name,summary)
           VALUES($1,$2,$3,$4,'agency-certification',$5,$6,$7)`,
          [principal.id || null, actorName, String(session.user.email || '').slice(0, 254), result.audit.action,
            result.body?.certification?.id || null, '相互認證', `${actorName}系統管理員${result.audit.phrase}`.slice(0, 500)],
        );
      } catch (error) { console.error('hr_agency_certification_audit_failed', error?.name || 'Error'); }
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error?.code === '23505') return NextResponse.json({ error: '認證資料剛剛被其他人更新，請重新整理後再試。' }, { status: 409 });
    console.error('hr_agency_certification_write_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '相互認證操作失敗，請稍後再試。' }, { status: 500 });
  }
}
