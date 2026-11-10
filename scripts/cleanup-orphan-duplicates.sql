-- 清理「變更會員類型」舊版 bug 留下的重複工作者／雇主（只處理沒有任何關聯資料的孤兒）。
-- 用法：先只執行 SELECT 確認名單，沒問題再執行下方 DELETE。
-- 孤兒 = 沒有任何會員綁定、沒有案件、沒有推薦紀錄、沒有上傳過文件，且同名資料已有會員綁定。

-- 1) 預覽：重複的孤兒工作者
SELECT w.id, w.name, w.status, w.created_at
FROM hr_workers w
WHERE NOT EXISTS (SELECT 1 FROM hr_members m WHERE m.worker_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM hr_cases c WHERE c.worker_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM hr_job_order_candidates jc WHERE jc.worker_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM hr_worker_documents d JOIN hr_document_submissions s ON s.requirement_id = d.id WHERE d.worker_id = w.id)
  AND EXISTS (SELECT 1 FROM hr_workers other JOIN hr_members m ON m.worker_id = other.id WHERE other.name = w.name AND other.id <> w.id)
ORDER BY w.name, w.id;

-- 2) 預覽：重複的孤兒雇主
SELECT e.id, e.name, e.status, e.created_at
FROM hr_employers e
WHERE NOT EXISTS (SELECT 1 FROM hr_members m WHERE m.employer_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM hr_cases c WHERE c.employer_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM hr_job_orders o WHERE o.employer_id = e.id)
  AND EXISTS (SELECT 1 FROM hr_employers other JOIN hr_members m ON m.employer_id = other.id WHERE other.name = e.name AND other.id <> e.id)
ORDER BY e.name, e.id;

-- 3) 確認後刪除（取消註解再執行）
-- BEGIN;
-- DELETE FROM hr_workers w
-- WHERE NOT EXISTS (SELECT 1 FROM hr_members m WHERE m.worker_id = w.id)
--   AND NOT EXISTS (SELECT 1 FROM hr_cases c WHERE c.worker_id = w.id)
--   AND NOT EXISTS (SELECT 1 FROM hr_job_order_candidates jc WHERE jc.worker_id = w.id)
--   AND NOT EXISTS (SELECT 1 FROM hr_worker_documents d JOIN hr_document_submissions s ON s.requirement_id = d.id WHERE d.worker_id = w.id)
--   AND EXISTS (SELECT 1 FROM hr_workers other JOIN hr_members m ON m.worker_id = other.id WHERE other.name = w.name AND other.id <> w.id);
-- DELETE FROM hr_employers e
-- WHERE NOT EXISTS (SELECT 1 FROM hr_members m WHERE m.employer_id = e.id)
--   AND NOT EXISTS (SELECT 1 FROM hr_cases c WHERE c.employer_id = e.id)
--   AND NOT EXISTS (SELECT 1 FROM hr_job_orders o WHERE o.employer_id = e.id)
--   AND EXISTS (SELECT 1 FROM hr_employers other JOIN hr_members m ON m.employer_id = other.id WHERE other.name = e.name AND other.id <> e.id);
-- COMMIT;
