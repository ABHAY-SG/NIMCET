"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

// Fixed navbar height (h-16). The cursor glow pins to this line whenever the
// pointer rides over the bar, so the hover effect covers everything from the
// navbar's bottom edge down — no dead strip at the top of the stage.
const NAV_H = 64;

// The compass dial: 60 tick marks, longer every fifth — a protractor for the
// "precision preparation" idea. Positions are computed once at module load.
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i * 6 * Math.PI) / 180;
  const major = i % 5 === 0;
  const r1 = 206;
  const r2 = major ? 190 : 199;
  return {
    major,
    x1: +(240 + r1 * Math.cos(a)).toFixed(1),
    y1: +(240 + r1 * Math.sin(a)).toFixed(1),
    x2: +(240 + r2 * Math.cos(a)).toFixed(1),
    y2: +(240 + r2 * Math.sin(a)).toFixed(1),
  };
});

// Four syllabus glyphs anchored inside the dial: maths, CS, logic, analysis.
const GLYPHS: Array<[string, number, number]> = [
  ["∑", 240, 114],
  ["π", 366, 240],
  ["λ", 240, 366],
  ["∫", 114, 240],
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
      sec.style.setProperty("--nx", String((x / r.width - 0.5) * 2));
      sec.style.setProperty("--ny", String((y / r.height - 0.5) * 2));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <section ref={secRef} className="hero relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Stage: dot sheet, cursor glow, vignette — no blur filters anywhere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-dots absolute inset-0" />
        <div className="hero-glow" />
        <div className="hero-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-12 pt-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-10 lg:px-8 lg:pt-24">
        {/* Editorial column */}
        <div className="text-center lg:text-left">
          <p
            className="track-in inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase rise"
            style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)", color: "var(--muted)", letterSpacing: "0.22em", animationDelay: "0.1s" }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
            PREMIUM MOCKS · NIMCET + CUET PG
          </p>

          <h1 className="mt-5" style={{ fontSize: "clamp(1.9rem, 5.5vw, 4.2rem)", lineHeight: 1.1, fontFamily: '"Fraunces", Georgia, serif', overflowWrap: "anywhere" }}>
            <span className="hline">
              <span className="block font-extrabold tracking-tight italic" style={{ animationDelay: "0.18s", color: "var(--text)" }}>
                The paper doesn't forgive
              </span>
            </span>
            <span className="hline">
              <span className="block font-extrabold tracking-tight" style={{ animationDelay: "0.26s", color: "var(--accent)" }}>
                guesswork.
              </span>
            </span>
          </h1>

          <p className="rise mx-auto mt-6 max-w-[430px] text-[16px] leading-relaxed italic lg:mx-0 lg:text-left" style={{ color: "var(--accent)", fontFamily: '"Fraunces", Georgia, serif', animationDelay: "0.36s" }}>
            "Repetition is the only shortcut that works."
          </p>

          <div
            className="rise mx-auto mt-6 h-px w-24 lg:mx-0"
            style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", animationDelay: "0.3s" }}
          />

          <p className="rise mx-auto mt-5 max-w-[440px] text-[15px] leading-relaxed lg:mx-0" style={{ color: "var(--muted)", animationDelay: "0.42s" }}>
            Full-length timed mocks replay the real paper — same pattern, same
            clock, same negative marking. Instant scorecards pinpoint where you
            leak marks, so every attempt starts stronger than the last.
          </p>

          <div className="rise mt-7 flex flex-wrap justify-center gap-3 lg:justify-start" style={{ animationDelay: "0.52s" }}>
            <Link
              href="/#demo"
              className="cta-glow rounded-full px-7 py-3.5 text-sm font-bold"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)", boxShadow: "var(--shadow-1)" }}
            >
              Take the free mock <span className="carr">→</span>
            </Link>
            <Link
              href="/#exams"
              className="cta-line rounded-full px-7 py-3.5 text-sm font-semibold"
              style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--nav-bg) 55%, transparent)" }}
            >
              Explore the pattern
            </Link>
          </div>

          <div className="rise mt-7 flex items-center justify-center gap-7 lg:justify-start" style={{ animationDelay: "0.62s" }}>
            <div>
              <div className="mono text-[24px] font-extrabold leading-none">120</div>
              <div className="mt-1.5 text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Question paper · NIMCET
              </div>
            </div>
            <span aria-hidden className="h-8 w-px" style={{ background: "var(--border)" }} />
            <div>
              <div className="mono text-[24px] font-extrabold leading-none">75</div>
              <div className="mt-1.5 text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Question paper · CUET PG
              </div>
            </div>
          </div>
        </div>

        {/* Compass core — decor only */}
        <div aria-hidden className="rise" style={{ animationDelay: "0.35s" }}>
          <div className="hero-par-2 relative mx-auto w-[min(80vw,320px)] sm:w-[340px] lg:w-[400px]">
            <div className="core-glow pointer-events-none absolute -inset-[16%]" />
            <svg viewBox="0 0 480 480" className="relative block h-auto w-full">
              <defs>
                <radialGradient id="coreOrbG" cx="0.38" cy="0.3" r="0.92">
                  <stop offset="0" className="core-stop-a" stopOpacity="0.34" />
                  <stop offset="0.6" className="core-stop-a" stopOpacity="0.09" />
                  <stop offset="1" className="core-stop-a" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="coreShadowG" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" className="core-stop-a" stopOpacity="0.2" />
                  <stop offset="1" className="core-stop-a" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* dial ticks */}
              <g style={{ stroke: "color-mix(in srgb, var(--text) 14%, transparent)" }}>
                {TICKS.map((t, i) => (
                  <line
                    key={i}
                    x1={t.x1}
                    y1={t.y1}
                    x2={t.x2}
                    y2={t.y2}
                    strokeWidth={t.major ? 1.6 : 1}
                    style={t.major ? { stroke: "color-mix(in srgb, var(--text) 32%, transparent)" } : undefined}
                  />
                ))}
              </g>

              {/* rotating dashed orbit */}
              <g className="core-spin-c">
                <circle
                  cx="240"
                  cy="240"
                  r="178"
                  fill="none"
                  strokeWidth="1"
                  strokeDasharray="2 7"
                  strokeLinecap="round"
                  style={{ stroke: "color-mix(in srgb, var(--text) 22%, transparent)" }}
                />
              </g>

              {/* fixed inner circle + halo ring */}
              <circle cx="240" cy="240" r="150" fill="none" strokeWidth="1" style={{ stroke: "color-mix(in srgb, var(--text) 12%, transparent)" }} />
              <circle
                cx="240"
                cy="240"
                r="112"
                fill="none"
                strokeWidth="1"
                strokeDasharray="1 5"
                strokeLinecap="round"
                style={{ stroke: "color-mix(in srgb, var(--accent) 22%, transparent)" }}
              />

              {/* syllabus glyphs */}
              <g className="mono" textAnchor="middle" style={{ fill: "color-mix(in srgb, var(--text) 26%, transparent)" }}>
                {GLYPHS.map(([g, x, y]) => (
                  <text key={g} x={x} y={y} fontSize="15" dominantBaseline="central">
                    {g}
                  </text>
                ))}
              </g>

              {/* orbiting nodes */}
              <g className="core-spin-a">
                <circle cx="240" cy="62" r="12" style={{ fill: "color-mix(in srgb, var(--accent) 20%, transparent)" }} />
                <circle cx="240" cy="62" r="5" style={{ fill: "var(--accent)" }} />
              </g>
              <g className="core-spin-b">
                <circle cx="390" cy="240" r="4" style={{ fill: "var(--gold-3)" }} />
              </g>

              {/* monogram orb */}
              <g className="core-breathe">
                <circle cx="240" cy="240" r="88" strokeWidth="1" style={{ fill: "color-mix(in srgb, var(--nav-bg) 72%, transparent)", stroke: "var(--border)" }} />
                <circle cx="240" cy="240" r="88" style={{ fill: "url(#coreOrbG)" }} />
                {/* brand wordmark, in place of the monogram */}
                <image href="/logo.png" x="165" y="214" width="150" height="26" className="orb-logo" preserveAspectRatio="xMidYMid meet" />
                <text
                  x="240"
                  y="292"
                  textAnchor="middle"
                  fontSize="8"
                  className="mono"
                  style={{ fill: "color-mix(in srgb, var(--text) 46%, transparent)", letterSpacing: "0.22em" }}
                >
                  REAL QUESTION PAPERS
                </text>
              </g>

              {/* ground reflection */}
              <ellipse cx="240" cy="466" rx="132" ry="13" style={{ fill: "url(#coreShadowG)" }} />
            </svg>
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
