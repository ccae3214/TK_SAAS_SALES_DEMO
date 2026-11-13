import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { ensureSchema } from '@/app/api/hr/route';
import pool from '@/lib/db';
import { ensureNotificationSchema } from '@/lib/hr-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '請先登入。' }, { status: 401 });
  try {
    await ensureSchema();
    const principal = await getHrPrincipal(session);
    if (principal?.role !== 'admin') return NextResponse.json({ error: '僅限系統管理者。' }, { status: 403 });
    await ensureNotificationSchema(pool);
    // One statement/snapshot: the count and preview cannot describe different revisions.
    const result = await pool.query(`WITH pending AS (
      SELECT id,display_name,requested_role,updated_at FROM hr_members
      WHERE active=TRUE AND role IS NULL AND requested_role IS NOT NULL
    ) SELECT (SELECT COUNT(*)::integer FROM pending) AS total,
      COALESCE((SELECT jsonb_agg(item) FROM (SELECT * FROM pending ORDER BY updated_at DESC,id DESC LIMIT 10) item),'[]'::jsonb) AS items,
      (SELECT jsonb_build_object(
        'pending',COUNT(*) FILTER(WHERE n.status IN ('pending','processing')),
        'retry',COUNT(*) FILTER(WHERE n.status='retry'),
        'failed',COUNT(*) FILTER(WHERE n.status='failed'),
        'accepted',COUNT(*) FILTER(WHERE n.status='sent'))
       FROM hr_notification_outbox n JOIN pending p ON p.id=n.subject_member_id) AS delivery`);
    return NextResponse.json({ ...result.rows[0], checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('hr_notification_summary_failed');
    return NextResponse.json({ error: '通知暫時無法更新，請稍後再試。' }, { status: 500 });
  }
}
