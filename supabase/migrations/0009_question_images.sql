-- 0009: optional figure/illustration for a question (purely additive).
--
-- Some previous-year papers carry a diagram that is part of the question (for
-- example a missing-figure sequence or a data-interpretation chart). The image
-- is stored as a URL/path in questions.image_url and rendered below the stem in
-- the exam runner and on the scorecard. An empty string means "no image", so
-- every existing row and every text-only question keeps its current behaviour.
--
-- Nothing is dropped or rewritten. Idempotent — safe to run more than once.

alter table public.questions
  add column if not exists image_url text not null default '';

begin;

insert into public.schema_migrations (version)
  values ('0009')
  on conflict (version) do nothing;

commit;

-- Verification
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'questions'
--      and column_name = 'image_url';
