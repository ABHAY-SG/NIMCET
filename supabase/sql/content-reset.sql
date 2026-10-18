-- ============================================================================
-- NimCuet content reset -- STEP 2 of 2: BACKUP + DELETE (DESTRUCTIVE)
-- ============================================================================
--
-- RUN ORDER:
--   1. supabase/sql/content-reset-inventory.sql   (read-only; exact counts)
--   2. project owner approves the deletion plan
--   3. THIS FILE -- paste the whole thing into Supabase -> SQL Editor -> Run
--
-- Supersedes supabase/sql/reset-admin-data.sql (kept in git history). The old
-- script only emptied tests.question_ids; this one deletes the test rows
-- themselves too, as requested.
--
-- What this does, in ONE transaction (any error = nothing is deleted):
--   1. Saves full data copies of the four affected tables as backup tables:
--        content_reset_backup_20261018_questions
--        content_reset_backup_20261018_tests
--        content_reset_backup_20261018_attempts
--        content_reset_backup_20261018_audit
--      (data-only copies; RLS is enabled on them and API grants are revoked,
--      so the site's anon/authenticated keys cannot read them.)
--   2. Deletes (targeted DELETE -- no TRUNCATE, no DROP):
--        attempts         -> every IIT/JEE-style submission + result counters
--        tests            -> every mock test row; the question mapping
--                            (question_ids) lives on the row and is deleted
--                            with it -- there is no separate mapping table
--        questions        -> the entire question bank
--        admin_audit_log  -> the admin action history
--   3. Commits, then prints one verification row.
--
-- What this does NOT touch (verified against the schema):
--   auth.users, oauth_account_registry, signup_verification_sessions,
--   feedback, announcements, storage.avatars. No table/policy/trigger/grant
--   is altered or dropped; the only new objects are the four backup tables
--   above. Note: the script itself writes no audit entries -- the audit log
--   stays empty until the next admin action through the admin panel.
--
-- FOREIGN KEYS: none of the four tables references another (attempts.test is
-- a plain title string, tests.question_ids is a plain uuid[] with no FK,
-- audit actor_id is a plain uuid). Their only FK is attempts.user_id ->
-- auth.users ON DELETE CASCADE, which matters only when deleting USERS --
-- which this script never does. No other table references these four, so
-- targeted deletes here cannot cascade anywhere.
--
-- Re-running later: bump the _20261018 suffix everywhere in this file first.
-- The guard below refuses to run while backups with this suffix exist, so a
-- second run can never overwrite good backups.
--
-- RESTORE: see the commented snippet at the bottom of this file.
-- ============================================================================

begin;

-- 0. Refuse to run if this exact backup set already exists.
do $$
begin
  if exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname like 'content_reset_backup_20261018_%'
  ) then
    raise exception 'Backup tables content_reset_backup_20261018_* already exist - refusing to overwrite them. Rename or drop them first, or bump the suffix in this file, then re-run.';
  end if;
end $$;

-- 1. Backups: identical data copies taken BEFORE any delete.
create table public.content_reset_backup_20261018_questions as
  select * from public.questions;
create table public.content_reset_backup_20261018_tests as
  select * from public.tests;
create table public.content_reset_backup_20261018_attempts as
  select * from public.attempts;
create table public.content_reset_backup_20261018_audit as
  select * from public.admin_audit_log;

-- Lock the backups away from the API roles (service role / SQL editor keep
-- access; the site can never read these tables).
alter table public.content_reset_backup_20261018_questions enable row level security;
alter table public.content_reset_backup_20261018_tests     enable row level security;
alter table public.content_reset_backup_20261018_attempts  enable row level security;
alter table public.content_reset_backup_20261018_audit     enable row level security;
revoke all on public.content_reset_backup_20261018_questions from anon, authenticated;
revoke all on public.content_reset_backup_20261018_tests     from anon, authenticated;
revoke all on public.content_reset_backup_20261018_attempts  from anon, authenticated;
revoke all on public.content_reset_backup_20261018_audit     from anon, authenticated;

-- 2. Deletes (logical order: results first, then tests + mappings, then the
--    bank, then the audit history). No FK constraints link these tables, so
--    this order is for clarity, not for satisfying constraints.
delete from public.attempts;         -- submissions / results
delete from public.tests;            -- mock tests + their question mappings
delete from public.questions;        -- the question bank
delete from public.admin_audit_log;  -- admin action history

commit;

-- 3. Verification -- one result grid: what was deleted (from the backups)
--    and what remains (the four "remaining" numbers must all be 0;
--    auth users / feedback / announcements must be unchanged).
select
  (select count(*) from public.content_reset_backup_20261018_questions) as deleted_questions,
  (select count(*) from public.content_reset_backup_20261018_tests)     as deleted_tests,
  (select count(*) from public.content_reset_backup_20261018_attempts)  as deleted_attempts,
  (select count(*) from public.content_reset_backup_20261018_audit)     as deleted_audit_rows,
  (select count(*) from public.questions)                               as questions_remaining,
  (select count(*) from public.tests)                                   as tests_remaining,
  (select count(*) from public.attempts)                                as attempts_remaining,
  (select count(*) from public.admin_audit_log)                         as audit_remaining,
  (select count(*) from auth.users)                                     as auth_users_untouched,
  (select count(*) from public.feedback)                                as feedback_untouched,
  (select count(*) from public.announcements)                           as announcements_untouched;

-- ============================================================================
-- RESTORE (only if needed) -- paste if you ever want the deleted content
-- back. Restoring questions first keeps tests.question_ids resolvable.
-- Data-only backup copies keep the exact column order, so select * works.
-- ============================================================================
-- begin;
-- insert into public.questions       select * from public.content_reset_backup_20261018_questions;
-- insert into public.tests           select * from public.content_reset_backup_20261018_tests;
-- insert into public.attempts        select * from public.content_reset_backup_20261018_attempts;
-- insert into public.admin_audit_log select * from public.content_reset_backup_20261018_audit;
-- commit;
--
-- Once you are satisfied that you no longer need the backups:
-- drop table public.content_reset_backup_20261018_questions;
-- drop table public.content_reset_backup_20261018_tests;
-- drop table public.content_reset_backup_20261018_attempts;
-- drop table public.content_reset_backup_20261018_audit;
-- ============================================================================
