-- 把履歷「膚色」舊的「黃 / Yellow」改成新的「棕 / Brown」（可重複執行，只會改到舊值）。
-- 用法（PowerShell）：
--   Get-Content scripts\migrate-skin-complexion-brown.sql -Raw | docker compose exec -T postgres psql -U postgres -d kolecion_db
BEGIN;
UPDATE hr_workers
SET resume_profile = jsonb_set(resume_profile, '{skinComplexion}', to_jsonb('棕'::text))
WHERE resume_profile->>'skinComplexion' IN ('黃', 'Yellow', 'yellow');
COMMIT;
