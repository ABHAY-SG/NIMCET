import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { parseAdminEmails } from "@/lib/admin";
import {
  OAUTH_INTENT_COOKIE,
  oauthRecoveryPath,
  readOAuthIntentCookie,
} from "@/lib/oauth-return";

// Proxy (the Next.js 16 rename of middleware) — an entry/session gate for
// /, /admin and /dashboard. It answers "is anyone signed in?" and forwards a
// protected request path so the server gate can redirect back after login.
//
// Why the admin allowlist is NOT an authorization gate here: authorization
// depends on the server-only ADMIN_EMAILS value, and this layer is the wrong
// place to decide it (a stale build/deployment config here once bounced
// legitimate admins). The authoritative checks run one layer down, on the
// Node.js server, where env vars are read at request time:
//   - app/admin/(gated)/layout.tsx  → page access (getAdminSession)
//   - lib/admin-server.ts requireAdmin → every admin API route
// A signed-in non-admin who reaches the pages is redirected to /dashboard by
// the gate; no admin data is ever served because the APIs reject them too.
//
// The one allowlist use here is deliberately only a DESTINATION HINT for a
// signed-in visitor opening "/": admin → /admin, everyone else → /dashboard.
// /admin still re-checks the same allowlist server-side, so a stale proxy
// value can never grant access.
//
// Admin and student flows are deliberately SEPARATE: a failed session check
// for /admin lands on /admin/login?next=<path>; a failed check for /dashboard
// lands on the student /login?next=<path>. Unverified students are sent to
// /login?verify-required=1 instead of being allowed into the dashboard shell.
//
// Sessions self-heal: if getUser() cannot see a user (expired access token),
// one explicit refreshSession() is attempted before the visitor is treated as
// signed out. The refreshed cookies ride back on this same response, so a
// plain page refresh renews the session instead of dumping the user out.

function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Development-only preview route: never serve it from a production build,
  // even if its source file is ever accidentally committed.
  if (path === "/sidebar-preview" || path.startsWith("/sidebar-preview/")) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  const admin = isAdminPath(path);
  const rootEntry = path === "/";
  if (path === "/admin/login") return NextResponse.next();

  const studentGate = path === "/dashboard" || path.startsWith("/dashboard/");
  if (!admin && !studentGate) {
    // Supabase normally returns OAuth codes to /auth/callback. If this project
    // is ever configured to fall back to the Site URL, the code lands on a
    // public page and @supabase/ssr consumes it client-side — the navbar
    // changes but nobody navigates. Recover it before the page renders.
    // This must include "/": it is a public landing page, and OAuth can return
    // the code there before the signed-in redirect below is considered.
    const intent = readOAuthIntentCookie(req.headers.get("cookie"));
    const recovery = oauthRecoveryPath(path, req.nextUrl.searchParams, intent);
    if (recovery) {
      const res = NextResponse.redirect(new URL(recovery, req.url));
      res.cookies.set({
        name: OAUTH_INTENT_COOKIE,
        value: "",
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      });
      return res;
    }
    if (!rootEntry) return NextResponse.next();
  }

  // Preserve the full protected URL (including dashboard ?view=...) so a
  // signed-out deep link returns to the same section after login.
  const nextTarget = `${path}${req.nextUrl.search}`;
  const loginUrl = () => {
    const u = req.nextUrl.clone();
    u.pathname = admin ? "/admin/login" : "/login";
    u.search = "";
    u.searchParams.set("next", nextTarget);
    return u;
  };

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  if (!url || !key) {
    // Cannot verify sessions at all → protected areas fail closed. The
    // public root still renders as the marketing homepage.
    if (rootEntry) return NextResponse.next();
    return NextResponse.redirect(loginUrl());
  }

  // Forward the concrete path in a request header; the admin server gate uses
  // it to build ?next= so the admin returns to the page they asked for.
  const requestHeaders = new Headers(req.headers);
  if (admin) requestHeaders.set("x-admin-path", nextTarget);

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

  let user = null as Awaited<ReturnType<typeof sb.auth.getUser>>["data"]["user"] | null;
  try {
    user = (await sb.auth.getUser()).data.user;
  } catch {
    user = null;
  }

  if (!user) {
    // One recovery attempt: a valid refresh token must transparently renew an
    // expired access token instead of bouncing the user to a login screen.
    try {
      const { data, error } = await sb.auth.refreshSession();
      if (!error && data.user) user = data.user;
    } catch {
      user = null;
    }
  }

  if (!user) {
    // A signed-out visitor at "/" still gets the public homepage. Protected
    // areas continue to fail closed to their respective login screens.
    if (rootEntry) return res;
    return NextResponse.redirect(loginUrl());
  }

  // Verified-email gate for the student area. The dashboard/profile pages
  // also enforce this client-side, but the proxy stops the shell and any
  // server-rendered content from being shown at all.
  if (!admin && !(user.email_confirmed_at || user.confirmed_at)) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = "";
    u.searchParams.set("verify-required", "1");
    u.searchParams.set("next", path);
    return NextResponse.redirect(u);
  }

  if (rootEntry) {
    // Signed-in visitors should never be parked on the marketing homepage.
    // This is only a starting destination; the server gate below still owns
    // the actual admin authorization decision.
    const email = (user.email || "").toLowerCase();
    const isAllowlisted = !!email && parseAdminEmails(process.env.ADMIN_EMAILS).includes(email);
    const destination = isAllowlisted ? "/admin" : "/dashboard";
    const redirectRes = NextResponse.redirect(new URL(destination, req.url));
    // Do not drop refreshed cookies from the session check.
    res.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectRes.cookies.set(name, value, options);
    });
    redirectRes.headers.set("Cache-Control", "private, no-store");
    return redirectRes;
  }

  return res;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/login-choice",
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/sidebar-preview",
    "/sidebar-preview/:path*",
  ],
};
