import { findPendingNonce, completeHandoff } from '@/lib/hr-line-handoff-store';
import { handoffRedirectUri, isToken, renderHandoffPage } from '@/lib/hr-line-handoff-core';

export const dynamic = 'force-dynamic';

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
};

const page = (ok, code, status = 200) => new Response(renderHandoffPage({ ok, code }), { status, headers: PAGE_HEADERS });

async function lineForm(url, fields) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`LINE ${response.status}`);
  return response.json();
}

// LINE 授權完成後導回這裡（通常是在 LINE App 開出來的外部瀏覽器）。
// 這裡不需要任何 cookie：身分只記在資料庫的交接單，並顯示確認碼，回到桌面 App 輸入後才算登入。
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const state = params.get('state');
  const code = params.get('code');
  if (params.get('error') || !code || !isToken(state)) return page(false, '', 400);
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  if (!channelId || !channelSecret) return page(false, '', 503);
  try {
    const nonce = await findPendingNonce(state);
    if (!nonce) return page(false, '', 400);
    const token = await lineForm('https://api.line.me/oauth2/v2.1/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: handoffRedirectUri(process.env, request.url),
      client_id: channelId,
      client_secret: channelSecret,
    });
    // 由 LINE 驗證 id_token（簽章、audience、有效期限與 nonce）。
    const profile = await lineForm('https://api.line.me/oauth2/v2.1/verify', { id_token: token.id_token, client_id: channelId, nonce });
    if (!profile?.sub) return page(false, '', 400);
    const confirmCode = await completeHandoff({ state, lineUserId: profile.sub, displayName: profile.name });
    return confirmCode ? page(true, confirmCode) : page(false, '', 400);
  } catch (error) {
    console.error('hr_line_handoff_callback_failed', error?.message || 'Error');
    return page(false, '', 502);
  }
}
