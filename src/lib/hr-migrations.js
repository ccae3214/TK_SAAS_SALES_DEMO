// 伺服器啟動時，把所有資料表遷移（CREATE／ALTER、舊資料補欄位）一次跑完。
// - 用 PostgreSQL advisory lock 排隊：多個行程／副本同時啟動時，同一時間只有一個在改資料表，不會搶 DDL 鎖。
// - 跑完後各個 ensure* 都已完成（migrateOnce 記錄在 globalThis），請求路徑只是等一個已完成的 Promise，不再改資料表。
// - 資料庫暫時連不上時會重試幾次；仍失敗只記錄錯誤、不讓伺服器掛掉，這時第一個請求會照舊補跑（行為與修改前相同）。
import pool from '@/lib/db';
import { runMigrationSteps } from '@/lib/migration-runner';
import { ensureHrIdentitySchema } from '@/lib/hr-access';
import { ensureSchema, ensureChatSchema, ensureLineSchema, ensureWorkerProgressSchema } from '@/lib/hr-schema';
import { ensureCertificationSchema } from '@/lib/hr-agency-certification-store';
import { ensureProgressSchema } from '@/lib/hr-agency-auth-progress-store';
import { ensureAgencyProfileSchema } from '@/lib/hr-agency-profile';
import { ensureTrainingCenterSchema } from '@/lib/hr-training-center';
import { ensureEmployerDocumentsSchema } from '@/lib/hr-employer-documents';
import { ensureNotificationSchema } from '@/lib/hr-notifications';
import { ensureAuditSchema } from '@/lib/hr-audit';
import { ensureAgencyAuditSchema } from '@/lib/hr-agency-audit';
import { ensureTrainingCenterAuditSchema } from '@/lib/hr-tc-audit';
import { ensureWorkerLogSchema } from '@/lib/hr-worker-log';
import { ensureLineLanguageSyncSchema } from '@/lib/hr-line-language-sync';
import { ensureLogTable as ensureExpiryReminderLog } from '@/lib/hr-expiry-reminders-store';
import { ensurePushSchema } from '@/lib/hr-call-notify-store';
import { ensureLineHandoffSchema } from '@/lib/hr-line-handoff-store';

// 順序有相依：核心資料表 → 身分／會員 → 其餘功能。
export const MIGRATION_STEPS = [
  ['core', () => ensureSchema()],
  ['identity', () => ensureHrIdentitySchema()],
  ['agency-certification', () => ensureCertificationSchema(pool)],
  ['agency-cert-progress', () => ensureProgressSchema(pool)],
  ['agency-profile', () => ensureAgencyProfileSchema(pool)],
  ['training-center', () => ensureTrainingCenterSchema()],
  ['employer-documents', () => ensureEmployerDocumentsSchema()],
  ['notifications', () => ensureNotificationSchema(pool)],
  ['audit', () => ensureAuditSchema()],
  ['agency-audit', () => ensureAgencyAuditSchema()],
  ['training-center-audit', () => ensureTrainingCenterAuditSchema()],
  ['worker-log', () => ensureWorkerLogSchema()],
  ['worker-progress', () => ensureWorkerProgressSchema()],
  ['chat', () => ensureChatSchema()],
  ['line-bot', () => ensureLineSchema()],
  ['line-language-sync', () => ensureLineLanguageSyncSchema()],
  ['expiry-reminder-log', () => ensureExpiryReminderLog()],
  ['push-subscriptions', () => ensurePushSchema()],
  ['line-handoff', () => ensureLineHandoffSchema()],
];

export function runStartupMigrations(options = {}) {
  return runMigrationSteps({ db: pool, steps: MIGRATION_STEPS, ...options });
}
