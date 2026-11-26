import { completeChatHandoff } from '@/lib/hr-line-handoff-store';
import { LOGIN_CODE_REPLY, extractLoginCode } from '@/lib/hr-line-handoff-core';

// 使用者名稱只是方便記錄；查不到不影響登入。
async function fetchLineDisplayName(userId) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) return '';
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return '';
    return String((await response.json())?.displayName || '');
  } catch { return ''; }
}

// webhook 收到「登入驗證碼 XXXXXXXXXX」就在這裡處理，回傳要回覆的文字；不是登入訊息回傳 null。
// 只處理一對一聊天：群組裡的訊息不能用來登入。
export async function loginCodeReplyForEvent(event) {
  if (event?.type !== 'message' || event.message?.type !== 'text' || event.source?.type !== 'user' || !event.source.userId) return null;
  const chatCode = extractLoginCode(event.message.text);
  if (!chatCode) return null;
  const userId = event.source.userId;
  const ok = await completeChatHandoff({ chatCode, lineUserId: userId, displayName: await fetchLineDisplayName(userId) });
  return ok ? LOGIN_CODE_REPLY.ok : LOGIN_CODE_REPLY.invalid;
}
