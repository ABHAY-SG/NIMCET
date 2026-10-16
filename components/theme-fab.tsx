"use client";
import { useEffect, useState } from "react";
import { THEMES, applyTheme, readTheme, type ThemeId } from "@/lib/theme";

function ThemeIcon({ id }: { id: ThemeId }) {
  const paths: Record<ThemeId, React.ReactNode> = {
    light: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
    midnight: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    ocean: (<><path d="M2 8c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" /><path d="M2 14c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" /></>),
    forest: (<><path d="M5 19C5 9 13 4 20 4c0 8-5 15-15 15" /><path d="M5 19c3-5 7-9 11-11" /></>),
    sunset: (<><path d="M12 9a5 5 0 0 0-8 4h16a5 5 0 0 0-8-4z" /><path d="M12 4v2M5.6 6.6l1.4 1.4M18.4 6.6 17 8" /><path d="M4 17h16M7 20h10" /></>),
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[id]}
    </svg>
  );
}

export default function ThemeFab() {
  const [theme, setTheme] = useState<ThemeId>("light");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const pick = (t: ThemeId) => {
    setTheme(t);
    applyTheme(t);
    setOpen(false);
  };

  return (
    <div className="fixed right-4 top-4 z-[70]">
      {open && (
        <button type="button" aria-label="Close themes" onClick={() => setOpen(false)} className="fixed inset-0 cursor-default bg-transparent" />
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Change theme"
          title={`Theme: ${theme}`}
          className="flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-2xl transition-transform hover:-translate-y-0.5"
          style={{ background: "color-mix(in srgb, var(--nav-bg) 80%, transparent)", border: "1px solid var(--border)", color: "var(--text)", boxShadow: "0 12px 32px -12px rgba(0,0,0,0.4)" }}
        >
          <ThemeIcon id={theme} />
        </button>
        {open && (
          <div
            className="menu-in absolute right-0 top-13 z-50 w-44 overflow-hidden rounded-2xl p-1.5 backdrop-blur-2xl"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 18px 50px -12px rgba(0,0,0,0.35)" }}
          >
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
              Theme
            </div>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                className="tmenu flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-left text-sm font-medium"
                style={t.id === theme ? { background: "var(--pill)", color: "var(--text)" } : undefined}
              >
                <span className="tdot inline-block h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: t.dot, border: "1px solid var(--border)" }} />
                <span className="flex items-center gap-2">
                  <ThemeIcon id={t.id} />
                </span>
                <span className="flex-1">{t.name}</span>
                {t.id === theme && <span>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
