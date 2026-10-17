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
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
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
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Asked often, <span style={{ color: "var(--accent)" }}>answered plainly.</span>
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
        <Reveal>
          <div
            className="rounded-2xl p-6 text-center backdrop-blur-xl md:sticky md:top-24"
            style={{
              background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="logo-script text-3xl" style={{ transform: "rotate(-2deg)" }}>still stuck?</p>
            <p className="mx-auto mt-2 max-w-[220px] text-[13px] leading-6" style={{ color: "var(--muted)" }}>
              Ask us directly — a human replies within a day.
            </p>
            <a
              href="#contact"
              className="cta-glow mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-bold"
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
