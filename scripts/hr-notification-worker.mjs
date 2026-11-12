import pg from 'pg';
import { ensureNotificationSchema, dispatchNotifications } from '../src/lib/hr-notifications.js';

if (process.env.HR_NOTIFICATION_WORKER_ENABLED !== '1') {
  console.log('hr_notification_worker_disabled');
} else {
  const url = new URL(process.env.DATABASE_URL);
  if (process.env.LOCAL_REVIEW_ONLY === '1' && (url.pathname !== '/tk_saas_review' || url.hostname !== 'review-postgres')) {
    throw new Error('Local notification worker refuses a non-review database');
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  let stopped = false;
  let wake = () => {};
  const stop = () => { stopped = true; wake(); };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    await ensureNotificationSchema(pool);
    do {
      try { console.log(JSON.stringify({ event: 'hr_notification_batch', ...await dispatchNotifications(pool) })); }
      catch { console.error('hr_notification_worker_batch_failed'); }
      if (process.argv.includes('--once') || stopped) break;
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 5000);
        wake = () => { clearTimeout(timer); resolve(); };
      });
    } while (!stopped);
  } finally { await pool.end(); }
}
