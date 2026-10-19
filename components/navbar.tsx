"use client";
import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAuthClient } from "@/lib/supabase";
import { applyTheme, useTheme, THEMES, type ThemeId } from "@/lib/theme";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 8c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
      <path d="M2 14c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19C5 9 13 4 20 4c0 8-5 15-15 15" />
      <path d="M5 19c3-5 7-9 11-11" />
    </svg>
  );
}

function SunsetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 9a5 5 0 0 0-8 4h16a5 5 0 0 0-8-4z" />
      <path d="M12 4v2M5.6 6.6l1.4 1.4M18.4 6.6 17 8" />
      <path d="M4 17h16M7 20h10" />
    </svg>
  );
}

const THEME_ICONS: Record<ThemeId, ComponentType> = {
  light: SunIcon,
  midnight: MoonIcon,
  ocean: WaveIcon,
  forest: LeafIcon,
  sunset: SunsetIcon,
};

function LogoImg() {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <span className="leading-none">
        <span className="logo-script block text-[26px] text-[var(--text)] sm:text-[30px]">
          <span className="text-[1.3em]">N</span>imCuet
        </span>
        <span className="-mt-1 block text-[9px] font-medium tracking-[0.08em] text-[var(--muted)]">
          Prepare smart. <span style={{ color: "var(--accent)" }}>Perform better.</span>
        </span>
      </span>
    );
  }
  return (
    <span className="leading-none">
      <img
        src="/logo.png"
        alt="NimCuet"
        title="NimCuet"
        onError={() => setMissing(true)}
        className="site-logo block h-7 w-auto sm:h-8"
      />
      <span className="mt-0 hidden text-[9px] font-medium tracking-[0.08em] text-[var(--muted)] min-[420px]:block">
        Prepare smart. <span style={{ color: "var(--accent)" }}>Perform better.</span>
      </span>
    </span>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const theme = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  // Section anchors only exist on the landing page; other pages highlight
  // their own nav entry instead of a wrong "Home".
  const PAGE_IDS: Record<string, string> = { "/about": "about", "/faq": "faqs", "/contact": "contact" };
  const pageId = pathname === "/" ? "" : PAGE_IDS[pathname] ?? "";
  const isActive = (id: string) => (pathname === "/" ? active === id : pageId === id);

  useEffect(() => {
    // Session-aware action: the public navbar carries EXACTLY ONE entry point
    // for a signed-in visitor, chosen by role — "Admin panel" for staff, else
    // "Dashboard". The student dashboard and the admin console stay separate
    // areas and are never cross-linked from here, so a public page can't read
    // as a hub with two competing destinations. Anonymous visitors keep the
    // Log in / Get Started pair below and never see either label.
    // Read-only check — touches no auth flow.
    (async () => {
      try {
        const sb = getAuthClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        setLoggedIn(true);
        try {
          const r = await fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
          if (r.ok) {
            const info = (await r.json()) as { admin?: boolean };
            if (info.admin) setIsAdmin(true);
          }
        } catch {}
      } catch {}
    })();
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const spyIds = ["exams", "how", "pricing", "about", "faqs", "contact"];
    const onSpy = () => {
      if (window.scrollY < 200) { setActive("home"); return; }
      let cur = "";
      for (const id of spyIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) cur = id;
      }
      setActive(cur);
    };
    onSpy();
    window.addEventListener("scroll", onSpy, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onSpy);
    };
  }, []);

  const pick = (t: ThemeId) => {
    applyTheme(t);
    setThemeOpen(false);
  };

  // Escape closes the theme popover (keyboard parity with the close overlay).
  useEffect(() => {
    if (!themeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setThemeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [themeOpen]);

  const linkCls = "nlink shrink-0 rounded-full px-2.5 py-2 text-sm font-medium sm:px-3";
  const plainCls = "shrink-0 rounded-full px-2.5 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:px-3";
  const nav = (id: string, label: string, extra = "") => (
    <a href={id === "home" ? "/" : `/#${id}`} className={`${linkCls}${isActive(id) ? " active" : ""}${extra}`}>
      {label}
    </a>
  );

  const ActiveIcon = THEME_ICONS[theme];

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-2xl backdrop-saturate-150"
      style={{
        background: scrolled
          ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02)), color-mix(in srgb, var(--nav-bg) 82%, transparent)"
          : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01)), color-mix(in srgb, var(--nav-bg) 55%, transparent)",
        borderBottom: "1px solid var(--border)",
        boxShadow: scrolled
          ? "0 18px 48px -20px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.18)"
          : "inset 0 1px 0 0 rgba(255,255,255,0.12)",
      }}
    >
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className={plainCls + " lg:hidden"}
          >
            {open ? "✕" : "☰"}
          </button>
          <Link href="/" className="flex items-center transition-transform duration-300 hover:scale-[1.02]" aria-label="NimCuet home">
            <LogoImg />
          </Link>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-hidden lg:flex">
          {nav("home", "Home")}
          {nav("exams", "Exams")}
          {nav("how", "How it works")}
          {nav("pricing", "Pricing")}
          {nav("about", "About Us")}
          {nav("faqs", "FAQs")}
          {nav("contact", "Contact Us")}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setThemeOpen((v) => !v); }}
              aria-label="Change theme"
              className={plainCls + " flex items-center gap-1.5"}
              title={theme}
            >
              <ActiveIcon />
            </button>
            {themeOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setThemeOpen(false)}
                  className="fixed inset-0 z-40 cursor-default bg-transparent"
                />
                <div
                  className="menu-in absolute right-0 top-full z-[60] mt-3.5 w-48 overflow-hidden rounded-2xl p-1.5 backdrop-blur-2xl"
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
                      <span className="flex-1">{t.name}</span>
                      {t.id === theme && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {loggedIn ? (
            <a
              href={isAdmin ? "/admin" : "/dashboard"}
              className="cta-glow flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold sm:px-5"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              {isAdmin ? "Admin panel" : "Dashboard"}
              <span className="carr text-[15px]">→</span>
            </a>
          ) : (
            <>
              <a href="/login-choice" className={plainCls + " hidden sm:block"}>Log in</a>
              <a
                href="/signup"
                className="cta-glow flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold sm:px-5"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                Get Started
                <span className="carr text-[15px]">→</span>
              </a>
            </>
          )}
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" className="mx-auto flex w-full flex-col px-4 pb-3 sm:px-6 lg:hidden lg:px-8">
          {[
            ["home", "Home"],
            ["exams", "Exams"],
            ["how", "How it works"],
            ["pricing", "Pricing"],
            ["about", "About Us"],
            ["faqs", "FAQs"],
            ["contact", "Contact Us"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={id === "home" ? "/" : `/#${id}`}
              onClick={() => setOpen(false)}
              className={`${linkCls} nounder${isActive(id) ? " active" : ""}`}
            >
              {label}
            </a>
          ))}
          {loggedIn ? (
            <a
              href={isAdmin ? "/admin" : "/dashboard"}
              onClick={() => setOpen(false)}
              className={plainCls}
            >
              {isAdmin ? "Admin panel" : "Dashboard"} →
            </a>
          ) : (
            <a href="/login-choice" onClick={() => setOpen(false)} className={plainCls}>Log in</a>
          )}
          <div className="flex gap-1.5 py-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2"
                style={{
                  background: t.id === theme ? "var(--pill)" : "transparent",
                  border: t.id === theme ? "1px solid var(--accent)" : "1px solid var(--border)",
                }}
              >
                <span className="inline-block h-4 w-4 rounded-full" style={{ background: t.dot, border: "1px solid var(--border)" }} />
                <span className="text-[9px] font-medium" style={{ color: "var(--muted)" }}>{t.name}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
