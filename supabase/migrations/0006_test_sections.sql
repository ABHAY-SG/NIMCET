-- 0006: optional timed parts for sectioned mocks (purely additive).
--
-- tests.sections holds an ordered list of contiguous question blocks:
--   [{ "label": "Mathematics", "minutes": 70, "count": 50 }, ...]
-- The counts must add up to the number of questions in question_ids. An empty
-- array (the default) keeps the original single continuous timer, and any
-- malformed value is ignored by the student runner — so this column is safe
-- for existing rows, the admin panel and every test that never uses it.
--
-- Nothing is dropped and nothing is rewritten: existing rows keep working.
-- Idempotent — safe to run more than once. Either run this file, or simply run
-- supabase/seed/nimcet-mock-01.sql which bundles the same statement.

alter table public.tests
  add column if not exists sections jsonb not null default '[]'::jsonb;
