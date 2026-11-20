// 「依 LINE 語言設定強制同步一次」：每個 LINE 帳號只做一次。
// 把 LINE 個人資料的語言覆蓋成 LINE 機器人的回覆語言（preferred_language），圖文選單一起換，
// 並回傳網站要用的語言讓網頁套用一次。之後使用者仍可自行切換語言，不會再被覆蓋。
// 觸發時機：使用者下一次傳訊息給官方帳號，或下一次打開網站（兩邊誰先到誰做，另一邊不會重複）。
import pool, { query } from '@/lib/db';
import { migrateOnce } from './migrate-once.js';
import { ensureLineSchema } from '@/lib/hr-schema';
import { getHrPrincipal } from '@/lib/hr-access';
import { syncLineRichMenu } from '@/lib/hr-line-bot';
import { profileLocaleToBotLanguage, webLanguageForBotLanguage } from '@/lib/hr-line-language';

export function ensureLineLanguageSyncSchema() {
  return migrateOnce('line-language-sync', async () => {
    await ensureLineSchema();
    await pool.query('ALTER TABLE hr_line_member_settings ADD COLUMN IF NOT EXISTS line_language_synced_at TIMESTAMPTZ');
  });
}

async function fetchLineProfileLanguage(lineUserId) {
  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!lineUserId || !accessToken) return null;
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null; // 例如使用者還沒加官方帳號好友（404）：下次再試
    const profile = await response.json();
    return profileLocaleToBotLanguage(profile.language);
  } catch {
    return null;
  }
}

// principal 可以是會員資料物件，或「需要時才查會員資料」的函式（避免每則訊息都多查一次資料庫）。
export async function syncLineLanguageOnce(lineUserId, principal = null) {
  if (!lineUserId) return { applied: false };
  try {
    await ensureLineLanguageSyncSchema();
    const rows = await query('SELECT line_language_synced_at FROM hr_line_member_settings WHERE line_user_id=$1', [lineUserId]);
    if (rows[0]?.line_language_synced_at) return { applied: false };

    const botLanguage = await fetchLineProfileLanguage(lineUserId);
    if (!botLanguage) return { applied: false };

    // 只有第一個把「已同步」寫進去的請求會成功，網站與機器人同時觸發也只套用一次。
    const claimed = await query(`INSERT INTO hr_line_member_settings(line_user_id,preferred_language,line_language_synced_at)
      VALUES($1,$2,NOW())
      ON CONFLICT(line_user_id) DO UPDATE
        SET preferred_language=EXCLUDED.preferred_language,line_language_synced_at=NOW(),updated_at=NOW()
        WHERE hr_line_member_settings.line_language_synced_at IS NULL
      RETURNING line_user_id`, [lineUserId, botLanguage]);
    if (!claimed.length) return { applied: false };

    try {
      const resolved = typeof principal === 'function' ? await principal() : principal;
      await syncLineRichMenu(lineUserId, resolved || null, botLanguage);
    } catch (error) {
      console.warn('line_language_sync_menu_failed', String(error?.message || 'Error').slice(0, 80));
    }
    return { applied: true, botLanguage, webLanguage: webLanguageForBotLanguage(botLanguage) };
  } catch (error) {
    console.warn('line_language_sync_failed', error?.name || 'Error');
    return { applied: false };
  }
}

export function lineMemberPrincipalLoader(lineUserId) {
  return () => getHrPrincipal({ user: { lineUserId, name: 'LINE 會員' } });
}
