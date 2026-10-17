import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/reveal";

export const metadata: Metadata = {
  title: "About",
  description: "NimCuet builds premium mock tests for NIMCET and CUET PG MCA — real marking, real timers, honest analytics.",
  alternates: { canonical: "/about" },
};

const PILLARS: Array<[string, string]> = [
  ["Exact pattern", "120Q/1000 marks and 75Q/300 marks — down to the last −1."],
  ["Honest reports", "Topic accuracy, time per question, guess damage."],
  ["Zero hype", "No classes, no videos. Attempt, analyse, retest."],
];

const STATS: Array<[string, string]> = [
  ["120", "questions in a NIMCET full mock"],
  ["1,000", "marks scored on the real pattern"],
  ["2", "exams only — NIMCET & CUET PG"],
  ["5", "themes, from daylight to midnight"],
];

export default function AboutPage() {
  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <span className="orb" style={{ left: "4%", top: "-30%", width: "26rem", height: "26rem", background: "color-mix(in srgb, var(--accent) 18%, transparent)" }} />
        <span className="orb" style={{ right: "2%", top: "-10%", width: "24rem", height: "24rem", background: "color-mix(in srgb, var(--gold-3) 12%, transparent)", animationDelay: "-10s" }} />
      </div>

      <section className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
            About Us
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="display mt-3 text-4xl sm:text-5xl">
            Ranks are built in timed mocks with honest feedback —{" "}
            <em style={{ color: "var(--accent)" }}>not in marathon video lectures.</em>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7" style={{ color: "var(--muted)" }}>
            NimCuet exists for two exams and nothing else. Realistic papers,
            sharp reports, short explanations — that is the whole product,
            and the whole promise.
          </p>
          <p className="logo-script mt-4 text-3xl" style={{ color: "var(--text)", transform: "rotate(-2deg)" }}>
            — Team NimCuet
          </p>
        </Reveal>
      </section>

      <Reveal delay={0.1}>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map(([v, l]) => (
            <div key={l} className="premium-card rounded-2xl px-4 py-5 text-center">
              <div className="mono text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{v}</div>
              <div className="mt-1.5 text-[11px] font-semibold leading-4" style={{ color: "var(--muted)" }}>{l}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-3">
        {PILLARS.map(([t, d], i) => (
          <Reveal key={t} delay={i * 0.08}>
            <div className="lift relative h-full overflow-hidden rounded-2xl px-5 py-6" style={{ background: "color-mix(in srgb, var(--nav-bg) 45%, transparent)" }}>
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }}
              />
              <div className="text-[15px] font-extrabold tracking-tight">{t}</div>
              <div className="mt-2 text-[13px] leading-6" style={{ color: "var(--muted)" }}>{d}</div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-14 grid gap-4 lg:grid-cols-2">
        <Reveal>
          <div className="premium-card h-full rounded-[22px] p-7">
            <div className="text-[11px] font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.18em" }}>Our Mission</div>
            <p className="mt-2.5 text-sm leading-7" style={{ color: "var(--muted)" }}>
              Make MCA entrance prep honest and affordable. Every aspirant —
              in a metro or a small town — should practise on the exact paper
              for less than the price of a pizza. Free tier forever, full
              access at ₹149/month.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="premium-card h-full rounded-[22px] p-7">
            <div className="text-[11px] font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.18em" }}>Our Commitment</div>
            <ul className="mt-2.5 space-y-2.5 text-sm leading-6" style={{ color: "var(--muted)" }}>
              <li className="flex gap-2.5"><span style={{ color: "var(--accent)" }}>✓</span> Patterns updated every exam cycle, never stale.</li>
              <li className="flex gap-2.5"><span style={{ color: "var(--accent)" }}>✓</span> No fake ranks, no inflated claims — only your numbers.</li>
              <li className="flex gap-2.5"><span style={{ color: "var(--accent)" }}>✓</span> Every message answered within a day, by a human.</li>
            </ul>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <div className="mt-14 text-center">
          <p className="mono text-[11px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.22em" }}>
            FOUNDED 2026 • MADE IN INDIA
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/#demo"
              className="cta-glow rounded-full px-7 py-3 text-sm font-bold"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)", boxShadow: "var(--shadow-1)" }}
            >
              Try the free sample <span className="carr">→</span>
            </Link>
            <Link
              href="/contact"
              className="cta-line rounded-full px-7 py-3 text-sm font-semibold"
              style={{ border: "1px solid var(--border)" }}
            >
              Talk to us
            </Link>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
