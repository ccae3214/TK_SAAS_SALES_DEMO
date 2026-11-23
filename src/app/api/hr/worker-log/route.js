import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { listLoggableWorkers, readWorkerLog } from '@/lib/hr-worker-log';
import { normalizeWorkerLogFilters, workerLogAudience } from '@/lib/hr-worker-log-core';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 工人會員的活動紀錄。
//   工人本人：只看得到自己的紀錄（workerId 由登入身分決定，不接受前端傳入）。
//   系統管理者：看全部，或用 workerId 只看某位工人。
// 仲介、雇主、訓練中心等其他身分一律 403。
export async function GET(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const principal = await getHrPrincipal(session);
    const filters = normalizeWorkerLogFilters(new URL(request.url).searchParams);
    let scope;
    let audience;
    if (principal?.role === 'worker') {
      audience = workerLogAudience(principal, { id: principal.worker_id });
      if (!audience) return NextResponse.json({ error: '找不到你的工作者資料。' }, { status: 403 });
      scope = { workerId: Number(principal.worker_id) };
    } else if (principal?.role === 'admin') {
      audience = 'staff';
      scope = { workerId: filters.workerId };
    } else {
      return NextResponse.json({ error: '只有工人本人與系統管理者可以查看工人活動紀錄。' }, { status: 403 });
    }
    const log = await readWorkerLog({ ...scope, q: filters.q, beforeId: filters.beforeId, viewerRole: principal.role });
    const workers = audience === 'staff' ? await listLoggableWorkers() : [];
    return NextResponse.json({ audience, ...log, workers }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('hr_worker_log_read_failed', error?.name || 'Error');
    return NextResponse.json({ error: '讀取活動紀錄失敗，請稍後再試。' }, { status: 500 });
  }
}
