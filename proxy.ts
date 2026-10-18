import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Proxy (the Next.js 16 rename of middleware) — a SESSION gate for /admin,
// deliberately NOT an authorization gate. It only answers "is anyone signed
// in?" and forwards the request path so the server gate can redirect back to
// the exact page after login.
//
// Why the allowlist is NOT checked here: authorization depends on the
// server-only ADMIN_EMAILS value, and this layer's environment is the wrong
// place to decide it (a stale build/deployment config here once bounced
// legitimate admins). The authoritative checks run one layer down, on the
// Node.js server, where env vars are read at request time:
//   - app/admin/(gated)/layout.tsx  → page access (getAdminSession)
//   - lib/admin-server.ts requireAdmin → every admin API route
// A signed-in non-admin who reaches the pages is redirected to /dashboard by
// the gate; no admin data is ever served because the APIs reject them too.
//
// Admin and student flows are deliberately SEPARATE: a failed session check
// here always lands on /admin/login?next=<path>, never the student /login.
//
// Sessions self-heal: if getUser() cannot see a user (expired access token),
// one explicit refreshSession() is attempted before the visitor is treated as
// signed out. The refreshed cookies ride back on this same response, so a
// plain page refresh renews the session instead of dumping the admin out.

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/admin/login") return NextResponse.next();

  const loginUrl = () => {
    const u = req.nextUrl.clone();
    u.pathname = "/admin/login";
    u.search = "";
    u.searchParams.set("next", path);
    return u;
  };

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  if (!url || !key) {
    // Cannot verify sessions at all → send to the admin sign-in (fail closed).
    return NextResponse.redirect(loginUrl());
  }

  // Forward the concrete path in a request header; the server gate uses it
  // to build ?next= so the admin returns to the page they asked for.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-admin-path", path);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        // Refreshed session cookies must ride back on this response.
        list.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  let authed = false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    authed = !!user;
  } catch {
    authed = false;
  }

  if (!authed) {
    // One recovery attempt: a valid refresh token must transparently renew an
    // expired access token instead of bouncing the admin to a login screen.
    try {
      const { data, error } = await sb.auth.refreshSession();
      if (!error && data.user) authed = true;
    } catch {
      authed = false;
    }
  }

  if (!authed) return NextResponse.redirect(loginUrl());

  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
