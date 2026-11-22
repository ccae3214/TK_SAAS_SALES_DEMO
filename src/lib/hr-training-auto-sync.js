// 把自動判斷出的訓練狀態寫回資料庫（只往前推進，不會把手動設定較後面的狀態改回去），案件階段才會跟著前進。
import pool from '@/lib/db';
import { refreshWorkerCases } from '@/lib/hr-case-stage';
import { TRAINING_STATUS_RANK } from '@/lib/hr-training-auto-status';

export async function syncTrainingStatuses(items) {
  for (const { workerId, status } of items) {
    const client = await pool.connect();
    const run = async (sql, params) => (await client.query(sql, params)).rows;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM hr_workers WHERE id=$1 FOR UPDATE', [workerId]);
      await client.query('INSERT INTO hr_worker_health_training(worker_id) VALUES($1) ON CONFLICT(worker_id) DO NOTHING', [workerId]);
      const [current] = await run('SELECT training_status FROM hr_worker_health_training WHERE worker_id=$1 FOR UPDATE', [workerId]);
      if ((TRAINING_STATUS_RANK[current?.training_status] ?? 0) >= TRAINING_STATUS_RANK[status]) { await client.query('ROLLBACK'); continue; }
      await client.query("UPDATE hr_worker_health_training SET training_status=$2,updated_by='system',updated_at=NOW() WHERE worker_id=$1", [workerId, status]);
      await client.query("UPDATE hr_cases SET training_status=$2,updated_at=NOW() WHERE worker_id=$1 AND status<>'closed'", [workerId, status]);
      await client.query(`INSERT INTO hr_case_activity(case_id,actor_email,action,detail)
        SELECT c.id,'system','訓練狀態自動更新',$2 FROM hr_cases c WHERE c.worker_id=$1 AND c.status<>'closed'`, [workerId, status]);
      await refreshWorkerCases(run, workerId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('hr_training_auto_sync_failed', error?.code || error?.name || 'Error');
    } finally { client.release(); }
  }
}
