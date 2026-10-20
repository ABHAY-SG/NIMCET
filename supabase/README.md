# Supabase migrations

Apply these files manually in the Supabase Dashboard → SQL Editor, in numeric
order. There is no automatic migration runner in this repository, and the app
does not apply schema changes at runtime.

| File | Purpose |
| --- | --- |
| `0001_core.sql` | Base tables, views, policies and grants. Creates the `schema_migrations` ledger and refuses to replay over later hardening. |
| `0002_hardening.sql` | Least-privilege RLS, revokes direct writes, moves privileged access behind service-role routes. |
| `0003_advisor.sql` | Advisor fixes: deny-all policy, guarded `rls_auto_enable` revoke, private avatars. |
| `0004_no_definer_view.sql` | Drops the flagged definer view; the API serves the same answer-free columns. |
| `0005_admin.sql` | Announcements, feedback, audit log, test description/instructions. |
| `0006_test_sections.sql` | Additive `tests.sections`. |
| `0007_full_mock.sql` | `tests.template`, `mock_sessions`, full-mock backfill, one-open-session index. |
| `0008_security_remediation.sql` | Existing-database defensive pass: backfills the ledger, adds/verifies the one-open-session unique index, re-asserts hardening. |

## Existing production database

If `0001`–`0007` were already applied before the ledger existed, **do not rerun
them**. Run only:

1. `0008_security_remediation.sql`

It will:

1. Create/backfill `public.schema_migrations` with versions `0001`–`0007`.
2. Abort with **no changes** if the expected schema is missing.
3. Abort if any `(user_id, test_id)` pair has more than one open
   (`completed = false`) session. This is deliberate: the migration does not
   delete or silently complete a student's attempt.
4. Create
   `mock_sessions_one_open_per_test_idx` (partial unique index, `WHERE completed = false`).
5. Re-assert the hardened policies/grants for `attempts`, `questions`,
   `tests`, `mock_sessions`, announcements, feedback and the audit log.
6. Record version `0008`.

### Duplicate-open-session preflight

Run this first and review every row:

```sql
select user_id, test_id, count(*) as open_sessions,
       array_agg(id order by created_at) as session_ids
  from public.mock_sessions
 where completed = false
 group by user_id, test_id
having count(*) > 1;
```

Resolve duplicates through the app, not with direct updates:

- Let the student finish/resume the session they intend to keep; the
  completion claim closes that row.
- For clearly abandoned duplicates, use the app's normal completion path
  (`POST /api/student/attempt/complete` with the owner's session) so the
  attempt is scored and recorded.
- **Do not** run `update mock_sessions set completed = true` directly. That
  skips attempt recording and makes answered work disappear from history.

Then rerun `0008`.

### Verification after 0008

```sql
-- 1 = index exists
select count(*) from pg_indexes
 where schemaname = 'public'
   and indexname = 'mock_sessions_one_open_per_test_idx';

-- 0 = no duplicate open sessions
select count(*) from (
  select user_id, test_id from public.mock_sessions
   where completed = false group by user_id, test_id having count(*) > 1
) d;

-- 0 = no anon/authenticated write privilege on attempts
select count(*) from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'attempts'
   and grantee in ('anon','authenticated')
   and privilege_type in ('INSERT','UPDATE','DELETE');

-- 0 = no anon/authenticated privilege on questions
select count(*) from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'questions'
   and grantee in ('anon','authenticated');

-- 8 = ledger rows 0001..0008
select count(*) from public.schema_migrations;
```

## Fresh database

Run `0001` → `0008` in order. The ledger is created by `0001`; later files
record their own versions. `0001` carries a guard that aborts if a later
version is already recorded, or if the hard-lock state (no `authenticated`
insert on `attempts`) is detected.

## Rollback

Policy changes are intentionally not rolled back: reverting them would re-open
answer-key/write access. The only emergency structural rollback is:

```sql
drop index if exists public.mock_sessions_one_open_per_test_idx;
```

Remove the index only while intentionally disabling the affected start route;
re-add it after resolving the reason it could not be created.

## Notes

- `0008` is idempotent. `0003` now guards the storage/function steps so a fresh
  project without the `storage` schema or the unversioned
  `rls_auto_enable()` function does not abort the migration.
- The migration files are not executed by CI or by `next build`. Treat applying
  them as a separate, reviewed production operation.
