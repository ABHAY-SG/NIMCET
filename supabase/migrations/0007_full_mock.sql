-- ============================================================================
-- 0007_full_mock.sql — NIMCET 2026 full-mock template + server-enforced exams
--
-- Run once in the Supabase SQL Editor (whole file, one paste). Idempotent and
-- non-destructive; re-running never deletes or duplicates anything:
--
--   1. tests.template  — marks a test as following a built-in template
--                        ("nimcet-2026"). Empty string = custom/practice test.
--   2. tests.sections  — safety add (in case 0006 was never applied).
--   3. mock_sessions   — server-side state for template exams: the start time,
--                        per-part answer snapshots and locks. Section timing
--                        and question access are enforced from this table, so
--                        the browser can no longer bend the rules.
--   4. Backfill        — the seeded "NIMCET MOCK - 01" becomes an official
--                        full mock (template + the three timed parts + 120
--                        minutes). Only touched when it has no template yet.
--
-- Untouched on purpose: questions, attempts, users, auth, and every existing
-- custom/practice test.
-- ============================================================================

begin;

-- 1. Template marker.
alter table public.tests
  add column if not exists template text not null default '';

-- 2. tests.sections is additive too (see supabase/migrations/0006_test_sections.sql).
alter table public.tests
  add column if not exists sections jsonb not null default '[]'::jsonb;

-- 3. Exam sessions — keyed to the student, service-role only.
create table if not exists public.mock_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  test_id      uuid not null,
  test_title   text not null default '',
  template     text not null default '',
  question_ids uuid[] not null default '{}',
  started_at   timestamptz not null default now(),
  -- One entry per timed part: { answers: [{id, answer}], lockedAt: iso|null }
  parts        jsonb not null default '[]'::jsonb,
  completed    boolean not null default false,
  attempt_id   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists mock_sessions_user_test_idx
  on public.mock_sessions (user_id, test_id, completed, created_at desc);
create index if not exists mock_sessions_open_idx
  on public.mock_sessions (completed, started_at desc);

alter table public.mock_sessions enable row level security;

drop policy if exists mock_sessions_deny_all on public.mock_sessions;
create policy mock_sessions_deny_all on public.mock_sessions
  for all to anon, authenticated using (false) with check (false);

revoke all on public.mock_sessions from anon, authenticated;

-- 4. Backfill the seeded full-length mock into a real full mock.
update public.tests
set template = 'nimcet-2026',
    minutes  = 120,
    sections = '[
      {"label": "Part I — Mathematics", "minutes": 70, "count": 50},
      {"label": "Part II — Analytical Ability & Logical Reasoning", "minutes": 30, "count": 40},
      {"label": "Part III — Computer Awareness & General English", "minutes": 20, "count": 30}
    ]'::jsonb
where title = 'NIMCET MOCK - 01'
  and template = '';

commit;

-- ============ verification (expected: 2 / 1 / 1 / 1 / ≥0) ============

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'tests'
       and column_name in ('template', 'sections')) as tests_columns,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'mock_sessions') as sessions_table,
  (select count(*) from pg_tables
     where schemaname = 'public' and tablename = 'mock_sessions' and rowsecurity) as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and policyname = 'mock_sessions_deny_all') as deny_policy,
  (select count(*) from public.tests where template = 'nimcet-2026') as full_mocks;
