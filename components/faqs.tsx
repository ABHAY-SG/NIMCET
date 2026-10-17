"use client";
import { useState } from "react";
import Reveal from "@/components/reveal";
import { LANDING_FAQS as FAQS } from "@/lib/faq-data";

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="row-hover -mx-2 flex w-full items-center justify-between gap-4 rounded-xl px-2 py-4 text-left"
      >
        <span className={`text-[15px] font-bold transition-colors ${open ? "" : ""}`} style={open ? { color: "var(--accent)" } : undefined}>{q}</span>
        <span
          className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
          style={{
            background: open ? "var(--accent)" : "var(--pill)",
            color: open ? "var(--accent-fg)" : "var(--text)",
            transform: open ? "rotate(45deg)" : "none",
            transition: "transform 0.3s, background 0.3s",
          }}
        >
          +
        </span>
      </button>
      <div
        className="grid"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.35s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-5 text-sm leading-7" style={{ color: "var(--muted)" }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function Faqs() {
  return (
    <section id="faqs" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <Reveal className="text-center">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
        >
          FAQs
        </p>
        <h2 className="display mt-2.5 text-3xl sm:text-4xl">
          Asked often, <em style={{ color: "var(--accent)" }}>answered plainly.</em>
        </h2>
      </Reveal>
      <div className="mt-6 grid items-start gap-6 md:grid-cols-[1.6fr_1fr]">
        <Reveal>
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {FAQS.map(([q, a]) => (
              <Item key={q} q={q} a={a} />
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="premium-card relative overflow-hidden rounded-2xl p-6 text-center md:sticky md:top-24">
            <span
              aria-hidden
              className="orb"
              style={{ left: "-30%", top: "-45%", width: "16rem", height: "16rem", background: "color-mix(in srgb, var(--accent) 22%, transparent)" }}
            />
            <p className="logo-script relative text-3xl" style={{ transform: "rotate(-2deg)" }}>still stuck?</p>
            <p className="relative mx-auto mt-2 max-w-[220px] text-[13px] leading-6" style={{ color: "var(--muted)" }}>
              Ask us directly — a human replies within a day.
            </p>
            <a
              href="#contact"
              className="cta-glow relative mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-bold"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              Contact us →
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
