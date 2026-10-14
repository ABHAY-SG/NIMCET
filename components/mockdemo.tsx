"use client";
import { useEffect, useRef, useState } from "react";
import { saveAttempt } from "@/lib/supabase";

type Q = { tag: string; stem: string; opts: string[]; ans: number; plus: number; minus: number };

const QS: Q[] = [
  { tag: "MATHS • +12 / −3", stem: "If A is 3×3 with det(A) = 4, det(2A) = ?", opts: ["8", "16", "32", "64"], ans: 2, plus: 12, minus: -3 },
  { tag: "REASONING • +6 / −1.5", stem: "2, 6, 12, 20, 30, ?", opts: ["40", "42", "44", "36"], ans: 1, plus: 6, minus: -1.5 },
  { tag: "COMPUTERS • +6 / −1.5", stem: "Which discipline does a stack follow?", opts: ["FIFO", "LIFO", "LILO", "Random"], ans: 1, plus: 6, minus: -1.5 },
];

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function MockDemo() {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [left, setLeft] = useState(5 * 60);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (left <= 0) { setDone(true); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, done]);

  const savedRef = useRef(false);

  useEffect(() => {
    if (!done || savedRef.current) return;
    savedRef.current = true;
    let score = 0, correct = 0, wrong = 0, skip = 0;
    QS.forEach((qq, i) => {
      const a = answers[i];
      if (a == null) skip++;
      else if (a === qq.ans) { correct++; score += qq.plus; }
      else { wrong++; score += qq.minus; }
    });
    saveAttempt({ test: "Homepage demo mock", score, correct, wrong, skipped: skip });
  }, [done, answers]);

  const q = QS[idx];

  if (done) {
    let score = 0, correct = 0, wrong = 0, skip = 0;
    QS.forEach((qq, i) => {
      const a = answers[i];
      if (a == null) skip++;
      else if (a === qq.ans) { correct++; score += qq.plus; }
      else { wrong++; score += qq.minus; }
    });
    return (
      <div className="rounded-2xl p-5 backdrop-blur-xl sm:p-6" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
        <p className="mono text-[11px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.16em" }}>DEMO RESULT</p>
        <div className="mono mt-2 text-4xl font-extrabold">{score} <span className="text-base font-medium" style={{ color: "var(--muted)" }}>marks</span></div>
        <p className="mono mt-1 text-xs" style={{ color: "var(--muted)" }}>{correct} CORRECT • {wrong} WRONG • {skip} SKIPPED</p>
        <button
          type="button"
          onClick={() => { savedRef.current = false; setAnswers({}); setIdx(0); setLeft(5 * 60); setDone(false); }}
          className="mt-4 rounded-full px-5 py-2 text-sm font-bold"
          style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
        >
          Retry demo →
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="mono text-[11px] font-bold" style={{ color: "var(--muted)" }}>LIVE DEMO • Q{idx + 1}/3</span>
        <span className="mono rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }}>⏱ {fmt(left)}</span>
        <button type="button" onClick={() => setDone(true)} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "#16a34a", color: "#fff" }}>Submit</button>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mono text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.14em" }}>{q.tag}</p>
        <p className="mt-1.5 font-bold leading-6">{q.stem}</p>
        <div className="mt-3 grid gap-1.5 text-sm">
          {q.opts.map((o, i) => (
            <button
              key={o}
              type="button"
              onClick={() => setAnswers((a) => ({ ...a, [idx]: i }))}
              className="rounded-xl px-3 py-2 text-left transition-transform hover:-translate-y-px"
              style={answers[idx] === i
                ? { background: "var(--accent)", color: "#fff", fontWeight: 700 }
                : { border: "1px solid var(--border)" }}
            >
              <span className="mono mr-2 text-[11px] opacity-70">{String.fromCharCode(65 + i)}</span>{o}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[13px]">
          <button type="button" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="font-semibold disabled:opacity-30" style={{ color: "var(--muted)" }}>← Prev</button>
          <div className="flex gap-1.5">
            {QS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Question ${i + 1}`}
                className="mono h-7 w-7 rounded-lg text-xs font-bold"
                style={answers[i] != null
                  ? { background: "var(--accent)", color: "#fff" }
                  : i === idx
                    ? { border: "1.5px solid var(--accent)" }
                    : { background: "var(--pill)", color: "var(--muted)" }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={idx === QS.length - 1}
            onClick={() => setIdx(idx + 1)}
            className="font-bold disabled:opacity-30"
            style={{ color: "var(--accent)" }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
