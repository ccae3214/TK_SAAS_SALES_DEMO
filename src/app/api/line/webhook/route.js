import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { ensureHrIdentitySchema } from '@/lib/hr-access';
import { replyForHrLineEvent } from '@/lib/hr-line-bot';

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

async function claimEvent(event) {
  const eventId = event.webhookEventId;
  if (!eventId) return true;
  const claimed = await query(`INSERT INTO hr_line_webhook_events(event_id,event_type,status,attempts)
    VALUES($1,$2,'processing',1)
    ON CONFLICT(event_id) DO UPDATE SET status='processing',attempts=hr_line_webhook_events.attempts+1,last_error=NULL
      WHERE hr_line_webhook_events.status='failed'
    RETURNING event_id`, [eventId,event.type || 'unknown']);
  return claimed.length > 0;
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
      await ensureHrIdentitySchema();
      await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_webhook_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('processing','completed','failed')),
        attempts INTEGER NOT NULL DEFAULT 1,
        last_error TEXT,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_member_settings (
        line_user_id TEXT PRIMARY KEY,
        preferred_language TEXT NOT NULL CHECK (preferred_language IN ('zh','en','tl')),
        rich_menu_role TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query('ALTER TABLE hr_line_member_settings ADD COLUMN IF NOT EXISTS rich_menu_role TEXT');
      await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_rich_menus (
        menu_key TEXT PRIMARY KEY,
        rich_menu_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_admin_sessions (
        line_user_id TEXT PRIMARY KEY,
        session_data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    }

    let replied = 0, duplicates = 0;
    for (const event of payload.events) {
      if (!(await claimEvent(event))) { duplicates += 1; continue; }
      try {
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