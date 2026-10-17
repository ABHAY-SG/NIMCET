"use client";
import { useState } from "react";
import Link from "next/link";
import Reveal from "@/components/reveal";
import { FAQ_GROUPS as GROUPS } from "@/lib/faq-data";

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
        <span className="text-[15px] font-bold" style={open ? { color: "var(--accent)" } : undefined}>{q}</span>
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
      <div className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 0.35s cubic-bezier(0.22,1,0.36,1)" }}>
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-5 text-sm leading-7" style={{ color: "var(--muted)" }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqPage() {
  return (
    <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-28">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] overflow-hidden">
        <span className="orb" style={{ left: "8%", top: "-30%", width: "22rem", height: "22rem", background: "color-mix(in srgb, var(--accent) 16%, transparent)" }} />
        <span className="orb" style={{ right: "4%", top: "-10%", width: "20rem", height: "20rem", background: "color-mix(in srgb, var(--accent-2) 14%, transparent)", animationDelay: "-12s" }} />
      </div>
      <Reveal>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
            Help
          </p>
          <h1 className="display mt-2.5 text-4xl sm:text-5xl">Full FAQ</h1>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>Grouped answers — exams, mocks, plans, support.</p>
        </div>
      </Reveal>
      <div className="mt-10 space-y-6">
        {GROUPS.map((g, gi) => (
          <Reveal key={g.title} delay={gi * 0.06}>
            <section className="premium-card rounded-[22px] p-6 sm:p-7">
              <h2 className="display flex items-center gap-3 text-2xl">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rotate-45" style={{ background: "var(--accent)" }} />
                {g.title}
              </h2>
              <div className="mt-3" style={{ borderTop: "1px solid var(--border)" }}>
                {g.items.map(([q, a]) => (
                  <Item key={q} q={q} a={a} />
                ))}
              </div>
            </section>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <p className="mt-10 text-center text-sm" style={{ color: "var(--muted)" }}>
          Question not covered?{" "}
          <Link href="/contact" className="font-bold" style={{ color: "var(--accent)" }}>Contact us</Link>
          {" "}— a human replies within a day.
        </p>
      </Reveal>
    </main>
  );
}
