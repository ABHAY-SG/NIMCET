# NimCuet — Android app

Mobile-first Android client for the NIMCET/CUET-PG-MCA mock-test platform.

- **Nature:** a real, native-shelled app (Capacitor 8), **not** a website wrapper. Its UI is a
  purpose-built mobile SPA; the existing website is untouched.
- **Backend:** the **same** Supabase project and the **same** Next.js APIs as the website. No
  duplicate database, no copied backend logic, no service-role key.
- **Package ID / name:** `app.nimcuet.mobile` / `NimCuet`.

---

## Architecture

```
mobile/  (this project)                         website repo (unchanged)
───────────────────────                         ───────────────────────
Capacitor 8 Android shell                        Next.js app on Vercel
  └─ bundled Vite + React + TS SPA                ├─ /api/student/*   (Bearer auth)
       ├─ Supabase Auth (email+password) ─────▶   └─ Supabase (RLS) ◀────┐
       ├─ Supabase reads under RLS (tests, attempts) ────────────────────┘
       └─ student APIs over HTTPS with Bearer ──▶ /api/student/{questions,announcements}
```

The app authenticates with Supabase directly, then calls the website's student endpoints with
`Authorization: Bearer <supabase-access-token>`. Server-side, `lib/admin-server.ts` verifies that
token via Supabase Auth on every request (never decoded or cached locally), and `requireUser` still
enforces verified email. This is the additive mobile path already shipped in the website repo
(commit `dda8bee`); the cookie path used by the browser is unchanged.

Cross-origin access is limited by the website's `next.config.ts` (`MOBILE_ORIGINS` =
`https://localhost`, `capacitor://localhost`) and only for `/api/student/*` and `/api/avatar`.
`/api/admin/*` is deliberately **not** in that allowlist — **the admin panel stays web-only.**

The Android WebView loads the bundle from `https://localhost` (`androidScheme: "https"` in
`capacitor.config.ts`), which is why that origin is the one allowlisted.

---

## What works today (Phase 2)

| Area | Status |
| --- | --- |
| Email + password **signup** | ✅ real (`supabase.auth.signUp`), sends the confirmation email |
| Email + password **login** | ✅ real (`signInWithPassword`) with friendly error mapping |
| **Logout** | ✅ real, clears the persisted session |
| **Session persistence** | ✅ `localStorage` via `@capacitor/core` WebView; restored on launch |
| **Session expiry handling** | ✅ auto-refresh + 401-after-refresh ⇒ sign out + "session expired" notice |
| **Email verification** | ✅ `nimcuet://auth/verified` deep-link hand-off + "resend confirmation" |
| **Bearer-token API client** | ✅ `lib/api.ts` (refresh-once + retry, typed errors) |
| **Dashboard** | ✅ real attempts stats, published-test count, live announcements |
| **Profile** | ✅ real account fields + real attempt count |
| **Mock Tests** | ✅ real published tests from Supabase (RLS), marks computed from the live bank |
| **Test Instructions** | ✅ real test structure (parts/subjects/marks) |
| Google / GitHub OAuth | ⛔ disabled on purpose (see below) |
| Exam runner / results | ⛔ not implemented (next milestone) |

### Data sources (no fabricated data)

- `tests` (published) and `attempts` (own rows) are read **directly from Supabase under RLS** —
  exactly what the website does in the browser. RLS is what restricts `attempts` to the signed-in
  user; the app never sends a `user_id` filter it could tamper with.
- The **question bank** and **announcements** come from the existing `/api/student/*` endpoints over
  the bearer token. The bank endpoint exposes metadata only (no answer keys), by design.
- Empty states are shown when there is genuinely no data; nothing is invented.

---

## Prerequisites

**For web development / building the bundle:**

- Node.js 20+ (tested on v24) and npm.

**For building an APK/AAB (installed on this machine):**

- JDK 21 — `C:\Program Files\Java\jdk-21.0.12.1`
- Android SDK — `%LOCALAPPDATA%\Android\Sdk` (platform `android-37.0`, build-tools `36.0.0`)
- Android Studio — `C:\Program Files\Android\Android Studio`

Neither `java` nor `adb` is on `PATH`, so set the environment for the session before building:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.12.1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

`mobile/android/local.properties` (git-ignored) points Gradle at the SDK.

> The `cmdline-tools`/`sdkmanager` package is not installed. The Android Gradle Plugin downloads any
> missing SDK components automatically (the SDK licences are already accepted).

---

## Environment variables

Copy `.env.example` → `.env.local` and fill in real values (`.env.local` is git-ignored):

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Existing backend, e.g. `https://nimcet-eta.vercel.app` |
| `VITE_SUPABASE_URL` | Supabase project URL (same project as the website) |
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

# Native (Android project lives in mobile/android/):
npm run cap:sync            # build web assets into the native project (run after every web change)
npm run cap:add:android     # one-time: (re)generates the android/ Gradle project
npm run cap:open:android    # open in Android Studio
npm run cap:run:android     # build + install + run on a device/emulator
```

Local dev against the website: run the website (`npm run dev` in the repo root, port 3000) and
point `VITE_API_BASE_URL=http://localhost:3000` in `mobile/.env.local`. The website's dev CORS rule
already allows `http://localhost:5173`.

### Building the APK

With the environment set (see *Prerequisites*):

```powershell
cd mobile
npm.cmd run build                 # rebuild the web bundle
.\node_modules\.bin\cap.cmd sync android

cd android
.\gradlew.bat assembleDebug       # debug APK
# output: mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

Install on a connected device/emulator:

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

### Release signing

The signed release APK is built with a keystore that lives **outside this repository**:

| Item | Location |
| --- | --- |
| Keystore | `C:\Users\abhay\nimcuet-keystore\nimcuet-release.jks` (PKCS12, alias `nimcuet`, RSA 2048, 10 000-day validity) |
| Credentials | `mobile/android/keystore.properties` (git-ignored) |
| Signing config | `mobile/android/app/build.gradle` — loaded only when `keystore.properties` exists |

```powershell
cd mobile\android
.\gradlew.bat assembleRelease
# output: mobile\android\app\build\outputs\apk\release\app-release.apk
```

The keystore and its passwords are **never committed** (`*.jks`, `*.keystore`,
`keystore.properties` are ignored in `mobile/.gitignore` and `mobile/android/.gitignore`). Back the
keystore up somewhere safe: losing it means you can never ship an update that installs over an
existing install. The signing block is conditional — without `keystore.properties` the release build
still runs but produces an *unsigned* APK.

The Gradle distribution is cached under `%USERPROFILE%\.gradle`. If the Gradle wrapper's download
times out on a slow network, pre-fetch it with `curl` into
`%USERPROFILE%\.gradle\wrapper\dists\gradle-8.14.3-all\<hash>\gradle-8.14.3-all.zip`; the wrapper
then unzips it instead of downloading.

---

## Routes / screens

| Route | Screen | Notes |
| --- | --- | --- |
| `/login` | Login | Real email+password; shows session-expired notice; resend confirmation |
| `/signup` | Signup | Real signup + verification hand-off + resend |
| `/dashboard` | Dashboard | Real attempts stats, test count, announcements |
| `/mocks` | Mock Tests | Real published tests (RLS); tap → instructions |
| `/mocks/:testId/instructions` | Test Instructions | Real test structure; "Begin" disabled |
| `/attempt/:sessionId` | Test Runner | Placeholder — no fake questions/timer |
| `/results/:attemptId` | Results | Placeholder — no invented scores |
| `/profile` | Profile | Real account data + attempt count + sign out |

Routing uses a **HashRouter** (file-origin WebViews handle hash routing reliably), with a bottom tab
bar, safe-area insets, and hardware back-button handling.

---

## Authentication details

- **Session store:** the Supabase client persists the session in the WebView's `localStorage`
  (`persistSession: true`, `autoRefreshToken: true`). `detectSessionInUrl: false` because callbacks
  arrive via the custom scheme, not a browser fragment.
- **Expiry:** Supabase refreshes the access token in the background. A failed refresh surfaces as
  `SIGNED_OUT` and routes back to `/login` with an explanation. If a protected API still returns 401
  after a one-shot refresh, `lib/api.ts` raises `unauthorized` (`lib/session.ts`), the provider clears
  the session, and the login screen shows "Your session has expired."
- **Verification:** the app signs up with
  `emailRedirectTo = <API_BASE_URL>/auth/callback?mobile=1`; the confirmation link verifies the email
  server-side, then redirects to `/auth/verified?mobile=1`, which fires `nimcuet://auth/verified`. The
  URL carries no secret — the app re-checks the session against Supabase and never treats it as proof.
- **Unverified sessions** are kept out of the app UI (`ProtectedLayout`) because the server's
  `requireUser` would reject every API call with 403.

---

## Deep links (`nimcuet://`)

**When the Android project is generated**, register the scheme in
`android/app/src/main/AndroidManifest.xml`:

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

## Verification performed (non-destructive)

Run against the live project on the current machine — no accounts created, no data written:

| Check | Result |
| --- | --- |
| `tests.template`, `tests.sections` present (anon read) | ✅ HTTP 200 — migrations `0006`/`0007` applied |
| Published `NIMCET MOCK - 01` (`template: nimcet-2026`, 3 sections) | ✅ present |
| `attempts`, `questions`, `announcements`, `mock_sessions` tables exist | ✅ (401 "permission denied" = exists, anon ungranted) |
| Supabase auth service reachable (`GET /auth/v1/settings`) | ✅ 200; `mailer_autoconfirm: false` (email confirmation required) |
| Password login path (bogus creds) | ✅ 400 `invalid_credentials` — endpoint works, nothing created |
| `/api/student/announcements` without bearer | ✅ 401 `Not authenticated.` (bearer enforced) |
| CORS preflight from `https://localhost` | ✅ 204, `Access-Control-Allow-Origin: https://localhost`, `Authorization` allowed |
| `npm run typecheck` | ✅ pass |
| `npm run build` | ✅ pass |

A **real signup / login / logout** click-through was **not** executed: it would create an account in
the live production Supabase, which the task forbids. To verify manually, run `npm run dev`, sign up
with a real inbox, confirm the email, then log in.

---

## Known limitations / not yet done

- **Google/GitHub OAuth is disabled.** The provider callback's PKCE exchange runs on the server,
  which cannot see the app's code verifier, so completing OAuth on-device needs a deliberate
  hand-off design. Buttons are shown disabled rather than faking a login. (Supabase reports both
  providers enabled server-side; only the app-side flow is missing.)
- **Password reset** is not in the app yet; the plan is to open the website's existing reset flow in
  the in-app browser.
- No Android toolchain on the build machine yet → no APK/AAB, no `android/` project.
- The **exam runner, results/solutions and analytics** are the next milestone. They must speak to the
  server-authoritative APIs (`/api/student/attempt/{start,part,answers,complete}`) so the clock and
  scoring can never be tampered with client-side.

---

## Suggested next steps

1. Install JDK 21 + Android SDK; run `npm run cap:add:android` and add the `nimcuet://` intent filter.
2. Build the runner on `/api/student/attempt/*` (start → part → answers → complete) with the
   server-owned clock, then the results/solutions screen.
3. Add password reset via the in-app browser.
4. Decide and implement the OAuth on-device hand-off.
