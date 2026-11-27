-- Resume "education level": convert the old options to the new Philippine education options.
-- Safe to run more than once: only rows that still have an old value are changed.
--   U&'\5C08\79D1' (associate / junior college)  ->  U&'\526F\5B78\58EB / \5C08\79D1\5B78\4F4D'
--   U&'\5927\5B78' (university)                   ->  U&'\5B78\58EB\5B78\4F4D\FF08\5927\5B78\7562\696D\FF09'
-- Elementary / junior high have no new option and stay unchanged; High School is now a real option and is not converted.
--
-- This file is ASCII only on purpose. Windows PowerShell reads files with the ANSI code page by default,
-- which corrupts Chinese characters (and the quote after them) and breaks the SQL.
-- The Chinese values are written with U&'\XXXX' Unicode escapes so any terminal can run this file.
--
-- Usage (PowerShell, run in the project root):
--   Get-Content scripts\migrate-education-levels.sql -Raw -Encoding UTF8 | docker compose exec -T postgres psql -U postgres -d kolecion_db -v ON_ERROR_STOP=1
BEGIN;
UPDATE hr_workers
SET resume_profile = jsonb_set(resume_profile, '{educationLevels}', to_jsonb(CASE resume_profile->>'educationLevels'
      WHEN U&'\5C08\79D1' THEN U&'\526F\5B78\58EB / \5C08\79D1\5B78\4F4D'
      WHEN U&'\5927\5B78' THEN U&'\5B78\58EB\5B78\4F4D\FF08\5927\5B78\7562\696D\FF09' END::text))
WHERE resume_profile->>'educationLevels' IN (U&'\5C08\79D1', U&'\5927\5B78');
COMMIT;
