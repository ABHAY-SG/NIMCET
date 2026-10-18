-- ============================================================================
-- NimCuet admin — full data reset (one paste in Supabase → SQL Editor → Run)
-- ============================================================================
--
-- Clears, in one transaction:
--   1. public.questions        — the entire question bank
--   2. tests.question_ids      — every test row stays, but starts with 0 questions
--   3. public.attempts         — all test attempts (this is what makes the admin
--                                analytics page go back to zeros)
--   4. public.admin_audit_log  — the full admin action history
--
-- NOT touched: students (auth.users), the test rows themselves, feedback,
-- announcements, settings, storage/avatars.
--
-- After running this, "NIMCET MOCK - 01" exists but has no questions. To
-- refill it with the 120-question paper, run
-- supabase/seed/nimcet-mock-01-questions.sql next.
--
-- Re-running this file is safe: the deletes simply find nothing.
-- ============================================================================

begin;

delete from public.questions;
update public.tests set question_ids = '{}' where cardinality(question_ids) > 0;
delete from public.attempts;
delete from public.admin_audit_log;

-- Verification — every number below should be 0 after the reset.
select
  (select count(*) from public.questions)                                as questions_remaining,
  (select count(*) from public.tests where cardinality(question_ids) > 0) as tests_with_questions,
  (select count(*) from public.attempts)                                 as attempts_remaining,
  (select count(*) from public.admin_audit_log)                          as audit_rows_remaining;

commit;
