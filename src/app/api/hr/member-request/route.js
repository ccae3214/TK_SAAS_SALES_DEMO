import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureHrIdentitySchema, getHrPrincipal, HR_ROLES } from '@/lib/hr-access';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  }
  catch { return false; }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '請先登入。' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。' }, { status: 403 });
  try {
    await ensureHrIdentitySchema();
    const body = await request.json();
    const requestedRole = String(body?.requestedRole || '');
    if (!HR_ROLES.has(requestedRole)) return NextResponse.json({ error: '請選擇工作者、雇主、仲介或訓練中心類型。' }, { status: 400 });
    const requestedAgencyId = requestedRole === 'training_center' ? null : Number(body?.requestedAgencyId);
    if (requestedRole !== 'training_center') {
      if (!Number.isSafeInteger(requestedAgencyId) || requestedAgencyId <= 0) return NextResponse.json({ error: '請選擇所屬仲介。' }, { status: 400 });
      const agencyType = requestedRole === 'worker' ? 'philippines' : requestedRole === 'employer' ? 'taiwan' : null;
      const agency = agencyType
        ? await query('SELECT id FROM hr_agencies WHERE id=$1 AND active=TRUE AND agency_type=$2', [requestedAgencyId,agencyType])
        : await query('SELECT id FROM hr_agencies WHERE id=$1 AND active=TRUE', [requestedAgencyId]);
      if (!agency.length) return NextResponse.json({ error: '所屬仲介不存在、已停用或與申請身分不符。' }, { status: 400 });
    }
    const principal = await getHrPrincipal(session);
    if (principal?.role === 'admin') return NextResponse.json({ error: '管理者不需申請會員類型。' }, { status: 400 });
    if (principal?.role) return NextResponse.json({ error: '此帳號已有會員類型。' }, { status: 409 });

    const email = session.user.email?.trim().toLowerCase() || null;
    const lineUserId = session.user.lineUserId || null;
    if (!email && !lineUserId) return NextResponse.json({ error: '登入服務未提供可識別的帳號資料。' }, { status: 400 });
    const displayName = String(session.user.name || email?.split('@')[0] || 'LINE 會員').trim().slice(0, 160);
    const existing = principal;
    const result = existing
      ? await query(`UPDATE hr_members SET requested_role=$2,requested_agency_id=$3,updated_at=NOW()
          WHERE id=$1 AND role IS NULL RETURNING id,requested_role,requested_agency_id`, [existing.id, requestedRole,requestedAgencyId])
      : await query(`INSERT INTO hr_members(email,line_user_id,display_name,role,requested_role,requested_agency_id,active)
          VALUES($1,$2,$3,NULL,$4,$5,TRUE) RETURNING id,requested_role,requested_agency_id`, [email,lineUserId,displayName,requestedRole,requestedAgencyId]);
    if (!result.length) return NextResponse.json({ error: '此帳號已完成會員類型指派。' }, { status: 409 });
    return NextResponse.json({ pendingApproval: true, requestedRole: result[0].requested_role, requestedAgencyId: result[0].requested_agency_id }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: '申請資料格式不正確。' }, { status: 400 });
    if (error?.code === '23505') return NextResponse.json({ error: '此 Email 或 LINE 帳號已綁定其他會員。' }, { status: 409 });
    console.error('hr_member_request_failed', error?.name || 'Error');
    return NextResponse.json({ error: '送出申請失敗，請稍後再試。' }, { status: 500 });
  }
}
