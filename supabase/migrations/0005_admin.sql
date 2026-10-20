-- 0005: premium admin panel — announcements, feedback inbox, audit log,
-- and additive test metadata (description + instructions).
--
-- REVIEW + RUN in Supabase Dashboard → SQL Editor, AFTER 0001 → 0002 → 0003 → 0004.
-- Idempotent: safe to re-run. Drops nothing, deletes no rows, touches no auth flow.
--
-- What this adds:
-- 1. tests.description / tests.instructions — additive columns with defaults,
--    so existing rows and the student mock runner keep working unchanged.
--    These are catalog fields (like title/tag): students may read them.
-- 2. public.announcements — student-facing notices, written by the admin UI.
-- 3. public.feedback — student feedback inbox with an admin-managed status.
-- 4. public.admin_audit_log — append-only record of sensitive admin actions.
--
-- Security model for the three new tables (same as the hardened tables from
-- 0002/0003): RLS is enabled, an explicit deny-all policy documents the intent
-- for anon/authenticated, and table grants are revoked from those roles.
-- Every read/write goes through the service role in authorized API routes
-- (admin routes: requireAdmin; student submit: requireUser). No client role
-- can ever touch these tables directly.

-- ============ 1. additive test metadata ============

begin;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;


alter table public.tests add column if not exists description text not null default '';
alter table public.tests add column if not exists instructions text not null default '';

-- ============ 2. announcements ============

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ 3. feedback ============

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null default '',
  category text not null default 'general'
    check (category in ('general', 'bug', 'content', 'test', 'other')),
  subject text not null,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'read', 'in_progress', 'resolved')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ 4. admin audit log ============

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text not null default '',
  action text not null,
  entity text not null,
  entity_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ indexes ============

create index if not exists feedback_status_created_idx
  on public.feedback (status, created_at desc);
create index if not exists announcements_published_created_idx
  on public.announcements (published, created_at desc);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

-- ============ RLS: service-role only (explicit deny-all) ============

alter table public.announcements enable row level security;
alter table public.feedback enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists announcements_deny_all on public.announcements;
create policy announcements_deny_all on public.announcements
  for all to anon, authenticated using (false) with check (false);

drop policy if exists feedback_deny_all on public.feedback;
create policy feedback_deny_all on public.feedback
  for all to anon, authenticated using (false) with check (false);

drop policy if exists admin_audit_log_deny_all on public.admin_audit_log;
create policy admin_audit_log_deny_all on public.admin_audit_log
  for all to anon, authenticated using (false) with check (false);

revoke all on public.announcements from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

insert into public.schema_migrations (version)
  values ('0001'), ('0002'), ('0003'), ('0004'), ('0005')
  on conflict (version) do nothing;

commit;

-- ============ verification (expected: 2 / 3 / 3 / 3) ============

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'tests'
       and column_name in ('description', 'instructions')) as tests_new_columns,
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('announcements', 'feedback', 'admin_audit_log')) as new_tables,
  (select count(*) from pg_tables
     where schemaname = 'public'
       and tablename in ('announcements', 'feedback', 'admin_audit_log')
       and rowsecurity) as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public'
       and policyname in ('announcements_deny_all', 'feedback_deny_all', 'admin_audit_log_deny_all')) as deny_policies;
