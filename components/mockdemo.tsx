"use client";
import { useEffect, useRef, useState } from "react";

export type MockQuestion = {
  tag: string; stem: string; opts: string[]; ans?: number;
  plus: number; minus: number; exp?: string;
  qid?: string;
};

export type SubmitResult = {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  details: Array<{ stem: string; opts: string[]; picked: number | null; correct: number; exp: string; ok?: boolean }>;
};

type Q = MockQuestion;

// In-progress runs (real, server-scored mocks only) are mirrored to
// sessionStorage so an accidental refresh or a trip to another tab does not
// silently destroy a half-finished attempt. Cleared when the run completes.
const RUN_KEY = "nimcuet-run-v1";

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

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Summary = { score: number; correct: number; wrong: number; skip: number };

export default function MockDemo({
  questions,
  title = "SAMPLE MOCK",
  minutes,
  testName,
  autoStart = false,
  onSubmit,
}: {
  questions?: MockQuestion[];
  title?: string;
  minutes?: number;
  testName?: string;
  autoStart?: boolean;
  onSubmit?: (picks: Record<number, number>) => Promise<SubmitResult>;
} = {}) {
  const list = questions && questions.length > 0 ? questions : QS;
  const MAX = list.reduce((a, q) => a + q.plus, 0);
  const mins = minutes ?? 12;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [left, setLeft] = useState(mins * 60);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(autoStart);
  const [serverResult, setServerResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const savedRef = useRef(false);
  const localSavedRef = useRef(false);
  // Wall-clock deadline: the timer keeps correct time even if the browser
  // throttles timers in a background tab.
  const endAtRef = useRef<number | null>(null);
  const persist = !!onSubmit && !!testName;

  // Restore a run interrupted by refresh/tab-switch (real mocks only).
  useEffect(() => {
    if (!persist) return;
    try {
      const raw = sessionStorage.getItem(RUN_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { name?: string; answers?: Record<string, number>; idx?: number; endAt?: number };
      if (s.name !== testName || typeof s.endAt !== "number" || s.endAt < Date.now() + 1000) {
        sessionStorage.removeItem(RUN_KEY);
        return;
      }
      if (s.answers && typeof s.answers === "object") {
        const restored: Record<number, number> = {};
        for (const [k, v] of Object.entries(s.answers)) {
          const i = Number(k);
          if (Number.isInteger(i) && i >= 0 && i < list.length && Number.isInteger(v) && v >= 0 && v <= 3) restored[i] = v;
        }
        setAnswers(restored);
      }
      if (Number.isInteger(s.idx) && (s.idx as number) >= 0 && (s.idx as number) < list.length) {
        setIdx(s.idx as number);
      }
      endAtRef.current = s.endAt;
      setLeft(Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!started || done) return;
    if (endAtRef.current == null) endAtRef.current = Date.now() + mins * 60_000;
    const tick = () => {
      const end = endAtRef.current ?? Date.now();
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) setDone(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [started, done, mins]);

  // Mirror the run while it is live so a reload cannot silently discard it.
  useEffect(() => {
    if (!persist || !started || done) return;
    const end = endAtRef.current;
    if (end == null) return;
    try {
      sessionStorage.setItem(RUN_KEY, JSON.stringify({ name: testName, answers, idx, endAt: end }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, started, done, answers, idx, testName]);

  // Warn before closing the tab mid-test (real mocks only).
  useEffect(() => {
    if (!persist || !started || done) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, started, done]);

  useEffect(() => {
    if (!done) return;
    if (savedRef.current) return;
    savedRef.current = true;
    if (!onSubmit) {
      // Homepage sample: everything stays on this device. The bank-backed
      // mocks never write a device-local record — the server owns their
      // attempt history (and only the server holds the answer key, so a local
      // score would be guesswork).
      if (!localSavedRef.current) {
        localSavedRef.current = true;
        try {
          const s = summarize();
          const raw = localStorage.getItem("nimcuet-attempts");
          const arr = raw ? JSON.parse(raw) : [];
          arr.unshift({
            test: testName ?? "Free sample mock (12Q)",
            created_at: new Date().toISOString(),
            id: `local-${Date.now()}`,
            score: s.score,
            correct: s.correct,
            wrong: s.wrong,
            skipped: s.skip,
          });
          localStorage.setItem("nimcuet-attempts", JSON.stringify(arr.slice(0, 20)));
        } catch {}
      }
      try { sessionStorage.removeItem(RUN_KEY); } catch {}
      const s = summarize();
      setServerResult({
        score: s.score,
        correct: s.correct,
        wrong: s.wrong,
        skipped: s.skip,
        details: list.map((q, i) => ({
          stem: q.stem,
          opts: q.opts,
          picked: answers[i] ?? null,
          correct: q.ans ?? -1,
          exp: q.exp ?? "",
          ok: answers[i] != null && answers[i] === (q.ans ?? -1),
        })),
      });
      return;
    }
    // Server scores from the answer key and records the attempt — the
    // browser never sees correct answers before submitting.
    onSubmit(answers)
      .then((r) => {
        setServerResult(r);
        setSubmitError("");
        try { sessionStorage.removeItem(RUN_KEY); } catch {}
      })
      .catch((e) => setSubmitError(e instanceof Error ? e.message : "Submit failed."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, retryTick]);

  function summarize(): Summary {
    let score = 0, correct = 0, wrong = 0, skip = 0;
    list.forEach((qq, i) => {
      const a = answers[i];
      if (a == null) skip++;
      else if (a === qq.ans) { correct++; score += qq.plus; }
      else { wrong++; score += qq.minus; }
    });
    return { score: Math.round(score * 10) / 10, correct, wrong, skip };
  }

  const reset = () => {
    savedRef.current = false;
    localSavedRef.current = false;
    endAtRef.current = null;
    try { sessionStorage.removeItem(RUN_KEY); } catch {}
    setServerResult(null);
    setSubmitError("");
    setAnswers({});
    setIdx(0);
    setLeft(mins * 60);
    setDone(false);
  };

  const retrySubmit = () => {
    savedRef.current = false;
    setSubmitError("");
    setRetryTick((t) => t + 1);
  };

  if (!started) {
    return (
      <div className="overflow-hidden rounded-2xl p-6 text-center backdrop-blur-xl sm:p-8" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
        <p className="mono text-[11px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.16em" }}>
          FREE SAMPLE MOCK • {list.length} QUESTIONS • {mins} MINUTES
        </p>
        <h3 className="mx-auto mt-2 max-w-sm text-xl font-extrabold tracking-tight">
          5 Maths • 3 Reasoning • 2 Computers • 2 English
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: "var(--muted)" }}>
          Real per-section marking, live timer, palette and full solutions at
          the end. The clock starts only when you press start.
        </p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="cta-glow mt-5 rounded-full px-8 py-3 text-sm font-bold"
          style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
        >
          Start sample mock →
        </button>
      </div>
    );
  }

  if (done) {
    if (onSubmit && !serverResult && !submitError) {
      return (
        <div className="overflow-hidden rounded-2xl p-10 text-center backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full" style={{ border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
          <p className="mt-4 text-sm font-bold">Scoring on the server…</p>
        </div>
      );
    }
    if (onSubmit && !serverResult && submitError) {
      return (
        <div className="overflow-hidden rounded-2xl p-10 text-center backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-bold">Could not submit: {submitError}</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px]" style={{ color: "var(--muted)" }}>
            Your answers are kept — nothing was recorded. Check your connection and retry.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={retrySubmit} className="rounded-full px-5 py-2 text-sm font-bold" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
              Retry submit →
            </button>
            <button type="button" onClick={() => setDone(false)} className="rounded-full px-5 py-2 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>
              Back to test
            </button>
          </div>
        </div>
      );
    }
    const r = serverResult ?? (() => {
      const s = summarize();
      return {
        score: s.score,
        correct: s.correct,
        wrong: s.wrong,
        skipped: s.skip,
        details: list.map((q, i) => ({
          stem: q.stem,
          opts: q.opts,
          picked: answers[i] ?? null,
          correct: q.ans ?? -1,
          exp: q.exp ?? "",
          ok: answers[i] != null && answers[i] === (q.ans ?? -1),
        })),
      };
    })();
    const pct = Math.max(0, Math.round((r.score / MAX) * 100));
    const schemes = Array.from(new Set(list.map((q) => `+${q.plus} / −${Math.abs(q.minus)}`)));
    const markingLabel = schemes.length === 1 ? `${schemes[0]} MARKING APPLIED` : "PER-SECTION MARKING APPLIED";
    return (
      <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
        <div className="p-5 text-center sm:p-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="mono text-[11px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.16em" }}>SCORECARD • {title}</p>
          <div className="mono mt-2 text-5xl font-extrabold">
            {r.score}<span className="text-lg font-medium" style={{ color: "var(--muted)" }}>/{MAX}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
          </div>
          <p className="mono mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {r.correct} CORRECT • {r.wrong} WRONG • {r.skipped} SKIPPED • {markingLabel}
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
            {r.details.map((d, i) => {
              const ok = d.ok ?? (d.picked != null && d.picked === d.correct);
              return (
                <div key={i} className="rounded-xl p-3.5 text-sm" style={{ border: "1px solid var(--border)" }}>
                  <p className="font-bold">Q{i + 1}. {d.stem}</p>
                  <p className="mt-1" style={{ color: ok ? "#16a34a" : d.picked == null ? "var(--muted)" : "#dc2626" }}>
                    {d.picked == null ? `Skipped — answer: ${d.opts[d.correct] ?? d.correct}` : ok ? `Your answer: ${d.opts[d.picked]} ✓` : `Your answer: ${d.opts[d.picked]} ✘ (correct: ${d.opts[d.correct] ?? d.correct})`}
                  </p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>Why: {d.exp}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const q = list[idx];
  const answered = Object.keys(answers).length;
  return (
    <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="mono text-[11px] font-bold" style={{ color: "var(--muted)" }}>{title} • Q{idx + 1}/{list.length}</span>
        <span className="mono rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }} aria-label={`Time left ${fmt(left)}`}>⏱ {fmt(left)}</span>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Submit the test now?\n\n${answered} of ${list.length} answered. You can't change answers after submitting.`)) return;
            setDone(true);
          }}
          className="rounded-full px-3 py-1.5 text-xs font-bold text-white"
          style={{ background: "#047857" }}
        >
          Submit
        </button>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mono text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.14em" }}>{q.tag}</p>
        <p className="mt-1.5 font-bold leading-6">{q.stem}</p>
        <div className="mt-3 grid gap-1.5 text-sm">
          {q.opts.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAnswers((a) => ({ ...a, [idx]: i }))}
              aria-pressed={answers[idx] === i}
              className="rounded-xl px-3 py-2.5 text-left transition-transform hover:-translate-y-px"
              style={answers[idx] === i
                ? { background: "var(--accent)", color: "var(--accent-fg)", fontWeight: 700 }
                : { border: "1px solid var(--border)" }}
            >
              <span className="mono mr-2 text-[11px] opacity-70">{String.fromCharCode(65 + i)}</span>{o}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
          <div className="flex items-center gap-3">
            <button type="button" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="font-semibold disabled:opacity-30" style={{ color: "var(--muted)" }}>← Prev</button>
            <button
              type="button"
              disabled={answers[idx] == null}
              onClick={() => setAnswers((a) => { const n = { ...a }; delete n[idx]; return n; })}
              className="font-semibold disabled:opacity-30"
              style={{ color: "var(--muted)" }}
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 px-1">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Question ${i + 1}${answers[i] != null ? " (answered)" : ""}`}
                aria-current={i === idx ? "true" : undefined}
                className="mono h-9 w-9 rounded-lg text-xs font-bold"
                style={answers[i] != null
                  ? { background: "var(--accent)", color: "var(--accent-fg)" }
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
            disabled={idx === list.length - 1}
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
