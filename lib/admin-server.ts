import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SERVER ONLY — never import from client components. The service-role key
// bypasses RLS entirely; it lives only in server env (SUPABASE_SERVICE_ROLE_KEY)
// and is never sent to the browser.

export type SessionUser = { id: string; email: string; emailVerified: boolean };

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function serviceClient(): SupabaseClient | null {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

function publicSupabaseEnv(): { url: string; key: string } | null {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return null;
  return { url, key };
}

// Verifies the request's Supabase session SERVER-SIDE from cookies. Works
// identically in route handlers, server components and the page gate — the
// session is whatever the signed-in browser holds, never anything the client
// claims.
export async function sessionUser(): Promise<SessionUser | null> {
  const cfg = publicSupabaseEnv();
  if (!cfg) return null;
  const store = await cookies();
  const sb = createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => {
          try {
            store.set(name, value, options);
          } catch {}
        });
      },
    },
  });
  try {
    const first = await sb.auth.getUser();
    let user = first.data.user;
    if (!user) {
      // Expired access token whose refresh token is still valid: renew once
      // (in route handlers the new cookies persist through setAll above) so a
      // long-idle tab recovers instead of answering 401 / bouncing to login.
      try {
        const retry = await sb.auth.refreshSession();
        user = retry.data.user ?? null;
      } catch {
        user = null;
      }
    }
    if (!user?.email) return null;
    // OAuth logins and confirmed email signups carry email_confirmed_at;
    // pending signups do not. Client pages used to be the only place that
    // enforced this — the flag now travels with the session so server routes
    // can enforce it too (see requireUser).
    const emailVerified = !!(user.email_confirmed_at || user.confirmed_at);
    return { id: user.id, email: user.email, emailVerified };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MOBILE BEARER AUTH — additive; the cookie path above is unchanged.
//
// The bundled mobile app has no cookie jar for this origin, so it authenticates
// with the Supabase access token it already holds:
//
//     Authorization: Bearer <supabase-access-token>
//
// The token is verified by asking Supabase Auth, which checks the signature AND
// the live server-side session/expiry. It is never decoded or trusted locally,
// and nothing is cached — every request is re-validated.
//
// Deliberately used only by requireUser/requireAdmin (route handlers). The
// cookie-only sessionUser below stays the page gate's path, so no server
// component ever reads request headers.
//
// Three-state result, so a PRESENT but INVALID token is never silently replaced
// by a different credential:
//   { present: false }            -> no bearer claim; caller uses cookies
//   { present: true, user }       -> verified
//   { present: true, user: null } -> rejected; caller answers 401
// ---------------------------------------------------------------------------
type BearerResult = { present: boolean; user: SessionUser | null };

async function bearerSessionUser(): Promise<BearerResult> {
  let raw = "";
  try {
    raw = (await headers()).get("authorization") || "";
  } catch {
    return { present: false, user: null };
  }
  const match = /^Bearer[ \t]+(\S+)$/i.exec(raw.trim());
  // Any other scheme (or no Authorization header at all) is not this app's
  // credential, so fall through to cookies and the website is untouched.
  if (!match) return { present: false, user: null };
  const token = match[1];
  // Supabase access tokens are JWTs; reject absurd input without a round-trip.
  if (token.length < 20 || token.length > 4096) return { present: true, user: null };

  const cfg = publicSupabaseEnv();
  if (!cfg) return { present: true, user: null };
  try {
    // Anon/publishable client on purpose: verifying a user token needs no
    // privilege, so this must never use the service-role client.
    const sb = createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user?.email) return { present: true, user: null };
    return {
      present: true,
      user: {
        id: user.id,
        email: user.email,
        // Same rule as the cookie path — requireUser enforces it.
        emailVerified: !!(user.email_confirmed_at || user.confirmed_at),
      },
    };
  } catch {
    return { present: true, user: null };
  }
}

// One entry per email. Tolerant of how values get pasted into dashboards
// (wrapping quotes, padding, stray case) so a legitimately configured admin
// is never locked out by formatting noise.
function parseAllowlist(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

// The ONE server-side admin allowlist. Deliberately NOT NEXT_PUBLIC_*:
// the browser-visible variable may exist as a convenience/legacy value, but
// it must never be what grants page or database access. Empty list = NOT
// CONFIGURED and every admin path fails closed with an explicit 503/message.
export function serverAdminEmails(): { list: string[]; configured: boolean } {
  const list = parseAllowlist(env("ADMIN_EMAILS"));
  return { list, configured: list.length > 0 };
}

export type AdminSession =
  | { status: "admin"; user: SessionUser }
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: SessionUser }
  | { status: "unconfigured"; user: SessionUser };

// The ONE authorization decision, given an already-verified user. Shared by the
// cookie path (page gate + APIs) and the bearer path (APIs only), so pages and
// APIs can never disagree about who is an admin.
function decideAdmin(user: SessionUser): AdminSession {
  const { list, configured } = serverAdminEmails();
  if (!configured) return { status: "unconfigured", user };
  if (!list.includes(user.email.toLowerCase())) return { status: "forbidden", user };
  return { status: "admin", user };
}

// Cookie-only on purpose: the /admin page gate (app/admin/(gated)/layout.tsx) is
// a server component, and reading request headers there would pull a
// request-time API into prerendering under Cache Components.
export async function getAdminSession(): Promise<AdminSession> {
  const user = await sessionUser();
  if (!user) return { status: "unauthenticated" };
  return decideAdmin(user);
}

export type AdminContext = { svc: SupabaseClient; user: SessionUser };

// Route-handler only: bearer first (mobile), then cookies (website).
async function resolveAdminSession(): Promise<AdminSession> {
  const bearer = await bearerSessionUser();
  if (bearer.present) {
    return bearer.user ? decideAdmin(bearer.user) : { status: "unauthenticated" };
  }
  return getAdminSession();
}

// Authorizes the request FIRST, then attaches the service-role client (so an
// anonymous probe never learns whether the service key exists). Fails closed:
// 401 unauthenticated · 403 signed-in non-admin · 503 server misconfigured.
export async function requireAdmin(): Promise<
  AdminContext | { error: NextResponse }
> {
  const session = await resolveAdminSession();
  if (session.status === "unauthenticated") {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  if (session.status === "unconfigured") {
    return {
      error: NextResponse.json(
        { error: "Admin access is not configured: set ADMIN_EMAILS in the server environment." },
        { status: 503 }
      ),
    };
  }
  if (session.status === "forbidden") {
    return { error: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  }
  const svc = serviceClient();
  if (!svc) {
    return {
      error: NextResponse.json(
        { error: "Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      ),
    };
  }
  return { svc, user: session.user };
}

// Any authenticated user (student or admin). Used by student-scoped routes.
// Email verification is enforced HERE as well as in the dashboard UI: an
// unverified session can no longer call student APIs directly.
export async function requireUser(): Promise<
  { svc: SupabaseClient; user: SessionUser } | { error: NextResponse }
> {
  const bearer = await bearerSessionUser();
  const user = bearer.present ? bearer.user : await sessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  if (!user.emailVerified) {
    return {
      error: NextResponse.json(
        { error: "Verify your email first — open the confirmation link we sent, then retry." },
        { status: 403 }
      ),
    };
  }
  const svc = serviceClient();
  if (!svc) {
    return {
      error: NextResponse.json(
        { error: "Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      ),
    };
  }
  return { svc, user };
}
