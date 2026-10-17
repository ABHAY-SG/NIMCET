import Link from "next/link";
import Reveal from "@/components/reveal";

const STEPS: Array<[string, string, string]> = [
  ["01", "Attempt", "Sit a full mock with the palette, timer and Save & Next — exactly like the real CBT hall."],
  ["02", "Analyse", "Get scored with true negative marking, section accuracy and time-per-question stats."],
  ["03", "Fix", "Read short explanations behind every answer and patch the leaking topics first."],
  ["04", "Retest", "Take the next mock and watch weak areas close, attempt after attempt."],
];

export default function How() {
  return (
    <section id="how" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 md:grid-cols-[1fr_1.5fr] md:items-start">
        <Reveal className="text-center md:sticky md:top-24 md:text-left">
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
          >
            How It Works
          </p>
          <h2 className="display mt-2.5 text-3xl sm:text-4xl">
            One loop, <em style={{ color: "var(--accent)" }}>repeated till rank.</em>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 md:mx-0" style={{ color: "var(--muted)" }}>
            No courses, no videos, no clutter. Four steps on repeat — that is
            the entire method behind every topper we aim to produce.
          </p>
          <Link href="/#pricing" className="nlink nounder mt-4 inline-block text-sm font-bold">
            Start the loop →
          </Link>
        </Reveal>
        <div className="relative pl-8">
          <span
            aria-hidden
            className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full"
            style={{ background: "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 25%, transparent) 78%, transparent)" }}
          />
          {STEPS.map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 0.08}>
              <div className="group relative pb-8 last:pb-0">
                <span
                  className="mono absolute top-0 flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold transition-transform duration-300 group-hover:scale-110"
                  style={{ left: "-50px", background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)", boxShadow: "0 12px 26px -12px var(--accent)" }}
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
