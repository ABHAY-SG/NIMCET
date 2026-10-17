import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/reveal";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the NimCuet team about plans, bugs, question quality or anything else.",
  alternates: { canonical: "/contact" },
};

const CHANNELS: Array<{ icon: string; label: string; value: string; href: string; note: string }> = [
  {
    icon: "✉️",
    label: "Email",
    value: "abhayincodingworld@gmail.com",
    href: "mailto:abhayincodingworld@gmail.com",
    note: "Best for question fixes and plan help — a real person replies within a day.",
  },
  {
    icon: "📞",
    label: "Phone",
    value: "+91 74250 97293",
    href: "tel:+917425097293",
    note: "Missed the call? Email works better — we always reply there.",
  },
];

const ROUTES: Array<[string, string]> = [
  ["Wrong answer or explanation?", "Email the test name + question number — fixes ship into future mocks."],
  ["Plan activation or refund?", "Write from your registered email so we can match your account in one look."],
  ["A bug in a mock?", "Tell us the test, the question and what you saw — screenshots help."],
];

export default function ContactPage() {
  return (
    <main className="relative mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <span className="orb" style={{ left: "6%", top: "-28%", width: "24rem", height: "24rem", background: "color-mix(in srgb, var(--accent) 18%, transparent)" }} />
        <span className="orb" style={{ right: "4%", top: "-6%", width: "22rem", height: "22rem", background: "color-mix(in srgb, var(--accent-2) 16%, transparent)", animationDelay: "-11s" }} />
      </div>

      <section className="text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
            Contact Us
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="display mt-3 text-4xl sm:text-5xl">
            One message away, <em style={{ color: "var(--accent)" }}>always a human.</em>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6" style={{ color: "var(--muted)" }}>
            Syllabus confusion, plan help, or a bug in a mock — pick a channel
            below and we reply within a day.
          </p>
        </Reveal>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {CHANNELS.map((c, i) => (
          <Reveal key={c.label} delay={i * 0.08}>
            <a href={c.href} className="premium-card group flex h-full flex-col rounded-[22px] p-6">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ background: "var(--pill)" }}>{c.icon}</span>
                <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>{c.label}</div>
                <span aria-hidden className="ml-auto text-lg transition-transform duration-300 group-hover:translate-x-1" style={{ color: "var(--accent)" }}>→</span>
              </div>
              <div className="mono mt-4 break-all text-[15px] font-extrabold" style={{ color: "var(--text)" }}>{c.value}</div>
              <p className="mt-2 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>{c.note}</p>
            </a>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="premium-card mt-4 rounded-[22px] p-6 sm:p-7">
          <div className="text-[11px] font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.18em" }}>
            Fastest route
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {ROUTES.map(([q, a]) => (
              <div key={q} className="row-hover rounded-xl px-3 py-3" style={{ background: "var(--pill)" }}>
                <div className="text-[13px] font-extrabold leading-5">{q}</div>
                <div className="mt-1.5 text-[12px] leading-5" style={{ color: "var(--muted)" }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-10 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Most answers already live on the site —{" "}
            <Link href="/faq" className="font-bold" style={{ color: "var(--accent)" }}>read the full FAQ</Link>{" "}
            before you write.
          </p>
        </div>
      </Reveal>
    </main>
  );
}
