-- NIMCET core schema + RLS, idempotent setup script.
-- REVIEW BEFORE RUNNING in Supabase Dashboard → SQL Editor.
--
-- What this creates (skips anything already present):
--   attempts, questions, tests (+ oauth_account_registry,
--   signup_verification_sessions from the auth flow).
--
-- HONEST SECURITY NOTES (read before running):
-- 1. This project has NO service-role key in the app and no role table, so
--    row policies cannot distinguish admins from students. Policies below
--    follow least-privilege WHERE the app allows it, and are explicitly
--    marked ACCEPTED-RISK where admin UI needs broad access with the anon
--    key (attempts cross-user reads; questions/tests writes).
-- 2. Compensating controls in code: middleware gates /admin pages with a
--    server-side session + allowlist check; the admin UI never links these
--    endpoints publicly. Proper fix later: service-role-backed API routes
--    + DROP the ACCEPTED-RISK policies below.
-- 3. Answer keys (questions.answer/explanation) are readable by any logged-in
--    user because the current client-side test engine scores in-browser.
--    A server-side scorer is the proper fix; until then this is accepted.
--
-- RERUN SAFETY: this file is the BASE migration. It must never be replayed on
-- a database that already has the later hardening (0002+) applied — doing so
-- would recreate the permissive policies and grants that 0002 revoked. The
-- guard below aborts in that case. For an existing production database, run
-- only supabase/migrations/0008_security_remediation.sql (which backfills the
-- ledger and re-asserts the hardening).

begin;

-- ============ migration ledger ============
-- One row per applied migration. Later migrations insert their own version;
-- 0001 refuses to run once a later version is recorded (or once the hardened
-- state is detected on databases that predate this ledger).

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

do $$
begin
  if exists (select 1 from public.schema_migrations where version > '0001') then
    raise exception 'Refusing to re-run 0001_core.sql: later migrations are recorded in public.schema_migrations. Run only the pending migrations.';
  end if;
  -- Fresh installs have no attempts table yet. If it exists but authenticated
  -- can no longer INSERT, 0002 (or a later hardening migration) already ran.
  if to_regclass('public.attempts') is not null
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    if not has_table_privilege('authenticated', 'public.attempts', 'INSERT') then
      raise exception 'Refusing to re-run 0001_core.sql: the hardened least-privilege state is already applied. Run only supabase/migrations/0008_security_remediation.sql if you need to re-assert it.';
    end if;
  end if;
end $$;

-- ============ tables ============

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test text not null,
  score numeric not null default 0,
  correct integer not null default 0,
  wrong integer not null default 0,
  skipped integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam text not null,
  section text not null default '',
  topic text not null default '',
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  stem text not null,
  options jsonb not null default '[]',
  answer integer not null default 0,
  explanation text not null default '',
  plus numeric not null default 4,
  minus numeric not null default -1,
  created_at timestamptz not null default now()
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  exam text not null,
  title text not null,
  tag text not null default '',
  minutes integer not null default 30 check (minutes >= 5 and minutes <= 180),
  free boolean not null default true,
  published boolean not null default false,
  question_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_account_registry (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.signup_verification_sessions (
  challenge_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz
);

create index if not exists attempts_user_id_created_idx
  on public.attempts (user_id, created_at desc);
create index if not exists questions_exam_difficulty_idx
  on public.questions (exam, difficulty);
create index if not exists tests_published_idx
  on public.tests (published);

-- ============ RLS ============

alter table public.attempts enable row level security;
alter table public.questions enable row level security;
alter table public.tests enable row level security;
alter table public.oauth_account_registry enable row level security;
alter table public.signup_verification_sessions enable row level security;

grant select, insert on public.attempts to authenticated;
grant select on public.questions to anon, authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select on public.tests to anon, authenticated;
grant select, insert, update, delete on public.tests to authenticated;
grant select, insert on public.oauth_account_registry to authenticated;
grant insert (challenge_id, user_id, expires_at)
  on public.signup_verification_sessions to anon, authenticated;
grant select (challenge_id, verified_at, expires_at)
  on public.signup_verification_sessions to anon;
grant select (challenge_id, user_id, verified_at, expires_at)
  on public.signup_verification_sessions to authenticated;
grant update (verified_at)
  on public.signup_verification_sessions to anon, authenticated;

-- ---- attempts policies ----
drop policy if exists "Users read own attempts" on public.attempts;
create policy "Users read own attempts"
  on public.attempts for select to authenticated
  using ((select auth.uid()) = user_id);

-- ACCEPTED-RISK (see header note 1): the admin overview/attempts pages read
-- cross-user rows with the anon key. Tighten to service-role-only reads once
-- admin API routes exist.
drop policy if exists "Admin UI reads all attempts" on public.attempts;
create policy "Admin UI reads all attempts"
  on public.attempts for select to authenticated
  using (true);

drop policy if exists "Users insert own attempts" on public.attempts;
create policy "Users insert own attempts"
  on public.attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No update/delete for anyone: attempts are immutable history. There is no
-- admin delete UI, so nothing legitimate needs it.

-- ---- questions policies ----
drop policy if exists "Logged-in users read questions" on public.questions;
create policy "Logged-in users read questions"
  on public.questions for select to authenticated
  using (true);

-- ACCEPTED-RISK (see header note 1): admin question CRUD runs with the anon
-- key, so any logged-in user could technically write. The admin UI is gated
-- by middleware + allowlist; proper fix is service-role API routes.
drop policy if exists "Admin UI manages questions" on public.questions;
create policy "Admin UI manages questions"
  on public.questions for all to authenticated
  using (true)
  with check (true);

-- ---- tests policies ----
drop policy if exists "Anyone reads published tests" on public.tests;
create policy "Anyone reads published tests"
  on public.tests for select to anon, authenticated
  using (published = true);

drop policy if exists "Logged-in users read all tests" on public.tests;
create policy "Logged-in users read all tests"
  on public.tests for select to authenticated
  using (true);

-- ACCEPTED-RISK (see header note 1): same as questions above.
drop policy if exists "Admin UI manages tests" on public.tests;
create policy "Admin UI manages tests"
  on public.tests for all to authenticated
  using (true)
  with check (true);

-- ---- oauth_account_registry policies (unchanged semantics) ----
drop policy if exists "Users can view their own account registry entry" on public.oauth_account_registry;
create policy "Users can view their own account registry entry"
  on public.oauth_account_registry for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can register their own account" on public.oauth_account_registry;
create policy "Users can register their own account"
  on public.oauth_account_registry for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---- signup_verification_sessions policies (unchanged semantics) ----
drop policy if exists "Signup clients can create verification challenges"
  on public.signup_verification_sessions;
create policy "Signup clients can create verification challenges"
  on public.signup_verification_sessions for insert to anon, authenticated
  with check (expires_at > now() and expires_at <= now() + interval '25 hours');

drop policy if exists "Public can read completed signup challenges"
  on public.signup_verification_sessions;
create policy "Public can read completed signup challenges"
  on public.signup_verification_sessions for select to anon
  using (verified_at is not null and expires_at > now());

drop policy if exists "Users can read their own signup challenges"
  on public.signup_verification_sessions;
create policy "Users can read their own signup challenges"
  on public.signup_verification_sessions for select to authenticated
  using ((select auth.uid()) = user_id or (verified_at is not null and expires_at > now()));

drop policy if exists "Verified users can complete their own signup challenge"
  on public.signup_verification_sessions;
create policy "Verified users can complete their own signup challenge"
  on public.signup_verification_sessions for update to authenticated
  using ((select auth.uid()) = user_id and verified_at is null and expires_at > now())
  with check ((select auth.uid()) = user_id and verified_at is not null);

drop policy if exists "Callback can mark unexpired challenge verified"
  on public.signup_verification_sessions;
create policy "Callback can mark unexpired challenge verified"
  on public.signup_verification_sessions for update to anon
  using (verified_at is null and expires_at > now())
  with check (verified_at is not null and expires_at > now());

insert into public.schema_migrations (version) values ('0001')
  on conflict (version) do nothing;

commit;
