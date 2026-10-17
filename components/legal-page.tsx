import Reveal from "@/components/reveal";

// Shared shell for Terms and Privacy: centered editorial hero, a sticky
// on-this-page index on desktop, and the sections inside one glass card.
export default function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: Array<[string, string[]]>;
}) {
  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] overflow-hidden">
        <span className="orb" style={{ left: "10%", top: "-30%", width: "22rem", height: "22rem", background: "color-mix(in srgb, var(--accent) 15%, transparent)" }} />
        <span className="orb" style={{ right: "6%", top: "-12%", width: "20rem", height: "20rem", background: "color-mix(in srgb, var(--gold-3) 11%, transparent)", animationDelay: "-12s" }} />
      </div>

      {/* Heading band: pinned under the navbar, content scrolls beneath it */}
      <div
        className="sticky top-16 z-30 -mx-4 px-4 pb-5 pt-2 text-center sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{
          background: "linear-gradient(180deg, var(--bg) 0%, var(--bg) 72%, transparent 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <Reveal>
          <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
            Legal
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="display mt-3 text-4xl sm:text-5xl">{title}</h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mono mt-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
            Last updated: {updated}
          </p>
        </Reveal>
      </div>

      <div className="mt-10 grid items-start gap-8 md:grid-cols-[230px_minmax(0,1fr)]">
        <Reveal className="hidden md:sticky md:top-[14.5rem] md:block">
          <aside className="premium-card rounded-[22px] p-3.5">
            <div className="px-2 pb-2 pt-1 text-[10px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
              On this page
            </div>
            <nav className="grid gap-0.5">
              {sections.map(([t], i) => (
                <a key={t} href={`#s${i + 1}`} className="tmenu px-2.5 py-2 text-[12.5px] font-semibold leading-4">
                  {t}
                </a>
              ))}
            </nav>
          </aside>
        </Reveal>

        <Reveal delay={0.08}>
          <article className="premium-card rounded-[22px] p-6 sm:p-9">
            {sections.map(([t, ps], i) => (
              <section
                key={t}
                id={`s${i + 1}`}
                className="scroll-mt-[15rem] border-b py-7 first:pt-0 last:border-b-0 last:pb-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-baseline gap-3">
                  <span className="mono text-[12px] font-extrabold" style={{ color: "var(--accent)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="display text-xl sm:text-2xl">{t.replace(/^\d+\.\s*/, "")}</h2>
                </div>
                {ps.map((p, k) => (
                  <p key={k} className="mt-3 text-sm leading-7" style={{ color: "var(--muted)" }}>{p}</p>
                ))}
              </section>
            ))}
          </article>
        </Reveal>
      </div>
    </main>
  );
}
