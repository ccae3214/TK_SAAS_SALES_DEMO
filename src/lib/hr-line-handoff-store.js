import pool from '@/lib/db';
import { migrateOnce } from '@/lib/migrate-once';
import {
  HANDOFF_MAX_ATTEMPTS, HANDOFF_MAX_PENDING, HANDOFF_TTL_MS,
  hashChatCode, hashConfirmCode, hashToken, isConfirmCode, isToken, newChatCode, newConfirmCode, newToken, safeEqual,
} from '@/lib/hr-line-handoff-core';

// 交接單：桌面 App 與外部瀏覽器之間唯一共用的狀態。
//   state        公開值，會經過 LINE 與外部瀏覽器的網址
//   secret_hash  只有 App 視窗持有 secret，資料庫只存雜湊
export function ensureLineHandoffSchema() { return migrateOnce('hr-line-handoff', migrateLineHandoffSchema); }
async function migrateLineHandoffSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS hr_line_handoffs (
    state TEXT PRIMARY KEY,
    secret_hash TEXT NOT NULL,
    nonce TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','used')),
    line_user_id TEXT,
    display_name TEXT,
    confirm_code_hash TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS hr_line_handoffs_expires_at ON hr_line_handoffs(expires_at)');
  // chat_code_hash：聊天室驗證碼的雜湊；via：這張交接單是用哪種方式完成的（chat 免確認碼，browser 要輸入確認碼）。
  await pool.query('ALTER TABLE hr_line_handoffs ADD COLUMN IF NOT EXISTS chat_code_hash TEXT');
  await pool.query("ALTER TABLE hr_line_handoffs ADD COLUMN IF NOT EXISTS via TEXT CHECK (via IS NULL OR via IN ('chat','browser'))");
  await pool.query('CREATE INDEX IF NOT EXISTS hr_line_handoffs_chat_code ON hr_line_handoffs(chat_code_hash) WHERE chat_code_hash IS NOT NULL');
}

export async function createHandoff() {
  await ensureLineHandoffSchema();
  await pool.query("DELETE FROM hr_line_handoffs WHERE expires_at < NOW() - INTERVAL '1 hour'");
  const pending = await pool.query("SELECT COUNT(*)::int AS total FROM hr_line_handoffs WHERE status='pending' AND expires_at > NOW()");
  if (pending.rows[0].total >= HANDOFF_MAX_PENDING) throw new Error('line handoff busy');
  const state = newToken();
  const secret = newToken();
  const nonce = newToken();
  const chatCode = newChatCode();
  await pool.query(
    'INSERT INTO hr_line_handoffs (state, secret_hash, nonce, chat_code_hash, expires_at) VALUES ($1,$2,$3,$4,$5)',
    [state, hashToken(secret), nonce, hashChatCode(chatCode), new Date(Date.now() + HANDOFF_TTL_MS)],
  );
  return { state, secret, nonce, chatCode };
}

// callback 驗證 id_token 時要用的 nonce；只有「還在等待 LINE 驗證」的交接單才找得到。
export async function findPendingNonce(state) {
  if (!isToken(state)) return null;
  await ensureLineHandoffSchema();
  const { rows } = await pool.query("SELECT nonce FROM hr_line_handoffs WHERE state=$1 AND status='pending' AND expires_at > NOW()", [state]);
  return rows[0]?.nonce || null;
}

// LINE 驗證成功：記下身分、產生確認碼。回傳確認碼（只顯示在外部瀏覽器）；交接單已失效則回傳 null。
export async function completeHandoff({ state, lineUserId, displayName }) {
  if (!isToken(state) || !lineUserId) return null;
  await ensureLineHandoffSchema();
  const code = newConfirmCode();
  const result = await pool.query(
    `UPDATE hr_line_handoffs SET status='ready', via='browser', line_user_id=$2, display_name=$3, confirm_code_hash=$4
     WHERE state=$1 AND status='pending' AND expires_at > NOW()`,
    [state, String(lineUserId), String(displayName || '').slice(0, 200), hashConfirmCode(state, code)],
  );
  return result.rowCount === 1 ? code : null;
}

// LINE 聊天室收到登入驗證碼（寄件者身分由 LINE webhook 簽章保證）：標記完成，不需要再輸入確認碼。
// 驗證碼找不到、已過期或已被使用都回傳 false。
export async function completeChatHandoff({ chatCode, lineUserId, displayName = '' }) {
  if (!chatCode || !lineUserId) return false;
  await ensureLineHandoffSchema();
  const result = await pool.query(
    `UPDATE hr_line_handoffs SET status='ready', via='chat', line_user_id=$2, display_name=$3
     WHERE chat_code_hash=$1 AND status='pending' AND expires_at > NOW()`,
    [hashChatCode(chatCode), String(lineUserId), String(displayName || '').slice(0, 200)],
  );
  return result.rowCount === 1;
}

// App 輪詢：pending（等 LINE）／ready（via=chat 直接登入；via=browser 請輸入確認碼）／expired。
// secret 不符一律當作 expired，不洩漏交接單是否存在。
export async function handoffStatus({ state, secret }) {
  if (!isToken(state) || !isToken(secret)) return { status: 'expired', via: null };
  await ensureLineHandoffSchema();
  const { rows } = await pool.query('SELECT secret_hash, status, via, attempts, (expires_at > NOW()) AS alive FROM hr_line_handoffs WHERE state=$1', [state]);
  const row = rows[0];
  if (!row || !safeEqual(row.secret_hash, hashToken(secret)) || !row.alive || row.status === 'used' || row.attempts >= HANDOFF_MAX_ATTEMPTS) return { status: 'expired', via: null };
  return { status: row.status, via: row.status === 'ready' ? row.via : null };
}

// App 輸入確認碼後換取身分（只能成功一次）。確認碼錯誤超過上限，這張交接單就作廢。
export async function consumeHandoff({ state, secret, code }) {
  if (!isToken(state) || !isToken(secret)) return null;
  await ensureLineHandoffSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT secret_hash, status, via, line_user_id, display_name, confirm_code_hash, attempts, (expires_at > NOW()) AS alive FROM hr_line_handoffs WHERE state=$1 FOR UPDATE',
      [state],
    );
    const row = rows[0];
    let identity = null;
    if (row && row.alive && row.status === 'ready' && row.attempts < HANDOFF_MAX_ATTEMPTS && safeEqual(row.secret_hash, hashToken(secret))) {
      if (row.via === 'chat') {
        // 聊天室驗證碼已在 LINE 端驗證過身分，只需要 App 持有的 secret。
        await client.query("UPDATE hr_line_handoffs SET status='used' WHERE state=$1", [state]);
        identity = { lineUserId: row.line_user_id, displayName: row.display_name || '' };
      } else if (row.via === 'browser' && isConfirmCode(code)) {
        if (safeEqual(row.confirm_code_hash, hashConfirmCode(state, code))) {
          await client.query("UPDATE hr_line_handoffs SET status='used' WHERE state=$1", [state]);
          identity = { lineUserId: row.line_user_id, displayName: row.display_name || '' };
        } else {
          await client.query('UPDATE hr_line_handoffs SET attempts = attempts + 1 WHERE state=$1', [state]);
        }
      }
    }
    await client.query('COMMIT');
    return identity;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
