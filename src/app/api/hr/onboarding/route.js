import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal, ensureHrIdentitySchema } from '@/lib/hr-access';
import { ONBOARDING_TOURS, ONBOARDING_VERSION } from '@/lib/hr-onboarding';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 記錄新手導覽「看過了」。有會員資料的帳號存在 hr_members.onboarding_seen（跨裝置）；
// 沒有會員資料的帳號（例如剛登入、尚未送出申請的新使用者）回傳 persist:'local'，由瀏覽器自己記。

function sameOrigin(request) {
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

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    await ensureHrIdentitySchema();
    const principal = await getHrPrincipal(session);
    if (!principal?.id) return NextResponse.json({ persist: 'local', seen: {} });
    const rows = await query('SELECT onboarding_seen FROM hr_members WHERE id=$1', [principal.id]);
    return NextResponse.json({ persist: 'server', seen: rows[0]?.onboarding_seen || {} });
  } catch (error) {
    console.error('hr_onboarding_read_failed', error?.name || 'Error');
    return NextResponse.json({ persist: 'local', seen: {} });
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '資料格式不正確。' }, { status: 400 }); }
  const tour = typeof body?.tour === 'string' ? body.tour : '';
  const version = Number(body?.version);
  if (!ONBOARDING_TOURS.includes(tour) || !Number.isInteger(version) || version < 1 || version > ONBOARDING_VERSION + 100) {
    return NextResponse.json({ error: '導覽資料不正確。' }, { status: 400 });
  }
  try {
    await ensureHrIdentitySchema();
    const principal = await getHrPrincipal(session);
    if (!principal?.id) return NextResponse.json({ ok: true, persist: 'local' });
    await pool.query(
      `UPDATE hr_members SET onboarding_seen = jsonb_set(COALESCE(onboarding_seen,'{}'::jsonb), ARRAY[$2]::text[], to_jsonb($3::int)) WHERE id=$1`,
      [principal.id, tour, version]
    );
    return NextResponse.json({ ok: true, persist: 'server' });
  } catch (error) {
    console.error('hr_onboarding_write_failed', error?.name || 'Error');
    return NextResponse.json({ ok: true, persist: 'local' });
  }
}
