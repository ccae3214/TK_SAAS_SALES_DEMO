import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureSchema } from '@/app/api/hr/route';
import { getHrPrincipal } from '@/lib/hr-access';
import { recordAdminAction } from '@/lib/hr-audit';
import { requestIsSameOrigin } from '@/lib/hr-employer-documents';
import {
  AGENCY_PROFILE_ERRORS, canManageAgencyProfile, canViewAgencyProfile, ensureAgencyProfileSchema, normalizeAgencyProfileInput,
  readAgencyProfile, resolveAgencyId, saveAgencyProfile,
} from '@/lib/hr-agency-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 仲介機構自己的基本資料（名稱、國家／地區、聯絡人、電話、Email、地址、許可字號）與證書清單。
//   GET ?agencyId=（系統管理者才需要帶）→ { agency, profile, certificates, canManage }
//   PUT { agencyId?, name, country, contactPerson, phone, email, address, licenseNumber }

const fail = (code, status) => NextResponse.json({ error: AGENCY_PROFILE_ERRORS[code] || code, code }, { status });

let schemaPromise;
function ensureTables() {
  schemaPromise ||= (async () => { await ensureSchema(); await ensureAgencyProfileSchema(pool); })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

async function context() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  await ensureTables();
  const principal = await getHrPrincipal(session);
  if (principal?.role !== 'admin' && principal?.role !== 'agency') return { error: fail('forbidden', 403) };
  return { session, principal };
}

export async function GET(request) {
  try {
    const ctx = await context();
    if (ctx.error) return ctx.error;
    const { principal } = ctx;
    const agencyId = resolveAgencyId(principal, new URL(request.url).searchParams.get('agencyId'));
    if (!agencyId) return fail('agency_required', 400);
    if (!canViewAgencyProfile(principal, agencyId)) return fail('forbidden', 403);
    const result = await readAgencyProfile(pool, agencyId);
    if (!result) return fail('not_found', 404);
    return NextResponse.json({ ...result, canManage: canManageAgencyProfile(principal, agencyId) });
  } catch (error) {
    console.error('hr_agency_profile_read_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '無法讀取仲介機構資料，請稍後再試。', code: 'server' }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。', code: 'origin' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '表單資料格式不正確。', code: 'bad_body' }, { status: 400 }); }
  try {
    const ctx = await context();
    if (ctx.error) return ctx.error;
    const { session, principal } = ctx;
    const agencyId = resolveAgencyId(principal, body?.agencyId);
    if (!agencyId) return fail('agency_required', 400);
    if (!canManageAgencyProfile(principal, agencyId)) return fail('forbidden', 403);
    const current = await readAgencyProfile(pool, agencyId);
    if (!current) return fail('not_found', 404);
    // 機構類型（台灣／菲律賓）不能由仲介自己改，只用來決定「國家／地區」留白時的預設值。
    const parsed = normalizeAgencyProfileInput(body, current.agency.agency_type);
    if (parsed.error) return fail(parsed.error, 400);
    const actor = String(session.user?.name || session.user?.email || session.user?.lineUserId || 'LINE 登入').slice(0, 254);
    const saved = await saveAgencyProfile(pool, agencyId, parsed.value, actor);
    if (saved.error) return fail(saved.error, saved.error === 'name_taken' ? 409 : 404);
    if (principal.role === 'admin') {
      await recordAdminAction({ principal, session, action: '編輯', type: 'agency', id: agencyId, name: parsed.value.name, phrase: `編輯了仲介機構「${parsed.value.name}」的基本資料` });
    }
    return NextResponse.json({ ...(await readAgencyProfile(pool, agencyId)), canManage: true, ok: true });
  } catch (error) {
    console.error('hr_agency_profile_write_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '儲存失敗，請稍後再試。', code: 'server' }, { status: 500 });
  }
}
