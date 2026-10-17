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
      </div>
      <div ref={spot} aria-hidden className="pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 pb-12 pt-16 text-center md:pt-20" style={{ minHeight: "calc(100svh - 4rem)" }}>
        <Reveal>
          <p className="rise mono text-[12px]" style={{ letterSpacing: "0.3em", color: "var(--muted)" }}>
            NIMCET&ensp;—&ensp;CUET PG MCA
          </p>
        </Reveal>
        <Reveal>
          <h1 className="rise mt-6 leading-[1.04]" style={{ fontSize: "clamp(2.8rem, 7vw, 5.2rem)", animationDelay: "0.1s" }}>
            <span className="serif-it">The quiet way to</span>
            <br />
            <span className="headline-warm font-bold">top MCA entrances.</span>
          </h1>
        </Reveal>
        <Reveal>
          <div className="rise mx-auto mt-6 h-px w-16" style={{ background: "var(--accent)", animationDelay: "0.2s" }} />
        </Reveal>
        <Reveal>
          <p className="rise mx-auto mt-6 max-w-lg text-[15px] leading-7" style={{ color: "var(--muted)", animationDelay: "0.25s" }}>
            Full-length mocks on the exact NIMCET and CUET PG pattern. Attempt,
            read your report, fix the leak, retest — 120 questions and 75
            questions respectively, with honest negative marking throughout.
          </p>
        </Reveal>
        <Reveal>
          <div className="rise mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "0.35s" }}>
            <Link
              href="/#demo"
              className="cta-glow rounded-full px-8 py-3.5 text-sm font-bold"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              Start Free Mock <span className="carr">→</span>
            </Link>
            <Link
              href="/#pricing"
              className="rounded-full px-8 py-3.5 text-sm font-semibold"
              style={{ border: "1px solid var(--border)" }}
            >
              See Pricing
            </Link>
          </div>
        </Reveal>
      </div>
      <div aria-hidden className="relative overflow-hidden py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
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
