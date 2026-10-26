-- ============================================================================
-- 0011_question_qa.sql — deterministic Question QA state + publish gate
--
-- This migration is ADDITIVE and non-destructive:
--
--   questions.qa_model        optional structured model for reasoning solvers
--   question_qa_state         last validation result per question
--   qa_test_state             last test-level result + publish eligibility
--   qa_reviews                audit trail for reruns and admin overrides
--
-- Security:
--   * all three tables are service-role only (RLS on, no policies, no grants);
--   * questions keep their existing policies;
--   * the publish gate is enforced by a BEFORE trigger on tests, so it applies
--     to the admin API and to direct SQL updates alike.
--
-- Legacy behaviour is deliberate: rows that predate this migration have no QA
-- state and stay readable. The first publish transition (or content edit) of a
-- test requires a fresh QA result. A question content edit invalidates its
-- stored result immediately, which makes student reads fail closed.
--
-- Run once in the Supabase SQL Editor. Re-running is safe.
-- ============================================================================

begin;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

-- 1. Optional structured model. Existing rows stay NULL; the text recognisers
--    keep working, so no backfill is required.
alter table public.questions
  add column if not exists qa_model jsonb;

-- 2. Per-question result.
create table if not exists public.question_qa_state (
  question_id          uuid primary key references public.questions (id) on delete cascade,
  status               text not null
                       check (status in ('PASS', 'WARNING', 'FAILED', 'NEEDS_REVIEW')),
  counts               jsonb not null default '{}'::jsonb,
  findings             jsonb not null default '[]'::jsonb,
  kind                 text,
  computed_answer      integer,
  deterministic_verified boolean not null default false,
  engine_version       text not null,
  policy_version       text not null,
  question_fingerprint text not null default '',
  stale                boolean not null default false,
  checked_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists question_qa_state_status_idx
  on public.question_qa_state (status, checked_at desc);
create index if not exists question_qa_state_stale_idx
  on public.question_qa_state (stale) where stale = true;

-- 3. Per-test result. `eligible` is the publish decision; `override_reason`
--    records an explicit admin acknowledgement of review-level findings.
create table if not exists public.qa_test_state (
  test_id          uuid primary key references public.tests (id) on delete cascade,
  status           text not null
                   check (status in ('PASS', 'WARNING', 'FAILED', 'NEEDS_REVIEW')),
  counts           jsonb not null default '{}'::jsonb,
  findings         jsonb not null default '[]'::jsonb,
  question_statuses jsonb not null default '{}'::jsonb,
  eligible         boolean not null default false,
  override_reason  text,
  test_fingerprint text not null,
  engine_version   text not null,
  policy_version   text not null,
  checked_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists qa_test_state_eligible_idx
  on public.qa_test_state (eligible, checked_at desc);

-- 4. Audit trail. The existing admin audit log still records the API action;
--    this table keeps the QA-specific before/after evidence and override text.
create table if not exists public.qa_reviews (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  question_id uuid references public.questions (id) on delete set null,
  test_id     uuid references public.tests (id) on delete set null,
  action      text not null
              check (action in ('validate', 'audit', 'override', 'publish_blocked')),
  reason      text,
  findings    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists qa_reviews_test_idx
  on public.qa_reviews (test_id, created_at desc);
create index if not exists qa_reviews_question_idx
  on public.qa_reviews (question_id, created_at desc);

-- 5. Deny-all RLS: only the service-role key used by server routes can read or
--    write these tables. The browser never sees QA internals.
alter table public.question_qa_state enable row level security;
alter table public.qa_test_state enable row level security;
alter table public.qa_reviews enable row level security;

drop policy if exists question_qa_state_deny_all on public.question_qa_state;
create policy question_qa_state_deny_all on public.question_qa_state
  for all to anon, authenticated using (false) with check (false);
drop policy if exists qa_test_state_deny_all on public.qa_test_state;
create policy qa_test_state_deny_all on public.qa_test_state
  for all to anon, authenticated using (false) with check (false);
drop policy if exists qa_reviews_deny_all on public.qa_reviews;
create policy qa_reviews_deny_all on public.qa_reviews
  for all to anon, authenticated using (false) with check (false);

revoke all on public.question_qa_state from anon, authenticated;
revoke all on public.qa_test_state from anon, authenticated;
revoke all on public.qa_reviews from anon, authenticated;

-- 6. Canonical test fingerprint. This MUST match testFingerprint() in
--    lib/qa/server.ts:
--      md5([id, title, exam, minutes, question_ids.join(','), template]
--          .join('\x1f'))
create or replace function public.qa_test_fingerprint(t public.tests)
returns text
language sql
immutable
as $$
  select md5(concat_ws(
    E'\x1f',
    coalesce(t.id::text, ''),
    coalesce(t.title, ''),
    coalesce(t.exam, ''),
    coalesce(t.minutes::text, ''),
    coalesce(array_to_string(t.question_ids, ','), ''),
    coalesce(t.template, '')
  ));
$$;

-- 7. Any question edit invalidates its result. A stale result is never
--    publishable and student reads fail closed until QA is rerun.
create or replace function public.qa_invalidate_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.question_qa_state (
    question_id, status, counts, findings, engine_version, policy_version,
    question_fingerprint, stale, checked_at, updated_at
  ) values (
    new.id, 'NEEDS_REVIEW', '{}'::jsonb, '[]'::jsonb, 'stale', 'stale',
    '', true, now(), now()
  )
  on conflict (question_id) do update
    set status = 'NEEDS_REVIEW',
        stale = true,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_qa_invalidate on public.questions;
create trigger questions_qa_invalidate
  after insert or update of
    exam, section, topic, difficulty, stem, options, answer, explanation,
    plus, minus, image_url, qa_model
  on public.questions
  for each row execute function public.qa_invalidate_question();

-- 8. Publish gate. A test can only be published when:
--      * a fresh qa_test_state row exists for its current fingerprint;
--      * that result is eligible;
--      * every question has a current, non-FAILED result.
--    NEEDS_REVIEW questions are allowed only when the test result carries an
--    explicit override_reason (admin acknowledgement).
create or replace function public.qa_enforce_test_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.qa_test_state%rowtype;
  qid uuid;
  qs public.question_qa_state%rowtype;
begin
  if new.published is not true then
    return new;
  end if;

  select * into st from public.qa_test_state where test_id = new.id;
  if not found then
    raise exception 'QA gate: this test has no QA result. Run validation in Admin -> Question QA before publishing.'
      using errcode = 'check_violation';
  end if;

  if st.test_fingerprint is distinct from public.qa_test_fingerprint(new) then
    raise exception 'QA gate: the test changed after its last QA run. Rerun validation before publishing.'
      using errcode = 'check_violation';
  end if;

  if st.eligible is not true then
    raise exception 'QA gate: the last QA run is not publishable (%). Fix critical findings or acknowledge review findings.',
      st.status
      using errcode = 'check_violation';
  end if;

  foreach qid in array coalesce(new.question_ids, '{}'::uuid[]) loop
    select * into qs from public.question_qa_state where question_id = qid;
    if not found then
      raise exception 'QA gate: question % has no QA result. Rerun the paper validation.', qid
        using errcode = 'check_violation';
    end if;
    if qs.stale then
      raise exception 'QA gate: question % changed after its last QA run. Rerun validation.', qid
        using errcode = 'check_violation';
    end if;
    if qs.status = 'FAILED' then
      raise exception 'QA gate: question % has critical failures. Fix it before publishing.', qid
        using errcode = 'check_violation';
    end if;
    if qs.status = 'NEEDS_REVIEW' and coalesce(st.override_reason, '') = '' then
      raise exception 'QA gate: question % needs review. Acknowledge the review with a reason before publishing.', qid
        using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists tests_qa_publish_gate on public.tests;
create trigger tests_qa_publish_gate
  before insert or update of published, question_ids, title, exam, minutes, template
  on public.tests
  for each row execute function public.qa_enforce_test_publish();

insert into public.schema_migrations (version)
  values ('0011')
  on conflict (version) do nothing;

commit;

-- ============ verification (expected: 1 / 3 / 3 / 2 / 1) ============
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'questions'
       and column_name = 'qa_model') as qa_model_column,
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('question_qa_state', 'qa_test_state', 'qa_reviews')) as qa_tables,
  (select count(*) from pg_tables
     where schemaname = 'public'
       and tablename in ('question_qa_state', 'qa_test_state', 'qa_reviews')
       and rowsecurity) as rls_enabled,
  (select count(*) from pg_trigger
     where tgname in ('questions_qa_invalidate', 'tests_qa_publish_gate')) as qa_triggers,
  (select count(*) from public.schema_migrations where version = '0011') as migration_recorded;
