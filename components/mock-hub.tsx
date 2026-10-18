"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import MockDemo, { SAMPLE_MARKS, SAMPLE_QUESTION_COUNT, type MockQuestion } from "@/components/mockdemo";
import MockCard from "@/components/mock-card";
import MockExam from "@/components/mock-exam";
import MockInstructions, { type SchemeRow } from "@/components/mock-instructions";
import { getSupabase } from "@/lib/supabase";
import { parseParts, partRanges, RUN_KEY, LEGACY_RUN_KEY, type ExamPart } from "@/lib/exam-parts";
import {
  FULL_MOCK_MAX_MARKS,
  FULL_MOCK_MINUTES,
  FULL_MOCK_QUESTIONS,
  isFullMockTemplate,
  partNote,
  SUBJECTS,
  templateParts,
} from "@/lib/nimcet-full-mock";

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
  description: string;
  instructions: string;
  sections?: unknown;
  template?: string;
};

type Run = {
  qs: MockQuestion[];
  title: string;
  testName: string;
  attemptName: string;
  testId?: string;
  minutes: number;
  parts?: ExamPart[];
  /** Server-enforced template exam (NIMCET full mock) — run by MockExam. */
  serverExam?: boolean;
};

// Everything the pre-exam instructions page needs, plus the run it will
// launch — resolved once, so Start Test is a pure state flip.
type Setup = {
  title: string;
  minutes: number;
  count: number;
  totalMarks: number;
  scheme: SchemeRow[];
  timed: boolean;
  instructions: string;
  run: Run;
  /** Server-enforced template exam — instructions switch to server wording. */
  serverMode?: boolean;
};

type SectionGroup = { label: string; count: number; marks: number; plus: number; minus: number };

function toTest(raw: Record<string, unknown>): Test {
  return {
    id: String(raw.id ?? ""),
    exam: String(raw.exam ?? ""),
    title: String(raw.title ?? ""),
    tag: String(raw.tag ?? ""),
    minutes: Number(raw.minutes) || 0,
    free: Boolean(raw.free),
    published: Boolean(raw.published),
    question_ids: Array.isArray(raw.question_ids)
      ? (raw.question_ids as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    description: typeof raw.description === "string" ? raw.description : "",
    instructions: typeof raw.instructions === "string" ? raw.instructions : "",
    sections: raw.sections,
    template: typeof raw.template === "string" ? raw.template : "",
  };
}

function toMock(q: BankRow): MockQuestion {
  return {
    qid: q.id,
    tag: `${q.section.toUpperCase()} • +${q.plus} / ${q.minus}`,
    stem: q.stem,
    opts: q.options,
    plus: q.plus,
    minus: q.minus,
    section: q.section,
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

// Level badge for a test card: the dominant difficulty of its questions, or
// "Mixed" when no single level holds a clear majority. "—" until the test's
// rows are available.
function dominantDifficulty(ids: string[], byId: Map<string, BankRow>): string {
  const counts = new Map<string, number>();
  let total = 0;
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) continue;
    const d = (q.difficulty || "").trim();
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return "—";
  let best = "";
  let bestN = 0;
  for (const [d, n] of counts) {
    if (n > bestN) {
      best = d;
      bestN = n;
    }
  }
  if (bestN / total < 0.55) return "Mixed";
  return best.charAt(0).toUpperCase() + best.slice(1);
}

// Groups a test's questions into ordered section buckets. Returns null while
// any referenced question is unresolved, so partial data is never shown as a
// complete breakdown.
function groupRows(ids: string[], byId: Map<string, BankRow>): SectionGroup[] | null {
  const groups: SectionGroup[] = [];
  const index = new Map<string, number>();
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) return null;
    const label = (q.section || "General").trim();
    const at = index.get(label);
    let g = at === undefined ? undefined : groups[at];
    if (!g) {
      g = { label, count: 0, marks: 0, plus: Number(q.plus) || 0, minus: Number(q.minus) || 0 };
      index.set(label, groups.length);
      groups.push(g);
    }
    g.count += 1;
    g.marks += Number(q.plus) || 0;
  }
  return groups;
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
  const [setup, setSetup] = useState<Setup | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: tdata, error: tErr } = await sb
          .from("tests")
          .select("*")
          .eq("published", true)
          // Newest first so newly created mocks always surface; the cap is
          // generous enough for the whole catalogue to stay browsable.
          .order("created_at", { ascending: false })
          .limit(60);
        if (tErr) throw tErr;
        const qRes = await fetch("/api/student/questions?limit=300", { credentials: "same-origin" });
        const qj = (await qRes.json()) as { error?: string; rows?: BankRow[] };
        if (!qRes.ok) throw new Error(qj.error || "Bank load failed.");
        if (tdata) setTests((tdata as unknown as Array<Record<string, unknown>>).map(toTest));
        setBank(qj.rows ?? []);
      } catch {}
      setReady(true);
    })();
  }, []);

  const bankById = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);

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

  // Prefer the bank copy (already loaded); fetch any missing ids.
  const resolveRows = useCallback(
    async (t: Test): Promise<BankRow[]> => {
      const byId = new Map(bank.map((q) => [q.id, q]));
      const missing = t.question_ids.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        try {
          const qRes = await fetch(`/api/student/questions?ids=${missing.slice(0, 200).join(",")}`, {
            credentials: "same-origin",
          });
          const qj = (await qRes.json()) as { error?: string; rows?: BankRow[] };
          if (!qRes.ok) throw new Error(qj.error || "Load failed.");
          for (const q of qj.rows ?? []) byId.set(q.id, q);
        } catch {}
      }
      return t.question_ids.map((id) => byId.get(id)).filter((q): q is BankRow => !!q);
    },
    [bank]
  );

  // Resolves a published test and opens its two-page instructions flow. The
  // ready-to-run payload travels with the setup so Start Test is instant.
  const openSetup = async (t: Test) => {
    if (isFullMockTemplate(t.template)) {
      // Template exams are server-run: the paper structure comes straight from
      // the template (no bank prefetch) and the server serves each timed
      // section only when its window opens.
      const parts = templateParts();
      const scheme: SchemeRow[] = parts.map((p, i) => {
        const subs = SUBJECTS.filter((s) => s.part === i);
        return {
          label: p.label,
          count: p.count,
          marks: subs.reduce((sum, s) => sum + s.count * s.plus, 0),
          plus: subs[0]?.plus ?? 0,
          minus: subs[0]?.minus ?? 0,
          minutes: p.minutes,
          note: partNote(i) || undefined,
        };
      });
      setSetup({
        title: t.title,
        minutes: FULL_MOCK_MINUTES,
        count: FULL_MOCK_QUESTIONS,
        totalMarks: FULL_MOCK_MAX_MARKS,
        scheme,
        timed: true,
        instructions: t.instructions || "",
        serverMode: true,
        run: {
          qs: [],
          title: t.title.toUpperCase(),
          testName: `${t.title} (${FULL_MOCK_QUESTIONS}Q)`,
          attemptName: t.title,
          testId: t.id,
          minutes: FULL_MOCK_MINUTES,
          parts,
          serverExam: true,
        },
      });
      window.scrollTo({ top: 0 });
      return;
    }
    setPendingId(t.id);
    window.scrollTo({ top: 0 });
    const rows = await resolveRows(t);
    setPendingId(null);
    if (rows.length === 0) return;
    const parts = parseParts(t.sections, t.question_ids.length) ?? undefined;
    const ranges = parts ? partRanges(parts) : null;
    const byId = new Map(rows.map((q) => [q.id, q]));
    const scheme: SchemeRow[] = parts && ranges
      ? parts.map((p, i) => {
          const r = ranges[i];
          let marks = 0;
          let plus = 0;
          let minus = 0;
          for (let j = r.start; j < r.end; j++) {
            const q = byId.get(t.question_ids[j]);
            if (!q) continue;
            marks += Number(q.plus) || 0;
            if (j === r.start) {
              plus = Number(q.plus) || 0;
              minus = Number(q.minus) || 0;
            }
          }
          return { label: p.label, count: p.count, marks, plus, minus, minutes: p.minutes };
        })
      : (groupRows(t.question_ids, byId) ?? []).map((g) => ({ label: g.label, count: g.count, marks: g.marks, plus: g.plus, minus: g.minus }));
    const minutes = parts ? parts.reduce((s, p) => s + p.minutes, 0) : t.minutes || Math.max(10, rows.length);
    setSetup({
      title: t.title,
      minutes,
      count: rows.length,
      totalMarks: rows.reduce((s, q) => s + (Number(q.plus) || 0), 0),
      scheme,
      timed: !!parts,
      instructions: t.instructions || "",
      run: {
        qs: rows.map(toMock),
        title: t.title.toUpperCase(),
        testName: `${t.title} (${rows.length}Q)`,
        // The plain title is what attempt history stores and what the
        // dashboard matches tests against; the "(NQ)" form is display-only.
        attemptName: t.title,
        testId: t.id,
        minutes,
        parts,
      },
    });
  };

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
      timed: false,
      instructions: "",
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

  const submitRun = async (qs: MockQuestion[], attemptName: string, testId: string | undefined, picks: Record<number, number>) => {
    const r = await fetch("/api/student/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        test: attemptName,
        testId,
        answers: qs.map((q, i) => ({ id: q.qid ?? "", answer: picks[i] ?? null })),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j as { error?: string }).error || "Submit failed.");
    return j as { score: number; correct: number; wrong: number; skipped: number; details: Array<{ stem: string; opts: string[]; picked: number | null; correct: number; exp: string; ok?: boolean }> };
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
    if (run.serverExam && run.testId) {
      return (
        <div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Leave the exam? The server clock keeps running — you can resume before the section ends.")) leaveRun();
            }}
            className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold transition-transform hover:-translate-x-1"
            style={{ color: "var(--muted)" }}
          >
            <span aria-hidden>←</span> Back to mocks
          </button>
          <MockExam testId={run.testId} title={run.testName} onExit={leaveRun} />
        </div>
      );
    }
    return (
      <div>
        <button
          type="button"
          onClick={leaveRun}
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
          parts={run.parts}
          onSubmit={run.qs.length > 0 ? (picks) => submitRun(run.qs, run.attemptName, run.testId, picks) : undefined}
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
          <span aria-hidden>←</span> Back to mocks
        </button>
        <MockInstructions
          title={setup.title}
          minutes={setup.minutes}
          count={setup.count}
          totalMarks={setup.totalMarks}
          scheme={setup.scheme}
          timed={setup.timed}
          instructions={setup.instructions}
          serverMode={setup.serverMode}
          onStart={() => {
            setRun(setup.run);
            setSetup(null);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  if (pendingId) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl p-10" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="h-6 w-6 animate-spin rounded-full" style={{ border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
        <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>Preparing your instructions…</p>
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

      <section className="mt-4 rounded-2xl px-5 py-5" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}>
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
            Nothing in the bank for this filter yet — the free sample below always works.
          </p>
        )}
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleTests.map((t) => {
          const done = attempted[t.title] ?? 0;
          return (
            <MockCard
              key={t.id}
              title={t.title}
              questions={Array.isArray(t.question_ids) ? t.question_ids.length : 0}
              minutes={t.minutes}
              marks={marksOf(t)}
              difficulty={dominantDifficulty(t.question_ids, bankById)}
              tag={t.tag}
              free={t.free}
              attempted={done}
              onStart={() => openSetup(t)}
            />
          );
        })}
        {visibleTests.length === 0 && (
          <div className="rounded-2xl p-6 text-center text-sm sm:col-span-2 xl:col-span-3" style={{ background: "var(--card)", border: "1px dashed var(--border)", color: "var(--muted)" }}>
            {query || kind !== "All"
              ? "No tests match this filter — clear the search or pick another filter."
              : "No published mocks yet — build a custom one above or try the free sample below."}
          </div>
        )}
        <MockCard
          title="Free sample mock"
          questions={SAMPLE_QUESTION_COUNT}
          minutes={12}
          marks={SAMPLE_MARKS}
          difficulty="Mixed"
          tag="Sample"
          free
          attempted={0}
          icon="🆓"
          iconBg="#dcfce7"
          iconFg="#15803d"
          onStart={() => setRun({ qs: [], title: "SAMPLE MOCK", testName: "Free sample mock (12Q)", attemptName: "Free sample mock (12Q)", minutes: 12 })}
        />
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
