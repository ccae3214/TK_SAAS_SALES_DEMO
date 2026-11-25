/* global process */
// 伺服器啟動時（僅 Node 環境）：先跑資料表遷移，再啟動「體檢／核准函到期提醒」的背景推播。
// 設定 HR_STARTUP_MIGRATIONS=off 可略過啟動遷移（改回第一個請求時才補跑）；HR_EXPIRY_REMINDERS=off 可關閉背景推播（畫面上的提醒不受影響）。
import { runStartupMigrations } from '@/lib/hr-migrations';
import { startExpiryReminderJob } from '@/lib/hr-expiry-reminders-store';
import { registerCallNotifyHook } from '@/lib/hr-call-notify-store';

export async function registerNode() {
  // 先登記：這一步不需要資料庫，不能被下面的遷移拖慢或擋住（資料庫剛好連不上時遷移會丟出錯誤）。
  registerCallNotifyHook(); // 有人撥號時通知不在線上的被叫者（網頁推播／LINE）
  if (process.env.HR_STARTUP_MIGRATIONS !== 'off') await runStartupMigrations();
  if (process.env.HR_EXPIRY_REMINDERS !== 'off') startExpiryReminderJob();
}
