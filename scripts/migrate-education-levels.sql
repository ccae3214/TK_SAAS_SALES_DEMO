-- 把履歷「教育程度」舊的選項轉成新的菲律賓學歷選項（可重複執行，只會改到舊值）。
-- 小學／國中沒有對應的新選項，維持原值不動。
-- 用法（PowerShell）：
--   Get-Content scripts\migrate-education-levels.sql -Raw | docker compose exec -T postgres psql -U postgres -d saas_demo
BEGIN;
UPDATE hr_workers
SET resume_profile = jsonb_set(resume_profile, '{educationLevels}', to_jsonb(CASE resume_profile->>'educationLevels'
      WHEN '高中' THEN '高中畢業'
      WHEN '專科' THEN '副學士 / 專科學位'
      WHEN '大學' THEN '學士學位（大學畢業）' END::text))
WHERE resume_profile->>'educationLevels' IN ('高中', '專科', '大學');
COMMIT;
