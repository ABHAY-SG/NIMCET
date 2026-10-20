# Security & exam-flow verification

These checks need a deployed (or locally running) app plus a real Supabase
project. They complement the Jest suite, which uses a fake Supabase client.
Never paste real tokens, service-role keys or student data into a ticket or
commit.

## 0. Setup

```bash
export BASE="https://nimcet-eta.vercel.app"   # or http://127.0.0.1:3100
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<publishable/anon key>"
```

Get short-lived access tokens for two test students (A and B) through your
normal Supabase auth flow, e.g. in a local Node REPL:

```js
// Do not save this file; tokens are short-lived secrets.
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const { data } = await sb.auth.signInWithPassword({
  email: process.env.STUDENT_A_EMAIL,
  password: process.env.STUDENT_A_PASSWORD,
});
console.log(data.session.access_token);
```

Then:

```bash
export A_TOKEN="<student A access token>"
export B_TOKEN="<student B access token>"
export ADMIN_TOKEN="<admin access token>"
```

Student APIs accept either the website cookie session or
`Authorization: Bearer <token>`.

## 1. Anonymous access is rejected

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/student/stats"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/student/questions?limit=5"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/student/submit" \
  -H 'content-type: application/json' -d '{"test":"x","answers":[]}'
```

Expected: `401` for each. `/dashboard` should redirect to
`/login?next=%2Fdashboard`; `/admin` to `/admin/login?next=%2Fadmin`:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE/dashboard"
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE/admin"
```

## 2. Question access is scoped

With Student A's token:

```bash
curl -s -H "Authorization: Bearer $A_TOKEN" \
  "$BASE/api/student/questions?limit=300" | head -c 400
```

- Every returned row must be part of a published, non-template test.
- No row may contain `answer` or `explanation`.
- Pick a draft question id directly from SQL:

```sql
select q.id
  from public.questions q
 where not exists (
   select 1 from public.tests t
    where t.published = true
      and coalesce(t.template, '') = ''
      and q.id = any(t.question_ids)
 );
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $A_TOKEN" \
  "$BASE/api/student/questions?ids=<draft-question-id>"
```

Expected: `403`. A question that belongs only to a published timed template
should also return `403` unless it is in one of Student A's own
`mock_sessions.question_ids`.

## 3. Submit authorization

Take a published practice test id/title and a question id from a different
test (SQL):

```sql
select id, title, question_ids
  from public.tests
 where published = true and coalesce(template, '') = ''
 order by created_at desc
 limit 3;
```

```bash
# Unknown title -> 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/student/submit" \
  -H "Authorization: Bearer $A_TOKEN" -H 'content-type: application/json' \
  -d '{"test":"Definitely not a test","answers":[{"id":"<question-id>","answer":0}]}'

# Question from a different test -> 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/student/submit" \
  -H "Authorization: Bearer $A_TOKEN" -H 'content-type: application/json' \
  -d '{"test":"<practice-title>","testId":"<practice-id>","answers":[{"id":"<other-test-question>","answer":0}]}'

# Timed template -> 409 (use its own id/question)
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/student/submit" \
  -H "Authorization: Bearer $A_TOKEN" -H 'content-type: application/json' \
  -d '{"test":"<full-mock-title>","testId":"<full-mock-id>","answers":[{"id":"<full-mock-question>","answer":0}]}'
```

A valid practice submission returns `200` with `details` (review answers). A
valid `{"test":"...","custom":true,"answers":[...]}` run returns `200` only if
every question is in the published practice pool.

## 4. Attempt ownership

Start a timed mock as A and capture `sessionId`:

```bash
curl -s -X POST "$BASE/api/student/attempt/start" \
  -H "Authorization: Bearer $A_TOKEN" -H 'content-type: application/json' \
  -d '{"testId":"<full-mock-id>"}'
```

Using B's token, call `attempt/part`, `attempt/answers` and
`attempt/complete` with A's `sessionId`.

Expected: no session data is returned (`403`/`404` as implemented); B's request
must never read A's questions, score A's attempt, or mark A's session complete.

## 5. Concurrent start (requires migration 0008)

This is the property a unit test cannot prove. Run two starts at the same
instant for the same student and test:

```bash
for i in 1 2; do
  curl -s -X POST "$BASE/api/student/attempt/start" \
    -H "Authorization: Bearer $A_TOKEN" -H 'content-type: application/json' \
    -d '{"testId":"<full-mock-id>"}' > "start-$i.json" &
done
wait
cat start-1.json start-2.json
```

Expected:

- Both requests return `200`.
- Both `sessionId` values are identical (one winner; the loser received
  `23505` from the partial unique index and re-read the winner).
- Neither response contains `previous` unless an older expired session was
  genuinely finalized.
- SQL returns exactly one open row:

```sql
select count(*) as open_sessions
  from public.mock_sessions
 where user_id = '<student-a-uuid>'
   and test_id = '<test-uuid>'
   and completed = false;
```

If both requests return different session ids, the index is missing — apply
`0008_security_remediation.sql` before retesting.

## 6. Completion/linking behaviour

- Finish a timed mock normally. The result screen must say the attempt was
  saved, and the attempt must appear once in the dashboard/history.
- Refresh the result screen / call `complete` again with the same session. No
  second attempt row may be inserted.
- If the attempt row is inserted but the session link cannot be written, the
  server deletes only the just-created attempt and releases the completion
  claim, then returns an error so the client retries. Confirm with SQL that
  there is no attempt without a session and no completed session without an
  attempt after a retry:

```sql
select count(*) from public.mock_sessions s
 where s.completed = true and s.attempt_id is null;   -- expected 0
```

## 7. Admin role checks

```bash
# Anonymous -> 401
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/admin/analytics?days=7"

# Student -> 403
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $A_TOKEN" "$BASE/api/admin/analytics?days=7"

# Admin allowlisted -> 200
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/admin/analytics?days=7"
```

## 8. Response headers

```bash
curl -sI "$BASE/" | grep -iE \
  'content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security'
```

Expected: CSP present; `X-Frame-Options: DENY`; `nosniff`;
`Referrer-Policy: strict-origin-when-cross-origin`; a restrictive
Permissions-Policy; HSTS only on HTTPS production responses.

## 9. Database migration checks

Run the verification queries at the end of
`supabase/migrations/0008_security_remediation.sql` and the duplicate preflight
in `supabase/README.md`. All expected values are documented inline.

## 10. What is not covered here

- Load/performance testing.
- Supabase Auth provider configuration (email templates, OAuth redirect URLs).
- Vercel deployment logs and WAF/CDN behavior.
