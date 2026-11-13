/* global process */
// 啟動「體檢／核准函到期提醒」的背景推播（僅 Node 環境）。
// 設定環境變數 HR_EXPIRY_REMINDERS=off 可關閉（畫面上的提醒不受影響）。
import { startExpiryReminderJob } from '@/lib/hr-expiry-reminders-store';

if (process.env.HR_EXPIRY_REMINDERS !== 'off') startExpiryReminderJob();
