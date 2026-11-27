-- Resume "skin complexion": change the old value Yellow (U+9EC3) to the new value Brown (U+68D5).
-- Safe to run more than once: only rows that still have the old value are changed.
--
-- This file is ASCII only on purpose. Windows PowerShell reads files with the ANSI code page by default,
-- which corrupted the Chinese characters (and the quote after them) into "??" and broke the SQL.
-- The Chinese values are written with U&'\XXXX' Unicode escapes so any terminal can run this file.
--
-- Usage (PowerShell, run in the project root):
--   Get-Content scripts\migrate-skin-complexion-brown.sql -Raw -Encoding UTF8 | docker compose exec -T postgres psql -U postgres -d kolecion_db -v ON_ERROR_STOP=1
BEGIN;
UPDATE hr_workers
SET resume_profile = jsonb_set(resume_profile, '{skinComplexion}', to_jsonb(U&'\68D5'::text))
WHERE resume_profile->>'skinComplexion' IN (U&'\9EC3', 'Yellow', 'yellow');
COMMIT;
