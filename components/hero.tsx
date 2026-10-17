"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

// Fixed navbar height (h-16). The cursor glow pins to this line whenever the
// pointer rides over the bar, so the hover effect covers everything from the
// navbar's bottom edge down — no dead strip at the top of the stage.
const NAV_H = 64;

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
      {/* Stage: dot sheet + drifting wordmark + breathing auras + cursor glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-dots absolute inset-0" />
        <div className="hero-par-1 absolute inset-x-0 top-[13%] flex justify-center">
          <span className="hero-word display">NIMCUET</span>
        </div>
        <span
          className="aura hero-par-2 absolute"
          style={{ left: "-12%", top: "4%", width: "34rem", height: "34rem", background: "color-mix(in srgb, var(--accent) 30%, transparent)" }}
        />
        <span
          className="aura hero-par-2 absolute"
          style={{ right: "-10%", top: "30%", width: "30rem", height: "30rem", background: "color-mix(in srgb, var(--gold-3) 24%, transparent)", animationDelay: "-6s", opacity: 0.45 }}
        />
        <span
          className="aura hero-par-2 absolute"
          style={{ left: "28%", bottom: "-18%", width: "36rem", height: "36rem", background: "color-mix(in srgb, var(--accent-2) 22%, transparent)", animationDelay: "-11s", opacity: 0.4 }}
        />
        <div className="hero-glow" />
      </div>

      {/* Content: editorial column + floating exam HUD */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-12 pt-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6 lg:px-8 lg:pt-24">
        <div className="text-center lg:max-w-xl lg:text-left">
          <p
            className="track-in inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase backdrop-blur-xl"
            style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)", color: "var(--muted)", letterSpacing: "0.22em" }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
            NIMCET — CUET PG MCA
          </p>

          <h1 className="display mt-7" style={{ fontSize: "clamp(2.7rem, 6.4vw, 4.9rem)", lineHeight: 1.04 }}>
            <span className="hline"><span>The quiet way</span></span>
            <span className="hline"><span style={{ animationDelay: "0.12s" }}>to <b className="headline-warm">top MCA entrances.</b></span></span>
          </h1>

          <div
            className="rise mx-auto mt-7 h-px w-24 lg:mx-0"
            style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", animationDelay: "0.32s" }}
          />

          <p className="rise mx-auto mt-6 max-w-lg text-[15px] leading-7 lg:mx-0" style={{ color: "var(--muted)", animationDelay: "0.4s" }}>
            Full-length mocks on the exact NIMCET and CUET PG pattern. Attempt,
            read your report, fix the leak, retest — 120 questions and 75
            questions respectively, with honest negative marking throughout.
          </p>

          <div className="rise mt-9 flex flex-wrap justify-center gap-3 lg:justify-start" style={{ animationDelay: "0.5s" }}>
            <Link
              href="/#demo"
              className="cta-glow rounded-full px-8 py-3.5 text-sm font-bold"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)", boxShadow: "var(--shadow-1)" }}
            >
              Start Free Mock <span className="carr">→</span>
            </Link>
            <Link
              href="/#pricing"
              className="cta-line rounded-full px-8 py-3.5 text-sm font-semibold backdrop-blur-xl"
              style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--nav-bg) 55%, transparent)" }}
            >
              See Pricing
            </Link>
          </div>

          <div className="rise mt-11 flex items-center justify-center gap-8 lg:justify-start" style={{ animationDelay: "0.6s" }}>
            <div>
              <div className="mono text-[26px] font-extrabold leading-none">120</div>
              <div className="mt-1.5 text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Questions · NIMCET mock
              </div>
            </div>
            <span aria-hidden className="h-8 w-px" style={{ background: "var(--border)" }} />
            <div>
              <div className="mono text-[26px] font-extrabold leading-none">75</div>
              <div className="mt-1.5 text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Questions · CUET PG mock
              </div>
            </div>
          </div>
        </div>

        {/* Floating exam HUD — desktop collage, decor only */}
        <div aria-hidden className="hero-par-3 relative hidden h-[440px] lg:block">
          <div className="rise absolute inset-0" style={{ animationDelay: "0.35s" }}>
            <div className="float-a premium-card absolute left-0 top-2 flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
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

            <div className="float-b premium-card absolute right-0 top-0 w-[188px] rounded-2xl p-5">
              <div className="relative mx-auto h-24 w-24">
                <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
                  <circle cx="48" cy="48" r="42" fill="none" stroke="var(--border)" strokeWidth="7" />
                  <circle className="ring-draw" cx="48" cy="48" r="42" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="mono text-[22px] font-extrabold">84%</span>
                </div>
              </div>
              <div className="mt-3 text-center text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                Sample accuracy
              </div>
            </div>

            <div className="float-a premium-card absolute left-0 top-[64px] rounded-full px-4 py-2 text-[11px] font-bold" style={{ color: "var(--muted)" }}>
              +4 / −1 · negative marking ON
            </div>

            <div className="float-b premium-card absolute left-2 top-[208px] w-[252px] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
                  Q 47 / 120
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                  +4 / −1
                </span>
              </div>
              <div className="display mt-2.5 text-[17px]">
                lim<span className="mono align-sub text-[10px]"> x→0 </span>(sin x) / x = ?
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {[["A", "0"], ["B", "1"], ["C", "∞"], ["D", "−1"]].map(([k, v]) => {
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

            <div className="float-a premium-card absolute right-2 bottom-4 flex items-center gap-2.5 rounded-2xl px-4 py-2.5">
              <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
              <span className="mono text-[13px] font-bold">68:24</span>
              <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
                Section A
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div aria-hidden className="pointer-events-none absolute bottom-24 left-1/2 hidden -translate-x-1/2 md:block">
        <svg className="scroll-cue" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
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
