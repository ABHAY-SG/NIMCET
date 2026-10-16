import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SERVER ONLY — never import from client components. The service-role key
// bypasses RLS entirely; it lives only in server env (SUPABASE_SERVICE_ROLE_KEY)
// and is never sent to the browser.

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function serviceClient(): SupabaseClient | null {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

async function sessionUser(): Promise<{ id: string; email: string } | null> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon =
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) return null;
  const store = await cookies();
  const sb = createServerClient(url, anon, {
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
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}

function adminAllowlist(): string[] {
  // Server-only allowlist. Intentionally NO fallback to NEXT_PUBLIC_* here:
  // a browser-visible variable must never be the database security boundary.
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type AdminContext = { svc: SupabaseClient; user: { id: string; email: string } };

// Verifies the request's Supabase session server-side, then authorizes the
// email against the SERVER allowlist. Fails closed (503/401/403) — never
// degrades to anon-key access.
export async function requireAdmin(): Promise<
  | AdminContext
  | { error: NextResponse }
> {
  const svc = serviceClient();
  if (!svc) {
    return {
      error: NextResponse.json(
        { error: "Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      ),
    };
  }
  const user = await sessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  const allow = adminAllowlist();
  if (allow.length === 0 || !allow.includes(user.email.toLowerCase())) {
    return { error: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  }
  return { svc, user };
}

// Any authenticated user (student or admin). Used by student-scoped routes.
export async function requireUser(): Promise<
  | { svc: SupabaseClient; user: { id: string; email: string } }
  | { error: NextResponse }
> {
  const svc = serviceClient();
  if (!svc) {
    return {
      error: NextResponse.json(
        { error: "Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      ),
    };
  }
  const user = await sessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  return { svc, user };
}
