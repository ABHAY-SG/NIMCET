"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

// Fixed navbar height (h-16). The cursor glow pins to this line whenever the
// pointer rides over the bar, so the hover light covers everything from the
// navbar's bottom edge down — no dead strip at the top of the stage.
const NAV_H = 64;

// Sample scorecard content — a real-looking attempt, all theme-tinted.
const SECTIONS: Array<[string, number]> = [
  ["Mathematics", 78],
  ["Reasoning", 64],
  ["Computer Awareness", 82],
  ["General English", 71],
];

const STATS: Array<[string, string]> = [
  ["120", "NIMCET · full paper"],
  ["75", "CUET PG · full paper"],
  ["Instant", "scorecard & analytics"],
];

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
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <section ref={secRef} className="hero relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Stage: dot sheet, cursor glow, vignette — all theme tokens */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-dots absolute inset-0" />
        <div className="hero-glow" />
        <div className="hero-vignette absolute inset-0" />
      </div>

      {/* Bento: headline, mock scorecard, section snapshot, stats */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 pb-12 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Headline tile */}
          <div className="tile rise p-7 sm:p-9 lg:col-span-7 lg:row-span-2 lg:p-10" style={{ animationDelay: "0.08s" }}>
            <p
              className="navfont inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase"
              style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)", color: "var(--muted)", letterSpacing: "0.18em" }}
            >
              <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
              NIMCET + CUET PG · nothing else
            </p>

            <h1 className="mt-6" style={{ fontSize: "clamp(2rem, 4.4vw, 3.9rem)", lineHeight: 1.06 }}>
              <span className="hline">
                <span
                  className="block font-extrabold tracking-tight"
                  style={{ fontFamily: '"Sora", "Space Grotesk", "Inter", sans-serif', animationDelay: "0.16s" }}
                >
                  The paper won’t
                </span>
              </span>
              <span className="hline">
                <span className="block" style={{ animationDelay: "0.24s" }}>
                  <span className="display serif-it headline-warm">surprise you.</span>
                </span>
              </span>
            </h1>

            <p className="navfont mt-5 max-w-[460px] text-[15.5px] font-medium leading-[1.65]" style={{ color: "var(--muted)" }}>
              Full-length NIMCET and CUET PG papers under the real clock — true
              negative marking, instant scorecard, section-wise analytics.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/#demo"
                className="navfont cta-glow rounded-full px-7 py-3.5 text-sm font-bold"
                style={{ background: "var(--btn-bg)", color: "var(--btn-text)", boxShadow: "var(--shadow-1)" }}
              >
                Attempt a full paper free <span className="carr">→</span>
              </Link>
              <Link
                href="/#how"
                className="navfont cta-line rounded-full px-7 py-3.5 text-sm font-semibold"
                style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--nav-bg) 55%, transparent)" }}
              >
                See how it works
              </Link>
            </div>
          </div>

          {/* Scorecard tile */}
          <div className="tile rise flex items-center gap-5 p-6 sm:p-7 lg:col-span-5" style={{ animationDelay: "0.18s" }}>
            <div className="relative h-[96px] w-[96px] shrink-0">
              <svg viewBox="0 0 96 96" className="block h-full w-full">
                <defs>
                  <linearGradient id="heroRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" style={{ stopColor: "var(--accent)" }} />
                    <stop offset="1" style={{ stopColor: "var(--accent-2)" }} />
                  </linearGradient>
                </defs>
                <circle cx="48" cy="48" r="40" fill="none" strokeWidth="7" style={{ stroke: "color-mix(in srgb, var(--text) 9%, transparent)" }} />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="182 251"
                  transform="rotate(-90 48 48)"
                  style={{ stroke: "url(#heroRing)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="mono text-[17px] font-extrabold leading-none">87</span>
                <span className="mono mt-1 text-[9px] font-semibold" style={{ color: "var(--muted)" }}>/ 120</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="mono text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                NIMCET · Mock 01
              </div>
              <div
                className="mono mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)", letterSpacing: "0.08em" }}
              >
                +4 / −1 TRUE MARKING
              </div>
              <div className="mt-3 flex gap-5">
                <div>
                  <div className="mono text-[9px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>Accuracy</div>
                  <div className="display mt-1 text-[24px] leading-none">72%</div>
                </div>
                <div>
                  <div className="mono text-[9px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>Percentile</div>
                  <div className="display mt-1 text-[24px] leading-none" style={{ color: "var(--accent)" }}>99.2</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section snapshot tile */}
          <div className="tile rise p-6 sm:p-7 lg:col-span-5" style={{ animationDelay: "0.28s" }}>
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                Section snapshot
              </span>
              <span className="mono text-[10px] font-semibold" style={{ color: "var(--muted)" }}>vs last attempt ↑</span>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {SECTIONS.map(([name, pct], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="navfont w-[136px] shrink-0 truncate text-[12px] font-semibold">{name}</span>
                  <span className="tile-bar flex-1">
                    <span style={{ "--w": `${pct}%`, animationDelay: `${0.35 + i * 0.12}s` } as CSSProperties} />
                  </span>
                  <span className="mono w-9 text-right text-[11px] font-bold" style={{ color: "var(--muted)" }}>{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="tile rise grid grid-cols-1 gap-5 p-6 sm:grid-cols-3 sm:p-7 lg:col-span-12" style={{ animationDelay: "0.38s" }}>
            {STATS.map(([n, c], i) => (
              <div
                key={c}
                className={`flex items-baseline gap-3${i > 0 ? " sm:border-l sm:pl-6" : ""}`}
                style={{ borderColor: "var(--border)" }}
              >
                <span className="mono text-[24px] font-extrabold leading-none">{n}</span>
                <span className="navfont text-[11px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
                  {c}
                </span>
              </div>
            ))}
          </div>
        </div>
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
