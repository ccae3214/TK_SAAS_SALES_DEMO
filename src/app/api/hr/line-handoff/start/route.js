import { NextResponse } from 'next/server';
import { requestIsSameOrigin } from '@/lib/request-origin';
import { createHandoff } from '@/lib/hr-line-handoff-store';
import { buildLineAuthorizeUrl, handoffRedirectUri, loginMessageText, officialAccountMessageUrl } from '@/lib/hr-line-handoff-core';
import { getOfficialBasicId } from '@/lib/hr-line-official-account';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// 桌面 App（PWA）開始 LINE 登入：建立交接單，回傳
//   chatUrl：開啟官方帳號聊天室並預填驗證碼（主要方式；查不到官方帳號 ID 時為 null）
//   url：LINE 網頁授權網址（沒加官方帳號好友時的備用方式）
//   secret：只有這個視窗知道，之後輪詢與登入都要帶。
// 回傳的是錯誤代碼，不是中文訊息；畫面文字由登入頁依語言顯示。
export async function POST(request) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId || !process.env.LINE_LOGIN_CHANNEL_SECRET) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  let body = {};
  try { body = await request.json(); } catch { /* 沒帶內容就用中文 */ }
  try {
    const { state, secret, nonce, chatCode } = await createHandoff();
    const basicId = await getOfficialBasicId();
    const chatUrl = basicId ? officialAccountMessageUrl(basicId, loginMessageText(body?.lang === 'en' || body?.lang === 'tl' ? 'en' : 'zh', chatCode)) : null;
    const url = buildLineAuthorizeUrl({ channelId, redirectUri: handoffRedirectUri(process.env, request.url), state, nonce });
    return NextResponse.json({ state, secret, url, chatUrl }, { headers: NO_STORE });
  } catch (error) {
    console.error('hr_line_handoff_start_failed', error?.message || 'Error');
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
