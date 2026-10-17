import Reveal from "@/components/reveal";

// Shared shell for Terms and Privacy: a viewport-height page that itself
// never scrolls. The heading is fixed, the sections live in their own scroll
// box ("On this page" jumps scroll inside that box), and page chrome
// (navbar / contact strip / footer) is hidden for these routes via BARE in
// components/chrome.tsx. The data-legal hook freezes the outer scrollbars.
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
    <main data-legal className="relative mx-auto flex h-[100dvh] w-full max-w-5xl flex-col px-4 pb-6 pt-10 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] overflow-hidden">
        <span className="orb" style={{ left: "10%", top: "-30%", width: "22rem", height: "22rem", background: "color-mix(in srgb, var(--accent) 15%, transparent)" }} />
        <span className="orb" style={{ right: "6%", top: "-12%", width: "20rem", height: "20rem", background: "color-mix(in srgb, var(--gold-3) 11%, transparent)", animationDelay: "-12s" }} />
      </div>

      {/* Fixed heading — never scrolls */}
      <div className="shrink-0 pb-8 text-center">
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

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-8 md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="premium-card hidden self-start rounded-[22px] p-3.5 md:block">
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

        <Reveal delay={0.08} className="min-h-0">
          <article
            tabIndex={0}
            role="region"
            aria-label={`${title} — full text`}
            className="premium-card admin-scroll h-full overflow-y-auto rounded-[22px] p-6 outline-none sm:p-9"
          >
            {sections.map(([t, ps], i) => (
              <section
                key={t}
                id={`s${i + 1}`}
                className="scroll-mt-6 border-b py-7 first:pt-0 last:border-b-0 last:pb-0"
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
