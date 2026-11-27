-- 列出標記為測試資料（is_test）的工作者、雇主、仲介、會員，以及它們關聯的資料筆數。
-- 只讀不改（READ ONLY transaction）；要刪除哪些資料請另外決定，刪除前先 npm run db:backup。
--
-- 執行（PowerShell，在專案資料夾）：
--   Get-Content scripts\report-test-data.sql | docker compose exec -T postgres psql -U postgres -d kolecion_db -P pager=off

BEGIN TRANSACTION READ ONLY;

\echo '== 測試工作者 / Test workers'
SELECT w.id, w.name, w.status, a.name AS agency,
  (SELECT count(*) FROM hr_cases c WHERE c.worker_id=w.id) AS cases,
  (SELECT count(*) FROM hr_document_submissions s JOIN hr_worker_documents d ON d.id=s.requirement_id WHERE d.worker_id=w.id) AS uploads,
  (SELECT count(*) FROM hr_members m WHERE m.worker_id=w.id OR m.last_worker_id=w.id) AS member_accounts
FROM hr_workers w LEFT JOIN hr_agencies a ON a.id=w.agency_id
WHERE w.is_test ORDER BY w.id;

\echo '== 測試雇主 / Test employers'
SELECT e.id, e.name, e.status,
  (SELECT count(*) FROM hr_cases c WHERE c.employer_id=e.id) AS cases,
  (SELECT count(*) FROM hr_job_orders o WHERE o.employer_id=e.id) AS job_orders,
  (SELECT count(*) FROM hr_employer_documents d WHERE d.employer_id=e.id) AS documents
FROM hr_employers e WHERE e.is_test ORDER BY e.id;

\echo '== 測試仲介 / Test agencies'
SELECT a.id, a.name, a.agency_type,
  (SELECT count(*) FROM hr_workers w WHERE w.agency_id=a.id) AS workers,
  (SELECT count(*) FROM hr_employers e WHERE e.agency_id=a.id) AS employers,
  (SELECT count(*) FROM hr_members m WHERE m.agency_id=a.id) AS members
FROM hr_agencies a WHERE a.is_test ORDER BY a.id;

\echo '== 測試會員帳號 / Test member accounts'
SELECT m.id, m.display_name, m.role, m.active, m.deleted_at IS NOT NULL AS in_trash
FROM hr_members m WHERE m.is_test ORDER BY m.id;

\echo '== 注意：屬於測試對象、但本身沒有標記的資料 / Linked records not flagged themselves'
SELECT 'case' AS kind, c.id, c.case_number AS name FROM hr_cases c
  JOIN hr_workers w ON w.id=c.worker_id JOIN hr_employers e ON e.id=c.employer_id
  WHERE (w.is_test OR e.is_test) AND NOT (w.is_test AND e.is_test)
UNION ALL
SELECT 'member', m.id, m.display_name FROM hr_members m
  LEFT JOIN hr_workers w ON w.id=m.worker_id LEFT JOIN hr_employers e ON e.id=m.employer_id
  WHERE NOT m.is_test AND (w.is_test OR e.is_test)
ORDER BY 1,2;

ROLLBACK;
