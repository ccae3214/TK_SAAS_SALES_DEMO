import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { ensureAuditSchema } from '@/lib/hr-audit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const principal = await getHrPrincipal(session);
    if (principal?.role !== 'admin') return NextResponse.json({ error: '僅系統管理者可查看操作紀錄。' }, { status: 403 });
    await ensureAuditSchema();
    const rows = await query('SELECT id,actor_name,actor_email,action,target_type,target_name,summary,created_at FROM hr_admin_audit_log ORDER BY created_at DESC, id DESC LIMIT 300');
    return NextResponse.json({ rows });
  } catch (error) {
    console.error('hr_admin_audit_read_failed', error?.name || 'Error');
    return NextResponse.json({ error: '讀取操作紀錄失敗，請稍後再試。' }, { status: 500 });
  }
}
