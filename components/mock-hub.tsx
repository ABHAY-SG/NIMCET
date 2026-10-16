"use client";
import { useEffect, useMemo, useState } from "react";
import MockDemo, { type MockQuestion } from "@/components/mockdemo";
import { getSupabase } from "@/lib/supabase";

type BankRow = {
  id: string;
  exam: string;
  section: string;
  difficulty: string;
  stem: string;
  options: string[];
  plus: number;
  minus: number;
};

type Test = {
  id: string;
  exam: string;
  title: string;
  tag: string;
  minutes: number;
  free: boolean;
  published: boolean;
  question_ids: string[];
};

type Run = { qs: MockQuestion[]; title: string; testName: string; minutes: number };

function toMock(q: BankRow): MockQuestion {
  return {
    qid: q.id,
    tag: `${q.section.toUpperCase()} • +${q.plus} / ${q.minus}`,
    stem: q.stem,
    opts: q.options,
    plus: q.plus,
    minus: q.minus,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIFFS = ["All", "Easy", "Medium", "Hard"] as const;
const KINDS = ["All", "Free", "Premium", "Attempted"] as const;
const COUNTS = [5, 10, 15, 20];
const DURATIONS = [10, 20, 30, 60];

export default function MockHub({ attempted }: { attempted: Record<string, number> }) {
  const [tests, setTests] = useState<Test[]>([]);
  const [bank, setBank] = useState<BankRow[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [exam, setExam] = useState("nimcet");
  const [difficulty, setDifficulty] = useState<(typeof DIFFS)[number]>("All");
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(20);
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: tdata, error: tErr } = await sb
          .from("tests")
          .select("id,exam,title,tag,minutes,free,published,question_ids")
          .eq("published", true)
          .limit(30);
        if (tErr) throw tErr;
        const qRes = await fetch("/api/student/questions?limit=300", { credentials: "same-origin" });
        const qj = (await qRes.json()) as { error?: string; rows?: BankRow[] };
        if (!qRes.ok) throw new Error(qj.error || "Bank load failed.");
        if (tdata) setTests(tdata as Test[]);
        setBank(qj.rows ?? []);
      } catch {}
      setReady(true);
    })();
  }, []);

  const plusOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of bank) m.set(q.id, Number(q.plus) || 0);
    return m;
  }, [bank]);

  const marksOf = (t: Test) => t.question_ids.reduce((s, id) => s + (plusOf.get(id) ?? 0), 0);

  const exams = useMemo(() => {
    const set = new Set(bank.map((q) => q.exam).filter(Boolean));
    return ["nimcet", ...Array.from(set).filter((e) => e !== "nimcet")];
  }, [bank]);

  const pool = useMemo(
    () => bank.filter((q) => q.exam === exam && (difficulty === "All" || q.difficulty === difficulty)),
    [bank, exam, difficulty]
  );

  const visibleTests = tests.filter((t) => {
    if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (kind === "Free" && !t.free) return false;
    if (kind === "Premium" && t.free) return false;
    if (kind === "Attempted" && !(attempted[t.title] > 0)) return false;
    return true;
  });

  const startTest = async (t: Test) => {
    // Prefer the bank copy (already loaded); fetch any missing ids.
    const byId = new Map(bank.map((q) => [q.id, q]));
    const missing = t.question_ids.filter((id) => !byId.has(id));
    let rows: BankRow[] = t.question_ids.map((id) => byId.get(id)).filter((q): q is BankRow => !!q);
    if (missing.length > 0) {
      try {
        const qRes = await fetch(`/api/student/questions?ids=${missing.slice(0, 200).join(",")}`, {
          credentials: "same-origin",
        });
        const qj = (await qRes.json()) as { error?: string; rows?: BankRow[] };
        if (!qRes.ok) throw new Error(qj.error || "Load failed.");
        for (const q of qj.rows ?? []) {
          byId.set(q.id, q);
        }
        rows = t.question_ids.map((id) => byId.get(id)).filter((q): q is BankRow => !!q);
      } catch {}
    }
    if (rows.length === 0) return;
    setRun({
      qs: rows.map(toMock),
      title: t.title.toUpperCase(),
      testName: `${t.title} (${rows.length}Q)`,
      minutes: t.minutes || Math.max(10, rows.length),
    });
    window.scrollTo({ top: 0 });
  };

  const startCustom = () => {
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    if (picked.length === 0) return;
    setRun({
      qs: picked.map(toMock),
      title: "CUSTOM MOCK",
      testName: `Custom ${examLabel(exam)} mock (${picked.length}Q)`,
      minutes,
    });
    window.scrollTo({ top: 0 });
  };

  const submitRun = async (qs: MockQuestion[], testName: string, picks: Record<number, number>) => {
    const r = await fetch("/api/student/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        test: testName,
        answers: qs.map((q, i) => ({ id: q.qid ?? "", answer: picks[i] ?? null })),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j as { error?: string }).error || "Submit failed.");
    return j as { score: number; correct: number; wrong: number; skipped: number; details: Array<{ stem: string; opts: string[]; picked: number | null; correct: number; exp: string; ok?: boolean }> };
  };

  if (run) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setRun(null)}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold transition-transform hover:-translate-x-1"
          style={{ color: "var(--muted)" }}
        >
          <span aria-hidden>←</span> Back to mocks
        </button>
        <MockDemo
          key={`${run.testName}-${run.qs.length}`}
          questions={run.qs}
          title={run.title}
          minutes={run.minutes}
          testName={run.testName}
          autoStart
          onSubmit={(picks) => submitRun(run.qs, run.testName, picks)}
        />
      </div>
    );
  }

  return (
    <div>
      <section
        className="relative overflow-hidden rounded-[26px] px-6 py-8 text-white sm:px-10"
        style={{ background: "linear-gradient(120deg, #0f766e 0%, #15803d 45%, #1d4ed8 130%)", boxShadow: "0 40px 90px -35px rgba(13, 60, 60, 0.7)" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 220px at 85% 0%, rgba(255,255,255,0.16), transparent 65%)" }} />
        <h1 className="dash-display relative text-3xl font-extrabold tracking-tight sm:text-4xl">NIMCET Mock Tests</h1>
        <p className="relative mt-2 max-w-xl text-sm leading-6" style={{ color: "rgba(255,255,255,0.85)" }}>
          Master NIMCET with mock tests — your path to success starts here!
        </p>
        <div className="relative mt-5 flex flex-col gap-2.5 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tests…"
            aria-label="Search tests"
            className="min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2"
            style={{ background: "rgba(255,255,255,0.95)" }}
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
            aria-label="Filter tests"
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 outline-none"
            style={{ background: "rgba(255,255,255,0.95)" }}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{k === "All" ? "All tests" : k}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-white px-5 py-5" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}>
        <h2 className="dash-display text-lg font-extrabold tracking-tight" style={{ color: "#1e2952" }}>Create your first mock</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Pick an exam, difficulty and size — questions come straight from the bank{bank.length > 0 ? ` (${bank.length} loaded)` : ""}.
        </p>
        {!ready ? (
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>Loading question bank…</p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "#1e2952" }}>Exam</span>
              <select value={exam} onChange={(e) => setExam(e.target.value)}
                className="w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2"
                style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {exams.map((e) => (
                  <option key={e} value={e}>{examLabel(e)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "#1e2952" }}>Difficulty</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as (typeof DIFFS)[number])}
                className="w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2"
                style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {DIFFS.map((d) => (
                  <option key={d} value={d}>{d === "All" ? "All levels" : d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "#1e2952" }}>Questions</span>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                className="w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2"
                style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {COUNTS.map((c) => (
                  <option key={c} value={c}>{c} questions</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-bold" style={{ color: "#1e2952" }}>Minutes</span>
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
                style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
              >
                {pool.length === 0 ? "No questions" : `Start (${Math.min(count, pool.length)}Q)`}
              </button>
            </div>
          </div>
        )}
        {ready && pool.length === 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Nothing in the bank for this filter yet — the free sample below always works.
          </p>
        )}
      </section>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleTests.map((t) => {
          const done = attempted[t.title] ?? 0;
          const qcount = Array.isArray(t.question_ids) ? t.question_ids.length : 0;
          const marks = marksOf(t);
          return (
            <div
              key={t.id}
              className="relative flex flex-col overflow-hidden rounded-2xl bg-white px-5 py-5"
              style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
            >
              <span aria-hidden className="absolute bottom-0 left-0 top-0 w-1.5" style={{ background: "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }} />
              <div className="flex items-center gap-2">
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-xl text-base" style={{ background: "#fef3c7", color: "#d97706" }}>🏅</span>
                <h3 className="truncate text-[15px] font-extrabold" style={{ color: "#1e2952" }} title={t.title}>{t.title}</h3>
                {done > 0 && (
                  <span className="mono ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                    ×{done}
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                <span style={{ color: "var(--muted)" }}>❓ <strong className="mono" style={{ color: "#1e2952" }}>{qcount}</strong> Questions</span>
                <span style={{ color: "var(--muted)" }}>🕒 <strong className="mono" style={{ color: "#1e2952" }}>{t.minutes}</strong> Minutes</span>
                <span style={{ color: "var(--muted)" }}>🏆 <strong className="mono" style={{ color: "#1e2952" }}>{marks}</strong> Marks</span>
                <span style={{ color: t.free ? "#16a34a" : "#d97706", fontWeight: 800 }}>{t.free ? "FREE" : "PREMIUM"}</span>
              </div>
              <button
                type="button"
                onClick={() => startTest(t)}
                className="mt-4 w-full cursor-pointer rounded-xl py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px"
                style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
              >
                ▶ Start Test
              </button>
            </div>
          );
        })}
        {visibleTests.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm sm:col-span-2 xl:col-span-3" style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}>
            {query || kind !== "All"
              ? "No tests match this filter — clear the search or pick another filter."
              : "No published mocks yet — build a custom one above or try the free sample below."}
          </div>
        )}
        <div
          className="relative flex flex-col overflow-hidden rounded-2xl bg-white px-5 py-5"
          style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
        >
          <span aria-hidden className="absolute bottom-0 left-0 top-0 w-1.5" style={{ background: "#16a34a" }} />
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-xl text-base" style={{ background: "#dcfce7", color: "#16a34a" }}>🆓</span>
            <h3 className="text-[15px] font-extrabold" style={{ color: "#1e2952" }}>Free sample mock</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
            <span style={{ color: "var(--muted)" }}>❓ <strong className="mono" style={{ color: "#1e2952" }}>12</strong> Questions</span>
            <span style={{ color: "var(--muted)" }}>🕒 <strong className="mono" style={{ color: "#1e2952" }}>12</strong> Minutes</span>
          </div>
          <button
            type="button"
            onClick={() => setRun({ qs: [], title: "SAMPLE MOCK", testName: "Free sample mock (12Q)", minutes: 12 })}
            className="mt-4 w-full cursor-pointer rounded-xl py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px"
            style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
          >
            ▶ Start Test
          </button>
        </div>
      </div>
    </div>
  );
}

function examLabel(exam: string): string {
  const e = (exam || "").toLowerCase();
  if (e === "nimcet") return "NIMCET";
  if (e === "cuet-pg-mca" || e === "cuet") return "CUET PG";
  return (exam || "").toUpperCase();
}
