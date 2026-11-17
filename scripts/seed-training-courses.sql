-- 訓練中心預設課程：CAV 與中文 N1（可重複執行，已存在的證照／課程不會被覆蓋）。
--
-- 用法（在專案資料夾，center_email 換成訓練中心會員的 Email）：
--   Get-Content scripts/seed-training-courses.sql | docker compose exec -T postgres psql -U postgres -d saas_demo -v center_email=center@example.com
--
-- 若網站還沒更新到有「課程費用」欄位的版本，這支腳本也會先補上欄位。
\set ON_ERROR_STOP on

-- 找不到訓練中心就中止，不寫入任何資料。
SELECT COALESCE(max(id), 0) AS center_id FROM hr_members
WHERE role = 'training_center' AND lower(email) = lower(:'center_email') \gset
SELECT :center_id = 0 AS missing_center \gset
\if :missing_center
  \echo '找不到這個 Email 的訓練中心會員（會員類型必須是訓練中心），已中止。'
  \quit
\endif

BEGIN;

ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS fee NUMERIC(12,2);
ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PHP';

INSERT INTO hr_tc_certifications(center_id, name)
VALUES (:center_id, 'CAV'), (:center_id, '中文N1')
ON CONFLICT (center_id, name) DO NOTHING;

INSERT INTO hr_tc_courses(center_id, certification_id, name, fee, currency)
SELECT :center_id, c.id, v.course_name, v.fee, 'PHP'
FROM (VALUES
  ('CAV',    'CAV Training (Q8)',             35000),
  ('中文N1', 'Mandarin Training (Kolecion)',  20000)
) AS v(cert_name, course_name, fee)
JOIN hr_tc_certifications c ON c.center_id = :center_id AND c.name = v.cert_name
ON CONFLICT (center_id, certification_id, name) DO NOTHING;

COMMIT;

SELECT c.name AS certification, co.name AS course, co.fee, co.currency, co.active
FROM hr_tc_courses co JOIN hr_tc_certifications c ON c.id = co.certification_id
WHERE co.center_id = :center_id ORDER BY co.id;
