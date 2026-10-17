"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import MockDemo, { type MockQuestion } from "@/components/mockdemo";
import { getSupabase } from "@/lib/supabase";
import { parseParts, partRanges, RUN_KEY, LEGACY_RUN_KEY, type ExamPart } from "@/lib/exam-parts";

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
};

type Run = { qs: MockQuestion[]; title: string; testName: string; attemptName: string; testId?: string; minutes: number; parts?: ExamPart[] };

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

function fmtMarks(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function shortLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("math")) return "Maths";
  if (l.includes("reason")) return "Reasoning";
  if (l.includes("computer") && l.includes("english")) return "Computers + English";
  if (l.includes("computer")) return "Computers";
  if (l.includes("english")) return "English";
  return label;
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
  const [detail, setDetail] = useState<Test | null>(null);
  const [detailRows, setDetailRows] = useState<BankRow[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: tdata, error: tErr } = await sb
          .from("tests")
          .select("*")
          .eq("published", true)
          .limit(30);
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

  const startTest = async (t: Test) => {
    const rows = await resolveRows(t);
    if (rows.length === 0) return;
    const parts = parseParts(t.sections, t.question_ids.length) ?? undefined;
    setRun({
      qs: rows.map(toMock),
      title: t.title.toUpperCase(),
      testName: `${t.title} (${rows.length}Q)`,
      // The plain title is what attempt history stores and what the
      // dashboard matches tests against; the "(NQ)" form is display-only.
      attemptName: t.title,
      testId: t.id,
      minutes: parts ? parts.reduce((s, p) => s + p.minutes, 0) : t.minutes || Math.max(10, rows.length),
      parts,
    });
    window.scrollTo({ top: 0 });
  };

  const openDetail = (t: Test) => {
    setDetail(t);
    setDetailRows(null);
    resolveRows(t)
      .then((rows) => setDetailRows(rows))
      .catch(() => setDetailRows([]));
  };

  const startCustom = () => {
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    if (picked.length === 0) return;
    setRun({
      qs: picked.map(toMock),
      title: "CUSTOM MOCK",
      testName: `Custom ${examLabel(exam)} mock (${picked.length}Q)`,
      attemptName: `Custom ${examLabel(exam)} mock (${picked.length}Q)`,
      minutes,
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

  if (detail) {
    const ids = detail.question_ids;
    const byId = new Map((detailRows ?? []).map((q) => [q.id, q]));
    const rowsReady = detailRows !== null && detailRows.length === ids.length;
    const groups = rowsReady ? groupRows(ids, byId) : null;
    const parts = parseParts(detail.sections, ids.length);
    const ranges = parts ? partRanges(parts) : null;
    const maxMarks = groups ? groups.reduce((s, g) => s + g.marks, 0) : marksOf(detail);
    const partStats = parts && ranges && rowsReady
      ? parts.map((p, i) => {
          const r = ranges[i];
          let marks = 0;
          let plus = 0;
          let minus = 0;
          for (let j = r.start; j < r.end; j++) {
            const q = byId.get(ids[j]);
            if (!q) continue;
            marks += Number(q.plus) || 0;
            if (j === r.start) {
              plus = Number(q.plus) || 0;
              minus = Number(q.minus) || 0;
            }
          }
          return { label: p.label, count: p.count, minutes: p.minutes, marks, plus, minus };
        })
      : null;
    return (
      <div>
        <button
          type="button"
          onClick={() => { setDetail(null); setDetailRows(null); }}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-bold transition-transform hover:-translate-x-1"
          style={{ color: "var(--muted)" }}
        >
          <span aria-hidden>←</span> Back to mocks
        </button>
        <section
          className="overflow-hidden rounded-2xl px-5 py-6 sm:px-7"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>{examLabel(detail.exam)}</span>
            {detail.tag && (
              <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>{detail.tag}</span>
            )}
            <span className="mono text-[10px] font-extrabold" style={{ color: detail.free ? "#16a34a" : "#d97706" }}>{detail.free ? "FREE" : "PREMIUM"}</span>
          </div>
          <h2 className="dash-display mt-2 text-xl font-extrabold tracking-tight sm:text-2xl" style={{ color: "var(--text)" }}>{detail.title}</h2>
          {detail.description && (
            <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--muted)" }}>{detail.description}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
            <span style={{ color: "var(--muted)" }}>❓ <strong className="mono" style={{ color: "var(--text)" }}>{ids.length}</strong> Questions</span>
            <span style={{ color: "var(--muted)" }}>🕒 <strong className="mono" style={{ color: "var(--text)" }}>{detail.minutes}</strong> Minutes</span>
            <span style={{ color: "var(--muted)" }}>🏆 <strong className="mono" style={{ color: "var(--text)" }}>{fmtMarks(maxMarks)}</strong> Marks</span>
            <span style={{ color: "var(--muted)" }}>🎯 <strong className="mono" style={{ color: "var(--text)" }}>{partStats ? partStats.length : groups ? groups.length : "—"}</strong> Sections</span>
          </div>

          {detailRows === null ? (
            <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>Loading section details…</p>
          ) : partStats ? (
            <div className="mt-4">
              <p className="mono text-[10px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>SECTION-WISE SCHEDULE &amp; MARKING</p>
              <div className="admin-scroll mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead>
                    <tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
                      <th className="py-1.5 pr-3 text-left font-bold">SECTION</th>
                      <th className="px-2 py-1.5 text-right font-bold">QUESTIONS</th>
                      <th className="px-2 py-1.5 text-right font-bold">MARKS</th>
                      <th className="px-2 py-1.5 text-right font-bold">MARKING</th>
                      <th className="py-1.5 pl-3 text-right font-bold">TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partStats.map((p) => (
                      <tr key={p.label} style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                        <td className="py-2 pr-3 font-semibold">{p.label}</td>
                        <td className="mono px-2 py-2 text-right">{p.count}</td>
                        <td className="mono px-2 py-2 text-right">{fmtMarks(p.marks)}</td>
                        <td className="mono px-2 py-2 text-right">+{p.plus} / {p.minus}</td>
                        <td className="mono py-2 pl-3 text-right">{p.minutes} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : groups ? (
            <div className="mt-4">
              <p className="mono text-[10px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>SUBJECT BREAKDOWN</p>
              <div className="admin-scroll mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-[13px]">
                  <thead>
                    <tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
                      <th className="py-1.5 pr-3 text-left font-bold">SUBJECT</th>
                      <th className="px-2 py-1.5 text-right font-bold">QUESTIONS</th>
                      <th className="px-2 py-1.5 text-right font-bold">MARKS</th>
                      <th className="py-1.5 pl-3 text-right font-bold">MARKING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.label} style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                        <td className="py-2 pr-3 font-semibold">{g.label}</td>
                        <td className="mono px-2 py-2 text-right">{g.count}</td>
                        <td className="mono px-2 py-2 text-right">{fmtMarks(g.marks)}</td>
                        <td className="mono py-2 pl-3 text-right">+{g.plus} / {g.minus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {detail.instructions && (
            <div className="mt-4 rounded-xl px-3.5 py-3 text-[13px] leading-6" style={{ background: "var(--pill)", color: "var(--text)" }}>
              <span className="mono mb-1 block text-[10px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>Examination instructions</span>
              <span className="whitespace-pre-line">{detail.instructions}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setDetail(null); setDetailRows(null); startTest(detail); }}
            className="mt-5 w-full cursor-pointer rounded-xl py-3 text-sm font-extrabold text-white transition-transform hover:-translate-y-px sm:w-auto sm:px-10"
            style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
          >
            ▶ Start Test
          </button>
        </section>
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
        <h2 className="dash-display text-lg font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Create your first mock</h2>
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
          const chips = qcount > 0 ? groupRows(t.question_ids, bankById) : null;
          return (
            <div
              key={t.id}
              className="relative flex flex-col overflow-hidden rounded-2xl px-5 py-5"
              style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
            >
              <span aria-hidden className="absolute bottom-0 left-0 top-0 w-1.5" style={{ background: "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }} />
              <div className="flex items-center gap-2">
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-xl text-base" style={{ background: "#fef3c7", color: "#d97706" }}>🏅</span>
                <h3 className="truncate text-[15px] font-extrabold" style={{ color: "var(--text)" }} title={t.title}>{t.title}</h3>
                {done > 0 && (
                  <span className="mono ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                    ×{done}
                  </span>
                )}
              </div>
              {t.tag && (
                <span className="mono mt-1.5 self-start rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                  {t.tag}
                </span>
              )}
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                <span style={{ color: "var(--muted)" }}>❓ <strong className="mono" style={{ color: "var(--text)" }}>{qcount}</strong> Questions</span>
                <span style={{ color: "var(--muted)" }}>🕒 <strong className="mono" style={{ color: "var(--text)" }}>{t.minutes}</strong> Minutes</span>
                <span style={{ color: "var(--muted)" }}>🏆 <strong className="mono" style={{ color: "var(--text)" }}>{marks}</strong> Marks</span>
                <span style={{ color: t.free ? "#16a34a" : "#d97706", fontWeight: 800 }}>{t.free ? "FREE" : "PREMIUM"}</span>
              </div>
              {chips && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span key={c.label} className="mono rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                      {shortLabel(c.label)} {c.count}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => startTest(t)}
                  className="flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px"
                  style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
                >
                  ▶ Start Test
                </button>
                <button
                  type="button"
                  onClick={() => openDetail(t)}
                  className="cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-extrabold transition-transform hover:-translate-y-px"
                  style={{ border: "1px solid var(--border)", color: "var(--text)" }}
                >
                  Details
                </button>
              </div>
            </div>
          );
        })}
        {visibleTests.length === 0 && (
          <div className="rounded-2xl p-6 text-center text-sm sm:col-span-2 xl:col-span-3" style={{ background: "var(--card)", border: "1px dashed var(--border)", color: "var(--muted)" }}>
            {query || kind !== "All"
              ? "No tests match this filter — clear the search or pick another filter."
              : "No published mocks yet — build a custom one above or try the free sample below."}
          </div>
        )}
        <div
          className="relative flex flex-col overflow-hidden rounded-2xl px-5 py-5"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
        >
          <span aria-hidden className="absolute bottom-0 left-0 top-0 w-1.5" style={{ background: "#16a34a" }} />
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-xl text-base" style={{ background: "#dcfce7", color: "#16a34a" }}>🆓</span>
            <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>Free sample mock</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
            <span style={{ color: "var(--muted)" }}>❓ <strong className="mono" style={{ color: "var(--text)" }}>12</strong> Questions</span>
            <span style={{ color: "var(--muted)" }}>🕒 <strong className="mono" style={{ color: "var(--text)" }}>12</strong> Minutes</span>
          </div>
          <button
            type="button"
            onClick={() => setRun({ qs: [], title: "SAMPLE MOCK", testName: "Free sample mock (12Q)", attemptName: "Free sample mock (12Q)", minutes: 12 })}
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
