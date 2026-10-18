-- ============================================================================
-- NIMCET full-mock verification — **READ ONLY**
--
-- This file contains NO DDL and NO DML. It never inserts, updates, deletes or
-- alters anything, and it never touches auth users, attempts or audit logs.
-- Run it as often as you like, before or after applying migrations.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Every result set is numbered and says what a healthy database looks like.
--
-- ORDER MATTERS. Run section 1 FIRST — it reports which migrations are in
-- place and never touches tests.template or tests.sections:
--   · section 1                  — always safe, before any migration
--   · sections 2 through 8       — need migration 0007 (tests.template)
--   · section 9                  — needs migration 0007 (mock_sessions)
-- Before 0007 is applied those queries stop with "column template does not
-- exist" / "relation mock_sessions does not exist". That is harmless — it is a
-- read-only file and nothing is changed — but section 1 is the check to trust
-- until then.
--
-- Source of truth for every expectation below: the official NIMCET-2026
-- Information Brochure, section "11. TEST PATTERN" —
--
--   Part I    70 min   Mathematics                        50 Q   +12 / -3     600
--   Part II   30 min   Analytical Ability & Reasoning      40 Q   +6  / -1.5   240
--   Part III  20 min   Computer Awareness (20) + General English (10)
--                                                            +6/-1.5 and +4/-1  160
--   Total    120 min   120 Q   ·   1000 marks
--
-- The brochure also states the three parts appear "one after the other", that
-- "time assigned for each part is fixed", and that "movement to one section
-- from the other is not possible" — so the stored question order must match the
-- three section counts, because the runner slices the paper BY POSITION.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Schema — what the full-mock feature needs.
--    healthy: has_template = has_sections = has_sessions = true
-- ---------------------------------------------------------------------------
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'tests'
             and column_name = 'template')                              as has_template,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'tests'
             and column_name = 'sections')                              as has_sections,
  exists (select 1 from information_schema.tables
           where table_schema = 'public' and table_name = 'mock_sessions') as has_sessions;


-- ---------------------------------------------------------------------------
-- 2. Every test flagged as a full mock, with its declared timings.
--    healthy verdict = 'ok' for each row:
--      template 'nimcet-2026', 3 timed parts, 120 section minutes,
--      stored minutes equal to the sections sum, exactly 120 questions.
--    'DRIFT' means tests.minutes disagrees with sections — the student hub
--    card derives the duration from sections, so the stored value is stale.
-- ---------------------------------------------------------------------------
select
  t.title,
  t.published,
  t.template,
  t.minutes                                              as stored_minutes,
  jsonb_array_length(t.sections)                         as section_count,
  (select coalesce(sum(case when (p ->> 'minutes') ~ '^[0-9]+$'
                            then (p ->> 'minutes')::int else 0 end), 0)
     from jsonb_array_elements(t.sections) p)            as section_minutes,
  coalesce(array_length(t.question_ids, 1), 0)           as questions,
  case
    when t.template <> 'nimcet-2026'                     then 'not a template test'
    when jsonb_array_length(t.sections) <> 3              then 'EXPECT 3 timed parts'
    when (select coalesce(sum(case when (p ->> 'minutes') ~ '^[0-9]+$'
                                   then (p ->> 'minutes')::int else 0 end), 0)
            from jsonb_array_elements(t.sections) p) <> 120
                                                          then 'EXPECT 120 section minutes'
    when t.minutes <> (select coalesce(sum(case when (p ->> 'minutes') ~ '^[0-9]+$'
                                                then (p ->> 'minutes')::int else 0 end), 0)
                         from jsonb_array_elements(t.sections) p)
                                                          then 'DRIFT: stored minutes <> sections sum'
    when coalesce(array_length(t.question_ids, 1), 0) <> 120
                                                          then 'EXPECT 120 questions'
    else 'ok'
  end                                                    as verdict
from public.tests t
where t.template = 'nimcet-2026'
order by t.title;


-- ---------------------------------------------------------------------------
-- 3. Composition measured from the LIVE question bank (not a staged temp
--    table). subject mapping approximates lib/nimcet-full-mock.ts.
--    healthy: Maths 50, Reasoning 40, Computer 20, English 10, no UNMAPPED.
-- ---------------------------------------------------------------------------
with paper as (
  select
    t.title,
    u.pos::int as pos,
    q.id       as qid,
    q.section,
    case
      when q.section ilike '%math%'                                            then 'maths'
      when q.section ilike '%reason%' or q.section ilike '%analytical%'
        or q.section ilike '%logical%'                                         then 'reasoning'
      when q.section ilike '%computer%'                                        then 'computer'
      when q.section ilike '%english%' or q.section ilike '%verbal%'           then 'english'
      else 'UNMAPPED'
    end as subject
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  left join public.questions q on q.id = u.qid
  where t.template = 'nimcet-2026'
),
expect(key, label, want) as (
  values ('maths',     'Mathematics',                          50),
         ('reasoning', 'Analytical Ability & Logical Reasoning', 40),
         ('computer',  'Computer Awareness',                   20),
         ('english',   'General English',                       10)
)
select
  p.title,
  e.key                                             as subject,
  e.label,
  count(p.qid)                                      as in_paper,
  e.want                                            as required,
  case when count(p.qid) = e.want then 'ok' else 'MISMATCH' end as verdict
from expect e
left join paper p on p.subject = e.key
group by p.title, e.key, e.label, e.want
order by p.title nulls last, e.key;


-- ---------------------------------------------------------------------------
-- 4. Question references that no longer resolve in the bank.
--    healthy: zero rows.
-- ---------------------------------------------------------------------------
with paper as (
  select t.title, u.pos::int as pos, u.qid
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  where t.template = 'nimcet-2026'
)
select p.title, p.pos, p.qid as missing_question_id
from paper p
left join public.questions q on q.id = p.qid
where q.id is null
order by p.title, p.pos;


-- ---------------------------------------------------------------------------
-- 5. Per-question marks against the official rule for that subject.
--    First set = summary (matching should equal questions).
--    Second set = the offending rows (healthy: zero rows).
-- ---------------------------------------------------------------------------
with paper as (
  select
    t.title, q.id as qid, q.section, q.plus, q.minus,
    case
      when q.section ilike '%math%'                                            then 'maths'
      when q.section ilike '%reason%' or q.section ilike '%analytical%'
        or q.section ilike '%logical%'                                         then 'reasoning'
      when q.section ilike '%computer%'                                        then 'computer'
      when q.section ilike '%english%' or q.section ilike '%verbal%'           then 'english'
      else 'UNMAPPED'
    end as subject
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  left join public.questions q on q.id = u(qid)
  where t.template = 'nimcet-2026'
)
select
  p.title,
  p.subject,
  count(*) as questions,
  sum(case
        when p.subject = 'maths'     and p.plus = 12 and p.minus = -3   then 1
        when p.subject = 'reasoning' and p.plus = 6  and p.minus = -1.5 then 1
        when p.subject = 'computer'  and p.plus = 6  and p.minus = -1.5 then 1
        when p.subject = 'english'   and p.plus = 4  and p.minus = -1   then 1
        else 0
      end) as matching_official_marks
from paper p
group by p.title, p.subject
order by p.title, p.subject;

with paper as (
  select
    t.title, q.id as qid, q.section, q.plus, q.minus,
    case
      when q.section ilike '%math%'                                            then 'maths'
      when q.section ilike '%reason%' or q.section ilike '%analytical%'
        or q.section ilike '%logical%'                                         then 'reasoning'
      when q.section ilike '%computer%'                                        then 'computer'
      when q.section ilike '%english%' or q.section ilike '%verbal%'           then 'english'
      else 'UNMAPPED'
    end as subject
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  left join public.questions q on q.id = u(qid)
  where t.template = 'nimcet-2026'
)
select p.title, p.qid, p.subject, p.section, p.plus, p.minus
from paper p
where not (p.subject = 'maths'     and p.plus = 12 and p.minus = -3)
  and not (p.subject = 'reasoning' and p.plus = 6  and p.minus = -1.5)
  and not (p.subject = 'computer'  and p.plus = 6  and p.minus = -1.5)
  and not (p.subject = 'english'   and p.plus = 4  and p.minus = -1)
order by p.title, p.subject;


-- ---------------------------------------------------------------------------
-- 6. Maximum marks. healthy: max_marks = 1000 and questions = 120.
-- ---------------------------------------------------------------------------
select
  t.title,
  coalesce(array_length(t.question_ids, 1), 0) as questions,
  sum(q.plus)                                  as max_marks,
  case when sum(q.plus) = 1000 then 'ok (1000)' else 'EXPECT 1000' end as verdict
from public.tests t
cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
left join public.questions q on q.id = u(qid)
where t.template = 'nimcet-2026'
group by t.id, t.title, t.question_ids
order by t.title;


-- ---------------------------------------------------------------------------
-- 7. PART-SLICE INTEGRITY — the check that catches a wrongly ordered paper.
--    The runner slices question_ids by POSITION using the section counts, so
--    the stored order must be Maths → Reasoning → Computer → English.
--    Expected for Part III: sections_present = 'computer, english' and
--    first_section = 'computer'. If first_section = 'english', the paper was
--    built from the seed CSV order and Part III presents English first, which
--    contradicts its own "Computer Awareness & General English" label.
-- ---------------------------------------------------------------------------
with sc as (
  select
    t.id, t.title,
    (p.value ->> 'label')                              as label,
    coalesce((p.value ->> 'count')::int, 0)            as cnt,
    p.ord
  from public.tests t
  cross join lateral jsonb_array_elements(t.sections) with ordinality as p(value, ord)
  where t.template = 'nimcet-2026'
),
bounds as (
  select
    id, title, label, ord,
    coalesce(sum(cnt) over (partition by id order by ord
      rows between unbounded preceding and current row) - cnt, 0) as start_pos,
    sum(cnt) over (partition by id order by ord
      rows between unbounded preceding and current row)           as end_pos
  from sc
),
pos as (
  select t.id, t.title, u.pos::int as pos, q.section
  from public.tests t
  cross join lateral unnest(t.question_ids) with ordinality as u(qid, pos)
  left join public.questions q on q.id = u.qid
  where t.template = 'nimcet-2026'
)
select
  b.title,
  b.ord                                              as part,
  b.label,
  b.start_pos + 1                                    as from_q,
  b.end_pos                                          as to_q,
  count(*)                                           as questions,
  (array_agg(coalesce(p.section, '(missing)') order by p.pos))[1] as first_section,
  string_agg(distinct coalesce(p.section, '(missing)'), ', '
             order by coalesce(p.section, '(missing)'))            as sections_present
from bounds b
join pos p on p.id = b.id and p.pos > b.start_pos and p.pos <= b.end_pos
group by b.title, b.ord, b.label, b.start_pos, b.end_pos
order by b.title, b.ord;


-- ---------------------------------------------------------------------------
-- 8. Duration drift across EVERY test that declares sections (not just
--    templates). The hub card shows the sections sum, so a differing stored
--    minutes column is stale — informational, nothing needs changing.
-- ---------------------------------------------------------------------------
select
  t.title,
  t.template,
  t.minutes                                            as stored_minutes,
  (select coalesce(sum(case when (p ->> 'minutes') ~ '^[0-9]+$'
                            then (p ->> 'minutes')::int else 0 end), 0)
     from jsonb_array_elements(t.sections) p)          as section_minutes,
  case
    when t.minutes = (select coalesce(sum(case when (p ->> 'minutes') ~ '^[0-9]+$'
                                               then (p ->> 'minutes')::int else 0 end), 0)
                        from jsonb_array_elements(t.sections) p)
      then 'in sync'
    else 'DRIFT — hub card shows the sections sum'
  end                                                  as verdict
from public.tests t
where jsonb_array_length(coalesce(t.sections, '[]'::jsonb)) > 0
order by t.title;


-- ---------------------------------------------------------------------------
-- 9. Exam sessions. REQUIRES migration 0007 — before it is applied this
--    query errors ("relation public.mock_sessions does not exist"), which is
--    expected and harmless. Skip this section until then.
--    healthy: open_sessions small, stale_open = 0 once windows have passed,
--             completed_without_attempt_id = 0.
-- ---------------------------------------------------------------------------
select
  count(*)                                                        as total_sessions,
  count(*) filter (where not completed)                            as open_sessions,
  count(*) filter (where completed and attempt_id is null)         as completed_without_attempt_id,
  count(*) filter (where not completed
                     and started_at < now() - interval '125 minutes') as stale_open,
  min(started_at)                                                  as oldest,
  max(started_at)                                                  as newest
from public.mock_sessions;
