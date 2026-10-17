import { cookies } from "next/headers";
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
    const { data: { user } } = await sb.auth.getUser();
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

// The single authorization decision. Both consumers share it:
//   - the /admin page gate (app/admin/(gated)/layout.tsx) redirects with it
//   - requireAdmin() below arms the admin API routes with it
// Pages and APIs can therefore never disagree about who is an admin.
export async function getAdminSession(): Promise<AdminSession> {
  const user = await sessionUser();
  if (!user) return { status: "unauthenticated" };
  const { list, configured } = serverAdminEmails();
  if (!configured) return { status: "unconfigured", user };
  if (!list.includes(user.email.toLowerCase())) return { status: "forbidden", user };
  return { status: "admin", user };
}

export type AdminContext = { svc: SupabaseClient; user: SessionUser };

// Authorizes the request FIRST, then attaches the service-role client (so an
// anonymous probe never learns whether the service key exists). Fails closed:
// 401 unauthenticated · 403 signed-in non-admin · 503 server misconfigured.
export async function requireAdmin(): Promise<
  AdminContext | { error: NextResponse }
> {
  const session = await getAdminSession();
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
  const user = await sessionUser();
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
