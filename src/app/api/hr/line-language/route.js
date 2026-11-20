import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { syncLineLanguageOnce } from '@/lib/hr-line-language-sync';
import { requestIsSameOrigin } from '@/lib/request-origin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 依 LINE 語言設定「強制同步一次」：每個 LINE 帳號只會套用一次（記錄在 hr_line_member_settings.line_language_synced_at）。
// 套用時回傳 { applied: true, language: 'zh' | 'en' }，網頁收到後切換語言；其餘情況回傳 { applied: false }，不改任何東西。
export async function POST(request) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    // LINE 登入的 session 直接帶 lineUserId；Email 或 Google 登入的會員則用已綁定的 LINE 帳號。
    let principal = null;
    let lineUserId = session.user.lineUserId || '';
    if (!lineUserId) {
      principal = await getHrPrincipal(session);
      lineUserId = principal?.line_user_id || '';
    }
    if (!lineUserId) return NextResponse.json({ applied: false });
    const result = await syncLineLanguageOnce(lineUserId, principal || (() => getHrPrincipal(session)));
    if (!result.applied || !result.webLanguage) return NextResponse.json({ applied: false });
    return NextResponse.json({ applied: true, language: result.webLanguage });
  } catch (error) {
    console.error('hr_line_language_sync_failed', error?.name || 'Error');
    return NextResponse.json({ applied: false });
  }
}
