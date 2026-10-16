import Reveal from "@/components/reveal";

const PLANS = [
  {
    name: "Free", price: "₹0", per: "forever",
    lines: ["Free 12Q sample mock", "Solutions + scorecard", "No card • no login needed"],
    cta: "Start free", hot: false, href: "/signup",
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
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Simple pricing in <span style={{ color: "var(--accent)" }}>rupees.</span>
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: "var(--muted)" }}>
          Start free. Upgrade when you need unlimited reps. Pay once via UPI —
          we activate your plan on email within a day.
        </p>
      </Reveal>
      <div className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Reveal key={p.name} className="h-full">
            <div
              className="relative flex h-full flex-col rounded-[22px] p-6 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1"
              style={
                p.hot
                  ? {
                      background: "color-mix(in srgb, var(--nav-bg) 85%, transparent)",
                      border: "1.5px solid var(--accent)",
                      boxShadow: "0 24px 60px -28px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.15)",
                    }
                  : {
                      background: "color-mix(in srgb, var(--nav-bg) 60%, transparent)",
                      border: "1px solid var(--border)",
                    }
              }
            >
              {p.hot && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-extrabold uppercase"
                  style={{ background: "var(--accent)", color: "#fff", letterSpacing: "0.14em" }}
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
                className={`mt-6 block rounded-full py-2.5 text-center text-sm font-bold ${p.hot ? "" : "cta-glow"}`}
                style={
                  p.hot
                    ? { background: "var(--accent)", color: "#fff" }
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
