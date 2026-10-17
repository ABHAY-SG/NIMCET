"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

// Fixed navbar height (h-16). The cursor glow pins to this line whenever the
// pointer rides over the bar, so the hover effect covers everything from the
// navbar's bottom edge down — no dead strip at the top of the stage.
const NAV_H = 64;

// Rising ember field — seeded once, animated purely in CSS.
const SPARKS: Array<{ l: string; d: number; s: number; c: string }> = [
  { l: "6%", d: 1.2, s: 4, c: "accent" },
  { l: "14%", d: 5.4, s: 3, c: "gold" },
  { l: "23%", d: 2.6, s: 4, c: "accent" },
  { l: "31%", d: 8.3, s: 3, c: "accent2" },
  { l: "40%", d: 0.4, s: 4, c: "gold" },
  { l: "49%", d: 6.1, s: 3, c: "accent" },
  { l: "58%", d: 3.3, s: 4, c: "accent2" },
  { l: "67%", d: 9.2, s: 3, c: "gold" },
  { l: "75%", d: 4.7, s: 4, c: "accent" },
  { l: "84%", d: 1.9, s: 3, c: "gold" },
  { l: "92%", d: 7.4, s: 4, c: "accent2" },
  { l: "63%", d: 10.1, s: 3, c: "accent" },
];
const TONE: Record<string, string> = {
  accent: "var(--accent)",
  gold: "var(--gold-3)",
  accent2: "var(--accent-2)",
};

export default function Hero() {
  const secRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sec = secRef.current;
    if (!sec) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      const r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      let y = e.clientY - r.top;
      const navLine = NAV_H - r.top; // navbar's bottom edge in hero coordinates
      if (y < navLine) y = navLine;
      sec.style.setProperty("--mx", `${x}px`);
      sec.style.setProperty("--my", `${y}px`);
      sec.style.setProperty("--nx", String((x / r.width - 0.5) * 2));
      sec.style.setProperty("--ny", String((y / r.height - 0.5) * 2));
    };
    const onScroll = () => {
      sec.style.setProperty("--sy", String(Math.min(window.scrollY, 480)));
    };
    onScroll();
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section ref={secRef} className="hero relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Stage: dot sheet, ghost wordmark + script, breathing auras,
          rising sparks, cursor glow, vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-dots absolute inset-0" />
        <div className="hero-par-1 absolute inset-x-0 top-[15%]">
          <div className="hero-sy-1 relative mx-auto flex max-w-6xl justify-center">
            <span className="hero-word display select-none">NIMCUET</span>
            <span className="hero-script logo-script hidden lg:block">crack it.</span>
          </div>
        </div>
        <span className="hero-par-2 absolute" style={{ left: "-12%", top: "4%", width: "34rem", height: "34rem" }}>
          <span className="aura block h-full w-full" style={{ background: "color-mix(in srgb, var(--accent) 30%, transparent)" }} />
        </span>
        <span className="hero-par-2 absolute" style={{ right: "-10%", top: "30%", width: "30rem", height: "30rem" }}>
          <span className="aura block h-full w-full" style={{ background: "color-mix(in srgb, var(--gold-3) 24%, transparent)", animationDelay: "-6s", opacity: 0.45 }} />
        </span>
        <span className="hero-par-2 absolute" style={{ left: "28%", bottom: "-18%", width: "36rem", height: "36rem" }}>
          <span className="aura block h-full w-full" style={{ background: "color-mix(in srgb, var(--accent-2) 22%, transparent)", animationDelay: "-11s", opacity: 0.4 }} />
        </span>
        {SPARKS.map((p, i) => (
          <span
            key={i}
            className="spark"
            style={{
              left: p.l,
              width: p.s,
              height: p.s,
              background: `color-mix(in srgb, ${TONE[p.c]} 70%, transparent)`,
              animationDelay: `${-p.d}s`,
              animationDuration: `${9 + (i % 4) * 1.6}s`,
            }}
          />
        ))}
        <div className="hero-glow" />
        <div className="hero-vignette absolute inset-0" />
      </div>

      {/* Content: editorial column + tilting exam HUD */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-12 pt-28 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:gap-8 lg:px-8 lg:pt-24">
        <div className="text-center lg:max-w-xl lg:text-left">
          <p
            className="track-in inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase backdrop-blur-xl"
            style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)", color: "var(--muted)", letterSpacing: "0.22em" }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
            Full-length mocks · NIMCET + CUET PG
          </p>

          <h1 className="mt-7" style={{ fontSize: "clamp(2.9rem, 6.6vw, 5rem)", lineHeight: 1.03 }}>
            <span className="hline">
              <span className="block font-extrabold tracking-tight" style={{ fontFamily: '"Sora", "Space Grotesk", "Inter", sans-serif' }}>
                Rank is not luck.
              </span>
            </span>
            <span className="hline">
              <span className="block" style={{ animationDelay: "0.13s" }}>
                <span className="display serif-it headline-warm" style={{ fontWeight: 520 }}>
                  It’s repetition.
                </span>
              </span>
            </span>
          </h1>

          <div
            className="rise mx-auto mt-7 h-px w-24 lg:mx-0"
            style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", animationDelay: "0.32s" }}
          />

          <p className="rise mx-auto mt-6 max-w-lg text-[15px] leading-7 lg:mx-0" style={{ color: "var(--muted)", animationDelay: "0.4s" }}>
            Every mock replays the real paper — same pattern, same clock, same
            negative marking. You attempt, the report talks, the leaks get
            fixed, and the next attempt starts stronger than the last.
          </p>

          <div className="rise mt-9 flex flex-wrap justify-center gap-3 lg:justify-start" style={{ animationDelay: "0.5s" }}>
            <Link
              href="/#demo"
              className="cta-glow rounded-full px-8 py-3.5 text-sm font-bold"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)", boxShadow: "var(--shadow-1)" }}
            >
              Take the free mock <span className="carr">→</span>
            </Link>
            <Link
              href="/#exams"
              className="cta-line rounded-full px-8 py-3.5 text-sm font-semibold backdrop-blur-xl"
              style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--nav-bg) 55%, transparent)" }}
            >
              Explore the pattern
            </Link>
          </div>

          <div className="rise mt-11 flex items-center justify-center gap-8 lg:justify-start" style={{ animationDelay: "0.6s" }}>
            <div>
              <div className="mono text-[26px] font-extrabold leading-none">120</div>
              <div className="mt-1.5 text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Question paper · NIMCET
              </div>
            </div>
            <span aria-hidden className="h-8 w-px" style={{ background: "var(--border)" }} />
            <div>
              <div className="mono text-[26px] font-extrabold leading-none">75</div>
              <div className="mt-1.5 text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Question paper · CUET PG
              </div>
            </div>
          </div>
        </div>

        {/* Floating exam HUD — tilts with the cursor, decor only */}
        <div aria-hidden className="hero-tilt relative hidden h-[470px] lg:block">
          <div className="rise absolute inset-0" style={{ animationDelay: "0.35s" }}>
            <div className="hero-hud-glow pointer-events-none absolute inset-x-2 bottom-2 top-8" />

            <div className="float-a premium-card absolute left-0 top-0 z-30 flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ rotate: "-2deg", boxShadow: "var(--shadow-2)" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className="mono flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-extrabold"
                  style={n === 3 ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--pill)", color: "var(--muted)" }}
                >
                  {n}
                </span>
              ))}
            </div>

            <div className="float-b premium-card absolute right-0 top-5 z-20 w-[180px] rounded-[22px] p-5" style={{ rotate: "2.5deg", boxShadow: "var(--shadow-2)" }}>
              <div className="relative mx-auto h-[104px] w-[104px]">
                <svg viewBox="0 0 104 104" className="h-[104px] w-[104px] -rotate-90">
                  <defs>
                    <linearGradient id="heroRing" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="var(--accent)" />
                      <stop offset="1" stopColor="var(--accent-2)" />
                    </linearGradient>
                  </defs>
                  <circle cx="52" cy="52" r="46" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle className="ring-draw" cx="52" cy="52" r="46" fill="none" stroke="url(#heroRing)" strokeWidth="8" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="mono text-[19px] font-extrabold leading-none">68:24</span>
                  <span className="mt-1 text-[8.5px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
                    Part A
                  </span>
                </div>
              </div>
              <div className="mt-3 text-center text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                30 min · section timer
              </div>
            </div>

            <div className="float-a premium-card absolute left-0 top-[150px] z-40 w-[268px] rounded-[22px] p-4" style={{ rotate: "-1deg", boxShadow: "var(--shadow-2)" }}>
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
                  Q 23 / 120
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                  +4 / −1
                </span>
              </div>
              <div className="display mt-2.5 text-[16px] leading-snug">
                If |A| = 4 for a 3×3 matrix, then |2A| = ?
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {[["A", "8"], ["B", "32"], ["C", "64"], ["D", "16"]].map(([k, v]) => {
                  const on = k === "B";
                  return (
                    <div
                      key={k}
                      className="mono flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold"
                      style={on
                        ? { background: "color-mix(in srgb, var(--accent) 14%, transparent)", border: "1px solid var(--accent)", color: "var(--text)" }
                        : { border: "1px solid var(--border)", color: "var(--muted)" }}
                    >
                      <span className="text-[10px] font-extrabold" style={{ color: on ? "var(--accent)" : "var(--muted)" }}>{k}</span>
                      {v}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="float-b premium-card absolute right-2 top-[214px] z-10 w-[222px] rounded-[22px] p-4" style={{ rotate: "1.5deg", boxShadow: "var(--shadow-2)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                  Score trend
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                  +24%
                </span>
              </div>
              <svg viewBox="0 0 120 56" className="mt-3 w-full">
                <line x1="0" y1="55.5" x2="120" y2="55.5" stroke="var(--border)" strokeWidth="1" />
                {[24, 33, 30, 41, 50].map((h, i) => (
                  <rect
                    key={h}
                    className="chart-bar"
                    x={4 + i * 24}
                    y={56 - h}
                    width="16"
                    height={h}
                    rx="4"
                    fill={i === 4 ? "url(#heroRing)" : "color-mix(in srgb, var(--accent) 45%, transparent)"}
                    style={{ animationDelay: `${0.9 + i * 0.12}s` }}
                  />
                ))}
              </svg>
              <div className="mt-2 text-center text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                Last 5 mocks
              </div>
            </div>

            <div className="float-b premium-card absolute bottom-3 left-8 z-30 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ rotate: "-1.5deg", boxShadow: "var(--shadow-2)" }}>
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: "var(--gold-3)", boxShadow: "0 0 10px var(--gold-3)" }} />
              <span className="mono text-[13px] font-bold">12</span>
              <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Day streak
              </span>
            </div>

            <div className="float-a premium-card absolute bottom-8 right-6 z-30 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ rotate: "1deg", boxShadow: "var(--shadow-2)" }}>
              <span className="mono text-[12px] font-bold">+4 / −1</span>
              <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Marked honestly
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div aria-hidden className="pointer-events-none absolute bottom-24 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
        <span className="mono text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.3em" }}>
          Scroll
        </span>
        <span className="scroll-line" />
      </div>

      {/* Subject ticker — loop math unchanged */}
      <div aria-hidden className="marquee-mask relative overflow-hidden py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="marquee mono gap-10 text-[11px] font-semibold" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 gap-10 pr-10">
              {TICKER.map((t) => (
                <span key={t}>◆ {t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
