-- 0002: replace the broad interim RLS policies with least-privilege ones and
-- move privileged access behind service-role API routes.
--
-- EXECUTION ORDER (mandatory): run 0001_core.sql FIRST, then this file.
-- This file only drops/recreates policies, grants and one view — it never
-- drops tables and never modifies rows, so re-running it is always safe.
-- It is NOT self-sufficient: the view needs the questions table from 0001.
--
-- What changes:
-- 1. attempts: students keep own-row SELECT. Direct INSERT is revoked —
--    scores are now written ONLY by POST /api/student/submit (service role),
--    so forged client scores are impossible. No UPDATE/DELETE for anyone
--    (attempts stay immutable; there is no admin delete UI).
-- 2. questions: base table loses its broad policies AND direct grants.
--    Students read ONLY the public view (no answer/explanation columns).
--    Full rows + all writes go through service-role admin routes after
--    server-side allowlist checks.
-- 3. tests: metadata stays readable as before; all writes go through
--    service-role admin routes.
-- 4. question_bank_public VIEW holds zero PII and zero answer keys.
-- 5. oauth_account_registry + signup_verification_sessions: UNTOUCHED —
--    signup, email verification and OAuth flows keep working exactly as is.

-- ============ public question view (no answers, no explanations) ============
--
-- SECURITY MODEL (read carefully before "improving" this):
-- A plain (definer-rights) view runs with the VIEW OWNER's rights, so the
-- base table's RLS does not filter its rows; the view exposes EXACTLY the
-- columns in its SELECT list, and access is controlled solely by GRANTs on
-- the view itself. That is precisely what we want: a fixed, answer-free
-- projection for students, while the base table stays fully locked down.
--
-- Do NOT add security_invoker = true here: that flag makes the view enforce
-- the CALLER's base-table RLS instead — and since no anon/authenticated
-- policy remains on the base table below, every student read through the
-- view would return ZERO rows (it would break the mock runner, not secure
-- it). Supabase Postgres supports the flag; it is simply the wrong tool
-- for a column-restricted public projection.
-- Supabase Auth note: the service role bypasses RLS entirely, which is how
-- the server API routes read full rows and write after allowlist checks.

create or replace view public.question_bank_public as
  select id, exam, section, topic, difficulty, stem, options, plus, minus
  from public.questions;

-- Students only (the mock runner requires login). No anon grant: the public
-- homepage demo uses hardcoded sample questions, never this view.
grant select on public.question_bank_public to authenticated;

-- ============ attempts: drop broad read, drop direct insert ============

drop policy if exists "Admin UI reads all attempts" on public.attempts;
-- NOTE: no replacement: cross-user reads happen only via service-role routes.

drop policy if exists "Users insert own attempts" on public.attempts;
-- NOTE: no replacement: inserts happen only via POST /api/student/submit
-- (service role), which scores server-side from the answer key.

-- Belt-and-braces: remove the write grants too, so even a future loosely
-- written policy cannot re-open direct writes. SELECT grant stays: the
-- own-rows policy below needs it.
revoke insert, update, delete on public.attempts from anon, authenticated;

drop policy if exists "Users read own attempts" on public.attempts;
create policy "Users read own attempts"
  on public.attempts for select to authenticated
  using ((select auth.uid()) = user_id);

-- ============ questions: base table locked to service role ============

drop policy if exists "Logged-in users read questions" on public.questions;
drop policy if exists "Admin UI manages questions" on public.questions;
-- Revoke direct rights as well: after this, ONLY the service role (server
-- API routes) can touch full rows. Students use question_bank_public above;
-- admins use /api/admin/* routes. No anon/authenticated policy remains, so
-- answer/explanation columns are unreachable from browser-held keys.
revoke all on public.questions from anon, authenticated;

-- ============ tests: metadata readable, writes via service routes ============

drop policy if exists "Logged-in users read all tests" on public.tests;
drop policy if exists "Admin UI manages tests" on public.tests;
-- Kept: "Anyone reads published tests" (anon + authenticated) from 0001 —
-- titles/durations/prices are public catalog metadata, not answers.
revoke insert, update, delete on public.tests from anon, authenticated;
-- NOTE: SELECT grants stay (published policy needs them). All test
-- mutations go through service-role admin routes after allowlist checks.

-- ============ verification queries (run these AFTER both migrations) ============
-- Expect: view WITHOUT answer/explanation columns:
--   select * from public.question_bank_public limit 1;
-- Expect: permission denied (no base-table access from anon key):
--   select answer, explanation from public.questions limit 1;
-- Expect: only own rows (logged in as a student):
--   select * from public.attempts;
-- Expect: permission denied (direct score forgery closed):
--   insert into public.attempts (user_id, test, score) values ('00000000-0000-0000-000000000000','x',0);
-- Expect: only rows where published = true (logged out or logged in):
--   select id, title, published from public.tests;
