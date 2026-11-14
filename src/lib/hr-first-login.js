import { query } from '@/lib/db';

// 會員「審核通過後第一次登入」時，用 LINE 發一則歡迎訊息（每位會員只發一次）。
// 以 hr_members.welcomed_at 記錄是否已發送；失敗不影響登入。

const ROLE_NAMES = {
  zh: { worker: '工作者', employer: '雇主', agency: '仲介', training_center: '訓練中心' },
  en: { worker: 'Worker', employer: 'Employer', agency: 'Agency', training_center: 'Training center' },
  tl: { worker: 'Manggagawa', employer: 'Employer', agency: 'Ahensya', training_center: 'Training center' },
};

// 快捷按鈕實際送出的永遠是「我的身分」（現有 LINE bot 已支援的指令），只有按鈕文字依語言不同。
const MENU_COMMAND = '我的身分';
const COPY = {
  zh: (type) => ({
    text: `🎉 歡迎使用！你已成功登入系統。\n\n會員類型：${type}\n之後與你有關的重要提醒，會透過這個 LINE 官方帳號通知你。\n\n若沒有看到會員選單，請輸入「${MENU_COMMAND}」。`,
    label: '我的身分',
  }),
  en: (type) => ({
    text: `🎉 Welcome! You have signed in successfully.\n\nMember type: ${type}\nImportant reminders about your account will be sent through this LINE official account.\n\nIf you do not see the member menu, tap the button below.`,
    label: 'Member menu',
  }),
  tl: (type) => ({
    text: `🎉 Maligayang pagdating! Matagumpay kang nakapag-sign in.\n\nUri ng miyembro: ${type}\nIpapadala sa LINE official account na ito ang mahahalagang paalala tungkol sa iyong account.\n\nKung hindi mo nakikita ang member menu, pindutin ang button sa ibaba.`,
    label: 'Member menu',
  }),
};

export function buildWelcomeMessage(language, role) {
  const lang = COPY[language] ? language : 'zh';
  const type = ROLE_NAMES[lang][role] || ROLE_NAMES.en[role] || role;
  const { text, label } = COPY[lang](type);
  return [{
    type: 'text',
    text,
    quickReply: { items: [{ type: 'action', action: { type: 'message', label, text: MENU_COMMAND } }] },
  }];
}

// 第一次部署時新增 welcomed_at 欄位，並把「已經有會員類型」的既有會員標記為已歡迎，
// 避免所有現有會員在下次登入時一起收到歡迎訊息。已存在欄位時只做一次便宜的檢查。
let columnReady = null;
function ensureWelcomeColumn(run) {
  columnReady ??= run(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'hr_members' AND column_name = 'welcomed_at') THEN
        ALTER TABLE hr_members ADD COLUMN welcomed_at TIMESTAMPTZ;
        UPDATE hr_members SET welcomed_at = NOW() WHERE role IS NOT NULL;
      END IF;
    END $$`).catch((error) => { columnReady = null; throw error; });
  return columnReady;
}

async function preferredLanguage(run, lineUserId, role) {
  try {
    const rows = await run('SELECT preferred_language FROM hr_line_member_settings WHERE line_user_id=$1', [lineUserId]);
    if (rows?.[0]?.preferred_language) return rows[0].preferred_language;
  } catch { /* 還沒有語言設定表就用預設語言 */ }
  return role === 'worker' ? 'en' : 'zh';
}

/**
 * @param {{ lineUserId?: string|null, email?: string|null }} identity 剛登入的帳號
 * @param {{ run?: Function, push?: Function }} [deps] 測試用；正式環境不需傳入
 * @returns {Promise<number>} 實際發送的歡迎訊息數
 */
export async function welcomeAfterFirstLogin({ lineUserId = null, email = null } = {}, deps = {}) {
  const run = deps.run || query;
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  if (!lineUserId && !normalizedEmail) return 0;
  await ensureWelcomeColumn(run);

  // 一個 UPDATE 同時「判斷是否第一次」與「標記已歡迎」，同時登入也只會有一個請求拿到資料列。
  const claimed = await run(`UPDATE hr_members SET welcomed_at = NOW()
      WHERE welcomed_at IS NULL AND active = TRUE AND role IS NOT NULL
        AND role <> 'system_admin' AND COALESCE(admin_scope, 'none') <> 'system'
        AND (($1::text IS NOT NULL AND line_user_id = $1) OR ($2::text IS NOT NULL AND lower(email) = $2))
      RETURNING id, role, line_user_id`, [lineUserId, normalizedEmail]);

  let sent = 0;
  for (const row of claimed || []) {
    if (!row.line_user_id) continue; // 沒綁 LINE 的會員無法推播，仍標記為已歡迎
    try {
      const push = deps.push || (await import('@/lib/hr-line-bot')).pushLineMessage;
      const language = await preferredLanguage(run, row.line_user_id, row.role);
      await push(row.line_user_id, buildWelcomeMessage(language, row.role));
      sent += 1;
    } catch (error) {
      console.error('hr_first_login_welcome_push_failed', error?.message || 'Error');
    }
  }
  return sent;
}
