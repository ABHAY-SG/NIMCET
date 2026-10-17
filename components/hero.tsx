"use client";
import { useRef } from "react";
import Link from "next/link";
import Reveal from "@/components/reveal";
import Constellation from "@/components/constellation";

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

export default function Hero() {
  const spot = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = spot.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.style.background = `radial-gradient(480px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)`;
  };

  return (
    <section className="relative overflow-hidden" style={{ minHeight: "calc(100svh - 4rem)" }} onMouseMove={onMove}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Constellation />
        <span className="orb" style={{ left: "-7%", top: "6%", width: "32rem", height: "32rem", background: "color-mix(in srgb, var(--accent) 24%, transparent)" }} />
        <span className="orb" style={{ right: "-9%", top: "28%", width: "28rem", height: "28rem", background: "color-mix(in srgb, var(--accent-2) 20%, transparent)", animationDelay: "-9s" }} />
        <span className="orb" style={{ left: "32%", bottom: "-16%", width: "34rem", height: "34rem", background: "color-mix(in srgb, var(--gold-3) 13%, transparent)", animationDelay: "-17s" }} />
      </div>
      <div ref={spot} aria-hidden className="pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 pb-14 pt-16 text-center md:pt-20" style={{ minHeight: "calc(100svh - 4rem)" }}>
        <Reveal>
          <p
            className="rise inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase backdrop-blur-xl"
            style={{
              background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)",
              border: "1px solid var(--border)",
              letterSpacing: "0.22em",
              color: "var(--muted)",
            }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
            NIMCET — CUET PG MCA
          </p>
        </Reveal>
        <Reveal>
          <h1 className="rise display mt-7" style={{ fontSize: "clamp(3rem, 7.2vw, 5.4rem)", animationDelay: "0.1s" }}>
            <span className="serif-it" style={{ fontWeight: 420 }}>The quiet way to</span>
            <br />
            <span className="headline-warm"><b>top MCA entrances.</b></span>
          </h1>
        </Reveal>
        <Reveal>
          <div className="rise mx-auto mt-7 h-px w-20" style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", animationDelay: "0.2s" }} />
        </Reveal>
        <Reveal>
          <p className="rise mx-auto mt-6 max-w-lg text-[15px] leading-7" style={{ color: "var(--muted)", animationDelay: "0.25s" }}>
            Full-length mocks on the exact NIMCET and CUET PG pattern. Attempt,
            read your report, fix the leak, retest — 120 questions and 75
            questions respectively, with honest negative marking throughout.
          </p>
        </Reveal>
        <Reveal>
          <div className="rise mt-9 flex flex-wrap justify-center gap-3" style={{ animationDelay: "0.35s" }}>
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
        </Reveal>
      </div>
      <div aria-hidden className="pointer-events-none absolute bottom-16 left-1/2 hidden -translate-x-1/2 md:block">
        <svg className="scroll-cue" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
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
