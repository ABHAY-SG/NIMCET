# NimCuet — NIMCET / CUET PG MCA mock-test platform

A Next.js 16 app for realistic NIMCET and CUET PG MCA mock tests: server-owned
timers, server-side scoring, instant scorecards, review solutions, a student
dashboard and an admin panel.

The Android client in `mobile/` is a Capacitor shell for account, catalogue,
dashboard and profile. **Full-length timed mocks run on the website**; the app
clearly labels its runner as not yet available.

## Stack

- Next.js 16 (App Router, React 19, Turbopack), TypeScript, Tailwind CSS 4
- Supabase (Postgres + Auth + Storage) with RLS; privileged writes go through
  server-only API routes using the service-role key
- Jest + ts-jest + Testing Library
- Vercel production deployment; GitHub Actions CI

## Local setup

```bash
npm ci
cp .env.example .env.local   # fill in real values (never commit .env.local)
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Legacy anon key (either key variable works) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | New publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | RLS bypass for scoring/admin routes. Never expose. |
| `ADMIN_EMAILS` | **server only** | Comma-separated admin allowlist |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Canonical URL for metadata/sitemap |

If Supabase variables are missing, the UI fails closed (no fake data, no
privileged fallback).

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm start        # serve the production build
npm run lint     # ESLint (mobile/ has its own toolchain and is ignored)
npm test         # Jest
```

## Database migrations

Migration files live in `supabase/migrations/` and are applied manually in the
Supabase SQL Editor, in order. The repository does **not** run migrations
automatically.

- `0001`–`0007`: base schema, RLS hardening, admin tables, full-mock sessions.
- `0008_security_remediation.sql`: the defensive migration for existing
  databases. It adds the one-open-session unique index and re-asserts the
  hardened policies/grants. **It is not applied automatically.**

Read `supabase/README.md` before applying anything to production. In
particular, `0008` refuses to run if duplicate open sessions already exist; it
never deletes or silently completes a student's attempt.

## Security model (short version)

- Correct answers never reach the browser before submission. Practice scoring
  happens in `POST /api/student/submit`; timed exams are scored only by
  `POST /api/student/attempt/complete` from server-held answer snapshots.
- Students can fetch only questions in **published, non-template** tests, plus
  questions from their own mock sessions. Draft and timed-paper questions are
  refused by `/api/student/questions`.
- Direct submissions for template exams are rejected. Practice submissions
  must resolve to a published test (by id or exact title) or explicitly declare
  a `custom: true` run, which is limited to the published practice pool.
- One open mock session per `(user_id, test_id)` is enforced by a partial unique
  index; concurrent starts return the winner's session instead of invalidating
  another attempt.
- Admin access is decided server-side from `ADMIN_EMAILS`; `/admin` is only a
  session gate, every admin API re-checks the allowlist.
- The browser receives security headers (CSP, `X-Frame-Options: DENY`,
  `nosniff`, Referrer-Policy, Permissions-Policy, HSTS in production).

## Testing

```bash
npm test -- --runInBand
npx tsc --noEmit
npm run lint
```

CI runs the same typecheck, lint and test suite on every push to `main` and on
pull requests (`.github/workflows/ci.yml`).

Concurrency and role checks that need a real database/HTTP stack are documented
in `docs/security-verification.md` with copy-paste SQL and curl procedures.

## Deployment

Vercel auto-deploys `main`. Before deploying schema-dependent changes, apply
the pending migration in the Supabase SQL Editor and verify the queries in
`supabase/README.md`.

## Known limits

- Aggregate dashboard stats are exact up to the newest 20,000 attempts per
  student; beyond that the UI says the total is capped. The history list shows
  the latest 20 cloud attempts, plus device-local samples not already in the
  cloud.
- CSP allows inline scripts/styles because the app uses a static pre-paint
  theme script and Next/KaTeX inline styles. A nonce-based policy would force
  every page into dynamic rendering.
- The Android app does not yet run full-length timed mocks; it directs students
  to the website.
