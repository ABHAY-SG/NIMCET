"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAll } from "@/lib/supabase";
import { THEMES, applyTheme, useTheme, type ThemeId } from "@/lib/theme";
import { formatStreak } from "@/lib/streak";
import { ThemeIcon } from "@/components/theme-fab";

export type StreakSummary = {
  current: number;
  best: number;
  week: Array<{ label: string; active: boolean; isToday: boolean }>;
};

function initialsOf(name: string, email: string): string {
  const src = (name || "").trim() || email.split("@")[0].replace(/[._-]+/g, " ");
  const parts = src.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

const iconBtn =
  "relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:-translate-y-px";

export default function DashNav({
  email,
  displayName = "",
  avatarUrl = "",
  onLogout,
  streak,
  onMenuClick,
}: {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  onLogout: () => void;
  streak?: StreakSummary;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<null | "profile" | "streak" | "bell" | "theme">(null);
  const theme = useTheme();
  const [imgOk, setImgOk] = useState(true);

  // Reset the avatar fallback whenever the URL changes (React's documented
  // adjust-during-render pattern — no effect needed).
  const [prevAvatar, setPrevAvatar] = useState(avatarUrl);
  if (prevAvatar !== avatarUrl) {
    setPrevAvatar(avatarUrl);
    setImgOk(true);
  }

  const pickTheme = (t: ThemeId) => {
    applyTheme(t);
    setOpenMenu(null);
  };

  const logout = async () => {
    try {
      await signOutAll();
    } catch {}
    onLogout();
    router.push("/login");
  };

  const panelStyle: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 18px 50px -12px rgba(0,0,0,0.35)",
  };

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-2xl backdrop-saturate-150"
      style={{
        background: "color-mix(in srgb, var(--nav-bg) 82%, transparent)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 18px 48px -20px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.18)",
      }}
    >
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-2">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-lg md:hidden"
              style={{ border: "1px solid var(--border)", color: "var(--text)" }}
            >
              ☰
            </button>
          )}
          <a href="/dashboard" className="flex items-center gap-2.5" aria-label="NimCuet dashboard home">
            <img src="/logo.png" alt="" aria-hidden className="site-logo block h-7 w-auto" />
          </a>
        </div>
        <div className="relative flex shrink-0 items-center gap-1.5">
          {streak && (
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === "streak" ? null : "streak"))}
              aria-label={`Streak ${streak.current} days — view activity`}
              title="Daily streak"
              className={iconBtn}
              style={{ border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <span aria-hidden>🔥</span>
              <span className="mono text-xs font-extrabold">{streak.current}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "bell" ? null : "bell"))}
            aria-label="Notifications"
            title="Notifications"
            className={iconBtn}
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <BellIcon />
          </button>
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "theme" ? null : "theme"))}
            aria-label={`Change theme (current: ${theme})`}
            title="Theme"
            className={iconBtn}
            style={{ border: "1px solid var(--border)", color: THEMES.find((t) => t.id === theme)?.icon }}
          >
            <ThemeIcon id={theme} />
          </button>
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "profile" ? null : "profile"))}
            aria-label="Profile menu"
            title={displayName || email}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 transition-transform hover:-translate-y-px"
          >
            <span className="block h-10 w-10 overflow-hidden rounded-full"
              style={avatarUrl && imgOk ? undefined : { background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
            >
              {avatarUrl && imgOk ? (
                <img src={`/api/avatar?src=${encodeURIComponent(avatarUrl)}`} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-extrabold" style={{ color: "var(--accent-fg)" }}>
                  {initialsOf(displayName, email)}
                </span>
              )}
            </span>
            <span className="hidden text-sm font-bold sm:block" title={displayName || email}>
              {(displayName || "").trim().split(/\s+/)[0] || email.split("@")[0]}
            </span>
          </button>

          {openMenu && (
            <button type="button" aria-label="Close menu" onClick={() => setOpenMenu(null)} className="fixed inset-0 z-40 cursor-default bg-transparent" />
          )}

          {openMenu === "streak" && streak && (
            <div className="menu-in absolute right-0 top-12 z-50 w-72 rounded-2xl p-5" style={panelStyle}>
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>Daily streak</div>
                <span className="mono rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: "var(--pill)", color: "var(--accent)" }}>
                  BEST {streak.best}d
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))", color: "var(--accent-fg)" }}>
                <span aria-hidden className="text-4xl">🔥</span>
                <div>
                  <div className="text-xl font-extrabold leading-tight">{formatStreak(streak.current)}</div>
                  <div className="mt-1 text-[11px] font-semibold" style={{ color: "color-mix(in srgb, var(--accent-fg) 85%, transparent)" }}>
                    {streak.current > 0 ? "in a row — keep it burning" : "attempt a mock to ignite it"}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex min-w-0 justify-between gap-1">
                {streak.week.map((d, i) => (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold"
                      style={d.active
                        ? { background: "linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))", color: "var(--accent-fg)", boxShadow: "0 8px 20px -8px var(--accent)" }
                        : { background: "var(--pill)", color: "var(--muted)", border: d.isToday ? "2px solid var(--accent)" : "1px solid transparent" }}
                    >
                      {d.active ? "✓" : d.label}
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: d.isToday ? "var(--accent)" : "var(--muted)" }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold leading-5" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                {streak.week.length > 0 && streak.week[streak.week.length - 1]?.active
                  ? "Today's mock is done — see you tomorrow. 🔥"
                  : "No mock yet today — one attempt keeps the streak alive."}
              </p>
            </div>
          )}

          {openMenu === "bell" && (
            <div className="menu-in absolute right-0 top-12 z-50 w-72 rounded-2xl p-4" style={panelStyle}>
              <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>Notifications</div>
              <div className="mt-3 rounded-xl p-4 text-center" style={{ border: "1px dashed var(--border)" }}>
                <div className="text-2xl" aria-hidden>🔔</div>
                <p className="mt-2 text-[13px] font-bold">No updates yet</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--muted)" }}>
                  There is no announcements feed connected, so nothing is listed here rather than made-up news.
                </p>
              </div>
            </div>
          )}

          {openMenu === "theme" && (
            <div className="menu-in absolute right-0 top-12 z-50 w-48 rounded-2xl p-1.5" style={panelStyle}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                Theme
              </div>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTheme(t.id)}
                  className="tmenu flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-left text-sm font-medium"
                  style={t.id === theme ? { background: "var(--pill)", color: "var(--text)" } : undefined}
                >
                  <span className="tdot inline-block h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: t.dot, border: "1px solid var(--border)" }} />
                  <span className="flex items-center gap-2" style={{ color: t.icon }}>
                    <ThemeIcon id={t.id} />
                  </span>
                  <span className="flex-1">{t.name}</span>
                  {t.id === theme && <span>✓</span>}
                </button>
              ))}
            </div>
          )}

          {openMenu === "profile" && (
            <div className="menu-in absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl" style={panelStyle}>
              <div
                className="flex items-center gap-3 px-4 pb-3.5 pt-4"
                style={{ background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))", color: "var(--accent-fg)" }}
              >
                <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-full" style={{ border: "2px solid color-mix(in srgb, var(--accent-fg) 60%, transparent)" }}>
                  {avatarUrl && imgOk ? (
                    <img src={`/api/avatar?src=${encodeURIComponent(avatarUrl)}`} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-base font-extrabold" style={{ background: "color-mix(in srgb, var(--accent-fg) 20%, transparent)" }}>
                      {initialsOf(displayName, email)}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{displayName || email.split("@")[0]}</div>
                  <div className="truncate text-xs" style={{ color: "color-mix(in srgb, var(--accent-fg) 80%, transparent)" }} title={email}>{email}</div>
                </div>
              </div>
              <div className="p-1.5">
                <a
                  href="/dashboard/profile"
                  onClick={() => setOpenMenu(null)}
                  className="tmenu flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold"
                >
                  <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "var(--pill)", color: "var(--accent)" }}>👤</span>
                  Profile
                  <span aria-hidden className="ml-auto" style={{ color: "var(--muted)" }}>›</span>
                </a>
                <a
                  href="/dashboard#attempts"
                  onClick={() => setOpenMenu(null)}
                  className="tmenu flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold"
                >
                  <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "var(--pill)", color: "var(--accent)" }}>🕘</span>
                  Test history
                  <span aria-hidden className="ml-auto" style={{ color: "var(--muted)" }}>›</span>
                </a>
                <div className="mx-3 my-1 h-px" style={{ background: "var(--border)" }} />
                <button
                  type="button"
                  onClick={logout}
                  className="tmenu flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold"
                  style={{ color: "#dc2626" }}
                >
                  <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "rgba(220,38,38,0.12)" }}>↩</span>
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
