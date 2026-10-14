"use client";
import { useState } from "react";

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "Exams & Pattern",
    items: [
      ["What is the NIMCET pattern?", "120 MCQs, 1000 marks, 120 minutes. Mathematics 50×12 (−3), Reasoning 40×6 (−1.5), Computer Awareness 20×6 (−1.5), General English 10×4 (−1). Section windows run 70 + 30 + 20 minutes."],
      ["What is CUET PG MCA (SCQP09)?", "75 MCQs, 300 marks, 90 minutes, single paper. +4 correct, −1 wrong across Mathematics (30Q), Computer Science (35Q) and Thinking & Decision Making (10Q)."],
      ["Which NIMCET section matters most?", "Mathematics — 600 of 1000 marks. A 15% accuracy jump there moves your total more than perfect English ever could."],
      ["Is the site only for the 2027 attempt?", "No. Patterns are stable year to year; we update mocks whenever NTA or NIMCET notifies a change."],
    ],
  },
  {
    title: "Mocks & Marking",
    items: [
      ["Is there negative marking in demos?", "Yes — demos use the exact per-section marking of the real paper, scaled to the demo length."],
      ["Do skipped questions lose marks?", "Never — in NIMCET, CUET PG and our mocks. A confident skip beats a blind guess, especially in Maths."],
      ["Do I need an account?", "Not for demos. Accounts and saved history arrive with the next release."],
      ["Which device works best?", "Any modern phone, tablet or laptop browser. A laptop-sized screen matches the real CBT best."],
    ],
  },
  {
    title: "Plans & Payments",
    items: [
      ["What do the plans cost?", "Free ₹0 forever (5 mocks/month), Monthly ₹149 (unlimited), Annual ₹699 (12 months). Prices include all taxes."],
      ["How do I pay?", "Over UPI. Share your payment reference on email and your plan activates within a day."],
      ["Can I get a refund?", "Monthly within 48 hours and Annual within 7 days of purchase, if fewer than 2 mocks were attempted. Write to abhayincodingworld@gmail.com."],
      ["Will prices change later?", "Active plans keep their price till renewal. Only new purchases follow revised prices."],
    ],
  },
  {
    title: "Support",
    items: [
      ["How do I contact you?", "Email abhayincodingworld@gmail.com or call +91-74250-97293. A human replies within a day."],
      ["I found a wrong answer. What now?", "Send the mock name, question number and your working — we verify and fix it, and credit your report if it affected scoring."],
    ],
  },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 py-4 text-left">
        <span className="text-[15px] font-bold" style={open ? { color: "var(--accent)" } : undefined}>{q}</span>
        <span
          className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
          style={{
            background: open ? "var(--accent)" : "var(--pill)",
            color: open ? "#fff" : "var(--text)",
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
