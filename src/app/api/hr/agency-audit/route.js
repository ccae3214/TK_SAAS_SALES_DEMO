import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { readAgencyAudit } from '@/lib/hr-agency-audit';
import { canViewAgencyAudit, normalizeAgencyAuditFilters } from '@/lib/hr-agency-audit-core';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 仲介機構的操作紀錄。只有該機構自己的仲介管理者可以讀取，而且一律只回傳登入者所屬機構的紀錄
// （不接受 agencyId 參數，也沒有任何新增、修改、刪除的介面）。
//   GET ?actor=會員編號&q=關鍵字&before=上一頁最後一筆編號 → { rows, hasMore, actors }
export async function GET(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const principal = await getHrPrincipal(session);
    if (!canViewAgencyAudit(principal)) {
      return NextResponse.json({ error: '只有該仲介機構的仲介管理者可以查看操作紀錄。', code: 'forbidden' }, { status: 403 });
    }
    const filters = normalizeAgencyAuditFilters(new URL(request.url).searchParams);
    return NextResponse.json(await readAgencyAudit(principal.agency_id, filters));
  } catch (error) {
    console.error('hr_agency_audit_read_failed', error?.name || 'Error');
    return NextResponse.json({ error: '讀取操作紀錄失敗，請稍後再試。', code: 'server' }, { status: 500 });
  }
}
