/* global process */
// 到期提醒的資料層：讀出工人的體檢過期日／核准函發函日、畫面提醒清單、LINE 推播（含防重複）與背景排程。
// 規則與訊息文字在 hr-expiry-reminders.js（純函式）。
import { query } from '@/lib/db';
import { buildExpiryReminders, expiryMessage, taipeiToday } from '@/lib/hr-expiry-reminders';

const STEP_KEYS = ['medical_expiry', 'contract_issue', 'actual_entry'];

// 每位工人這三個進度項目「最新」的一筆（工作者層級與案件層級誰較新就用誰，與工作者進度頁一致）。
export async function loadExpiryInputs(run = query, workerIds = null) {
  return run(`WITH s AS (
      SELECT worker_id, step_key, completed_on, updated_at FROM hr_worker_progress_steps WHERE step_key = ANY($1::text[])
      UNION ALL
      SELECT c.worker_id, a.step_key, a.completed_on, a.updated_at FROM hr_application_steps a JOIN hr_cases c ON c.id=a.case_id WHERE a.step_key = ANY($1::text[])
    ), latest AS (
      SELECT DISTINCT ON (worker_id, step_key) worker_id, step_key, completed_on FROM s ORDER BY worker_id, step_key, updated_at DESC
    )
    SELECT w.id AS worker_id, w.name AS worker_name, w.agency_id,
      to_char(MAX(CASE WHEN l.step_key='medical_expiry' THEN l.completed_on END),'YYYY-MM-DD') AS medical_expiry_on,
      to_char(MAX(CASE WHEN l.step_key='contract_issue' THEN l.completed_on END),'YYYY-MM-DD') AS contract_issued_on,
      COALESCE(BOOL_OR(l.step_key='actual_entry' AND l.completed_on IS NOT NULL), FALSE) AS arrived
    FROM hr_workers w JOIN latest l ON l.worker_id=w.id
    WHERE w.status='active' AND ($2::bigint[] IS NULL OR w.id = ANY($2::bigint[]))
    GROUP BY w.id, w.name, w.agency_id`, [STEP_KEYS, workerIds]);
}

// 目前該提醒的清單。kinds 可限制種類（工人本人只看體檢）。
export async function collectExpiryReminders(run = query, { workerIds = null, kinds = null, today = taipeiToday() } = {}) {
  const rows = await loadExpiryInputs(run, workerIds);
  const result = [];
  for (const row of rows) {
    const reminders = buildExpiryReminders({ medicalExpiryOn: row.medical_expiry_on, contractIssuedOn: row.contract_issued_on, arrived: row.arrived }, today);
    for (const reminder of reminders) {
      if (kinds && !kinds.includes(reminder.kind)) continue;
      result.push({ ...reminder, workerId: Number(row.worker_id), workerName: row.worker_name, agencyId: row.agency_id ? Number(row.agency_id) : null });
    }
  }
  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

// 依登入者角色決定畫面上看得到哪些提醒：管理者與仲介看全部；工人只看自己的體檢；其他角色不顯示。
export function reminderKindsForRole(role) {
  if (role === 'admin' || role === 'agency') return ['medical', 'contract'];
  if (role === 'worker') return ['medical'];
  return null;
}

async function ensureLogTable() {
  await query(`CREATE TABLE IF NOT EXISTS hr_expiry_reminder_log (
    worker_id BIGINT NOT NULL REFERENCES hr_workers(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    due_on DATE NOT NULL,
    phase TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (worker_id, kind, due_on, phase)
  )`);
}

// 收件人：體檢 → 工人本人（有綁 LINE）＋ 菲律賓仲介成員；合約核准函 → 菲律賓仲介成員。
async function lineRecipients(reminder) {
  const rows = await query(`SELECT DISTINCT m.line_user_id, m.role FROM hr_members m
    WHERE m.active=TRUE AND COALESCE(m.line_user_id,'')<>''
      AND (($1::boolean AND m.role='worker' AND m.worker_id=$2) OR (m.role='agency' AND m.agency_id=$3))`,
  [reminder.kind === 'medical', reminder.workerId, reminder.agencyId]);
  if (!rows.length) return [];
  let languages = new Map();
  try {
    const settings = await query('SELECT line_user_id, preferred_language FROM hr_line_member_settings WHERE line_user_id = ANY($1::text[])', [rows.map(row => row.line_user_id)]);
    languages = new Map(settings.map(row => [row.line_user_id, row.preferred_language]));
  } catch { /* 還沒有語言設定表就用預設語言 */ }
  return rows.map(row => ({ lineUserId: row.line_user_id, language: languages.get(row.line_user_id) || (row.role === 'worker' ? 'en' : 'zh') }));
}

// 每個「工人＋種類＋到期日＋階段（快到期／已過期）」只推一次；先寫入紀錄再推播，避免兩個程序同時送出。
// 一個人都沒推成功時會刪掉紀錄，下次排程再試（例如收件人之後才綁定 LINE）。
export async function sendDueExpiryReminders({ now = new Date() } = {}) {
  if (!process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) return { skipped: 'no_line_token', sent: 0 };
  await ensureLogTable();
  const { pushLineMessage } = await import('@/lib/hr-line-bot');
  const reminders = await collectExpiryReminders(query, { today: taipeiToday(now) });
  let sent = 0;
  for (const reminder of reminders) {
    const phase = reminder.overdue ? 'overdue' : 'upcoming';
    const claimed = await query(`INSERT INTO hr_expiry_reminder_log(worker_id,kind,due_on,phase) VALUES($1,$2,$3::date,$4)
      ON CONFLICT DO NOTHING RETURNING worker_id`, [reminder.workerId, reminder.kind, reminder.dueOn, phase]);
    if (!claimed.length) continue;
    let delivered = 0;
    for (const recipient of await lineRecipients(reminder)) {
      try {
        await pushLineMessage(recipient.lineUserId, expiryMessage(recipient.language, reminder));
        delivered += 1;
      } catch (error) {
        console.error('hr_expiry_reminder_push_failed', error?.message || 'error');
      }
    }
    if (!delivered) await query('DELETE FROM hr_expiry_reminder_log WHERE worker_id=$1 AND kind=$2 AND due_on=$3::date AND phase=$4', [reminder.workerId, reminder.kind, reminder.dueOn, phase]);
    sent += delivered;
  }
  return { sent };
}

// 伺服器啟動後執行：2 分鐘後先跑一次，之後每 6 小時一次。任何錯誤只記錄，不影響網站。
export function startExpiryReminderJob({ intervalMs = 6 * 60 * 60 * 1000, firstDelayMs = 2 * 60 * 1000 } = {}) {
  if (globalThis.__hrExpiryReminderJob) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await sendDueExpiryReminders(); } catch (error) { console.error('hr_expiry_reminder_job_failed', error?.code || error?.message || 'error'); } finally { running = false; }
  };
  globalThis.__hrExpiryReminderJob = { first: setTimeout(run, firstDelayMs), repeat: setInterval(run, intervalMs) };
  globalThis.__hrExpiryReminderJob.first.unref?.();
  globalThis.__hrExpiryReminderJob.repeat.unref?.();
}
