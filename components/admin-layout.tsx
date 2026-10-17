"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase, signOutAll } from "@/lib/supabase";
import { Icon, type IconName } from "./admin/icons";
import { Avatar, Badge, Spinner, ToastProvider, cx } from "./admin/ui";
import { useAdminTheme, useInterval } from "./admin/hooks";
import { relTime } from "@/lib/format";

// Admin shell (sidebar + header + profile dropdown). Authorization is NOT
// decided here: every /admin page is gated server-side by
// app/admin/(gated)/layout.tsx, which shares its check with the admin API
// routes. This component only renders UI and reads real notification counts
// from /api/admin/notifications.

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/admin", label: "Overview", icon: "overview" },
  { href: "/admin/tests", label: "Mock Tests", icon: "tests" },
  { href: "/admin/questions", label: "Question Bank", icon: "questions" },
  { href: "/admin/students", label: "Students", icon: "students" },
  { href: "/admin/attempts", label: "Results & Attempts", icon: "attempts" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
  { href: "/admin/content", label: "Content & Announcements", icon: "content" },
  { href: "/admin/feedback", label: "Feedback", icon: "feedback" },
  { href: "/admin/audit", label: "Audit Logs", icon: "audit" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

type AdminProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  custom_avatar: string;
};

type Notifications = {
  unreadFeedback: number;
  latest: Array<{ id: string; subject: string; email: string; created_at: string }>;
};

function titleFor(path: string): string {
  if (path === "/admin/profile") return "Admin Profile";
  const hit = [...NAV].sort((a, b) => b.href.length - a.href.length).find(
    (n) => path === n.href || (n.href !== "/admin" && path.startsWith(`${n.href}/`))
  );
  return hit?.label ?? "Admin";
}

export default function AdminLayout({
  title,
  crumbs,
  actions,
  children,
}: {
  title?: string;
  crumbs?: string[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useAdminTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [notif, setNotif] = useState<Notifications>({ unreadFeedback: 0, latest: [] });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the saved sidebar state after mount (the server has no value to match).
      setCollapsed(localStorage.getItem("admin-nav-collapsed") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const r = await fetch("/api/admin/profile", { credentials: "same-origin" });
        const j = (await r.json()) as AdminProfile & { error?: string };
        if (r.ok && !j.error) {
          setProfile(j);
          setEmail(j.email);
          return;
        }
      } catch {}
      try {
        const sb = getSupabase();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (user?.email) setEmail(user.email);
      } catch {}
    };
    loadProfile();
    // The profile page dispatches this after saving a new name/avatar so the
    // header stays in sync without a reload.
    window.addEventListener("mcamock-admin-profile", loadProfile);
    return () => window.removeEventListener("mcamock-admin-profile", loadProfile);
  }, []);

  const loadNotif = async () => {
    try {
      const r = await fetch("/api/admin/notifications", { credentials: "same-origin" });
      const j = (await r.json()) as Notifications & { error?: string };
      if (r.ok && !j.error) setNotif({ unreadFeedback: j.unreadFeedback ?? 0, latest: j.latest ?? [] });
    } catch {}
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async loader defined above; every setNotif happens after its fetch resolves.
    loadNotif();
  }, []);
  useInterval(loadNotif, 60_000);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem("admin-nav-collapsed", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await signOutAll();
    } catch {}
    router.push("/login");
  };

  const displayName = useMemo(() => {
    const n = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    return n || email.split("@")[0] || "Administrator";
  }, [profile, email]);

  const pageTitle = title || titleFor(path);
  const unread = notif.unreadFeedback;

  const nav = (
    <nav className="flex h-full flex-col overflow-y-auto p-3" aria-label="Admin sections">
      <div className="space-y-1">
        {NAV.map((l) => {
          const active = path === l.href || (l.href !== "/admin" && path.startsWith(`${l.href}/`));
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setDrawer(false)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? l.label : undefined}
              className={cx(
                "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-bold transition-colors",
                collapsed && "justify-center px-0"
              )}
              style={
                active
                  ? { background: "var(--btn-bg)", color: "var(--btn-text)" }
                  : { color: "var(--muted)" }
              }
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                style={{ background: active ? "color-mix(in srgb, var(--btn-bg) 14%, transparent)" : "var(--pill)", color: active ? "var(--btn-text)" : "inherit" }}
              >
                <Icon name={l.icon} size={16} />
              </span>
              {!collapsed && <span className="min-w-0 flex-1 truncate">{l.label}</span>}
              {!collapsed && l.href === "/admin/feedback" && unread > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-extrabold"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-auto space-y-2 pt-4">
        <div
          className={cx("rounded-2xl p-3 text-[11px] leading-4", collapsed && "hidden")}
          style={{ background: "var(--pill)", color: "var(--muted)" }}
        >
          <span className="mb-1 flex items-center gap-1.5 font-extrabold">
            <Icon name="lock" size={12} /> Protected area
          </span>
          Every page and action is authorized server-side; mutations are audit-logged.
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          title="Log out"
          className={cx("admin-btn w-full justify-center", collapsed && "px-0")}
        >
          {loggingOut ? <Spinner size={13} /> : <Icon name="logout" size={14} />}
          {!collapsed && "Log out"}
        </button>
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-[100svh]" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <header
          className="fixed inset-x-0 top-0 z-50 backdrop-blur-2xl"
          style={{ background: "color-mix(in srgb, var(--nav-bg) 85%, transparent)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="mx-auto flex h-16 w-full items-center gap-2 px-3 sm:px-5" style={{ maxWidth: "96rem" }}>
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open admin menu"
              className="admin-btn px-2.5 md:hidden"
            >
              <Icon name="menu" size={17} />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="admin-btn hidden px-2.5 md:inline-flex"
            >
              <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={15} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                Admin{(crumbs ?? []).length ? ` / ${(crumbs ?? []).join(" / ")}` : ""}
              </p>
              <h1 className="truncate text-[17px] font-extrabold tracking-tight">{pageTitle}</h1>
            </div>

            {actions && <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div>}

            {/* notifications */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBellOpen((v) => !v);
                  if (!bellOpen) loadNotif();
                }}
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
                className="admin-btn relative px-2.5"
              >
                <Icon name="bell" size={16} />
                {unread > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setBellOpen(false)}
                    className="fixed inset-0 z-40 cursor-default bg-transparent"
                  />
                  <div
                    className="menu-in absolute right-0 top-12 z-50 w-80 rounded-2xl p-2"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 18px 50px -12px rgba(0,0,0,0.35)" }}
                  >
                    <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                      <span className="text-[11px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
                        Notifications
                      </span>
                      {unread > 0 && <Badge tone="red">{unread} new</Badge>}
                    </div>
                    {notif.latest.length === 0 ? (
                      <p className="px-2 pb-2 pt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
                        No unread items. New feedback appears here.
                      </p>
                    ) : (
                      <ul className="max-h-72 overflow-y-auto">
                        {notif.latest.map((n) => (
                          <li key={n.id}>
                            <Link
                              href="/admin/feedback"
                              onClick={() => setBellOpen(false)}
                              className="tmenu block rounded-xl px-2.5 py-2"
                            >
                              <span className="block truncate text-[13px] font-bold">{n.subject}</span>
                              <span className="block truncate text-[11.5px]" style={{ color: "var(--muted)" }}>
                                {n.email} · {relTime(n.created_at)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href="/admin/feedback"
                      onClick={() => setBellOpen(false)}
                      className="mt-1 block rounded-xl px-2.5 py-2 text-center text-[12.5px] font-extrabold"
                      style={{ background: "var(--pill)" }}
                    >
                      Open feedback inbox →
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* theme toggle */}
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "midnight" : "light")}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              title={theme === "light" ? "Dark mode" : "Light mode"}
              className="admin-btn hidden px-2.5 sm:inline-flex"
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
            </button>

            {/* profile dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Admin account menu"
                aria-expanded={menuOpen}
                className="flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2.5"
                style={{ border: "1px solid var(--border)", background: "var(--pill)" }}
              >
                <Avatar src={profile?.custom_avatar || undefined} name={displayName} size={30} />
                <span className="hidden max-w-[150px] truncate text-[12.5px] font-bold sm:block">{displayName}</span>
                <span style={{ color: "var(--muted)" }}>
                  <Icon name="chevronDown" size={13} />
                </span>
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 cursor-default bg-transparent"
                  />
                  <div
                    className="menu-in absolute right-0 top-12 z-50 w-72 rounded-2xl p-1.5"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 18px 50px -12px rgba(0,0,0,0.35)" }}
                  >
                    <div className="flex items-center gap-3 px-3 py-3">
                      <Avatar src={profile?.custom_avatar || undefined} name={displayName} size={42} />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-extrabold">{displayName}</div>
                        <div className="truncate text-[11.5px]" style={{ color: "var(--muted)" }} title={email}>
                          {email || "…"}
                        </div>
                        <div className="mt-1">
                          <Badge tone="violet">Administrator</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="my-1 h-px" style={{ background: "var(--border)" }} />
                    <Link
                      href="/admin/profile"
                      onClick={() => setMenuOpen(false)}
                      className="tmenu flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold"
                    >
                      <Icon name="user" size={15} /> Profile
                    </Link>
                    <Link
                      href="/admin/profile#account"
                      onClick={() => setMenuOpen(false)}
                      className="tmenu flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold"
                    >
                      <Icon name="lock" size={15} /> Account &amp; security
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTheme(theme === "light" ? "midnight" : "light")}
                      className="tmenu flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-bold"
                    >
                      <Icon name={theme === "light" ? "moon" : "sun"} size={15} />
                      {theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                    </button>
                    <Link
                      href="/admin/settings"
                      onClick={() => setMenuOpen(false)}
                      className="tmenu flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold"
                    >
                      <Icon name="settings" size={15} /> Settings
                    </Link>
                    <div className="my-1 h-px" style={{ background: "var(--border)" }} />
                    <button
                      type="button"
                      onClick={logout}
                      disabled={loggingOut}
                      className="tmenu flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-bold"
                      style={{ color: "#ef4444" }}
                    >
                      {loggingOut ? <Spinner size={13} /> : <Icon name="logout" size={15} />} Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full px-3 pt-20 sm:px-5" style={{ maxWidth: "96rem" }}>
          <aside
            className={cx(
              "sticky top-20 hidden h-[calc(100svh-6rem)] shrink-0 self-start overflow-hidden rounded-[20px] md:block",
              collapsed ? "w-[76px]" : "w-[268px]"
            )}
            style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}
          >
            {nav}
          </aside>
          <main className="min-w-0 flex-1 px-0 pb-24 md:pl-5">{children}</main>
        </div>

        {drawer && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 cursor-default"
              style={{ background: "rgba(0,0,0,0.45)" }}
            />
            <aside className="absolute bottom-0 left-0 top-0 flex w-[280px] max-w-[85vw] flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
              <div className="flex items-center justify-between px-4 pb-0 pt-4">
                <span className="text-[14px] font-extrabold">Admin panel</span>
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  aria-label="Close menu"
                  className="admin-btn px-2.5"
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
              <div className="min-h-0 flex-1">{nav}</div>
            </aside>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
