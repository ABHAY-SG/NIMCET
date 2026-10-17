"use client";
import { useState } from "react";
import { FAQ_GROUPS as GROUPS } from "@/lib/faq-data";

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-4 text-left">
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
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28">
      <p className="text-center text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
        Help
      </p>
      <h1 className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Full FAQ</h1>
      <p className="mt-2 text-center text-sm" style={{ color: "var(--muted)" }}>Grouped answers — exams, mocks, plans, support.</p>
      <div className="mt-8 space-y-10">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-lg font-extrabold tracking-tight">{g.title}</h2>
            <div className="mt-2" style={{ borderTop: "1px solid var(--border)" }}>
              {g.items.map(([q, a]) => (
                <Item key={q} q={q} a={a} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
