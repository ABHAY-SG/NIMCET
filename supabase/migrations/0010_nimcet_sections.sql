-- ============================================================================
-- 0010_nimcet_sections.sql — official NIMCET 2026 section-aware runner
--
-- No new subject-section table is required. The existing model already has
-- everything the server needs:
--
--   tests.sections      three official timed parts (70 + 30 + 20 minutes)
--   mock_sessions.parts one answer snapshot per timed part
--   mock_sessions.started_at  the server-owned clock
--
-- The four subject sections (Mathematics, Logical Reasoning, Computer
-- Awareness, English) are derived from the official template, in paper order.
-- Part III's Computer Awareness and English share its single 20-minute clock;
-- the official brochure does not define separate timers for them.
--
-- This migration only marks the NIMCET 2026 PYQ as a server-owned full mock so
-- it uses the same timed runner as the other NIMCET full mocks. It is
-- idempotent and does not touch questions, answers, attempts or CUET tests.
-- ============================================================================

begin;

alter table public.tests
  add column if not exists template text not null default '';
alter table public.tests
  add column if not exists sections jsonb not null default '[]'::jsonb;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

-- The seeded NIMCET MOCK - 01 was authored as Maths → Reasoning → English →
-- Computer, but the official paper order is Maths → Reasoning → Computer →
-- English. Reorder its question_ids by subject (stable within each subject) so
-- the four derived section ranges line up with the real questions. Question
-- text, answers, marks and attempt history are untouched.
with ranked as (
  select t.id as test_id,
         q.id as question_id,
         u.ord,
         case
           when lower(coalesce(q.section, '')) like '%math%' then 0
           when lower(coalesce(q.section, '')) like '%reason%'
             or lower(coalesce(q.section, '')) like '%analytical%' then 1
           when lower(coalesce(q.section, '')) like '%computer%' then 2
           when lower(coalesce(q.section, '')) like '%english%' then 3
           else 4
         end as subject_rank
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(question_id, ord)
  join public.questions q on q.id = u.question_id
  where t.title = 'NIMCET MOCK - 01'
    and coalesce(array_length(t.question_ids, 1), 0) = 120
)
update public.tests t
set question_ids = (
  select array_agg(r.question_id order by r.subject_rank, r.ord)
  from ranked r
  where r.test_id = t.id
)
where t.title = 'NIMCET MOCK - 01'
  and coalesce(array_length(t.question_ids, 1), 0) = 120
  and (select count(*) from ranked r where r.test_id = t.id) = 120;

-- Open sessions keep their own question_ids snapshot. Reorder those too so a
-- student resuming an in-progress NIMCET MOCK - 01 gets the same sections;
-- stored answers are matched by question id, not position. Completed attempts
-- are left alone.
do $$
begin
  if to_regclass('public.mock_sessions') is not null then
    update public.mock_sessions s
    set question_ids = t.question_ids
    from public.tests t
    where s.test_title = 'NIMCET MOCK - 01'
      and s.test_id = t.id
      and s.completed = false
      and coalesce(array_length(t.question_ids, 1), 0) = 120;
  end if;
end $$;

-- NIMCET 2026 PYQ: 120 questions, four subjects, three official timed parts.
-- The question-count guard avoids converting an incomplete/importing row.
update public.tests
set template = 'nimcet-2026',
    minutes  = 120,
    sections = '[
      {"label": "Part I — Mathematics", "minutes": 70, "count": 50},
      {"label": "Part II — Analytical Ability & Logical Reasoning", "minutes": 30, "count": 40},
      {"label": "Part III — Computer Awareness & General English", "minutes": 20, "count": 30}
    ]'::jsonb
where title = 'NIMCET 2026 PAPER'
  and coalesce(array_length(question_ids, 1), 0) = 120;

-- Defensive repeat of 0007's backfill for databases that skipped it.
update public.tests
set template = 'nimcet-2026',
    minutes  = 120,
    sections = '[
      {"label": "Part I — Mathematics", "minutes": 70, "count": 50},
      {"label": "Part II — Analytical Ability & Logical Reasoning", "minutes": 30, "count": 40},
      {"label": "Part III — Computer Awareness & General English", "minutes": 20, "count": 30}
    ]'::jsonb
where title = 'NIMCET MOCK - 01'
  and template = ''
  and coalesce(array_length(question_ids, 1), 0) = 120;

insert into public.schema_migrations (version)
  values ('0010')
  on conflict (version) do nothing;

commit;

-- ============ verification (expected: 2 / 1 / 1) ============

select
  (select count(*) from public.tests
     where title in ('NIMCET MOCK - 01', 'NIMCET 2026 PAPER')
       and template = 'nimcet-2026') as nimcet_server_tests,
  (select count(*) from public.tests
     where title = 'NIMCET 2026 PAPER'
       and jsonb_array_length(sections) = 3) as pyq_timed_parts,
  (select count(*) from public.schema_migrations where version = '0010') as migration_recorded;
