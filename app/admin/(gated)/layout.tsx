import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-server";

// Server-side gate for every /admin page EXCEPT /admin/login (which stays at
// app/admin/login, outside this route group). This is the page half of the
// authorization boundary; the API half is requireAdmin() in lib/admin-server.
// Both share getAdminSession(), so pages and APIs can never disagree about
// who is an admin, and nothing here depends on build-time browser env values.
//
// Layout shape is deliberate (Cache Components is enabled in this project —
// see node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-
// components.md): reading cookies() at a layout's top level is a build error,
// because it would hold the whole segment (including {children}) behind the
// request and block prerendering. A session read must sit inside a component
// behind a <Suspense> boundary instead: the prerendered shell is just the
// neutral skeleton below, and the admin page ({children}) is rendered only
// after the gate resolves — an unauthorized request never receives it.
//
//   - no session            → /login?next=<the exact page they wanted>
//   - signed in, not admin  → /dashboard (their rightful home)
//   - allowlist unset       → explicit setup screen (fail closed, no redirect
//                             loop, no guessed access)
//   - admin                 → render the requested page
export default function AdminGatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<GateSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (session.status === "unauthenticated") {
    const path = (await headers()).get("x-admin-path") || "/admin";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (session.status === "forbidden") redirect("/dashboard");

  if (session.status === "unconfigured") {
    return (
      <main
        className="mx-auto max-w-lg px-4 pb-20 pt-28 text-center"
        style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100svh" }}
      >
        <h1 className="text-2xl font-extrabold">Admin access isn&apos;t configured</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Signed in as <strong>{session.user.email}</strong>, but the server has no admin
          allowlist, so every admin path is locked.
        </p>
        <p className="mt-3 rounded-xl px-4 py-3 text-[13px] font-medium" style={{ background: "var(--pill)" }}>
          Fix: in Vercel → Project → Settings → Environment Variables, set{" "}
          <code>ADMIN_EMAILS</code> (Production) to the admin email(s), comma-separated, then
          redeploy so the server picks it up.
        </p>
        <a
          href="/dashboard"
          className="mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-bold"
          style={{ border: "1px solid var(--border)" }}
        >
          ← Back to dashboard
        </a>
      </main>
    );
  }

  return <>{children}</>;
}

// Neutral skeleton shown while the gate verifies the session. This is what
// goes into the prerendered shell — never any admin content.
function GateSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 pt-28 sm:px-6"
      style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100svh" }}
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Verifying admin access…</p>
      <div className="h-8 w-56 animate-pulse rounded-xl" style={{ background: "var(--pill)" }} />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl" style={{ background: "var(--pill)" }} />
        <div className="h-28 animate-pulse rounded-2xl" style={{ background: "var(--pill)" }} />
        <div className="h-28 animate-pulse rounded-2xl" style={{ background: "var(--pill)" }} />
      </div>
    </div>
  );
}
