import Link from "next/link";

// NIMCET is 120 questions across four sections, +4 / −1 marking — the labels
// and meta row state the real pattern, not invented numbers.
const LABELS: Array<{ t: string; pos: string }> = [
  { t: "MATHEMATICS · 50", pos: "left-[2%] top-[9%]" },
  { t: "REASONING · 40", pos: "right-[1%] top-[27%]" },
  { t: "COMPUTER · 10", pos: "left-[3%] bottom-[26%]" },
  { t: "ENGLISH · 20", pos: "right-[3%] bottom-[8%]" },
];

// Micro fragments — restrained technical texture floating inside the cage.
const FRAGS: Array<{ t: string; pos: string }> = [
  { t: "∫ x² dx", pos: "left-[10%] top-[38%]" },
  { t: "O(n log n)", pos: "right-[12%] top-[31%]" },
  { t: "P(A ∩ B)", pos: "right-[15%] bottom-[31%]" },
];

const TICKER = ["CALCULUS", "PROBABILITY", "MATRICES", "DATA STRUCTURES", "OPERATING SYSTEMS", "DBMS", "NETWORKS", "REASONING"];

export default function Hero() {
  return (
    <section className="hero relative flex min-h-[100svh] flex-col overflow-hidden">
      <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-4 pb-10 pt-24 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pb-16 lg:pt-28">
        {/* Left: the pitch */}
        <div className="rise max-w-[560px] lg:col-span-6">
          <span
            className="hero-eyebrow navfont inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.18em" }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
            NIMCET + CUET PG · Full-length mocks
          </span>

          <h1
            className="mt-6 font-extrabold"
            style={{ fontFamily: '"Sora", "Space Grotesk", "Inter", sans-serif', fontSize: "clamp(2.3rem, 5.2vw, 4.3rem)", lineHeight: 1.04, letterSpacing: "-0.015em" }}
          >
            <span className="block">Your NIMCET</span>
            <span className="display serif-it hero-em block" style={{ fontSize: "1.06em" }}>breakthrough</span>
            <span className="block">starts here.</span>
          </h1>

          <p className="mt-5 max-w-[480px] text-[15.5px] leading-[1.7]" style={{ color: "rgba(244, 244, 246, 0.62)" }}>
            Full-length NIMCET and CUET PG mock tests under the real clock —
            true negative marking, instant scorecard, and section-wise
            analytics after every attempt.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link href="/#demo" className="hbtn hbtn-1 navfont justify-center px-7 py-3.5 text-[14px]">
              Attempt Free Mock <span className="carr">→</span>
            </Link>
            <Link href="/#exams" className="hbtn hbtn-2 navfont justify-center px-7 py-3.5 text-[14px]">
              Explore Mock Tests
            </Link>
          </div>

          <div
            className="mono mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-semibold"
            style={{ color: "rgba(244, 244, 246, 0.42)", letterSpacing: "0.18em" }}
          >
            <span>120 QUESTIONS</span>
            <span aria-hidden className="h-3 w-px" style={{ background: "rgba(255, 255, 255, 0.14)" }} />
            <span>REAL CLOCK</span>
            <span aria-hidden className="h-3 w-px" style={{ background: "rgba(255, 255, 255, 0.14)" }} />
            <span>+4 / −1 MARKING</span>
          </div>
        </div>

        {/* Right: the subject — a dimensional subject orrery */}
        <div className="rise relative mx-auto w-full max-w-[420px] sm:max-w-[480px] lg:col-span-6 lg:mx-0 lg:max-w-[540px] lg:justify-self-end" style={{ animationDelay: "0.15s" }}>
          <div className="hero-lift relative aspect-square">
            {/* micro fragments */}
            {FRAGS.map((f) => (
              <span
                key={f.t}
                aria-hidden
                className={`mono absolute hidden text-[11px] font-semibold md:block ${f.pos}`}
                style={{ color: "rgba(255, 255, 255, 0.34)", letterSpacing: "0.06em" }}
              >
                {f.t}
              </span>
            ))}

            {/* the cage: four lit rings around a glowing core */}
            <svg viewBox="0 0 560 560" className="absolute inset-0 block h-full w-full" aria-hidden>
              <defs>
                <linearGradient id="hxG1" gradientUnits="userSpaceOnUse" x1="70" y1="40" x2="500" y2="530">
                  <stop offset="0" style={{ stopColor: "#ffffff", stopOpacity: 0.55 }} />
                  <stop offset="1" style={{ stopColor: "#ffffff", stopOpacity: 0.07 }} />
                </linearGradient>
                <linearGradient id="hxG2" gradientUnits="userSpaceOnUse" x1="70" y1="40" x2="500" y2="530">
                  <stop offset="0" style={{ stopColor: "#ffffff", stopOpacity: 0.4 }} />
                  <stop offset="1" style={{ stopColor: "#ffffff", stopOpacity: 0.06 }} />
                </linearGradient>
                <linearGradient id="hxG3" gradientUnits="userSpaceOnUse" x1="70" y1="40" x2="500" y2="530">
                  <stop offset="0" style={{ stopColor: "#ffffff", stopOpacity: 0.32 }} />
                  <stop offset="1" style={{ stopColor: "#ffffff", stopOpacity: 0.05 }} />
                </linearGradient>
                <linearGradient id="hxG4" gradientUnits="userSpaceOnUse" x1="70" y1="40" x2="500" y2="530">
                  <stop offset="0" style={{ stopColor: "#ffffff", stopOpacity: 0.5 }} />
                  <stop offset="1" style={{ stopColor: "#ffffff", stopOpacity: 0.08 }} />
                </linearGradient>
                <radialGradient id="hxHalo">
                  <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.3 }} />
                  <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
                </radialGradient>
                <radialGradient id="hxCore">
                  <stop offset="0" style={{ stopColor: "#ffffff", stopOpacity: 0.98 }} />
                  <stop offset="0.45" style={{ stopColor: "var(--accent)", stopOpacity: 0.85 }} />
                  <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
                </radialGradient>
              </defs>

              {/* ambient core light */}
              <circle cx="280" cy="280" r="130" fill="url(#hxHalo)" />

              {/* rings, lit from the top-left corner */}
              <g fill="none">
                <ellipse cx="280" cy="280" rx="230" ry="86" transform="rotate(-16 280 280)" stroke="url(#hxG1)" strokeWidth="1.6" />
                <ellipse cx="280" cy="280" rx="230" ry="148" transform="rotate(48 280 280)" stroke="url(#hxG2)" strokeWidth="1.4" />
                <ellipse cx="280" cy="280" rx="224" ry="204" transform="rotate(-72 280 280)" stroke="url(#hxG3)" strokeWidth="1.2" />
                <ellipse cx="280" cy="280" rx="234" ry="54" transform="rotate(22 280 280)" stroke="url(#hxG4)" strokeWidth="1.2" />
              </g>

              {/* ring nodes — one lit by the accent */}
              <circle cx="64" cy="311" r="2.4" fill="rgba(255,255,255,0.45)" />
              <circle cx="187" cy="83" r="2.4" fill="rgba(255,255,255,0.45)" />
              <circle cx="439" cy="412" r="2.4" fill="rgba(255,255,255,0.4)" />
              <circle cx="490" cy="375" r="3" style={{ fill: "var(--accent)", opacity: 0.9 }} />

              {/* core */}
              <circle cx="280" cy="280" r="62" fill="none" stroke="rgba(255,255,255,0.09)" />
              <circle cx="280" cy="280" r="34" fill="url(#hxCore)" className="orb-pulse" />
              <circle cx="280" cy="280" r="6" fill="#ffffff" />
            </svg>

            {/* dial layer — dashed ring + orbiting satellite */}
            <div aria-hidden className="orb-spin absolute inset-0">
              <svg viewBox="0 0 560 560" className="block h-full w-full">
                <circle cx="280" cy="280" r="246" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1" strokeDasharray="1 9" />
                <circle cx="280" cy="34" r="13" fill="rgba(255,255,255,0.16)" />
                <circle cx="280" cy="34" r="4" fill="#ffffff" opacity="0.92" />
              </svg>
            </div>

            {/* counter layer — accent arc + accent satellite */}
            <div aria-hidden className="orb-spin-rev absolute inset-0">
              <svg viewBox="0 0 560 560" className="block h-full w-full">
                <circle cx="280" cy="280" r="252" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="300 1283" transform="rotate(-90 280 280)" strokeLinecap="round" />
                <circle cx="280" cy="56" r="12" style={{ fill: "var(--accent)", opacity: 0.18 }} />
                <circle cx="280" cy="56" r="3.2" style={{ fill: "var(--accent)", opacity: 0.95 }} />
              </svg>
            </div>

            {/* subject callouts */}
            {LABELS.map((l) => (
              <span
                key={l.t}
                className={`hero-label mono absolute flex items-center gap-1.5 whitespace-nowrap text-[9px] font-semibold ${l.pos}`}
                style={{ letterSpacing: "0.16em" }}
              >
                <span aria-hidden className="inline-block h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <span aria-hidden className="inline-block h-px w-3 shrink-0" style={{ background: "rgba(255, 255, 255, 0.22)" }} />
                {l.t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Subject ticker — loop math unchanged */}
      <div aria-hidden className="marquee-mask relative overflow-hidden py-3" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div className="marquee mono gap-10 text-[11px] font-semibold" style={{ color: "rgba(244, 244, 246, 0.4)", letterSpacing: "0.18em" }}>
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
