import Link from "next/link";
import { ArrowRight, Check, Clock3, Sparkles } from "lucide-react";

const SUBJECTS = ["Mathematics", "Reasoning", "Computer Science", "English"];

const OPTIONS = [
  ["A", "I"],
  ["B", "−I"],
  ["C", "0"],
  ["D", "A"],
];

export default function Hero() {
  return (
    <section className="hero hero-stage relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-dots absolute inset-0" />
        <div className="hero-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-12 pt-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-14 lg:px-8 lg:pt-24">
        <div className="text-center lg:text-left">
          <p
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase sm:text-[11px]"
            style={{
              background: "color-mix(in srgb, var(--nav-bg) 78%, transparent)",
              borderColor: "var(--border)",
              color: "var(--muted)",
              letterSpacing: "0.15em",
            }}
          >
            <Sparkles aria-hidden size={13} style={{ color: "var(--accent)" }} />
            NIMCET + CUET PG MCA
          </p>

          <h1
            className="display mx-auto mt-5 max-w-[610px] text-[clamp(2.7rem,6.4vw,5rem)] lg:mx-0"
            style={{ lineHeight: 1.03 }}
          >
            <span className="block">Practice the paper.</span>
            <span className="block" style={{ color: "var(--accent)" }}>Arrive prepared.</span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-[490px] text-[15px] leading-7 sm:text-base lg:mx-0"
            style={{ color: "var(--muted)" }}
          >
            Real-format mocks with authentic timing and negative marking. Get a
            clear scorecard and know exactly what to work on next.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link
              href="/#demo"
              className="cta-glow inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold"
              style={{
                background: "var(--btn-bg)",
                color: "var(--btn-text)",
                boxShadow: "var(--shadow-1)",
              }}
            >
              Try a free mock <ArrowRight aria-hidden size={16} />
            </Link>
            <Link
              href="/#exams"
              className="cta-line inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--nav-bg) 72%, transparent)",
                color: "var(--text)",
              }}
            >
              See exam patterns
            </Link>
          </div>

          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--muted)" }}>
            <Check aria-hidden size={14} style={{ color: "var(--accent)" }} />
            Free sample. No account needed.
          </p>

          <div className="mt-8 flex items-center justify-center gap-7 lg:justify-start">
            <div className="text-left">
              <div className="mono text-[26px] font-extrabold leading-none">120</div>
              <div className="mt-1.5 text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
                Questions · NIMCET
              </div>
            </div>
            <span aria-hidden className="h-9 w-px" style={{ background: "var(--border)" }} />
            <div className="text-left">
              <div className="mono text-[26px] font-extrabold leading-none">75</div>
              <div className="mt-1.5 text-[10px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
                Questions · CUET PG
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[480px]">
          <div className="hero-preview-card">
            <div className="relative z-10 flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--pill)", color: "var(--accent)" }}>
                  <Sparkles aria-hidden size={17} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold" style={{ color: "var(--text)" }}>NIMCET · Mock 01</p>
                  <p className="mt-0.5 text-[10px] font-medium" style={{ color: "var(--muted)" }}>Interface preview</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--accent)", letterSpacing: "0.1em" }}>
                Practice
              </span>
            </div>

            <div className="relative z-10 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="mono text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>Question 24 of 120</p>
                  <p className="mt-1 text-xs font-semibold" style={{ color: "var(--accent)" }}>Mathematics</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card) 76%, var(--bg))", color: "var(--text)" }}>
                  <Clock3 aria-hidden size={14} style={{ color: "var(--accent)" }} />
                  <span className="mono text-[12px] font-bold">01:42:18</span>
                </div>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
                <div className="h-full rounded-full" style={{ width: "20%", background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
              </div>

              <h2 className="mt-5 text-[16px] font-bold leading-6 sm:text-[18px]" style={{ color: "var(--text)" }}>
                If A is an orthogonal matrix, then AᵀA is equal to:
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {OPTIONS.map(([letter, answer], index) => (
                  <div
                    key={letter}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-semibold"
                    style={index === 0
                      ? {
                          borderColor: "color-mix(in srgb, var(--accent) 48%, var(--border))",
                          background: "color-mix(in srgb, var(--accent) 8%, var(--card))",
                          color: "var(--text)",
                        }
                      : {
                          borderColor: "var(--border)",
                          background: "color-mix(in srgb, var(--card) 78%, var(--bg))",
                          color: "var(--muted)",
                        }}
                  >
                    <span className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold" style={index === 0 ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--pill)", color: "var(--muted)" }}>
                      {letter}
                    </span>
                    {answer}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                <Check aria-hidden size={14} style={{ color: "var(--accent)" }} />
                Answer saved
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[11px] font-bold" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
                Save &amp; Next <ArrowRight aria-hidden size={13} />
              </span>
            </div>
          </div>

          <div className="hero-preview-float flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "var(--shadow-2)" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--pill)", color: "var(--accent)" }}>
              <Check aria-hidden size={17} />
            </span>
            <span>
              <span className="block text-[10px] font-semibold" style={{ color: "var(--muted)" }}>After every attempt</span>
              <span className="mt-0.5 block text-xs font-bold" style={{ color: "var(--text)" }}>Clear, section-wise insights</span>
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-4 text-[10px] font-semibold uppercase sm:gap-x-8 sm:px-6 lg:justify-start lg:px-8" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
          <span className="text-[9px]" style={{ color: "var(--accent)" }}>Practice by subject</span>
          {SUBJECTS.map((subject) => (
            <span key={subject} className="inline-flex items-center gap-2">
              <span aria-hidden className="h-1 w-1 rotate-45 rounded-sm" style={{ background: "var(--accent)" }} />
              {subject}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
