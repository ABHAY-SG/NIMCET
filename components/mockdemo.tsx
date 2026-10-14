"use client";
import { useEffect, useRef, useState } from "react";
import { saveAttempt } from "@/lib/supabase";

type Q = {
  tag: string; stem: string; opts: string[]; ans: number;
  plus: number; minus: number; exp: string;
};

const QS: Q[] = [
  { tag: "MATHS • +12 / −3", stem: "If A is 3×3 with det(A) = 4, det(2A) = ?", opts: ["8", "16", "32", "64"], ans: 2, plus: 12, minus: -3, exp: "det(kA) = k³·det(A) for 3×3, so 8 × 4 = 32." },
  { tag: "MATHS • +12 / −3", stem: "Two fair dice are thrown. P(sum = 9) = ?", opts: ["1/9", "5/36", "1/6", "7/36"], ans: 0, plus: 12, minus: -3, exp: "Favourable: (3,6),(4,5),(5,4),(6,3) = 4 out of 36 → 1/9." },
  { tag: "MATHS • +12 / −3", stem: "∫₀¹ x² dx = ?", opts: ["1/3", "1/2", "1", "2"], ans: 0, plus: 12, minus: -3, exp: "Antiderivative x³/3 evaluated 0→1 gives 1/3." },
  { tag: "MATHS • +12 / −3", stem: "In how many ways can the letters of NIMCET be arranged?", opts: ["720", "360", "120", "5040"], ans: 0, plus: 12, minus: -3, exp: "6 distinct letters → 6! = 720." },
  { tag: "MATHS • +12 / −3", stem: "Distance between (2,3) and (5,7)?", opts: ["5", "4", "6", "√20"], ans: 0, plus: 12, minus: -3, exp: "√((5−2)² + (7−3)²) = √(9+16) = 5." },
  { tag: "REASONING • +6 / −1.5", stem: "2, 6, 12, 20, 30, ?", opts: ["40", "42", "44", "36"], ans: 1, plus: 6, minus: -1.5, exp: "Pattern n(n+1): 6×7 = 42." },
  { tag: "REASONING • +6 / −1.5", stem: "If CAT = 24, then DOG = ?", opts: ["26", "28", "30", "24"], ans: 0, plus: 6, minus: -1.5, exp: "Sum of letter positions: C(3)+A(1)+T(20)=24; D(4)+O(15)+G(7)=26." },
  { tag: "REASONING • +6 / −1.5", stem: "Odd one out: Apple, Mango, Banana, Potato", opts: ["Apple", "Mango", "Banana", "Potato"], ans: 3, plus: 6, minus: -1.5, exp: "Potato is a vegetable; the rest are fruits." },
  { tag: "COMPUTERS • +6 / −1.5", stem: "Which discipline does a stack follow?", opts: ["FIFO", "LIFO", "LILO", "Random"], ans: 1, plus: 6, minus: -1.5, exp: "Stack = Last In, First Out." },
  { tag: "COMPUTERS • +6 / −1.5", stem: "An IPv4 address has how many bits?", opts: ["16", "32", "64", "128"], ans: 1, plus: 6, minus: -1.5, exp: "IPv4 = 32 bits (IPv6 = 128 bits)." },
  { tag: "ENGLISH • +4 / −1", stem: "Choose the synonym of 'Candid'.", opts: ["Rude", "Frank", "Cunning", "Shy"], ans: 1, plus: 4, minus: -1, exp: "Candid = frank, straightforward." },
  { tag: "ENGLISH • +4 / −1", stem: "'To bite the dust' means —", opts: ["Eat quickly", "Suffer defeat", "Work hard", "Hide away"], ans: 1, plus: 4, minus: -1, exp: "Idiom: to fail or be defeated." },
];

const MAX = QS.reduce((a, q) => a + q.plus, 0);
const MINUTES = 12;

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Summary = { score: number; correct: number; wrong: number; skip: number };

export default function MockDemo() {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [left, setLeft] = useState(MINUTES * 60);
  const [done, setDone] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (done) return;
    if (left <= 0) { setDone(true); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, done]);

  useEffect(() => {
    if (!done || savedRef.current) return;
    savedRef.current = true;
    const s = summarize();
    const record = {
      test: "Free sample mock (12Q)",
      score: s.score, correct: s.correct, wrong: s.wrong, skipped: s.skip,
      created_at: new Date().toISOString(),
    };
    try {
      const raw = localStorage.getItem("nimcuet-attempts");
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ ...record, id: `local-${Date.now()}` });
      localStorage.setItem("nimcuet-attempts", JSON.stringify(arr.slice(0, 20)));
    } catch {}
    saveAttempt({ test: record.test, score: s.score, correct: s.correct, wrong: s.wrong, skipped: s.skip });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function summarize(): Summary {
    let score = 0, correct = 0, wrong = 0, skip = 0;
    QS.forEach((qq, i) => {
      const a = answers[i];
      if (a == null) skip++;
      else if (a === qq.ans) { correct++; score += qq.plus; }
      else { wrong++; score += qq.minus; }
    });
    return { score: Math.round(score * 10) / 10, correct, wrong, skip };
  }

  const reset = () => {
    savedRef.current = false;
    setAnswers({});
    setIdx(0);
    setLeft(MINUTES * 60);
    setDone(false);
  };

  if (done) {
    const s = summarize();
    const pct = Math.max(0, Math.round((s.score / MAX) * 100));
    return (
      <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
        <div className="p-5 text-center sm:p-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="mono text-[11px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.16em" }}>SCORECARD • SAMPLE MOCK</p>
          <div className="mono mt-2 text-5xl font-extrabold">
            {s.score}<span className="text-lg font-medium" style={{ color: "var(--muted)" }}>/{MAX}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
          </div>
          <p className="mono mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {s.correct} CORRECT • {s.wrong} WRONG • {s.skip} SKIPPED • +{QS[0].plus}/−{Math.abs(QS[0].minus)} MARKING APPLIED
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={reset} className="rounded-full px-5 py-2 text-sm font-bold" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
              Retry →
            </button>
            <a href="/#pricing" className="rounded-full px-5 py-2 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>
              Unlock all mocks
            </a>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto p-4 sm:p-5">
          <p className="mono text-[11px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>SOLUTIONS</p>
          <div className="mt-2 space-y-3">
            {QS.map((q, i) => {
              const a = answers[i];
              const ok = a === q.ans;
              return (
                <div key={i} className="rounded-xl p-3.5 text-sm" style={{ border: "1px solid var(--border)" }}>
                  <p className="font-bold">Q{i + 1}. {q.stem}</p>
                  <p className="mt-1" style={{ color: ok ? "#16a34a" : a == null ? "var(--muted)" : "#dc2626" }}>
                    {a == null ? `Skipped — answer: ${q.opts[q.ans]}` : ok ? `Your answer: ${q.opts[a]} ✓` : `Your answer: ${q.opts[a]} ✘ (correct: ${q.opts[q.ans]})`}
                  </p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>Why: {q.exp}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const q = QS[idx];
  return (
    <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="mono text-[11px] font-bold" style={{ color: "var(--muted)" }}>SAMPLE MOCK • Q{idx + 1}/{QS.length}</span>
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
          <div className="flex flex-wrap justify-center gap-1.5 px-2">
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
