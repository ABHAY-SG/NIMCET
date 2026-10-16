"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { signOutAll } from "@/lib/supabase";

const LINKS: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  { href: "/admin", label: "Overview", icon: <span aria-hidden>▦</span> },
  { href: "/admin/tests", label: "Mock Tests", icon: <span aria-hidden>▤</span> },
  { href: "/admin/questions", label: "Question Bank", icon: <span aria-hidden>?</span> },
  { href: "/admin/attempts", label: "Attempts", icon: <span aria-hidden>✓</span> },
  { href: "/admin/users", label: "Users", icon: <span aria-hidden>◉</span> },
];

function initialsOf(email: string): string {
  const src = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!src) return "?";
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminLayout({ title, crumbs, children }: { title: string; crumbs?: string[]; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "noauth" | "denied" | "ok">("loading");
  const [email, setEmail] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { setState("noauth"); return; }
        setEmail(user.email ?? "");
        setState(isAdminEmail(user.email) ? "ok" : "denied");
      } catch {
        setState("noauth");
      }
    })();
  }, []);

  const logout = async () => {
    try { await signOutAll(); } catch {}
    router.push("/login");
  };

  if (state === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-28">
        <div className="animate-pulse space-y-3" aria-label="Loading">
          <div className="h-8 w-48 rounded-xl" style={{ background: "var(--pill)" }} />
          <div className="h-24 rounded-2xl" style={{ background: "var(--pill)" }} />
          <div className="h-24 rounded-2xl" style={{ background: "var(--pill)" }} />
        </div>
      </main>
    );
  }

  if (state === "noauth") {
    const back = `/login?next=${encodeURIComponent(path || "/admin")}`;
    return (
      <main className="mx-auto max-w-md px-4 pb-20 pt-28 text-center">
        <h1 className="text-2xl font-extrabold">Admins only</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Log in with an admin account first.</p>
        <div className="mt-5 flex justify-center gap-2">
          <a href={back} className="rounded-full px-6 py-2.5 text-sm font-bold" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>Log in →</a>
          <button type="button" onClick={() => router.push("/")} className="rounded-full px-6 py-2.5 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>Home</button>
        </div>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="mx-auto max-w-md px-4 pb-20 pt-28 text-center">
        <h1 className="text-2xl font-extrabold">Not authorized</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Signed in as {email || "unknown"}. This account is not in the admin list — add it to NEXT_PUBLIC_ADMIN_EMAILS.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>
          ← Back home
        </Link>
      </main>
    );
  }

  const nav = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-4" aria-label="Admin sections">
      <div>
        {LINKS.map((l) => {
          const active = path === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setDrawer(false)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? l.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${collapsed ? "justify-center" : ""}`}
              style={active
                ? { background: "var(--btn-bg)", color: "var(--btn-text)" }
                : { color: "var(--muted)" }}
            >
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: "var(--pill)" }}>
                {l.icon}
              </span>
              {!collapsed && <span className="truncate">{l.label}</span>}
            </Link>
          );
        })}
      </div>
      <div className={`mt-auto rounded-2xl p-3 ${collapsed ? "text-center" : ""}`} style={{ background: "var(--pill)" }}>
        {!collapsed && (
          <p className="px-1 pb-2 text-[11px] leading-4" style={{ color: "var(--muted)" }}>
            Signed in as admin. Mutations run under database RLS.
          </p>
        )}
        <button
          type="button"
          onClick={logout}
          title="Log out"
          className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${collapsed ? "justify-center" : ""}`}
          style={{ border: "1px solid var(--border)" }}
        >
          <span aria-hidden>↩</span>
          {!collapsed && "Log out"}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-[100svh]">
      <header
        className="fixed inset-x-0 top-0 z-50 backdrop-blur-2xl"
        style={{ background: "color-mix(in srgb, var(--nav-bg) 85%, transparent)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex h-16 w-full items-center gap-2 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open admin menu"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-lg md:hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-full text-lg md:flex"
            style={{ border: "1px solid var(--border)" }}
          >
            {collapsed ? "→" : "←"}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
              Admin{(crumbs ?? []).map((c) => ` / ${c}`).join("")}
            </p>
            <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              className="flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2"
              style={{ border: "1px solid var(--border)" }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold text-white" style={{ background: "var(--accent)" }}>
                {initialsOf(email)}
              </span>
              <span className="hidden max-w-[160px] truncate text-xs font-bold sm:block" title={email}>{email}</span>
            </button>
            {menuOpen && (
              <>
                <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default bg-transparent" />
                <div className="menu-in absolute right-0 top-12 z-50 w-56 rounded-2xl p-1.5" style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 18px 50px -12px rgba(0,0,0,0.35)" }}>
                  <div className="px-3.5 py-2.5">
                    <div className="truncate text-sm font-extrabold">{email}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>Administrator</div>
                  </div>
                  <button type="button" onClick={logout}
                    className="tmenu flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold">
                    <span aria-hidden>↩</span> Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full px-4 pt-20 sm:px-6" style={{ maxWidth: collapsed ? "80rem" : "90rem" }}>
        <aside className={`sticky top-20 hidden h-[calc(100svh-6rem)] shrink-0 self-start overflow-hidden rounded-[22px] md:block ${collapsed ? "w-20" : "w-64"}`}
          style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
          {nav}
        </aside>
        <main className="min-w-0 flex-1 px-0 pb-20 md:pl-6">
          {children}
        </main>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 cursor-default" style={{ background: "rgba(0,0,0,0.45)" }} />
          <aside className="absolute bottom-0 left-0 top-0 flex w-72 max-w-[85vw] flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
            <div className="flex items-center justify-between p-4 pb-0">
              <span className="text-sm font-extrabold">Admin</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-base"
                style={{ border: "1px solid var(--border)" }}>✕</button>
            </div>
            <div className="min-h-0 flex-1">{nav}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
