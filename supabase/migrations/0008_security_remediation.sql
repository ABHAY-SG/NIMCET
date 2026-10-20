-- ============================================================================
-- 0008_security_remediation.sql — defensive re-assertion + exam-start invariant
--
-- Purpose
--   1. Add the database-enforced invariant behind POST /api/student/attempt/
--      start: at most ONE open mock_session per (user_id, test_id).
--   2. Re-assert the least-privilege state from 0002/0003/0004/0005/0007 in
--      case 0001_core.sql was ever replayed and restored its permissive
--      policies/grants.
--   3. Create/backfill public.schema_migrations so old base migrations can
--      refuse to replay over newer hardening.
--
-- APPLY AFTER 0001 → 0007. This file is idempotent, but it is NOT a substitute
-- for the earlier migrations: it aborts if the expected schema is missing.
--
-- DUPLICATE PREFLIGHT (the only potentially blocking step)
--   The unique index cannot be created if an existing database already has
--   more than one open session for the same (user, test). This migration does
--   NOT delete or silently complete anyone's attempt. It raises an exception
--   naming the count; resolve the duplicates deliberately, then re-run:
--
--     select user_id, test_id, count(*) as open_sessions,
--            array_agg(id order by created_at) as session_ids
--       from public.mock_sessions
--      where completed = false
--      group by user_id, test_id
--     having count(*) > 1;
--
--   Safe resolution options (pick one, after review):
--     a) Ask each affected student to finish/resume the session they want;
--        the app's next start/completion claim will close the other.
--     b) For clearly abandoned duplicates, score/finalize them through the
--        app's normal completion path before re-running this migration.
--   Do NOT set completed = true directly: that bypasses attempt recording and
--   makes an answered attempt disappear from history.
--
-- ROLLBACK
--   The only structural addition other than indexes is the ledger table.
--   Rollback is intentionally not provided for policy changes because
--   "rolling back" would re-open answer-key/write access. If the index must be
--   removed for an emergency, it is safe to:
--     drop index if exists public.mock_sessions_one_open_per_test_idx;
--   and then fix the application/start route before re-adding it.
-- ============================================================================

begin;

-- ============ 0. ledger ============

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

-- Fail clearly (and change nothing) if this is being run out of order.
do $$
begin
  if to_regclass('public.attempts') is null
     or to_regclass('public.questions') is null
     or to_regclass('public.tests') is null
     or to_regclass('public.mock_sessions') is null then
    raise exception '0008 applied out of order: run 0001 → 0007 first. Aborting with no changes.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tests' and column_name = 'template'
  ) then
    raise exception '0008 applied out of order: tests.template is missing (run 0007). Aborting with no changes.';
  end if;
end $$;

-- Backfill the ledger only after the schema preflight above.
insert into public.schema_migrations (version)
  values ('0001'), ('0002'), ('0003'), ('0004'), ('0005'), ('0006'), ('0007')
  on conflict (version) do nothing;

-- ============ 1. one open session per (user, test) ============

do $$
declare
  dup_pairs integer;
begin
  select count(*) into dup_pairs
    from (
      select user_id, test_id
        from public.mock_sessions
       where completed = false
       group by user_id, test_id
      having count(*) > 1
    ) d;
  if dup_pairs > 0 then
    raise exception
      'Cannot create mock_sessions_one_open_per_test_idx: % (user,test) pair(s) already have multiple open sessions. Run the duplicate preflight query in the 0008 header, resolve them through the app, then re-run this migration.',
      dup_pairs;
  end if;
end $$;

create unique index if not exists mock_sessions_one_open_per_test_idx
  on public.mock_sessions (user_id, test_id)
  where completed = false;

-- ============ 2. re-assert attempts hardening ============

alter table public.attempts enable row level security;

drop policy if exists "Admin UI reads all attempts" on public.attempts;
drop policy if exists "Users insert own attempts" on public.attempts;

drop policy if exists "Users read own attempts" on public.attempts;
create policy "Users read own attempts"
  on public.attempts for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.attempts from anon, authenticated;

-- ============ 3. re-assert questions hardening ============

alter table public.questions enable row level security;

drop policy if exists "Logged-in users read questions" on public.questions;
drop policy if exists "Admin UI manages questions" on public.questions;

drop policy if exists "Locked: no direct caller access" on public.questions;
create policy "Locked: no direct caller access"
  on public.questions for all to anon, authenticated
  using (false)
  with check (false);

revoke all on public.questions from anon, authenticated;
-- Definer view from 0002 was removed by 0004; re-assert in case of replay.
drop view if exists public.question_bank_public;

-- ============ 4. re-assert tests hardening ============

alter table public.tests enable row level security;

drop policy if exists "Logged-in users read all tests" on public.tests;
drop policy if exists "Admin UI manages tests" on public.tests;

drop policy if exists "Anyone reads published tests" on public.tests;
create policy "Anyone reads published tests"
  on public.tests for select to anon, authenticated
  using (published = true);

revoke insert, update, delete on public.tests from anon, authenticated;

-- ============ 5. re-assert service-role-only tables ============

alter table public.mock_sessions enable row level security;
drop policy if exists mock_sessions_deny_all on public.mock_sessions;
create policy mock_sessions_deny_all on public.mock_sessions
  for all to anon, authenticated using (false) with check (false);
revoke all on public.mock_sessions from anon, authenticated;

do $$
begin
  if to_regclass('public.announcements') is not null then
    execute 'alter table public.announcements enable row level security';
    execute 'drop policy if exists announcements_deny_all on public.announcements';
    execute 'create policy announcements_deny_all on public.announcements for all to anon, authenticated using (false) with check (false)';
    execute 'revoke all on public.announcements from anon, authenticated';
  end if;
  if to_regclass('public.feedback') is not null then
    execute 'alter table public.feedback enable row level security';
    execute 'drop policy if exists feedback_deny_all on public.feedback';
    execute 'create policy feedback_deny_all on public.feedback for all to anon, authenticated using (false) with check (false)';
    execute 'revoke all on public.feedback from anon, authenticated';
  end if;
  if to_regclass('public.admin_audit_log') is not null then
    execute 'alter table public.admin_audit_log enable row level security';
    execute 'drop policy if exists admin_audit_log_deny_all on public.admin_audit_log';
    execute 'create policy admin_audit_log_deny_all on public.admin_audit_log for all to anon, authenticated using (false) with check (false)';
    execute 'revoke all on public.admin_audit_log from anon, authenticated';
  end if;
end $$;

insert into public.schema_migrations (version) values ('0008')
  on conflict (version) do nothing;

commit;

-- ============ verification (all expected values in comments) ============
-- 1 = unique index present
--   select count(*) from pg_indexes
--    where schemaname = 'public'
--      and indexname = 'mock_sessions_one_open_per_test_idx';
-- 0 = no duplicate open sessions
--   select count(*) from (
--     select user_id, test_id from public.mock_sessions
--      where completed = false group by user_id, test_id having count(*) > 1
--   ) d;
-- 0 = no anon/authenticated write privilege on attempts
--   select count(*) from information_schema.role_table_grants
--    where table_schema='public' and table_name='attempts'
--      and grantee in ('anon','authenticated')
--      and privilege_type in ('INSERT','UPDATE','DELETE');
-- 0 = no anon/authenticated privilege on questions
--   select count(*) from information_schema.role_table_grants
--    where table_schema='public' and table_name='questions'
--      and grantee in ('anon','authenticated');
-- 1 = published-tests policy exists; 1 = deny-all questions policy exists
--   select count(*) from pg_policies
--    where schemaname='public' and policyname in
--      ('Anyone reads published tests', 'Locked: no direct caller access');
-- 8 = ledger rows 0001..0008
--   select count(*) from public.schema_migrations;
