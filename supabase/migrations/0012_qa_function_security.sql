-- 0012_qa_function_security.sql
-- Tighten execution privileges for QA trigger/helper functions after migration
-- 0011. Trigger execution remains operational; these functions are not public
-- RPC endpoints and must not be callable through the Supabase Data API.

begin;

alter function public.qa_test_fingerprint(public.tests)
  set search_path = pg_catalog, public;

revoke all on function public.qa_test_fingerprint(public.tests)
  from public, anon, authenticated;
revoke all on function public.qa_invalidate_question()
  from public, anon, authenticated;
revoke all on function public.qa_enforce_test_publish()
  from public, anon, authenticated;

insert into public.schema_migrations (version)
  values ('0012')
  on conflict (version) do nothing;

commit;
