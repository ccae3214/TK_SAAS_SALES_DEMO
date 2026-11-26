import { NextResponse } from 'next/server';
import { requestIsSameOrigin } from '@/lib/request-origin';
import { handoffStatus } from '@/lib/hr-line-handoff-store';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// 桌面 App 輪詢：LINE 驗證完成了嗎？
export async function POST(request) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  let body = {};
  try { body = await request.json(); } catch { /* 空內容視為無效 */ }
  try {
    return NextResponse.json(await handoffStatus({ state: body?.state, secret: body?.secret }), { headers: NO_STORE });
  } catch (error) {
    console.error('hr_line_handoff_status_failed', error?.message || 'Error');
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
