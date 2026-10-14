import Reveal from "@/components/reveal";

const STEPS: Array<[string, string, string]> = [
  ["01", "Attempt", "Palette, timer and Save & Next — like the real CBT."],
  ["02", "Analyse", "Score with negative marking and section accuracy."],
  ["03", "Fix", "Short explanations behind every answer."],
  ["04", "Retest", "Watch weak areas close, mock after mock."],
];

export default function How() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-12">
      <Reveal className="text-center">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
        >
          How It Works
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Attempt. Analyse. <span style={{ color: "var(--accent)" }}>Fix. Retest.</span>
        </h2>
      </Reveal>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          aria-hidden
          className="absolute left-12 right-12 top-8 hidden h-[2px] lg:block"
          style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", opacity: 0.5 }}
        />
        {STEPS.map(([n, t, d]) => (
          <Reveal key={n}>
            <div
              className="relative rounded-2xl p-5 text-center backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1"
              style={{
                background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="mono mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-extrabold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {n}
              </div>
              <div className="mt-3 font-bold">{t}</div>
              <div className="mt-1 text-[13px] leading-6" style={{ color: "var(--muted)" }}>{d}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
