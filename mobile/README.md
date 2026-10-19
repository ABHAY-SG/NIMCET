# NimCuet — Android app (Phase 1)

Mobile-first Android client for the NIMCET/CUET-PG-MCA mock-test platform.

- **Nature:** a real, native-shelled app (Capacitor 8), **not** a website wrapper. Its UI is a
  purpose-built mobile SPA; the existing website is untouched.
- **Backend:** the **same** Supabase project and the **same** Next.js APIs as the website. No
  duplicate database, no copied backend logic, no service-role key.
- **Scope of this phase:** project setup, design system, app shell, navigation and honest
  placeholder screens. The exam engine and payment system are **not** implemented yet.
- **Package ID / name:** `app.nimcuet.mobile` / `NimCuet`.

---

## Architecture

```
mobile/  (this project)                         website repo (unchanged)
───────────────────────                         ───────────────────────
Capacitor 8 Android shell                        Next.js app on Vercel
  └─ bundled Vite + React + TS SPA  ──HTTPS──▶     └─ /api/student/*  (Bearer auth)
       │                                              └─ Supabase (RLS)
       └─ Supabase Auth (email+password) ─────────▶ same Supabase project
```

The app authenticates with Supabase directly, then calls the website's existing student endpoints
with `Authorization: Bearer <supabase-access-token>`. Server-side, `lib/admin-server.ts` verifies
that token via Supabase Auth on every request (it is never decoded or cached locally), and
`requireUser` still enforces verified email. This is the additive mobile path already shipped in the
website repo (commit `dda8bee`); the cookie path used by the browser is unchanged.

Cross-origin access is limited by the website's `next.config.ts` (`MOBILE_ORIGINS` =
`https://localhost`, `capacitor://localhost`) and only for `/api/student/*` and `/api/avatar`.
`/api/admin/*` is deliberately **not** in that allowlist — **the admin panel stays web-only.**

The Android WebView loads the bundle from `https://localhost` (`androidScheme: "https"` in
`capacitor.config.ts`), which is why that origin is the one allowlisted.

---

## Prerequisites

**For web development / building the bundle (works today):**

- Node.js 20+ (tested on v24) and npm.

**For building an APK/AAB (not yet available on the current machine):**

- JDK 21 (Capacitor 8 bundles Gradle, but a JDK is required).
- Android SDK (build-tools + platform) and, practically, Android Studio.
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` set, and `adb` on `PATH`.

> Phase 1 validation ran **without** the Android toolchain, so no APK/AAB was produced and no native
> project exists yet. The web bundle and types are verified; the native build is the next step once a
> JDK + Android SDK are installed.

---

## Environment variables

Copy `.env.example` → `.env.local` and fill in real values (`.env.local` is git-ignored):

| Variable                 | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `VITE_API_BASE_URL`      | Existing backend, e.g. `https://nimcet-eta.vercel.app` |
| `VITE_SUPABASE_URL`      | Supabase project URL (same project as the website)   |
| `VITE_SUPABASE_ANON_KEY` | Supabase **publishable/anon** key (RLS-bound, public) |

**Never** place the Supabase **service-role** key in this project, or in any `VITE_*` variable —
those are embedded in the shipped app.

---

## Commands

```bash
cd mobile

npm install          # install dependencies

npm run dev          # Vite dev server on http://localhost:5173 (browser)
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production bundle into dist/
npm run preview      # serve the built bundle locally

# Native (requires the Android toolchain):
npm run cap:add:android     # one-time: generates the android/ Gradle project
npm run cap:sync            # build web assets into the native project
npm run cap:open:android    # open in Android Studio
npm run cap:run:android     # build + install + run on a device/emulator
```

Local dev against the website: run the website (`npm run dev` in the repo root, port 3000) and
point `VITE_API_BASE_URL=http://localhost:3000` in `mobile/.env.local`. The website's dev CORS rule
already allows `http://localhost:5173`.

---

## Routes / screens

| Route                          | Screen            | Status (Phase 1)                                   |
| ------------------------------ | ----------------- | -------------------------------------------------- |
| `/login`                       | Login             | **Implemented** (real Supabase email+password)     |
| `/signup`                      | Signup            | **Implemented** (real signup + verification hand-off) |
| `/dashboard`                   | Dashboard         | Session + live announcements (`/api/student/announcements`) |
| `/mocks`                       | Mock Tests        | Official pattern shown; paper list is Phase 2      |
| `/mocks/:testId/instructions`  | Test Instructions | Static instructions; "Begin" disabled              |
| `/attempt/:sessionId`          | Test Runner       | **Placeholder** — no fake questions/timer          |
| `/results/:attemptId`          | Results           | **Placeholder** — no invented scores               |
| `/profile`                     | Profile           | Session info + sign out                            |

Routing uses a **HashRouter** (file-origin WebViews handle hash routing reliably), with a bottom tab
bar, safe-area insets, and hardware back-button handling.

### Honest placeholders

Runner/Results render explanatory text only. They intentionally show **no** fabricated questions,
timers, scores or analytics — a fake exam UI would be worse than none. Phase 2 wires them to the
existing server-authoritative APIs (`/api/student/attempt/{start,part,answers,complete}`); the server
owns `started_at`, per-part timing and scoring, so the app clock can never be trusted or tampered
with.

---

## Deep links (`nimcuet://`)

The website already supports a mobile hand-off after email confirmation:

1. The app signs the user up with
   `emailRedirectTo = <API_BASE_URL>/auth/callback?mobile=1`.
2. The confirmation link verifies the email server-side, then redirects to
   `/auth/verified?mobile=1`.
3. That page fires `nimcuet://auth/verified`, which the app receives via
   `@capacitor/app`'s `appUrlOpen` listener (see `src/lib/auth.tsx`). The URL carries **no secret** —
   only an outcome — so the app re-checks the session against Supabase and never treats the link as
   proof.

**When the Android project is generated**, register the scheme in `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="nimcuet" />
</intent-filter>
```

---

## Security notes

- No service-role key anywhere in `mobile/`; only the public anon/publishable key.
- Admin routes are unreachable from the app (absent from the website's CORS allowlist).
- Bearer tokens are verified server-side on every request; nothing is decoded or trusted in the app.
- RLS is unchanged; the app is just another RLS-bound client.
- `@capacitor/browser` opens auth pages in an in-app browser; only `https` URLs on the backend host
  or `*.supabase.co` are accepted.

---

## Known limitations / not yet done

- **Google/GitHub OAuth is disabled** in the UI. The provider callback's PKCE exchange runs on the
  server, which cannot see the app's code verifier, so completing OAuth on-device needs a deliberate
  hand-off design (Phase 2). Buttons are shown disabled rather than faking a login.
- **Password reset** is not in the app yet; the plan is to open the website's existing reset flow in
  the in-app browser.
- No Android toolchain on the build machine yet → no APK/AAB, no `android/` project.
- The exam engine, results/solutions and analytics are Phase 2.
- Supabase migrations `0006`/`0007` and the NIMCET full-mock setup must be confirmed against the live
  project before the runner can be built (they are applied manually in the Supabase SQL editor).

---

## Suggested Phase 2 order

1. Install JDK 21 + Android SDK; run `npm run cap:add:android` and add the `nimcuet://` intent filter.
2. Confirm the Supabase migrations/seed for the NIMCET full mock on the live project.
3. Build the runner on `/api/student/attempt/*` (start → part → answers → complete) with the
   server-owned clock, then the results/solutions screen.
4. Wire the published-test list from the existing APIs (replace the Mock Tests placeholder).
5. Decide and implement the OAuth on-device hand-off; add password reset via in-app browser.
