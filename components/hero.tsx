"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

// Fixed navbar height (h-16). The cursor glow pins to this line whenever the
// pointer rides over the bar, so the hover light covers everything from the
// navbar's bottom edge down — no dead strip at the top of the stage.
const NAV_H = 64;

// Sample question for the floating deck — one option ticked so the card reads
// as an attempt under way (NIMCET-style: true marking shown in the footer).
const OPTIONS: Array<[string, string, boolean]> = [
  ["A", "0.602", false],
  ["B", "0.451", false],
  ["C", "0.903", true],
  ["D", "1.204", false],
];

const CHIPS = ["120 Q", "REAL CLOCK", "+4 / −1"];

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
      {/* Stage: token smoke, centre spotlight, dot sheet, cursor glow, vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-smoke hero-smoke-1" />
        <div className="hero-smoke hero-smoke-2" />
        <div className="hero-spot absolute left-1/2 top-[46%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="hero-dots absolute inset-0" />
        <div className="hero-glow" />
        <div className="hero-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-6 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        {/* Composition: ghost wordmark, script tagline, floating question deck */}
        <div className="relative flex flex-1 flex-col items-center justify-center">
          {/* Giant brand watermark behind everything */}
          <span
            aria-hidden
            className="hero-ghost pointer-events-none absolute inset-x-0 top-[5%] z-0 text-center"
            style={{ fontSize: "clamp(4rem, 17vw, 15rem)" }}
          >
            NimCuet
          </span>

          <h1 className="sr-only">Full-length NIMCET and CUET PG mock tests — prepare smart, perform better.</h1>

          {/* Floating subject glyphs */}
          <span aria-hidden className="hero-glyph mono absolute left-[7%] top-[22%] z-0 text-[18px]" style={{ color: "color-mix(in srgb, var(--text) 22%, transparent)", animationDelay: "0s" }}>∑</span>
          <span aria-hidden className="hero-glyph mono absolute right-[9%] top-[15%] z-0 text-[15px]" style={{ color: "color-mix(in srgb, var(--text) 18%, transparent)", animationDelay: "1.6s" }}>π</span>
          <span aria-hidden className="hero-glyph mono absolute right-[15%] bottom-[26%] z-0 text-[17px]" style={{ color: "color-mix(in srgb, var(--text) 20%, transparent)", animationDelay: "3.1s" }}>λ</span>

          {/* The subject: a floating deck of question cards */}
          <div className="hero-float relative z-20 w-[min(80vw,300px)] sm:w-[320px]">
            {/* Script line 1 — crosses behind the deck */}
            <span
              aria-hidden
              className="hero-script hero-script-grad pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[96vw] max-w-[1240px] -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ fontSize: "clamp(2.4rem, 7.6vw, 6.4rem)", rotate: "-4deg" }}
            >
              prepare smart.
            </span>

            {/* Back card — just the mark */}
            <div aria-hidden className="deck-card absolute inset-0" style={{ rotate: "8deg", translate: "18px 10px", opacity: 0.75 }}>
              <div className="flex h-full items-center justify-center">
                <span className="hero-ghost text-[110px] leading-none" style={{ opacity: 0.55 }}>N</span>
              </div>
            </div>

            {/* Middle card — next question coming up */}
            <div aria-hidden className="deck-card absolute inset-0" style={{ rotate: "3.5deg", translate: "26px -14px", opacity: 0.92 }}>
              <div className="p-5 sm:p-6">
                <span className="mono text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                  Q.15 · Reasoning
                </span>
                <p className="mt-2.5 text-[15px] font-semibold leading-snug">5, 11, 23, 47, ?</p>
              </div>
            </div>

            {/* Front card — question under way */}
            <div className="deck-card relative">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="mono text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>Q.14 · Mathematics</span>
                  <span className="mono text-[9px] font-semibold" style={{ color: "var(--muted)" }}>01:24:07</span>
                </div>
                <div className="mt-3 h-px w-full" style={{ background: "var(--border)" }} />
                <p className="mt-3.5 text-[15px] font-semibold leading-snug">If log₁₀ 2 = 0.301, then log₁₀ 8 = ?</p>
                <div className="mt-3.5 flex flex-col gap-2">
                  {OPTIONS.map(([letter, text, on]) => (
                    <div key={letter} className={`opt-row flex items-center gap-2.5 px-3 py-2${on ? " opt-row-on" : ""}`}>
                      <span
                        className="mono inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                        style={on ? { background: "var(--accent)", color: "var(--btn-text)" } : { border: "1px solid var(--border)", color: "var(--muted)" }}
                      >
                        {letter}
                      </span>
                      <span className="mono text-[12.5px] font-semibold" style={on ? { color: "var(--accent)" } : undefined}>{text}</span>
                      {on ? <span aria-hidden className="ml-auto text-[11px]" style={{ color: "var(--accent)" }}>✓</span> : null}
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 flex items-center justify-between">
                  <span className="mono text-[9px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>Marking +4 / −1</span>
                  <span className="mono text-[9px] font-semibold" style={{ color: "var(--muted)" }}>Q 14 OF 120</span>
                </div>
              </div>
              {/* Hangtag */}
              <span
                aria-hidden
                className="mono absolute -top-3.5 right-5 rounded-md px-2.5 py-1 text-[9px] font-bold"
                style={{ background: "var(--accent)", color: "var(--btn-text)", letterSpacing: "0.14em", rotate: "3deg", boxShadow: "var(--shadow-1)" }}
              >
                FULL LENGTH · 120 Q
              </span>
            </div>
          </div>

          {/* Script line 2 — the promise, in front */}
          <span
            aria-hidden
            className="hero-script relative z-30 mt-7 text-center"
            style={{ fontSize: "clamp(1.7rem, 4vw, 3.2rem)", rotate: "-2deg" }}
          >
            perform better.
          </span>

          {/* CTAs */}
          <div className="relative z-30 mt-8 flex flex-wrap items-center justify-center gap-3">
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

        {/* Corner blocks: the pitch bottom-left, the live mock bottom-right */}
        <div className="relative z-30 mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-4 lg:grid-cols-[300px_1fr_320px] lg:items-end">
          <div>
            <span className="navfont text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em" }}>
              Full-length mocks
            </span>
            <p className="mt-2.5 max-w-[260px] text-[13px] leading-[1.6]" style={{ color: "var(--muted)" }}>
              NIMCET and CUET PG papers under the real clock — true negative
              marking, instant scorecard, section-wise analytics.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[22px] font-extrabold leading-none">120</span>
                <span className="navfont text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>NIMCET · full paper</span>
              </div>
              <span aria-hidden className="h-6 w-px" style={{ background: "var(--border)" }} />
              <div className="flex items-baseline gap-2">
                <span className="mono text-[22px] font-extrabold leading-none">75</span>
                <span className="navfont text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>CUET PG · full paper</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block" />

          <div className="deck-card p-5">
            <div className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
              <span className="navfont text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em" }}>
                This week’s mock
              </span>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-[1.6]" style={{ color: "var(--muted)" }}>
              Mock Test 01 — Full Length is live now. 120 questions, one
              sitting, the real clock.
            </p>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {CHIPS.map((t) => (
                <span
                  key={t}
                  className="mono rounded-full px-2.5 py-1 text-[9px] font-bold"
                  style={{ background: "var(--pill)", color: "var(--muted)", letterSpacing: "0.1em" }}
                >
                  {t}
                </span>
              ))}
            </div>
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
