import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { canViewTrainingCenterAudit } from '@/lib/hr-tc-audit-shared';
import { listTrainingCenterAudit } from '@/lib/hr-tc-audit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 訓練中心操作紀錄（唯讀）：系統管理者可以看所有訓練中心；訓練中心的帳號只能看自己那一份，看別的中心回 403。
// 其他身分（仲介、雇主、工作者）一律 403。這支 API 只有 GET，沒有任何修改或刪除紀錄的方法。

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const digits = value => /^\d{1,18}$/.test(String(value ?? '')) && Number(value) > 0;

export async function GET(request) {
  const session = await auth();
  if (!session?.user) return json({ error: 'Authentication required' }, 401);
  try {
    const principal = await getHrPrincipal(session);
    const params = new URL(request.url).searchParams;
    const requested = params.get('centerId');
    // 訓練中心帳號沒帶 centerId 時，就是看自己的。
    const centerId = principal?.role === 'training_center' && requested === null ? String(principal.id) : requested;
    if (!canViewTrainingCenterAudit(principal, centerId)) return json({ error: '僅系統管理者或該訓練中心自己可查看操作紀錄。' }, 403);
    const before = params.get('before');
    if (!digits(centerId)) return json({ error: '請先選擇訓練中心。' }, 400);
    if (before !== null && !digits(before)) return json({ error: '資料編號不正確。' }, 400);
    const { rows, nextBefore } = await listTrainingCenterAudit(centerId, { before: before === null ? null : before });
    return json({ rows, nextBefore });
  } catch (error) {
    console.error('hr_tc_audit_read_failed', error?.name || 'Error');
    return json({ error: '讀取操作紀錄失敗，請稍後再試。' }, 500);
  }
}
