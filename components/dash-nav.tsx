"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronRight,
  Flame,
  History,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";
import { signOutAll } from "@/lib/supabase";
import { THEMES, applyTheme, useTheme, type ThemeId } from "@/lib/theme";
import { formatStreak } from "@/lib/streak";
import { ThemeIcon } from "@/components/theme-fab";
import PasswordPrompt from "@/components/password-prompt";

export type StreakSummary = {
  current: number;
  best: number;
  week: Array<{ label: string; active: boolean; isToday: boolean }>;
};

type Notice = { id: string; title: string; body: string; created_at: string };

function initialsOf(name: string, email: string): string {
  const src = (name || "").trim() || email.split("@")[0].replace(/[._-]+/g, " ");
  const parts = src.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const iconBtn =
  "relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border transition-colors hover:bg-[var(--dash-brand-soft)]";

export default function DashNav({
  email,
  displayName = "",
  avatarUrl = "",
  onLogout,
  streak,
  onMenuClick,
  title,
  subtitle,
  notices = [],
}: {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  onLogout: () => void;
  streak?: StreakSummary;
  onMenuClick?: () => void;
  title?: string;
  subtitle?: string;
  notices?: Notice[];
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

  useEffect(() => {
    if (!openMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenu]);

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
    background: "var(--dash-surface)",
    border: "1px solid var(--dash-line)",
    boxShadow: "0 28px 80px -28px rgba(4, 22, 24, 0.42)",
  };
  const currentTheme = THEMES.find((t) => t.id === theme);
  const firstName = (displayName || "").trim().split(/\s+/)[0] || email.split("@")[0];
  const noticeCount = notices.length;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-xl backdrop-saturate-150"
      style={{
        background: "color-mix(in srgb, var(--nav-bg) 94%, transparent)",
        borderBottom: "1px solid var(--dash-line)",
      }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1560px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          {onMenuClick && (
            <span className="flex shrink-0 lg:hidden">
              <button
                type="button"
                onClick={(e) => {
                  // Focus the trigger so the drawer can return focus here on close.
                  e.currentTarget.focus();
                  onMenuClick();
                }}
                aria-label="Open navigation"
                aria-haspopup="dialog"
                className="dash-btn dash-btn-ghost dash-btn-icon"
                style={{ width: 38, minWidth: 38, minHeight: 38, border: "1px solid var(--dash-line)" }}
              >
                <Menu size={18} />
              </button>
            </span>
          )}
          <a href="/dashboard" className="hidden shrink-0 items-center sm:flex lg:hidden" aria-label="NimCuet dashboard home">
            <span className="flex min-w-0 flex-col items-start gap-1">
              <img src="/logo.png" alt="" aria-hidden className="site-logo block h-6 w-auto" />
              <span
                aria-hidden
                className="hidden whitespace-nowrap text-[9.5px] font-semibold leading-none md:block"
                style={{ color: "var(--muted)", letterSpacing: ".09em" }}
              >
                Prepare Smart. Perform Better.
              </span>
            </span>
          </a>
          <span aria-hidden className="hidden h-6 w-px sm:block lg:hidden" style={{ background: "var(--dash-line)" }} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold leading-[1.25] tracking-[-0.012em]" style={{ color: "var(--text)" }}>
              {title || "Dashboard"}
            </div>
            <div className="hidden truncate text-[10.5px] font-medium leading-[1.35] sm:block" style={{ color: "var(--muted)" }}>
              {subtitle || "NIMCET & CUET PG preparation"}
            </div>
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5">
          {streak && (
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === "streak" ? null : "streak"))}
              aria-label={`Daily streak: ${streak.current} days. View activity.`}
              aria-expanded={openMenu === "streak"}
              aria-haspopup="dialog"
              title="Daily streak"
              className={`${iconBtn} hidden items-center gap-1.5 px-2.5 sm:flex`}
              style={{ borderColor: "var(--dash-line)", color: "var(--text)", background: "transparent" }}
            >
              <Flame size={15} style={{ color: streak.current > 0 ? "var(--dash-warning)" : "var(--muted)" }} />
              <span className="dash-num text-[11.5px] font-extrabold">{streak.current}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "theme" ? null : "theme"))}
            aria-label={`Change theme. Current theme: ${currentTheme?.name ?? theme}.`}
            aria-expanded={openMenu === "theme"}
            aria-haspopup="dialog"
            title="Theme"
            className={iconBtn}
            style={{ borderColor: "var(--dash-line)", color: "var(--text)", background: "transparent" }}
          >
            <ThemeIcon id={theme} />
          </button>

          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "bell" ? null : "bell"))}
            aria-label={noticeCount > 0 ? `Notifications: ${noticeCount} notice${noticeCount === 1 ? "" : "s"}` : "Notifications"}
            aria-expanded={openMenu === "bell"}
            aria-haspopup="dialog"
            title="Notifications"
            className={iconBtn}
            style={{ borderColor: "var(--dash-line)", color: "var(--text)", background: "transparent" }}
          >
            <Bell size={16} strokeWidth={1.9} />
            {noticeCount > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-extrabold text-white"
                style={{ background: "var(--accent)", boxShadow: "0 0 0 2px var(--nav-bg)" }}
              >
                {noticeCount > 9 ? "9+" : noticeCount}
              </span>
            )}
          </button>

          <span aria-hidden className="mx-0.5 hidden h-6 w-px sm:block" style={{ background: "var(--dash-line)" }} />

          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "profile" ? null : "profile"))}
            aria-label="Account menu"
            aria-expanded={openMenu === "profile"}
            aria-haspopup="dialog"
            title={displayName || email}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] pl-0.5 pr-1 transition-colors hover:bg-[var(--dash-brand-soft)]"
          >
            <span
              className="block h-8 w-8 overflow-hidden rounded-full border"
              style={avatarUrl && imgOk ? { borderColor: "var(--dash-line)" } : { borderColor: "var(--dash-accent-line)" }}
            >
              {avatarUrl && imgOk ? (
                <img
                  src={`/api/avatar?src=${encodeURIComponent(avatarUrl)}`}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setImgOk(false)}
                  className="block h-full w-full object-cover"
                />
              ) : (
                <span className="dash-avatar-fallback h-full w-full text-[11px]">{initialsOf(displayName, email)}</span>
              )}
            </span>
            <span className="hidden max-w-[9rem] truncate text-[12.5px] font-bold sm:block" style={{ color: "var(--text)" }}>
              {firstName}
            </span>
            <ChevronDown size={14} className="hidden sm:block" style={{ color: "var(--muted)" }} />
          </button>

          {openMenu && (
            <button type="button" aria-label="Close menu" onClick={() => setOpenMenu(null)} className="fixed inset-0 z-40 cursor-default bg-transparent" />
          )}

          {openMenu === "streak" && streak && (
            <div className="menu-in absolute right-0 top-12 z-50 w-[19rem] rounded-[var(--dash-radius)] p-4" style={panelStyle} role="dialog" aria-label="Daily streak">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="dash-eyebrow">Daily streak</div>
                  <div className="mt-1 text-[15px] font-extrabold" style={{ color: "var(--text)" }}>{formatStreak(streak.current)}</div>
                </div>
                <span className="dash-chip dash-chip-warning">
                  <Flame size={12} /> Best {streak.best}d
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-1.5">
                {streak.week.map((d, i) => (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold"
                      style={d.active
                        ? { background: "var(--accent)", color: "var(--accent-fg)" }
                        : { background: "var(--dash-surface-muted)", color: "var(--muted)", border: d.isToday ? "1.5px solid var(--accent)" : "1px solid var(--dash-line)" }}
                    >
                      {d.active ? <Check size={13} strokeWidth={2.6} /> : d.label}
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: d.isToday ? "var(--accent)" : "var(--muted)" }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-[10px] px-3 py-2 text-[11px] leading-5" style={{ background: "var(--dash-surface-muted)", color: "var(--muted)" }}>
                {streak.week.length > 0 && streak.week[streak.week.length - 1]?.active
                  ? "Today's mock is complete. Come back tomorrow to extend it."
                  : "One mock today keeps your streak active."}
              </p>
            </div>
          )}

          {openMenu === "bell" && (
            <div className="menu-in absolute right-0 top-12 z-50 w-[20rem] rounded-[var(--dash-radius)] p-4" style={panelStyle} role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between">
                <div className="dash-eyebrow">Notifications</div>
                <span className="dash-chip">{noticeCount} notice{noticeCount === 1 ? "" : "s"}</span>
              </div>
              {noticeCount === 0 ? (
                <div className="dash-empty mt-3 !px-4 !py-6">
                  <span className="dash-empty-icon"><BellOff size={18} /></span>
                  <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>Nothing new</p>
                  <p className="max-w-[15rem] text-[11px] leading-5" style={{ color: "var(--muted)" }}>
                    Announcements from the NimCuet team will appear here.
                  </p>
                </div>
              ) : (
                <div className="noscroll mt-3 grid max-h-[19rem] gap-2 overflow-y-auto">
                  {notices.slice(0, 6).map((n) => (
                    <div key={n.id} className="rounded-[10px] border px-3 py-2.5" style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}>
                      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                        <span className="text-[11.5px] font-bold" style={{ color: "var(--text)" }}>{n.title}</span>
                        <span className="dash-num text-[9.5px]" style={{ color: "var(--muted)" }}>
                          {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[10.5px] leading-5" style={{ color: "var(--muted)" }}>{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {openMenu === "theme" && (
            <div className="menu-in absolute right-0 top-12 z-50 w-52 rounded-[var(--dash-radius)] p-1.5" style={panelStyle} role="dialog" aria-label="Theme">
              <div className="px-3 pb-1.5 pt-2 dash-eyebrow">Appearance</div>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTheme(t.id)}
                  className="tmenu flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[12.5px] font-semibold"
                  style={t.id === theme ? { background: "var(--dash-surface-muted)", color: "var(--text)" } : undefined}
                >
                  <span className="tdot inline-block h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: t.dot, border: "1px solid var(--dash-line)" }} />
                  <span className="flex items-center gap-2" style={{ color: "var(--text)" }}>
                    <ThemeIcon id={t.id} />
                  </span>
                  <span className="flex-1">{t.name}</span>
                  {t.id === theme && <Check size={13} style={{ color: "var(--accent)" }} />}
                </button>
              ))}
            </div>
          )}

          {openMenu === "profile" && (
            <div className="menu-in absolute right-0 top-12 z-50 w-[17rem] overflow-hidden rounded-[var(--dash-radius)]" style={panelStyle} role="dialog" aria-label="Account menu">
              <div className="flex items-center gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}>
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: "var(--dash-line)" }}>
                  {avatarUrl && imgOk ? (
                    <img src={`/api/avatar?src=${encodeURIComponent(avatarUrl)}`} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
                  ) : (
                    <span className="dash-avatar-fallback h-full w-full text-[12px]">{initialsOf(displayName, email)}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>{displayName || email.split("@")[0]}</div>
                  <div className="truncate text-[11px]" style={{ color: "var(--muted)" }} title={email}>{email}</div>
                </div>
              </div>
              <div className="p-1.5">
                <a href="/dashboard/profile" onClick={() => setOpenMenu(null)} className="tmenu flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-semibold">
                  <span className="dash-icon-tile dash-icon-tile-neutral dash-icon-tile-sm"><UserRound size={15} /></span>
                  Profile & settings
                  <ChevronRight size={14} className="ml-auto" style={{ color: "var(--muted)" }} />
                </a>
                <a href="/dashboard?view=history" onClick={() => setOpenMenu(null)} className="tmenu flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-semibold">
                  <span className="dash-icon-tile dash-icon-tile-neutral dash-icon-tile-sm"><History size={15} /></span>
                  Test history
                  <ChevronRight size={14} className="ml-auto" style={{ color: "var(--muted)" }} />
                </a>
                <div className="mx-2.5 my-1 h-px" style={{ background: "var(--dash-line)" }} />
                <button
                  type="button"
                  onClick={logout}
                  className="tmenu flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-semibold"
                  style={{ color: "var(--dash-danger)" }}
                >
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px]" style={{ background: "var(--dash-danger-soft)" }}><LogOut size={15} /></span>
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* One-time "add a password" prompt for Google/GitHub-only accounts. */}
      <PasswordPrompt />
    </header>
  );
}
