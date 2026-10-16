import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Server-side admin gate. Runs at the edge before any /admin page renders:
// - /admin/login stays public (it IS the gate).
// - No session  → /login?next=<path> (existing login returns them back).
// - Session but not in the allowlist → /dashboard (their rightful home).
// - Allowlisted session → through; the client guard still shows its own
//   denied screen for edge cases (e.g. email removed mid-session).
//
// Allowlist: ADMIN_EMAILS (server-only, preferred) falling back to
// NEXT_PUBLIC_ADMIN_EMAILS (same values; browser-visible but only used here
// as configuration, never as the sole check — the session is always verified
// first). Set ADMIN_EMAILS identically in Vercel for hygiene.
// OAuth/student/email flows never touch /admin*, so they are unaffected.
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/admin/login") return NextResponse.next();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  if (!url || !key) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("next", path);
    return NextResponse.redirect(u);
  }

  const res = NextResponse.next();
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  let email: string | null = null;
  try {
    const { data: { user } } = await sb.auth.getUser();
    email = user?.email ?? null;
  } catch {
    email = null;
  }

  if (!email) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("next", path);
    return NextResponse.redirect(u);
  }

  const allow = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.includes(email.toLowerCase())) {
    const u = req.nextUrl.clone();
    u.pathname = "/dashboard";
    u.search = "";
    return NextResponse.redirect(u);
  }

  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
