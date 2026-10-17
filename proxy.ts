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
// OAuth/student/email flows never touch /admin*, so they are unaffected.

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/admin/login") return NextResponse.next();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  if (!url || !key) {
    // Cannot verify sessions at all → send to login (fail closed).
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("next", path);
    return NextResponse.redirect(u);
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
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("next", path);
    return NextResponse.redirect(u);
  }

  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
