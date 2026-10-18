"use client";
import { useEffect, useMemo, useState } from "react";
import MockDemo, { type MockQuestion, type SubmitResult } from "@/components/mockdemo";
import MockInstructions, { type SchemeRow } from "@/components/mock-instructions";
import { groupRows, toMock, type BankRow } from "@/lib/question-bank";
import { RUN_KEY, LEGACY_RUN_KEY } from "@/lib/exam-parts";

type Run = {
  qs: MockQuestion[];
  title: string;
  testName: string;
  attemptName: string;
  minutes: number;
};

// Everything the pre-exam instructions page needs, plus the run it will
// launch — resolved once, so Start Test is a pure state flip.
type Setup = {
  title: string;
  minutes: number;
  count: number;
  totalMarks: number;
  scheme: SchemeRow[];
  run: Run;
};

const DIFFS = ["All", "Easy", "Medium", "Hard"] as const;
const COUNTS = [5, 10, 15, 20];
const DURATIONS = [10, 20, 30, 60];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function examLabel(exam: string): string {
  const e = (exam || "").toLowerCase();
  if (e === "nimcet") return "NIMCET";
  if (e === "cuet-pg-mca" || e === "cuet") return "CUET PG";
  return (exam || "").toUpperCase();
}

// The Test Builder: the custom-mock flow that used to sit inside the NIMCET
// hub. It samples straight from the question bank and reuses the same
// instructions → exam → scorecard stages as published mocks.
export default function MockBuilder() {
  const [bank, setBank] = useState<BankRow[]>([]);
  const [ready, setReady] = useState(false);
  const [exam, setExam] = useState("nimcet");
  const [difficulty, setDifficulty] = useState<(typeof DIFFS)[number]>("All");
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(20);
  const [run, setRun] = useState<Run | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRes = await fetch("/api/student/questions?limit=300", { credentials: "same-origin" });
        const qj = (await qRes.json()) as { error?: string; rows?: BankRow[] };
        if (!qRes.ok) throw new Error(qj.error || "Bank load failed.");
        setBank(qj.rows ?? []);
      } catch {}
      setReady(true);
    })();
  }, []);

  const exams = useMemo(() => {
    const set = new Set(bank.map((q) => q.exam).filter(Boolean));
    return ["nimcet", ...Array.from(set).filter((e) => e !== "nimcet")];
  }, [bank]);

  const pool = useMemo(
    () => bank.filter((q) => q.exam === exam && (difficulty === "All" || q.difficulty === difficulty)),
    [bank, exam, difficulty]
  );

  const startCustom = () => {
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    if (picked.length === 0) return;
    const label = `Custom ${examLabel(exam)} mock`;
    const byId = new Map(picked.map((q) => [q.id, q]));
    const scheme: SchemeRow[] = (groupRows(picked.map((q) => q.id), byId) ?? []).map((g) => ({
      label: g.label,
      count: g.count,
      marks: g.marks,
      plus: g.plus,
      minus: g.minus,
    }));
    setSetup({
      title: `${label} (${picked.length} questions)`,
      minutes,
      count: picked.length,
      totalMarks: picked.reduce((s, q) => s + (Number(q.plus) || 0), 0),
      scheme,
      run: {
        qs: picked.map(toMock),
        title: label.toUpperCase(),
        testName: `${label} (${picked.length}Q)`,
        attemptName: `${label} (${picked.length}Q)`,
        minutes,
      },
    });
    window.scrollTo({ top: 0 });
  };

  const submitRun = async (qs: MockQuestion[], attemptName: string, picks: Record<number, number>): Promise<SubmitResult> => {
    const r = await fetch("/api/student/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        test: attemptName,
        answers: qs.map((q, i) => ({ id: q.qid ?? "", answer: picks[i] ?? null })),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j as { error?: string }).error || "Submit failed.");
    return j as SubmitResult;
  };

  const leaveRun = () => {
    if (run && run.qs.length > 0) {
      let inProgress = false;
      try { inProgress = sessionStorage.getItem(RUN_KEY) !== null; } catch {}
      if (inProgress && !window.confirm("Leave this test? Your in-progress run will be discarded.")) return;
      try {
        sessionStorage.removeItem(RUN_KEY);
        sessionStorage.removeItem(LEGACY_RUN_KEY);
      } catch {}
    }
    setRun(null);
  };

  if (run) {
    return (
      <div>
        <button
          type="button"
          onClick={leaveRun}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold transition-transform hover:-translate-x-1"
          style={{ color: "var(--muted)" }}
        >
          <span aria-hidden>←</span> Back to builder
        </button>
        <MockDemo
          key={`${run.testName}-${run.qs.length}`}
          questions={run.qs}
          title={run.title}
          minutes={run.minutes}
          testName={run.testName}
          autoStart
          onSubmit={(picks) => submitRun(run.qs, run.attemptName, picks)}
        />
      </div>
    );
  }

  if (setup) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSetup(null)}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold transition-transform hover:-translate-x-1"
          style={{ color: "var(--muted)" }}
        >
          <span aria-hidden>←</span> Back to builder
        </button>
        <MockInstructions
          title={setup.title}
          minutes={setup.minutes}
          count={setup.count}
          totalMarks={setup.totalMarks}
          scheme={setup.scheme}
          timed={false}
          instructions=""
          onStart={() => {
            setRun(setup.run);
            setSetup(null);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  return (
    <section className="rounded-2xl px-5 py-5" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}>
      <h2 className="dash-display text-lg font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Create a custom mock</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
        Pick an exam, difficulty and size — questions come straight from the bank{bank.length > 0 ? ` (${bank.length} loaded)` : ""}.
      </p>
      {!ready ? (
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>Loading question bank…</p>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "var(--text)" }}>Exam</span>
            <select value={exam} onChange={(e) => setExam(e.target.value)}
              className="w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2"
              style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {exams.map((e) => (
                <option key={e} value={e}>{examLabel(e)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "var(--text)" }}>Difficulty</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as (typeof DIFFS)[number])}
              className="w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2"
              style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {DIFFS.map((d) => (
                <option key={d} value={d}>{d === "All" ? "All levels" : d}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "var(--text)" }}>Questions</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}
              className="w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2"
              style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {COUNTS.map((c) => (
                <option key={c} value={c}>{c} questions</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "var(--text)" }}>Minutes</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2"
              style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={startCustom}
              disabled={pool.length === 0}
              className="w-full cursor-pointer rounded-xl py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px disabled:opacity-50"
              style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))" }}
            >
              {pool.length === 0 ? "No questions" : `Start (${Math.min(count, pool.length)}Q)`}
            </button>
          </div>
        </div>
      )}
      {ready && pool.length === 0 && (
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          Nothing in the bank for this filter yet — try another exam or difficulty.
        </p>
      )}
    </section>
  );
}
