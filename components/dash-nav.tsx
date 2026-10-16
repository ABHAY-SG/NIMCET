"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient, signOutAll } from "@/lib/supabase";
import { THEMES, applyTheme, readTheme, type ThemeId } from "@/lib/theme";

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
  onDisplayNameChange,
  streak,
}: {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  onLogout: () => void;
  onDisplayNameChange?: (name: string) => void;
  streak?: StreakSummary;
}) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<null | "profile" | "streak" | "bell" | "theme">(null);
  const [theme, setTheme] = useState<ThemeId>("light");
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  useEffect(() => {
    setImgOk(true);
  }, [avatarUrl]);

  const pickTheme = (t: ThemeId) => {
    setTheme(t);
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

  const openEditor = () => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    setFirst(parts[0] ?? "");
    setLast(parts.slice(1).join(" "));
    setSaveMsg("");
    setEditing(true);
  };

  const saveName = async () => {
    const f = first.trim();
    const l = last.trim();
    if (!f) { setSaveMsg("First name is required."); return; }
    setSaving(true);
    setSaveMsg("");
    try {
      const sb = getAuthClient();
      const { error } = await sb.auth.updateUser({ data: { first_name: f, last_name: l } });
      if (error) throw error;
      const full = [f, l].filter(Boolean).join(" ");
      onDisplayNameChange?.(full);
      setEditing(false);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
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
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4">
        <a href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="NimCuet dashboard home">
          <img src="/logo.png" alt="" aria-hidden className="site-logo block h-7 w-auto" />
          <span className="mono rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }}>
            DASHBOARD
          </span>
        </a>
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
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <span aria-hidden className="inline-block h-4 w-4 rounded-full" style={{ background: THEMES.find((t) => t.id === theme)?.dot, border: "1px solid var(--border)" }} />
          </button>
          <button
            type="button"
            onClick={() => { setOpenMenu((m) => (m === "profile" ? null : "profile")); setEditing(false); setSaveMsg(""); }}
            aria-label="Profile menu"
            title={displayName || email}
            className="h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full transition-transform hover:-translate-y-px"
            style={avatarUrl && imgOk ? { border: "2px solid var(--accent)" } : { background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
          >
            {avatarUrl && imgOk ? (
              <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-extrabold text-white">
                {initialsOf(displayName, email)}
              </span>
            )}
          </button>

          {openMenu && (
            <button type="button" aria-label="Close menu" onClick={() => setOpenMenu(null)} className="fixed inset-0 z-40 cursor-default bg-transparent" />
          )}

          {openMenu === "streak" && streak && (
            <div className="menu-in absolute right-0 top-12 z-50 w-64 rounded-2xl p-4" style={panelStyle}>
              <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>Daily streak</div>
              <div className="mt-2 flex items-end gap-3">
                <div className="mono text-3xl font-extrabold" style={{ color: "var(--accent)" }}>🔥 {streak.current}</div>
                <div className="pb-1 text-xs" style={{ color: "var(--muted)" }}>best {streak.best}d</div>
              </div>
              <div className="mt-3 flex justify-between gap-1">
                {streak.week.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                      style={d.active
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--pill)", color: "var(--muted)", border: d.isToday ? "1.5px solid var(--accent)" : "1px solid transparent" }}
                    >
                      {d.active ? "✓" : d.label}
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: "var(--muted)" }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5" style={{ color: "var(--muted)" }}>
                Attempt any mock to keep the streak alive. Today is ringed.
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
                  <span className="flex-1">{t.name}</span>
                  {t.id === theme && <span>✓</span>}
                </button>
              ))}
            </div>
          )}

          {openMenu === "profile" && (
            <div className="menu-in absolute right-0 top-12 z-50 w-72 rounded-2xl p-4" style={panelStyle}>
              <div className="flex items-center gap-3">
                <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-full">
                  {avatarUrl && imgOk ? (
                    <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-base font-extrabold text-white"
                      style={{ background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
                    >
                      {initialsOf(displayName, email)}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{displayName || email.split("@")[0]}</div>
                  <div className="truncate text-xs" style={{ color: "var(--muted)" }} title={email}>{email}</div>
                </div>
              </div>
              {!editing ? (
                <button
                  type="button"
                  onClick={openEditor}
                  className="mt-3 w-full cursor-pointer rounded-xl py-2 text-[13px] font-bold"
                  style={{ border: "1px solid var(--border)" }}
                >
                  Edit display name
                </button>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" autoComplete="given-name"
                      className="min-w-0 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
                    />
                    <input
                      type="text" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" autoComplete="family-name"
                      className="min-w-0 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
                    />
                  </div>
                  {saveMsg && <p className="mt-2 text-xs font-semibold" style={{ color: "#dc2626" }}>{saveMsg}</p>}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button" onClick={saveName} disabled={saving}
                      className="cursor-pointer rounded-xl py-2 text-[13px] font-bold text-white disabled:opacity-50"
                      style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button" onClick={() => setEditing(false)}
                      className="cursor-pointer rounded-xl py-2 text-[13px] font-bold"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--pill)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Profile photo</span>
                <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }} title="Photo uploads need a Supabase storage bucket, which is not set up yet">
                  Coming soon
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="mt-2 w-full cursor-pointer rounded-xl py-2.5 text-sm font-bold transition-transform hover:-translate-y-px"
                style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
