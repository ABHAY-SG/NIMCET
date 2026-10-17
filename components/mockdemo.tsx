"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  activePartAt,
  partDeadline,
  partRanges,
  parseParts,
  totalMs,
  RUN_KEY,
  LEGACY_RUN_KEY,
  type ExamPart,
} from "@/lib/exam-parts";
import { PALETTE } from "@/components/mock-instructions";

export type MockQuestion = {
  tag: string; stem: string; opts: string[]; ans?: number;
  plus: number; minus: number; exp?: string;
  qid?: string; section?: string;
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

// Fixed size and maximum score of the built-in sample paper, so hub cards can
// show the real numbers without duplicating the question list.
export const SAMPLE_QUESTION_COUNT = QS.length;
export const SAMPLE_MARKS = QS.reduce((a, q) => a + q.plus, 0);

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtMarks(n: number): string {
  return String(Math.round(n * 10) / 10);
}

type Summary = { score: number; correct: number; wrong: number; skip: number };

// Shape of the sessionStorage run mirror (see RUN_KEY in lib/exam-parts).
type SavedRun = {
  name?: string;
  answers?: Record<string, number>;
  marked?: Record<string, true>;
  idx?: number;
  startAt?: number;
};

type SectionStat = { label: string; qs: number; correct: number; wrong: number; skipped: number; score: number };

// Section-wise table for the scorecard. Returns null unless every submitted
// question is section-labelled AND the detail rows align 1:1 with the list,
// so a partial/incorrect table can never be shown.
function sectionBreakdown(list: Q[], details: SubmitResult["details"]): SectionStat[] | null {
  if (details.length !== list.length) return null;
  const acc = new Map<string, SectionStat>();
  list.forEach((qq, i) => {
    const label = (qq.section ?? "").trim();
    const d = details[i];
    if (!label || !d) return;
    const st = acc.get(label) ?? { label, qs: 0, correct: 0, wrong: 0, skipped: 0, score: 0 };
    st.qs += 1;
    if (d.picked == null) st.skipped += 1;
    else if (d.ok ?? d.picked === d.correct) {
      st.correct += 1;
      st.score += qq.plus;
    } else {
      st.wrong += 1;
      st.score += qq.minus;
    }
    acc.set(label, st);
  });
  if (acc.size === 0) return null;
  let total = 0;
  for (const st of acc.values()) total += st.qs;
  if (total !== list.length) return null;
  return Array.from(acc.values());
}

export default function MockDemo({
  questions,
  title = "SAMPLE MOCK",
  minutes,
  testName,
  autoStart = false,
  onSubmit,
  parts: partSpec,
}: {
  questions?: MockQuestion[];
  title?: string;
  minutes?: number;
  testName?: string;
  autoStart?: boolean;
  onSubmit?: (picks: Record<number, number>) => Promise<SubmitResult>;
  parts?: ExamPart[];
} = {}) {
  const list = questions && questions.length > 0 ? questions : QS;
  const MAX = list.reduce((a, q) => a + q.plus, 0);
  const mins = minutes ?? 12;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState<Record<number, true>>({});
  const [left, setLeft] = useState(mins * 60);
  const [part, setPart] = useState(0);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(autoStart);
  const [serverResult, setServerResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);
  const savedRef = useRef(false);
  const localSavedRef = useRef(false);
  // Wall-clock run start: the timer keeps correct time even if the browser
  // throttles timers in a background tab, and refreshes never pause the clock.
  const startAtRef = useRef<number | null>(null);
  const partRef = useRef(0);
  const persist = !!onSubmit && !!testName;
  // The saved payload is read from sessionStorage exactly once (lazily, on the
  // first restore pass) and remembered here: StrictMode re-runs mount effects,
  // and a second storage read would see the mirror effect's just-written
  // initial state (empty answers) instead of the payload being restored.
  const restoredRef = useRef<SavedRun | null | undefined>(undefined);

  // Optional timed parts (contiguous question blocks with their own clocks,
  // e.g. NIMCET 70/30/20). Invalid data simply keeps the continuous timer.
  const timed = useMemo(() => (partSpec ? parseParts(partSpec, list.length) : null), [partSpec, list.length]);
  const ranges = useMemo(() => (timed ? partRanges(timed) : null), [timed]);
  const examMs = useMemo(() => (timed ? totalMs(timed) : mins * 60_000), [timed, mins]);

  // Restore a run interrupted by refresh/tab-switch (real mocks only).
  /* eslint-disable react-hooks/set-state-in-effect -- post-mount restore from sessionStorage; SSR has no storage to read. */
  useEffect(() => {
    if (!persist) return;
    try {
      sessionStorage.removeItem(LEGACY_RUN_KEY);
    } catch {}
    if (restoredRef.current === undefined) {
      try {
        const raw = sessionStorage.getItem(RUN_KEY);
        restoredRef.current = raw ? (JSON.parse(raw) as SavedRun) : null;
      } catch {
        restoredRef.current = null;
      }
    }
    try {
      const s = restoredRef.current;
      if (!s) return;
      if (s.name !== testName || typeof s.startAt !== "number" || s.startAt + examMs <= Date.now()) {
        sessionStorage.removeItem(RUN_KEY);
        return;
      }
      if (s.answers && typeof s.answers === "object") {
        const restored: Record<number, number> = {};
        for (const [k, v] of Object.entries(s.answers)) {
          const i = Number(k);
          if (Number.isInteger(i) && i >= 0 && i < list.length && Number.isInteger(v) && v >= 0 && v <= 4) restored[i] = v;
        }
        setAnswers(restored);
      }
      if (s.marked && typeof s.marked === "object") {
        const restoredMarked: Record<number, true> = {};
        for (const k of Object.keys(s.marked)) {
          const i = Number(k);
          if (Number.isInteger(i) && i >= 0 && i < list.length) restoredMarked[i] = true;
        }
        setMarked(restoredMarked);
      }
      if (timed && ranges) {
        const ap = activePartAt(timed, Date.now() - s.startAt);
        partRef.current = ap;
        setPart(ap);
        const r = ranges[ap];
        const saved = s.idx;
        setIdx(Number.isInteger(saved) && (saved as number) >= r.start && (saved as number) < r.end ? (saved as number) : r.start);
      } else if (Number.isInteger(s.idx) && (s.idx as number) >= 0 && (s.idx as number) < list.length) {
        setIdx(s.idx as number);
      }
      startAtRef.current = s.startAt;
      setLeft(Math.max(0, Math.ceil((s.startAt + examMs - Date.now()) / 1000)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!started || done) return;
    if (startAtRef.current == null) startAtRef.current = Date.now();
    const tick = () => {
      const startAt = startAtRef.current ?? Date.now();
      const now = Date.now();
      if (timed && ranges) {
        // Timed parts: the visible clock and the reachable question range
        // follow the current part. Expired parts are locked (no going back)
        // and the run auto-submits when the last part ends.
        const ap = activePartAt(timed, now - startAt);
        if (ap !== partRef.current) {
          partRef.current = ap;
          setPart(ap);
          setIdx(ranges[ap].start);
        }
        setLeft(Math.max(0, Math.ceil((partDeadline(timed, startAt, ap) - now) / 1000)));
        if (now - startAt >= totalMs(timed)) setDone(true);
      } else {
        const remaining = Math.max(0, Math.ceil((startAt + examMs - now) / 1000));
        setLeft(remaining);
        if (remaining <= 0) setDone(true);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [started, done, timed, ranges, examMs]);

  // Mirror the run while it is live so a reload cannot silently discard it.
  // Writing on the mount pass is intentional (it persists the run start time
  // immediately); it cannot poison the restore above because that reads the
  // stored payload through restoredRef exactly once.
  useEffect(() => {
    if (!persist || !started || done) return;
    const startAt = startAtRef.current;
    if (startAt == null) return;
    try {
      sessionStorage.setItem(RUN_KEY, JSON.stringify({ name: testName, answers, marked, idx, startAt }));
    } catch {}
  }, [persist, started, done, answers, marked, idx, testName]);

  // Warn before closing the tab mid-test (real mocks only).
  useEffect(() => {
    if (!persist || !started || done) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [persist, started, done]);

  useEffect(() => {
    if (!done) return;
    if (savedRef.current) return;
    savedRef.current = true;
    setTimeTaken((v) => v ?? (startAtRef.current == null ? null : Math.max(0, Math.min(Math.round(examMs / 1000), Math.round((Date.now() - startAtRef.current) / 1000)))));
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
    startAtRef.current = null;
    partRef.current = 0;
    try { sessionStorage.removeItem(RUN_KEY); } catch {}
    setServerResult(null);
    setSubmitError("");
    setAnswers({});
    setMarked({});
    setIdx(0);
    setPart(0);
    setLeft(mins * 60);
    setDone(false);
    setTimeTaken(null);
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
    const secStats = sectionBreakdown(list, r.details);
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
            {timeTaken != null ? ` • TIME ${fmt(timeTaken)}` : ""}
          </p>
          {secStats && (
            <div className="mx-auto mt-4 max-w-md text-left">
              <p className="mono text-[10px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>SECTION-WISE RESULT</p>
              <table className="mt-1.5 w-full text-[12.5px]">
                <thead>
                  <tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
                    <th className="py-1 pr-2 text-left font-bold">SECTION</th>
                    <th className="px-1 py-1 text-right font-bold">Q</th>
                    <th className="px-1 py-1 text-right font-bold">✓</th>
                    <th className="px-1 py-1 text-right font-bold">✗</th>
                    <th className="px-1 py-1 text-right font-bold">SKIP</th>
                    <th className="py-1 pl-2 text-right font-bold">SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {secStats.map((s) => (
                    <tr key={s.label} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="py-1.5 pr-2 font-semibold">{s.label}</td>
                      <td className="mono px-1 py-1.5 text-right">{s.qs}</td>
                      <td className="mono px-1 py-1.5 text-right" style={{ color: "#16a34a" }}>{s.correct}</td>
                      <td className="mono px-1 py-1.5 text-right" style={{ color: "#dc2626" }}>{s.wrong}</td>
                      <td className="mono px-1 py-1.5 text-right" style={{ color: "var(--muted)" }}>{s.skipped}</td>
                      <td className="mono py-1.5 pl-2 text-right font-bold">{fmtMarks(s.score)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "1.5px solid var(--border)" }}>
                    <td className="py-1.5 pr-2 font-extrabold">Total</td>
                    <td className="mono px-1 py-1.5 text-right font-extrabold">{list.length}</td>
                    <td className="mono px-1 py-1.5 text-right font-extrabold">{r.correct}</td>
                    <td className="mono px-1 py-1.5 text-right font-extrabold">{r.wrong}</td>
                    <td className="mono px-1 py-1.5 text-right font-extrabold">{r.skipped}</td>
                    <td className="mono py-1.5 pl-2 text-right font-extrabold">{fmtMarks(r.score)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={reset} className="rounded-full px-5 py-2 text-sm font-bold" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
              Retry →
            </button>
            <Link href="/#pricing" className="rounded-full px-5 py-2 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>
              Unlock all mocks
            </Link>
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
  const cur = ranges ? ranges[part] : null;
  const qPos = cur ? idx - cur.start + 1 : idx + 1;
  const qTotal = cur ? cur.end - cur.start : list.length;
  const atStart = idx === (cur ? cur.start : 0);
  const atEnd = idx === (cur ? cur.end - 1 : list.length - 1);
  const goto = (i: number) => {
    if (cur && (i < cur.start || i >= cur.end)) return;
    setIdx(i);
  };
  const toggleMark = () => {
    setMarked((m) => {
      const next = { ...m };
      if (next[idx]) delete next[idx];
      else next[idx] = true;
      return next;
    });
  };
  const paletteIdx = cur ? list.slice(cur.start, cur.end).map((_, j) => cur.start + j) : list.map((_, i) => i);
  // Navigator counts are scoped to the active section when the paper is
  // sectioned; answered/marked state itself persists across sections.
  const visAnswered = paletteIdx.filter((i) => answers[i] != null).length;
  const visMarked = paletteIdx.filter((i) => !!marked[i]).length;
  const visBoth = paletteIdx.filter((i) => answers[i] != null && !!marked[i]).length;
  const low = left <= 60;
  const cellStyle = (i: number): CSSProperties => {
    const isAns = answers[i] != null;
    const isMark = !!marked[i];
    const base = isAns && isMark ? PALETTE.both : isAns ? PALETTE.answered : isMark ? PALETTE.marked : PALETTE.unanswered;
    const s: CSSProperties = { ...base };
    if (i === idx) s.boxShadow = `${s.boxShadow ? `${s.boxShadow}, ` : ""}0 0 0 2.5px color-mix(in srgb, var(--accent) 55%, transparent)`;
    return s;
  };
  const legend: Array<{ key: keyof typeof PALETTE; label: string; count?: number }> = [
    { key: "current", label: "Current" },
    { key: "unanswered", label: "Unattempted", count: qTotal - visAnswered },
    { key: "answered", label: "Answered", count: visAnswered - visBoth },
    { key: "marked", label: "Marked", count: visMarked - visBoth },
    { key: "both", label: "Answered + marked", count: visBoth },
  ];
  return (
    <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
      {/* Exam top bar: identity, section state, clock, submit */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/logo.png" alt="" aria-hidden className="site-logo block h-6 w-auto" />
          <span className="truncate text-[13px] font-extrabold tracking-tight" style={{ color: "var(--text)" }} title={title}>
            {title}
          </span>
        </div>
        {timed && (
          <div className="order-last flex w-full flex-wrap items-center gap-1.5 sm:order-none sm:ml-2 sm:w-auto">
            {timed.map((p, i) => {
              const active = i === part;
              const finished = i < part;
              return (
                <span
                  key={`${p.label}-${i}`}
                  className="mono inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10.5px] font-bold"
                  aria-current={active ? "step" : undefined}
                  style={active
                    ? { background: "var(--accent)", color: "var(--accent-fg)" }
                    : finished
                      ? { background: "color-mix(in srgb, #16a34a 12%, transparent)", color: "#15803d", border: "1px solid color-mix(in srgb, #16a34a 28%, transparent)" }
                      : { background: "var(--pill)", color: "var(--muted)", border: "1px solid var(--border)" }}
                >
                  {active ? <DotIcon /> : finished ? <CheckIcon /> : <LockIcon />}
                  <span className="max-w-[9.5rem] truncate">{partShort(p.label)}</span>
                </span>
              );
            })}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span
            className="mono inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-extrabold"
            aria-label={`Time left ${fmt(left)}`}
            style={low
              ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }
              : { background: "var(--pill)", color: "var(--accent)", border: "1px solid var(--border)" }}
          >
            <ClockIcon /> {fmt(left)}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Submit the test now?\n\n${answered} of ${list.length} answered. You can't change answers after submitting.`)) return;
              setDone(true);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-extrabold text-white transition-transform hover:-translate-y-px"
            style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
          >
            Submit Test <SendIcon />
          </button>
        </div>
      </div>

      {/* Position strip: question chip + report */}
      <div className="flex items-center justify-between gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--pill) 50%, transparent)" }}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="mono inline-flex items-baseline gap-0.5 rounded-md px-2 py-0.5 text-[13px] font-extrabold" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            Q{qPos}<span className="text-[10px] font-bold opacity-75">/{qTotal}</span>
          </span>
          {timed && (
            <span className="mono truncate text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
              {timed[part].label} • Section {part + 1} of {timed.length}
            </span>
          )}
        </div>
        <a href="/contact" target="_blank" rel="noopener" className="mono shrink-0 text-[11px] font-bold hover:underline" style={{ color: "#dc2626" }}>
          ⚑ Report
        </a>
      </div>

      {/* Question + navigator */}
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0">
          <p className="mono text-[10px] font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.14em" }}>{q.tag}</p>
          <p className="mt-2 text-[15px] font-bold leading-7" style={{ color: "var(--text)" }}>{q.stem}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {q.opts.map((o, i) => {
              const sel = answers[idx] === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setAnswers((a) => {
                      const n = { ...a };
                      if (n[idx] === i) delete n[idx];
                      else n[idx] = i;
                      return n;
                    })
                  }
                  aria-pressed={sel}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition-colors"
                  style={sel
                    ? { border: "1.5px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                    : { border: "1px solid var(--border)", background: "var(--card)" }}
                >
                  <span
                    aria-hidden
                    className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                    style={sel
                      ? { background: "var(--accent)", color: "var(--accent-fg)" }
                      : { background: "var(--pill)", color: "var(--muted)", border: "1px solid var(--border)" }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 flex-1 leading-6" style={{ color: "var(--text)" }}>{o}</span>
                  <span
                    aria-hidden
                    className="h-[18px] w-[18px] shrink-0 rounded-full"
                    style={sel
                      ? { border: "2px solid var(--accent)", boxShadow: "inset 0 0 0 4px var(--accent)" }
                      : { border: "2px solid var(--border)" }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={answers[idx] == null}
              onClick={() => setAnswers((a) => { const n = { ...a }; delete n[idx]; return n; })}
              className="cursor-pointer rounded-full px-4 py-2 text-xs font-bold disabled:cursor-default disabled:opacity-35"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={toggleMark}
              aria-pressed={!!marked[idx]}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"
              style={marked[idx]
                ? { background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e" }
                : { border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              {marked[idx] ? "⚑ Marked for review" : "⚐ Mark for review"}
            </button>
          </div>
        </div>

        <aside className="flex h-fit flex-col gap-3 rounded-xl p-3.5" style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--pill) 45%, transparent)" }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Question Navigator</span>
            <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>{qTotal} Q</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {legend.map((l) => (
              <span key={l.key} className="flex items-center gap-2">
                <span aria-hidden className="shrink-0 rounded-md" style={{ ...PALETTE[l.key], width: 18, height: 18 }} />
                <span className="min-w-0 truncate text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                  {l.label}{l.count != null ? ` (${l.count})` : ""}
                </span>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {paletteIdx.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => goto(i)}
                aria-label={`Question ${(cur ? i - cur.start : i) + 1}${answers[i] != null ? " (answered)" : ""}${marked[i] ? " (marked for review)" : ""}`}
                aria-current={i === idx ? "true" : undefined}
                className="mono h-9 w-9 cursor-pointer rounded-lg text-[12px] font-bold transition-transform hover:-translate-y-px"
                style={cellStyle(i)}
              >
                {(cur ? i - cur.start : i) + 1}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--pill) 40%, transparent)" }}>
        <span className="mono hidden text-[10px] font-bold sm:block" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
          {timed ? `SECTION ${part + 1} OF ${timed.length} • ` : ""}ANSWERED {visAnswered}/{qTotal}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={atStart}
            onClick={() => setIdx(idx - 1)}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-default disabled:opacity-35"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            ← Previous
          </button>
          <button
            type="button"
            disabled={atEnd}
            onClick={() => setIdx(idx + 1)}
            className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-extrabold text-white disabled:cursor-default disabled:opacity-35"
            style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function partShort(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("math")) return "Maths";
  if (l.includes("reason")) return "Reasoning";
  if (l.includes("computer") && l.includes("english")) return "Computers + English";
  if (l.includes("computer")) return "Computers";
  if (l.includes("english")) return "English";
  return label;
}

function DotIcon() {
  return (
    <svg className="h-1.5 w-1.5" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
    </svg>
  );
}
