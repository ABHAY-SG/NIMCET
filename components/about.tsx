import Reveal from "@/components/reveal";

const PILLARS = [
  ["Exact pattern", "120Q/1000 marks and 75Q/300 marks — down to the last −1."],
  ["Honest reports", "Topic accuracy, time per question, guess damage."],
  ["Zero hype", "No classes, no videos. Attempt, analyse, retest."],
];

export default function About() {
  return (
    <section id="about" className="mx-auto w-full max-w-3xl scroll-mt-24 px-4 pb-12 text-center">
      <Reveal>
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
        >
          About Us
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl">
          Ranks are built in timed mocks with honest feedback —{" "}
          <span style={{ color: "var(--accent)" }}>not in marathon video lectures.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7" style={{ color: "var(--muted)" }}>
          NimCuet exists for two exams and nothing else. Realistic papers,
          sharp reports, short explanations — that is the whole product,
          and the whole promise.
        </p>
        <p className="logo-script mt-4 text-3xl" style={{ color: "var(--text)", transform: "rotate(-2deg)" }}>
          — Team NimCuet
        </p>
      </Reveal>
      <div className="mt-8 grid gap-6 text-left sm:grid-cols-3">
        {PILLARS.map(([t, d]) => (
          <Reveal key={t}>
            <div className="border-t-2 pt-4" style={{ borderColor: "var(--accent)" }}>
              <div className="font-extrabold tracking-tight">{t}</div>
              <div className="mt-1.5 text-[13px] leading-6" style={{ color: "var(--muted)" }}>{d}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <p className="mono mt-10 text-[11px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.22em" }}>
          FOUNDED 2026 • MADE IN INDIA
        </p>
      </Reveal>
      <div className="mt-4 grid gap-4 text-left sm:grid-cols-2">
        <Reveal>
          <div
            className="h-full rounded-2xl p-6 backdrop-blur-xl"
            style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
          >
            <div className="text-[11px] font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.18em" }}>Our Mission</div>
            <p className="mt-2 text-sm leading-7" style={{ color: "var(--muted)" }}>
              Make MCA entrance prep honest and affordable. Every aspirant —
              in a metro or a small town — should practise on the exact paper
              for less than the price of a pizza. Free tier forever, full
              access at ₹149/month.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div
            className="h-full rounded-2xl p-6 backdrop-blur-xl"
            style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
          >
            <div className="text-[11px] font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.18em" }}>Our Commitment</div>
            <ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
              <li className="flex gap-2"><span style={{ color: "var(--accent)" }}>✓</span> Patterns updated every exam cycle, never stale.</li>
              <li className="flex gap-2"><span style={{ color: "var(--accent)" }}>✓</span> No fake ranks, no inflated claims — only your numbers.</li>
              <li className="flex gap-2"><span style={{ color: "var(--accent)" }}>✓</span> Every message answered within a day, by a human.</li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
