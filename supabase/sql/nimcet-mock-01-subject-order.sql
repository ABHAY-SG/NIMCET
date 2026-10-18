-- ============================================================================
-- NIMCET MOCK - 01 · put the paper into official subject order
--
-- STATUS: PROPOSED — **NOT RUN**. This is a separate diff for the existing
-- test row. Review it, then run it yourself in the Supabase SQL Editor if you
-- want the change. It is NOT part of migration 0007, and nothing in the app
-- depends on it having been run.
--
-- (Not to be confused with supabase/sql/content-reset.sql, which is
-- DESTRUCTIVE. This file deletes nothing.)
--
-- WHY THIS EXISTS
--   The runner slices question_ids BY POSITION using tests.sections:
--     Part I    positions   1.. 50
--     Part II   positions  51.. 90
--     Part III  positions  91..120
--
--   The seeded paper was built in CSV order:
--     maths 1-50 · reasoning 51-90 · ENGLISH 91-100 · computer 101-120
--
--   so Part III presents General English before Computer Awareness, which
--   contradicts its own label "Part III — Computer Awareness & General
--   English" and the official brochure order. All 30 questions and every mark
--   are still correct; only the internal order of Part III differs.
--
--   The admin APIs already canonicalise to maths → reasoning → computer →
--   english on every content save (lib/admin-queries.ts normalizeFullMockIds),
--   and the CSV importer orders the same way (lib/nimcet-full-mock.ts
--   orderBySubject). This script only brings the existing row in line with
--   what a normal admin save would already produce.
--
-- SAFETY
--   · Non-destructive: ONLY the ORDER of tests.question_ids changes. Nothing
--     is inserted, updated or deleted anywhere else in the database.
--   · Idempotent: re-running is a no-op once the order is already correct.
--   · Content never changes — same question ids, same set, same length.
--   · Attempt history untouched: attempts store the test title and score, not
--     per-question positions.
--   · GATED — the UPDATE is skipped entirely unless the paper holds exactly
--     120 questions AND every one maps to a recognised NIMCET subject. If
--     anything is unrecognised it does nothing, rather than silently
--     reshuffling the paper into the wrong slices.
--   · Only the test titled 'NIMCET MOCK - 01' is ever considered.
--
-- Expect BEFORE to show Part III first_section = 'english' (if the paper came
-- from the seed CSV) and AFTER to show 'computer'.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- BEFORE — first subject of each timed part.
-- ---------------------------------------------------------------------------
with sc as (
  select
    (p.value ->> 'label')                   as label,
    coalesce((p.value ->> 'count')::int, 0) as cnt,
    p.ord
  from public.tests t
  cross join lateral jsonb_array_elements(t.sections) with ordinality as p(value, ord)
  where t.title = 'NIMCET MOCK - 01'
),
bounds as (
  select
    label,
    ord,
    coalesce(sum(cnt) over (order by ord
      rows between unbounded preceding and current row) - cnt, 0) as start_pos,
    sum(cnt) over (order by ord
      rows between unbounded preceding and current row)           as end_pos
  from sc
),
pos as (
  select u.pos::int as pos, q.section
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  left join public.questions q on q.id = u.qid
  where t.title = 'NIMCET MOCK - 01'
)
select
  'BEFORE'                            as stage,
  b.ord                               as part,
  b.label,
  b.start_pos + 1                     as from_q,
  b.end_pos                           as to_q,
  count(*)                            as questions,
  (array_agg(coalesce(p.section, '(missing)') order by p.pos))[1] as first_section
from bounds b
join pos p on p.pos > b.start_pos and p.pos <= b.end_pos
group by b.ord, b.label, b.start_pos, b.end_pos
order by b.ord;


-- ---------------------------------------------------------------------------
-- THE CHANGE — rewrite question_ids in official subject order, stable within
-- each subject. Skipped unless the gates pass.
-- ---------------------------------------------------------------------------
with mapped as (
  select
    u.qid,
    u.pos,
    case
      when q.section ilike '%math%'                                  then 1
      when q.section ilike '%reason%' or q.section ilike '%analytical%'
        or q.section ilike '%logical%'                               then 2
      when q.section ilike '%computer%'                              then 3
      when q.section ilike '%english%' or q.section ilike '%verbal%' then 4
      else 5
    end as rank
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  left join public.questions q on q.id = u.qid
  where t.title = 'NIMCET MOCK - 01'
),
gate as (
  select
    count(*)                          as total,
    count(*) filter (where rank = 5)  as unmapped
  from mapped
),
ordered as (
  select array_agg(m.qid order by m.rank, m.pos) as ids
  from mapped m, gate g
  where g.total = 120
    and g.unmapped = 0
)
update public.tests t
set question_ids = o.ids
from ordered o
where t.title = 'NIMCET MOCK - 01'
  and o.ids is not null;


-- ---------------------------------------------------------------------------
-- AFTER — same report; Part III first_section should now be 'computer'.
-- ---------------------------------------------------------------------------
with sc as (
  select
    (p.value ->> 'label')                   as label,
    coalesce((p.value ->> 'count')::int, 0) as cnt,
    p.ord
  from public.tests t
  cross join lateral jsonb_array_elements(t.sections) with ordinality as p(value, ord)
  where t.title = 'NIMCET MOCK - 01'
),
bounds as (
  select
    label,
    ord,
    coalesce(sum(cnt) over (order by ord
      rows between unbounded preceding and current row) - cnt, 0) as start_pos,
    sum(cnt) over (order by ord
      rows between unbounded preceding and current row)           as end_pos
  from sc
),
pos as (
  select u.pos::int as pos, q.section
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  left join public.questions q on q.id = u.qid
  where t.title = 'NIMCET MOCK - 01'
)
select
  'AFTER'                             as stage,
  b.ord                               as part,
  b.label,
  b.start_pos + 1                     as from_q,
  b.end_pos                           as to_q,
  count(*)                            as questions,
  (array_agg(coalesce(p.section, '(missing)') order by p.pos))[1] as first_section
from bounds b
join pos p on p.pos > b.start_pos and p.pos <= b.end_pos
group by b.ord, b.label, b.start_pos, b.end_pos
order by b.ord;


-- ---------------------------------------------------------------------------
-- GUARD — the paper must still hold exactly 120 questions.
-- ---------------------------------------------------------------------------
select
  coalesce(array_length(question_ids, 1), 0)          as questions,
  case when coalesce(array_length(question_ids, 1), 0) = 120
       then 'ok (120)' else 'UNEXPECTED — do not commit, roll back' end as verdict
from public.tests
where title = 'NIMCET MOCK - 01';

commit;
