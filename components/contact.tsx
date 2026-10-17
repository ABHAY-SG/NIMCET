import Reveal from "@/components/reveal";

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export default function ContactStrip() {
  return (
    <section id="contact" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-[28px] px-6 py-10 text-center backdrop-blur-2xl backdrop-saturate-150 sm:px-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02)), color-mix(in srgb, var(--nav-bg) 72%, transparent)",
            border: "1px solid var(--border)",
            boxShadow:
              "0 32px 80px -32px rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.2)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
            style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
          />
          <span
            aria-hidden
            className="orb"
            style={{ left: "8%", top: "-35%", width: "18rem", height: "18rem", background: "color-mix(in srgb, var(--accent) 18%, transparent)", zIndex: -1 }}
          />
          <span
            aria-hidden
            className="orb"
            style={{ right: "6%", bottom: "-45%", width: "20rem", height: "20rem", background: "color-mix(in srgb, var(--accent-2) 16%, transparent)", animationDelay: "-12s", zIndex: -1 }}
          />
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
          >
            Contact Us
          </p>
          <h2 className="display mx-auto mt-2 max-w-lg text-3xl sm:text-4xl">
            Still stuck? <em style={{ color: "var(--accent)" }}>Talk to us.</em>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: "var(--muted)" }}>
            Syllabus confusion, plan help, or a bug in a mock — one message
            away, and a real person replies within a day.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <a
              href="mailto:abhayincodingworld@gmail.com"
              className="cta-glow flex max-w-full items-center justify-center gap-2.5 break-all rounded-full px-5 py-3 text-[13px] font-bold sm:px-6 sm:text-sm"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              <MailIcon />
              abhayincodingworld@gmail.com
            </a>
            <a
              href="tel:+917425097293"
              className="cta-glow flex shrink-0 items-center gap-2.5 rounded-full px-5 py-3 text-[13px] font-bold sm:px-6 sm:text-sm"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              <PhoneIcon />
              +91-74250-97293
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
