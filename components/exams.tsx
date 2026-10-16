"use client";
import { useState } from "react";
import Reveal from "@/components/reveal";

type Sec = { name: string; detail: string; marks: number; total: number };

const EXAMS: Record<string, {
  tab: string; code: string; name: string; desc: string;
  stats: Array<[string, string]>;
  sections: Sec[];
  note: string;
}> = {
  nimcet: {
    tab: "NIMCET",
    code: "NIT MCA ENTRANCE",
    name: "NIMCET",
    desc: "The MCA entrance for NITs. One paper, four sections — and Mathematics alone decides 600 of 1000 marks.",
    stats: [["120", "Questions"], ["1,000", "Marks"], ["120 min", "Duration"]],
    sections: [
      { name: "Mathematics", detail: "50Q • +12 / −3", marks: 600, total: 1000 },
      { name: "Analytical + Reasoning", detail: "40Q • +6 / −1.5", marks: 240, total: 1000 },
      { name: "Computer Awareness", detail: "20Q • +6 / −1.5", marks: 120, total: 1000 },
      { name: "General English", detail: "10Q • +4 / −1", marks: 40, total: 1000 },
    ],
    note: "Section windows run 70 + 30 + 20 minutes — unused time never carries over.",
  },
  cuet: {
    tab: "CUET PG",
    code: "SCQP09 • MCA TRACK",
    name: "CUET PG – MCA",
    desc: "Computer Science & IT paper for MCA admissions. One 90-minute paper, uniform marking throughout.",
    stats: [["75", "Questions"], ["300", "Marks"], ["90 min", "Duration"]],
    sections: [
      { name: "Computer Science", detail: "35Q • +4 / −1", marks: 140, total: 300 },
      { name: "Mathematics", detail: "30Q • +4 / −1", marks: 120, total: 300 },
      { name: "Thinking & Decision", detail: "10Q • +4 / −1", marks: 40, total: 300 },
    ],
    note: "Every question is worth the same — speed and accuracy decide everything.",
  },
};

export default function Exams() {
  const [key, setKey] = useState("nimcet");
  const e = EXAMS[key];
  return (
    <section id="exams" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <Reveal className="text-center">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
        >
          Exams
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Know the paper <span style={{ color: "var(--accent)" }}>before you sit it.</span>
        </h2>
      </Reveal>
      <Reveal>
        <div className="mx-auto mt-6 flex w-fit rounded-full p-1" style={{ background: "var(--pill)", border: "1px solid var(--border)" }}>
          {Object.entries(EXAMS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              className="rounded-full px-6 py-2 text-sm font-bold transition-all"
              style={k === key
                ? { background: "var(--btn-bg)", color: "var(--btn-text)" }
                : { color: "var(--muted)" }}
            >
              {v.tab}
            </button>
          ))}
        </div>
      </Reveal>
      <Reveal key={key}>
        <div
          className="mx-auto mt-5 max-w-4xl rounded-[22px] p-6 backdrop-blur-2xl sm:p-8"
          style={{
            background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)",
            border: "1px solid var(--border)",
            boxShadow: "0 28px 70px -34px rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.16)",
          }}
        >
          <p className="mono text-[11px] font-semibold" style={{ color: "var(--accent)", letterSpacing: "0.2em" }}>{e.code}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <h3 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{e.name}</h3>
            <div className="mono flex gap-5 text-sm">
              {e.stats.map(([v, l]) => (
                <span key={l}><strong className="text-base">{v}</strong> <span style={{ color: "var(--muted)" }}>{l}</span></span>
              ))}
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--muted)" }}>{e.desc}</p>
          <div className="mt-5 space-y-3.5">
            {e.sections.map((s, i) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-bold">{s.name}</span>
                  <span className="mono text-xs" style={{ color: "var(--muted)" }}>{s.detail}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
                  <div
                    className="grow h-full rounded-full"
                    style={{ width: `${Math.round((s.marks / s.total) * 100)}%`, background: "var(--accent)", animationDelay: `${i * 0.1}s` }}
                  />
                </div>
                <div className="mono mt-1 text-[11px]" style={{ color: "var(--muted)" }}>{s.marks} MARKS</div>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t pt-4 text-[13px] leading-6" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{e.note}</p>
        </div>
      </Reveal>
    </section>
  );
}
