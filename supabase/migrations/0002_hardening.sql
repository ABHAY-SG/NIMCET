-- 0002: replace the broad interim RLS policies with least-privilege ones and
-- move privileged access behind service-role API routes.
-- REVIEW + RUN in Supabase Dashboard → SQL Editor. No tables are dropped and
-- no rows are modified — policies only.
--
-- What changes:
-- 1. attempts: students keep own-row SELECT. Direct INSERT is revoked —
--    scores are now written ONLY by POST /api/student/submit (service role),
--    so forged client scores are impossible. No UPDATE/DELETE for anyone
--    (attempts stay immutable; there is no admin delete UI).
-- 2. questions: base table loses its broad policies. Students read ONLY the
--    public view (no answer/explanation columns). Full rows + all writes go
--    through service-role admin routes after server-side allowlist checks.
-- 3. tests: metadata stays readable as before; all writes go through
--    service-role admin routes.
-- 4. question_bank_public VIEW holds zero PII and zero answer keys.

-- ============ public question view (no answers, no explanations) ============

create or replace view public.question_bank_public as
  select id, exam, section, topic, difficulty, stem, options, plus, minus
  from public.questions;

-- Views do not inherit base-table policies; grant explicitly.
grant select on public.question_bank_public to anon, authenticated;

-- ============ attempts: drop broad read, drop direct insert ============

drop policy if exists "Admin UI reads all attempts" on public.attempts;
-- NOTE: no replacement: cross-user reads happen only via service-role routes.

drop policy if exists "Users insert own attempts" on public.attempts;
-- NOTE: no replacement: inserts happen only via POST /api/student/submit
-- (service role), which scores server-side from the answer key.

drop policy if exists "Users read own attempts" on public.attempts;
create policy "Users read own attempts"
  on public.attempts for select to authenticated
  using ((select auth.uid()) = user_id);

-- ============ questions: base table locked to service role ============

drop policy if exists "Logged-in users read questions" on public.questions;
drop policy if exists "Admin UI manages questions" on public.questions;
-- NOTE: no anon/authenticated policies remain on the base table, so only the
-- service role (server API routes) can read full rows or write. Students use
-- question_bank_public; admins use /api/admin/* routes.

-- ============ tests: metadata readable, writes via service routes ============

drop policy if exists "Logged-in users read all tests" on public.tests;
drop policy if exists "Admin UI manages tests" on public.tests;
-- Kept: "Anyone reads published tests" (anon + authenticated) from 0001 —
-- titles/durations/prices are public catalog metadata, not answers.
-- NOTE: no anon/authenticated insert/update/delete remains, so all test
-- mutations go through service-role admin routes after allowlist checks.
