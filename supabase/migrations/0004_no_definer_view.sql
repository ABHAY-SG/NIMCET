-- 0004: remove the SECURITY DEFINER view entirely.
-- REVIEW + RUN in Supabase Dashboard → SQL Editor, AFTER 0001 → 0002 → 0003.
-- No tables are dropped, no rows are modified, nothing is renamed.
--
-- WHY DROP INSTEAD OF security_invoker=true:
-- A security-invoker view enforces the CALLER's base-table RLS. The base
-- table below is deliberately locked (no anon/authenticated policies), so an
-- invoker view would return ZERO rows to every student and break the mock
-- runner — it secures nothing, it just breaks reads. The definer view it
-- replaces worked, but Security Advisor correctly flags ANY definer view as
-- a bypass vector, and keeping a flagged bypass is not acceptable.
-- The replacement architecture serves the same answer-free columns through
-- GET /api/student/questions (service role, session-verified), so nothing
-- functional is lost.
--
-- DEPLOY ORDER (mandatory): ship the app code FIRST (it no longer touches
-- the view), then run this migration. Reversed order breaks the mock hub
-- until the deploy lands.

-- 1. Remove the flagged view. It holds no data (a view never does).
begin;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

drop view if exists public.question_bank_public;

-- 2. Re-assert the base-table lock (idempotent; harmless if 0002 ran).
revoke all on public.questions from anon, authenticated;

drop policy if exists "Locked: no direct caller access" on public.questions;
create policy "Locked: no direct caller access"
  on public.questions for all to anon, authenticated
  using (false)
  with check (false);

insert into public.schema_migrations (version) values ('0001'), ('0002'), ('0003'), ('0004')
  on conflict (version) do nothing;

commit;

-- 3. Confirm nothing else references the dropped view (expect zero rows).
--   select * from information_schema.views
--    where table_schema = 'public' and table_name = 'question_bank_public';

-- ============ verification queries (run AFTER this migration) ============
-- Expect: relation does not exist (finding gone at the source):
--   select * from public.question_bank_public limit 1;
-- Expect: permission denied (base still locked, answers unreachable):
--   select answer, explanation from public.questions limit 1;
-- Expect: only own rows (student boundary intact):
--   select * from public.attempts;
-- Re-run Supabase Advisor → Database linter and confirm security_definer_view
-- no longer lists question_bank_public. Do NOT claim fixed before that rerun.
