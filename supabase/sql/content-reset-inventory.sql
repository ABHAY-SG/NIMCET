-- ============================================================================
-- NimCuet content reset -- STEP 1 of 2: READ-ONLY inventory (writes NOTHING)
-- ============================================================================
--
-- Run this in Supabase -> SQL Editor and check the single result row BEFORE
-- approving / running STEP 2 (supabase/sql/content-reset.sql).
--
-- It reports:
--   * exactly how much content STEP 2 will back up and delete
--     (questions, tests + their question mappings, attempts, audit log)
--   * orphan checks: question ids referenced by tests that no longer exist
--     in the bank, and attempts whose test title matches no test row
--   * what must be PRESERVED (auth users + the auth-support tables)
--
-- Estimated counts from the project history (inventory gives the exact
-- numbers): questions ~120+ (NIMCET MOCK - 01 plant), tests 1-3,
-- attempts unknown (0 to a few dozen, depends on student usage),
-- audit log ~10-50 rows from recent admin work. Feedback/announcements
-- are preserved either way.
-- ============================================================================

select
  -- content that STEP 2 deletes --------------------------------------------
  (select count(*) from public.questions)                                    as questions_to_delete,
  (select coalesce(sum(cardinality(question_ids)), 0) from public.tests)     as question_ids_referenced_by_tests,
  (select count(*) from public.tests)                                        as tests_to_delete,
  (select count(*) from public.tests where published)                        as tests_published,
  (select count(*) from public.attempts)                                     as attempts_to_delete,
  (select count(distinct user_id) from public.attempts)                      as students_with_attempts,
  (select count(*) from public.admin_audit_log)                              as audit_rows_to_clear,
  -- orphan checks ------------------------------------------------------------
  (select count(*)
     from public.tests t
     cross join lateral unnest(t.question_ids) as ref(qid)
    where not exists (select 1 from public.questions q where q.id = ref.qid))
                                                                             as orphan_question_refs,
  (select count(*)
     from public.attempts a
    where not exists (select 1 from public.tests t where t.title = a.test))
                                                                             as attempts_with_no_test_row,
  -- preserved (STEP 2 never touches these) ----------------------------------
  (select count(*) from auth.users)                                          as auth_users_preserved,
  (select count(*) from public.oauth_account_registry)                       as oauth_registry_preserved,
  (select count(*) from public.signup_verification_sessions)                 as signup_sessions_preserved,
  (select count(*) from public.feedback)                                     as feedback_preserved,
  (select count(*) from public.announcements)                                as announcements_preserved;

-- ----------------------------------------------------------------------------
-- OPTIONAL DETAILS -- copy any ONE of these into the editor and run it alone
-- if you want a breakdown before approving the reset.
--
-- Per-test split (title, published, #questions, #attempts):
-- select t.title, t.published, cardinality(t.question_ids) as questions,
--        (select count(*) from public.attempts a where a.test = t.title) as attempts,
--        t.created_at
--   from public.tests t order by t.created_at;
--
-- Orphaned question references (must be empty after STEP 2):
-- select t.title, ref.qid
--   from public.tests t cross join lateral unnest(t.question_ids) as ref(qid)
--  where not exists (select 1 from public.questions q where q.id = ref.qid);
--
-- Audit action breakdown:
-- select action, count(*) from public.admin_audit_log group by action order by 2 desc;
-- ----------------------------------------------------------------------------
