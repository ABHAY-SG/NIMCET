import Reveal from "@/components/reveal";

const STEPS: Array<[string, string, string]> = [
  ["01", "Attempt", "Sit a full mock with the palette, timer and Save & Next — exactly like the real CBT hall."],
  ["02", "Analyse", "Get scored with true negative marking, section accuracy and time-per-question stats."],
  ["03", "Fix", "Read short explanations behind every answer and patch the leaking topics first."],
  ["04", "Retest", "Take the next mock and watch weak areas close, attempt after attempt."],
];

export default function How() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-12">
      <div className="grid gap-8 md:grid-cols-[1fr_1.5fr] md:items-start">
        <Reveal className="text-center md:sticky md:top-24 md:text-left">
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
          >
            How It Works
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            One loop, <span style={{ color: "var(--accent)" }}>repeated till rank.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 md:mx-0" style={{ color: "var(--muted)" }}>
            No courses, no videos, no clutter. Four steps on repeat — that is
            the entire method behind every topper we aim to produce.
          </p>
          <a href="/#pricing" className="nlink nounder mt-4 inline-block text-sm font-bold">
            Start the loop →
          </a>
        </Reveal>
        <div className="relative pl-8" style={{ borderLeft: "2px solid var(--border)" }}>
          {STEPS.map(([n, t, d]) => (
            <Reveal key={n}>
              <div className="group relative pb-8 last:pb-0">
                <span
                  className="mono absolute top-0 flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold transition-transform duration-300 group-hover:scale-110"
                  style={{ left: "-50px", background: "var(--btn-bg)", color: "var(--btn-text)" }}
                >
                  {n}
                </span>
                <div className="text-lg font-extrabold tracking-tight">{t}</div>
                <div className="mt-1 max-w-lg text-sm leading-6" style={{ color: "var(--muted)" }}>{d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
