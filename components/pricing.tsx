import Reveal from "@/components/reveal";

const PLANS = [
  {
    name: "Free", price: "₹0", per: "forever",
    lines: ["Free 12Q sample mock", "Solutions + scorecard", "No card • no login needed"],
    cta: "Try the free sample", hot: false, href: "/#demo",
  },
  {
    name: "Monthly", price: "₹149", per: "/month",
    lines: ["Unlimited mocks", "Full section analytics", "All PYQ sets", "All future papers", "Cancel anytime"],
    cta: "Choose Monthly", hot: false, href: "/login",
  },
  {
    name: "Annual", price: "₹699", per: "/year",
    lines: ["12 months full access", "Everything in Monthly", "Priority support", "Early new papers"],
    cta: "Choose Annual", hot: true, href: "/login",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <Reveal className="text-center">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
        >
          Pricing
        </p>
        <h2 className="display mt-2.5 text-3xl sm:text-4xl">
          Simple pricing in <em style={{ color: "var(--accent)" }}>rupees.</em>
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: "var(--muted)" }}>
          Start free. Upgrade when you need unlimited reps. Pay once via UPI —
          we activate your plan on email within a day.
        </p>
      </Reveal>
      <div className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
        {PLANS.map((p, i) => (
          <Reveal key={p.name} className="h-full" delay={i * 0.08}>
            <div className={`relative flex h-full flex-col rounded-[22px] p-6 ${p.hot ? "premium-card premium-hi ring-grad" : "premium-card"}`}>
              {p.hot && (
                <span
                  className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-extrabold uppercase"
                  style={{ background: "linear-gradient(100deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)", letterSpacing: "0.14em", boxShadow: "0 10px 26px -12px var(--accent)" }}
                >
                  Most Popular
                </span>
              )}
              <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                {p.name}
              </div>
              <div className="mono mt-2 text-4xl font-extrabold">
                {p.price}
                <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>{p.per}</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm" style={{ color: "var(--muted)" }}>
                {p.lines.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span style={{ color: "var(--accent)" }}>✓</span> {l}
                  </li>
                ))}
              </ul>
              <a
                href={p.href}
                className="cta-glow mt-6 block rounded-full py-2.5 text-center text-sm font-bold"
                style={
                  p.hot
                    ? { background: "linear-gradient(100deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)" }
                    : { border: "1px solid var(--border)", color: "var(--text)" }
                }
              >
                {p.cta} →
              </a>
              {p.hot || p.name !== "Free" ? (
                <p className="mt-2 text-center text-[11px] leading-4" style={{ color: "var(--muted)" }}>
                  Log in, pay via UPI • activated within a day
                </p>
              ) : (
                <p className="mt-2 text-center text-[11px] leading-4" style={{ color: "var(--muted)" }}>
                  No card • no login needed
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-5 text-center text-xs" style={{ color: "var(--muted)" }}>
        Refunds: Monthly within 48h, Annual within 7 days (under 2 mocks attempted) — full policy in{" "}
        <a href="/terms" className="font-bold" style={{ color: "var(--accent)" }}>Terms</a>.
      </p>
    </section>
  );
}
