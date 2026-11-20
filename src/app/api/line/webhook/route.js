import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { replyForHrLineEvent } from '@/lib/hr-line-bot';
import { ensureLineSchema } from '@/lib/hr-schema';
import { lineMemberPrincipalLoader, syncLineLanguageOnce } from '@/lib/hr-line-language-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 舊版指令相容：整句就是舊說法時，視為對應的「工作者」指令（例如「管理工人」「我的工人」）。
// 只比對整句指令，管理者在編輯欄位時輸入的備註、姓名等自由文字不會被改動。
const LEGACY_WORKER_COMMAND = /^(?:(?:管理|我的)工人|工人(?:訓練|證照|配對|雇主)進度|配對工人進度)$/;
function withLegacyCommandTerms(event) {
  const text = event?.message?.text;
  if (event?.type !== 'message' || event.message?.type !== 'text' || typeof text !== 'string') return event;
  const command = text.trim().replace(/\s+/g, ' ');
  if (!LEGACY_WORKER_COMMAND.test(command)) return event;
  return { ...event, message: { ...event.message, text: command.replace('工人', '工作者') } };
}

function verifySignature(body, signature, secret) {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  let received;
  try { received = Buffer.from(signature, 'base64'); }
  catch { return false; }
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// 事件停在 processing 超過這段時間（行程當機、沒機會標 completed/failed），LINE 重送時就允許重新處理。
const STALE_PROCESSING_MINUTES = 2;

async function claimEvent(event) {
  const eventId = event.webhookEventId;
  if (!eventId) return true;
  const claimed = await query(`INSERT INTO hr_line_webhook_events(event_id,event_type,status,attempts)
    VALUES($1,$2,'processing',1)
    ON CONFLICT(event_id) DO UPDATE SET status='processing',attempts=hr_line_webhook_events.attempts+1,last_error=NULL,updated_at=NOW()
      WHERE hr_line_webhook_events.status='failed'
         OR (hr_line_webhook_events.status='processing'
             AND hr_line_webhook_events.updated_at < NOW() - make_interval(mins => $3::int))
    RETURNING event_id`, [eventId,event.type || 'unknown',STALE_PROCESSING_MINUTES]);
  return claimed.length > 0;
}

// 依 LINE 語言設定強制同步一次（每個 LINE 帳號只做一次，失敗不影響回覆）。
// 必須在 replyForHrLineEvent 之前，這樣使用者第一則訊息就用 LINE 語言回覆。
async function syncLanguageForEvent(event) {
  const userId = event?.source?.userId;
  if (!userId || event.source?.type !== 'user') return;
  const isFollow = event.type === 'follow';
  const isText = event.type === 'message' && event.message?.type === 'text';
  if (!isFollow && !isText) return;
  await syncLineLanguageOnce(userId, lineMemberPrincipalLoader(userId));
}

async function sendReply(replyToken, content) {
  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) throw new Error('missing_messaging_access_token');
  const messages = Array.isArray(content)
    ? content
    : [typeof content === 'string' ? { type: 'text', text: content.slice(0,4500) } : content];
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`line_reply_failed_${response.status}`);
}

export async function POST(request) {
  const channelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!channelSecret) return NextResponse.json({ ok: false, message: 'LINE Messaging API 尚未設定。' }, { status: 503 });
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    if (!verifySignature(rawBody, request.headers.get('x-line-signature'), channelSecret)) {
      return NextResponse.json({ ok: false, message: 'LINE 簽章驗證失敗。' }, { status: 401 });
    }
    const payload = JSON.parse(rawBody.toString('utf8'));
    if (!Array.isArray(payload.events)) return NextResponse.json({ ok: false, message: 'Webhook 格式不正確。' }, { status: 400 });

    if (payload.events.length) {
      await ensureLineSchema();
    }

    let replied = 0, duplicates = 0;
    for (const event of payload.events) {
      if (!(await claimEvent(event))) { duplicates += 1; continue; }
      try {
        await syncLanguageForEvent(event);
        let text = await replyForHrLineEvent(withLegacyCommandTerms(event));
        if (text === null) {
          text = '克雷迅人力仲介 LINE 服務。輸入「說明」查看查詢方式，輸入「會員網站」登入；新會員可輸入「註冊」。';
        }
        if (text && event.replyToken) {
          await sendReply(event.replyToken, text);
          replied += 1;
        }
        if (event.webhookEventId) await query(`UPDATE hr_line_webhook_events SET status='completed',last_error=NULL,updated_at=NOW() WHERE event_id=$1`, [event.webhookEventId]);
      } catch (error) {
        if (event.webhookEventId) await query(`UPDATE hr_line_webhook_events SET status='failed',last_error=$2,updated_at=NOW() WHERE event_id=$1`, [event.webhookEventId, String(error?.message || 'event_error').slice(0,100)]);
        throw error;
      }
    }
    return NextResponse.json({ ok: true, received: payload.events.length, replied, duplicates });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ ok: false, message: 'Webhook JSON 格式不正確。' }, { status: 400 });
    const errorCode = String(error?.message || '');
    console.error('hr_line_webhook_failed', /^(line_reply_failed_|line_rich_menu_(create|upload|link|unlink)_failed_|line_rich_menu_action_label_too_long_)/.test(errorCode) || errorCode === 'missing_messaging_access_token' ? errorCode : error?.name || 'Error');
    return NextResponse.json({ ok: false, message: 'LINE 回覆暫時失敗，請稍後重試。' }, { status: 502 });
  }
}