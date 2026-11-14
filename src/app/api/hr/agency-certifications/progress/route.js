import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureSchema } from '@/app/api/hr/route';
import { getHrPrincipal } from '@/lib/hr-access';
import { ensureCertificationSchema } from '@/lib/hr-agency-certification-store';
import { ensureProgressSchema, readProgress, saveProgress } from '@/lib/hr-agency-auth-progress-store';
import { requestIsSameOrigin } from '@/lib/hr-employer-documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 相互認證的文件驗證進度（雙方各自在對方國家的代表處驗證文件）。
//   GET  ?certificationId=  → { certification, mySide, canManage, rows }
//   POST { certificationId, itemKey, stage, note?, side? }（side 只有系統管理者要帶）

let schemaPromise;
function ensureTables() {
  schemaPromise ||= (async () => {
    await ensureSchema();
    await ensureCertificationSchema(pool);
    await ensureProgressSchema(pool);
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

export async function GET(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    await ensureTables();
    const principal = await getHrPrincipal(session);
    const result = await readProgress(pool, principal, new URL(request.url).searchParams.get('certificationId'));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('hr_agency_auth_progress_read_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '無法讀取辦理進度，請稍後再試。', code: 'server' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: '請從本站提交資料。', code: 'origin' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '表單資料格式不正確。', code: 'bad_body' }, { status: 400 }); }
  try {
    await ensureTables();
    const principal = await getHrPrincipal(session);
    const result = await saveProgress(pool, principal, body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('hr_agency_auth_progress_write_failed', error?.code || error?.name || 'Error');
    return NextResponse.json({ error: '儲存辦理進度失敗，請稍後再試。', code: 'server' }, { status: 500 });
  }
}
