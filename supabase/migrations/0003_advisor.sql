-- 0003: resolve Supabase Security Advisor findings without weakening anything.
-- REVIEW + RUN in Supabase Dashboard → SQL Editor, AFTER 0001 and 0002.
-- Nothing here drops tables, deletes rows, or touches auth flows.
-- Idempotent: safe to re-run.
--
-- Finding 1 — "RLS Enabled No Policy" on public.questions:
--   The base table intentionally has NO caller policies (only the service
--   role touches full rows; students use question_bank_public). An explicit
--   DENY-ALL policy documents that intent in-code instead of relying on the
--   implicit default-deny. This is not permissive and changes no behavior:
--   the service role bypasses RLS regardless.
--
-- Finding 2 — rls_auto_enable() executable by all:
--   This function is NOT in version control — it was created outside this
--   repository (dashboard tooling or manual creation). STEP 0 below shows
--   how to inspect what it does and what depends on it BEFORE revoking.
--   Revoking EXECUTE never drops the function and is instantly reversible.
--
-- Finding 3 — storage.avatars allows listing:
--   Avatar <img> tags only ever fetch ONE known path, never list buckets, so
--   listing is unnecessary exposure (it enumerates <uuid>/avatar.jpg paths).
--   The bucket goes private; display moves to short-lived signed URLs minted
--   by GET /api/avatar (session-verified, owner-only). Direct anonymous reads
--   stop working; nothing legitimate uses them after the app update ships.

-- ============ STEP 0: inspect the unknown function FIRST ============
-- Run these SELECTs and read the output before running the REVOKE below:
--   select p.oid::regprocedure, p.prosecdef, p.proowner::regrole as owner,
--          pg_get_functiondef(p.oid) as definition
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'rls_auto_enable';
--   -- Who can run it today?
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_schema = 'public' and routine_name = 'rls_auto_enable';
--   -- What depends on it (do NOT revoke if anything structural shows up)?
--   select classid::regclass as dependent, objid from pg_depend
--    where refobjid = 'public.rls_auto_enable()'::regprocedure;
-- If the definition is anything other than a benign RLS helper you recognize,
-- stop and investigate its origin before revoking.

-- ============ 1. explicit deny-all on questions (documents locked base) ============

begin;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;


drop policy if exists "Locked: no direct caller access" on public.questions;
create policy "Locked: no direct caller access"
  on public.questions for all to anon, authenticated
  using (false)
  with check (false);

-- ============ 2. revoke public execution of the unknown function ============
-- Safe: the function itself is untouched; only WHO may call it changes.
-- Guarded by catalog lookup because this function is NOT version-controlled:
-- if it does not exist (fresh project) this section is a no-op instead of an
-- error that aborts the rest of the migration. Dynamic %s handles overloads.
-- Restore anytime with:
--   grant execute on function public.rls_auto_enable() to anon, authenticated;

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  loop
    execute format('revoke execute on function %s from public', fn);
    execute format('revoke execute on function %s from anon', fn);
    execute format('revoke execute on function %s from authenticated', fn);
  end loop;
end $$;

-- ============ 3. avatars bucket: private, owner-only, no listing ============

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets set public = false where id = 'avatars';

    -- Remove the old public-read policy if the earlier setup created it, and
    -- the owner policy too so this file is genuinely re-runnable.
    execute 'drop policy if exists "Avatars are publicly readable" on storage.objects';
    execute 'drop policy if exists "Users manage own avatar" on storage.objects';
    execute 'drop policy if exists "Avatar owners manage own files" on storage.objects';

    -- Owner-only direct access (signed-URL display bypasses RLS via service
    -- role and is unaffected by these policies).
    execute $policy$
      create policy "Avatar owners manage own files"
        on storage.objects for all to authenticated
        using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
        with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$;
  end if;
end $$;

insert into public.schema_migrations (version) values ('0001'), ('0002'), ('0003')
  on conflict (version) do nothing;

commit;

-- ============ verification queries (run AFTER all three migrations) ============
-- Expect: exactly one row, no answer/explanation columns:
--   select * from public.question_bank_public limit 1;
-- Expect: permission denied (base locked, advisor finding 6 resolved):
--   select answer from public.questions limit 1;
-- Expect: permission denied (finding 1 resolved — no anon/authenticated path):
--   insert into public.attempts (user_id, test, score) values ('00000000-0000-0000-000000000000','x',0);
-- Expect: empty list (finding 2 resolved after revoke):
--   select grantee from information_schema.routine_privileges
--    where routine_schema='public' and routine_name='rls_auto_enable'
--      and grantee in ('anon','authenticated','PUBLIC');
-- Expect: false (finding 5 resolved — bucket private):
--   select public from storage.buckets where id = 'avatars';
-- Re-run Supabase Advisor → Database linter and confirm findings 1,2,3,5,6 clear.
-- Finding 4 (leaked passwords) is a Dashboard toggle, not SQL — see release notes.
-- Finding 7 (indexes) is intentionally untouched: all three are used by live
-- app queries (attempts by user+date, questions by exam+difficulty, tests by
-- published flag). No evidence exists to remove them.
