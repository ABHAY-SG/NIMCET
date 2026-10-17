"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

// Fixed navbar height (h-16). The cursor glow pins to this line whenever the
// pointer rides over the bar, so the hover light covers everything from the
// navbar's bottom edge down — no dead strip at the top of the stage.
const NAV_H = 64;

// OMR answer sheet — 2 columns × 7 questions. Each value is the filled bubble
// index (0-3), or -1 for a blank. Row 05 draws a correction: the original
// mark is struck through and the re-mark ringed in lime, so the sheet reads
// like a paper already attempted, reviewed and fixed.
const OMR: number[][] = [
  [1, 3, 0, 2, 1, -1, 2],
  [-1, 2, 1, 3, 0, 3, 1],
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
      {/* Stage: aurora washes, dot sheet, cursor glow, vignette — no blur filters */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hx-aur hx-aur-1" />
        <div className="hx-aur hx-aur-2" />
        <div className="hx-aur hx-aur-3" />
        <div className="hero-dots absolute inset-0" />
        <div className="hero-glow" />
        <div className="hero-vignette absolute inset-0" />
      </div>

      {/* Centered poster: meta strip → giant headline → sub → CTAs → OMR sheet */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-10 pt-28 text-center sm:px-6 lg:px-8 lg:pt-32">
        <p
          className="rise mono flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[10px] font-semibold uppercase"
          style={{ color: "var(--hx-muted)", letterSpacing: "0.2em", animationDelay: "0.08s" }}
        >
          <span>NIMCET · 120 Q</span>
          <span aria-hidden className="hidden sm:inline" style={{ opacity: 0.5 }}>—</span>
          <span>CUET PG · 75 Q</span>
          <span aria-hidden className="hidden sm:inline" style={{ opacity: 0.5 }}>—</span>
          <span className="hidden sm:inline">Full length, real clock</span>
        </p>

        <h1 className="mt-6 sm:mt-8" style={{ fontSize: "clamp(2.5rem, 8.4vw, 7rem)", lineHeight: 1 }}>
          <span className="hline">
            <span
              className="hx-outline block font-bold uppercase tracking-[-0.02em]"
              style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif', animationDelay: "0.16s" }}
            >
              The paper
            </span>
          </span>
          <span className="hline">
            <span
              className="block font-bold uppercase tracking-[-0.02em]"
              style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif', animationDelay: "0.24s" }}
            >
              won’t feel
            </span>
          </span>
          <span className="hline">
            <span className="block" style={{ animationDelay: "0.32s" }}>
              <span className="hx-serif italic" style={{ color: "var(--hx-lime)" }}>new to you.</span>
            </span>
          </span>
        </h1>

        <p
          className="rise navfont mt-6 max-w-[620px] text-[15.5px] font-medium leading-[1.65]"
          style={{ color: "var(--hx-muted)", animationDelay: "0.4s" }}
        >
          Full-length NIMCET and CUET PG papers under the real clock — true
          negative marking, instant scorecard, section-wise analytics.
        </p>

        <div className="rise mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.48s" }}>
          <Link
            href="/#demo"
            className="navfont cta-glow rounded-full px-7 py-3.5 text-sm font-bold"
            style={{ background: "var(--hx-lime)", color: "#0b0d16", boxShadow: "0 22px 50px -20px color-mix(in srgb, var(--hx-lime) 55%, transparent)" }}
          >
            Attempt a full paper free <span className="carr">→</span>
          </Link>
          <Link
            href="/#how"
            className="navfont cta-line rounded-full px-7 py-3.5 text-sm font-semibold"
            style={{
              border: "1px solid color-mix(in srgb, #ffffff 22%, transparent)",
              background: "color-mix(in srgb, #ffffff 5%, transparent)",
              color: "var(--hx-text)",
            }}
          >
            See how it works
          </Link>
        </div>

        {/* The object: a real OMR answer sheet, mid-review */}
        <div aria-hidden className="rise relative mt-14 w-[min(86vw,560px)]" style={{ animationDelay: "0.56s", rotate: "-2deg" }}>
          <span
            className="hx-stamp mono absolute -top-3 -right-1.5 z-10 rounded-[10px] px-3 py-1.5 text-[10px] font-bold"
            style={{ rotate: "-7deg", letterSpacing: "0.22em" }}
          >
            REHEARSED
          </span>
          <div className="hx-paper hx-float px-5 py-5 text-left sm:px-8 sm:py-7">
            <div className="flex items-center justify-between gap-3">
              <span className="mono text-[10px] font-bold uppercase" style={{ color: "rgba(20,23,42,0.72)", letterSpacing: "0.16em" }}>
                NIMCET — Mock 01
              </span>
              <span className="mono text-[10px] font-semibold uppercase" style={{ color: "rgba(20,23,42,0.45)", letterSpacing: "0.16em" }}>
                Full length · 120 Q
              </span>
            </div>
            <div className="mt-3 h-px w-full" style={{ background: "rgba(20,23,42,0.12)" }} />

            <svg viewBox="0 0 368 228" className="mt-4 block h-auto w-full">
              {OMR.map((col, c) =>
                col.map((filled, r) => {
                  const x = c * 216 + 8;
                  const y = 22 + r * 31;
                  const seq = c * 7 + r;
                  const isCorrection = c === 0 && r === 4;
                  const corrected = isCorrection ? 2 : -1;
                  return (
                    <g key={`${c}-${r}`}>
                      <text x={x} y={y + 3.5} fontSize="10" className="mono" fill="rgba(20,23,42,0.5)">
                        {String(seq + 1).padStart(2, "0")}
                      </text>
                      {[0, 1, 2, 3].map((k) => {
                        const cx = x + 30 + k * 30;
                        const showFilled = filled === k || corrected === k;
                        return (
                          <g key={k}>
                            <circle cx={cx} cy={y} r="8.5" fill="none" stroke="rgba(20,23,42,0.3)" strokeWidth="1.4" />
                            {showFilled && (
                              <circle
                                cx={cx}
                                cy={y}
                                r="7.5"
                                fill="#14172a"
                                className="hx-dot"
                                style={{ animationDelay: `${0.75 + seq * 0.045}s` }}
                              />
                            )}
                            {isCorrection && k === 1 && (
                              <g className="hx-cross" stroke="var(--hx-amber)" strokeWidth="2.4" strokeLinecap="round">
                                <line x1={cx - 6} y1={y - 6} x2={cx + 6} y2={y + 6} />
                                <line x1={cx - 6} y1={y + 6} x2={cx + 6} y2={y - 6} />
                              </g>
                            )}
                            {isCorrection && k === 2 && (
                              <circle cx={cx} cy={y} r="13.5" fill="none" stroke="var(--hx-lime)" strokeWidth="2.2" className="hx-ring" />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })
              )}
            </svg>

            <div className="mt-3 flex items-end justify-between gap-3">
              <span className="mono text-[10px] font-semibold uppercase" style={{ color: "rgba(20,23,42,0.45)", letterSpacing: "0.14em" }}>
                Marking +4 / −1
              </span>
              <span className="hx-serif italic text-[20px] leading-none" style={{ color: "rgba(20,23,42,0.82)" }}>
                attempt, review, repeat.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subject ticker — loop math unchanged */}
      <div aria-hidden className="marquee-mask relative overflow-hidden py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
        <div
          className="marquee mono gap-10 text-[11px] font-semibold"
          style={{ color: "color-mix(in srgb, var(--hx-muted) 80%, transparent)", letterSpacing: "0.18em" }}
        >
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
