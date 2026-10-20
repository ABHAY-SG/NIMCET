"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  Trophy,
} from "lucide-react";
import MockDemo, { type MockQuestion } from "@/components/mockdemo";
import MockCard from "@/components/mock-card";
import MockExam from "@/components/mock-exam";
import MockInstructions, { type SchemeRow } from "@/components/mock-instructions";
import { getSupabase } from "@/lib/supabase";
import { parseParts, partRanges, RUN_KEY, LEGACY_RUN_KEY, type ExamPart } from "@/lib/exam-parts";
import { groupRows, toMock, type BankRow } from "@/lib/question-bank";
import {
  FULL_MOCK_MAX_MARKS,
  FULL_MOCK_MINUTES,
  FULL_MOCK_QUESTIONS,
  isFullMockTemplate,
  partNote,
  SUBJECTS,
  templateParts,
} from "@/lib/nimcet-full-mock";

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

const KINDS = ["All", "Free", "Premium", "Attempted"] as const;

type HubExam = "nimcet" | "cuet";
type HubSet = "mock" | "pyq";

function isCuetExam(exam: string): boolean {
  const e = exam.toLowerCase();
  return e === "cuet" || e === "cuet-pg-mca" || e.startsWith("cuet");
}

// PYQ papers are ordinary tests tagged as previous-year sets. Match the title,
// tag and description so an admin can label a paper in whichever field suits.
function isPyqTest(t: Test): boolean {
  return /pyq|previous\s*year|past\s*paper/i.test(`${t.title} ${t.tag} ${t.description}`);
}

const HUB_COPY: Record<HubExam, Record<HubSet, {
  heading: string;
  blurb: string;
  meta: string;
  noun: [string, string];
  empty: string;
}>> = {
  nimcet: {
    mock: {
      heading: "NIMCET Mock Tests",
      blurb: "Master NIMCET with mock tests — your path to success starts here!",
      meta: "NIMCET pattern",
      noun: ["mock test", "mock tests"],
      empty: "No NIMCET mocks are published yet — check back once admin adds a paper.",
    },
    pyq: {
      heading: "NIMCET PYQ",
      blurb: "Solve previous-year NIMCET papers year by year — real patterns, real timing.",
      meta: "Previous-year papers",
      noun: ["PYQ set", "PYQ sets"],
      empty: "No NIMCET PYQ sets are published yet — previous-year papers will appear here.",
    },
  },
  cuet: {
    mock: {
      heading: "CUET PG Mock Tests",
      blurb: "Practise for CUET PG MCA with full-length mocks and instant scorecards.",
      meta: "CUET PG pattern",
      noun: ["mock test", "mock tests"],
      empty: "No CUET PG mocks are published yet — check back once admin adds a paper.",
    },
    pyq: {
      heading: "CUET PG PYQ",
      blurb: "Work through CUET PG previous-year questions and learn the paper's rhythm.",
      meta: "Previous-year papers",
      noun: ["PYQ set", "PYQ sets"],
      empty: "No CUET PG PYQ sets are published yet — previous-year papers will appear here.",
    },
  },
};

export default function MockHub({
  attempted,
  exam,
  collection = "mock",
}: {
  attempted: Record<string, number>;
  /** Restrict the hub to one exam. Omit to show the whole catalogue. */
  exam?: HubExam;
  /** Mock papers (default) or previous-year question sets. */
  collection?: HubSet;
}) {
  const copy = HUB_COPY[exam ?? "nimcet"][collection];
  const [tests, setTests] = useState<Test[]>([]);
  const [bank, setBank] = useState<BankRow[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [run, setRun] = useState<Run | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    setLoadError("");
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
    } catch (e) {
      const message = e instanceof Error ? e.message.trim() : "";
      setLoadError(message && message !== "Could not load the test catalogue." ? message : "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time catalogue fetch; loading state is the external request's lifecycle.
    void loadCatalogue();
  }, [loadCatalogue]);

  const bankById = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);

  const plusOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of bank) m.set(q.id, Number(q.plus) || 0);
    return m;
  }, [bank]);

  const marksOf = (t: Test) => t.question_ids.reduce((s, id) => s + (plusOf.get(id) ?? 0), 0);

  // Card duration. When a test declares timed sections, the sections ARE the
  // paper's clock — each window is fixed and unused time never carries over —
  // so the card shows their sum instead of the stored `minutes` column.
  // Display only: nothing is written back, so a stored value that ever drifts
  // from the sections can no longer lie to a student on the hub.
  const displayMinutesOf = (t: Test) => {
    const parts = parseParts(t.sections, t.question_ids.length);
    return parts ? parts.reduce((s, p) => s + p.minutes, 0) : t.minutes;
  };

  const visibleTests = tests.filter((t) => {
    if (exam) {
      const e = t.exam.toLowerCase();
      if (exam === "nimcet" ? e !== "nimcet" : !isCuetExam(e)) return false;
    }
    if (collection === "pyq" ? !isPyqTest(t) : isPyqTest(t)) return false;
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
            className="dash-btn dash-btn-ghost dash-btn-sm mb-3"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft size={14} /> Back to mocks
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
          className="dash-btn dash-btn-ghost dash-btn-sm mb-3"
          style={{ color: "var(--muted)" }}
        >
          <ArrowLeft size={14} /> Back to mocks
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
          className="dash-btn dash-btn-ghost dash-btn-sm mb-3"
          style={{ color: "var(--muted)" }}
        >
          <ArrowLeft size={14} /> Back to mocks
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
      <div className="dash-card flex flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="dash-icon-tile"><Loader2 size={18} className="animate-spin" /></span>
        <p className="text-[13px] font-bold" style={{ color: "var(--text)" }}>Preparing your instructions</p>
        <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>Loading the real questions for this paper.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="dash-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="dash-icon-tile" style={{ width: 44, height: 44 }}><Trophy size={20} strokeWidth={1.8} /></span>
            <div className="min-w-0">
              <div className="dash-eyebrow">{copy.meta}</div>
              <h1 className="dash-title mt-1">{copy.heading}</h1>
              <p className="dash-subtitle mt-1 max-w-xl">{copy.blurb}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative min-w-0">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tests by name"
              aria-label="Search tests"
              className="dash-input"
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
            aria-label="Filter tests"
            className="dash-input cursor-pointer"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{k === "All" ? "All tests" : k}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }} aria-live="polite">
          {loading
            ? "Loading published tests…"
            : `${visibleTests.length} ${visibleTests.length === 1 ? copy.noun[0] : copy.noun[1]}`}
          {!loading && kind !== "All" ? ` · ${kind}` : ""}
          {!loading && query ? ` · “${query}”` : ""}
        </p>
        <p className="hidden text-[10.5px] font-medium sm:block" style={{ color: "var(--muted)" }}>
          Full-length · {copy.meta} · instant scorecard
        </p>
      </div>

      {loadError ? (
        <div className="dash-alert dash-alert-danger" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold">Could not load the test catalogue</p>
            <p className="mt-0.5 text-[11px] leading-5 opacity-90">{loadError}</p>
          </div>
          <button type="button" onClick={() => void loadCatalogue()} className="dash-btn dash-btn-sm dash-btn-danger shrink-0">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="dash-skeleton h-[258px]" />)}
        </div>
      ) : visibleTests.length === 0 ? (
        <div className="dash-empty">
          <span className="dash-empty-icon">
            {query || kind !== "All" ? <SearchX size={18} /> : <BookOpen size={18} />}
          </span>
          <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>
            {query || kind !== "All" ? "No tests match this filter" : "The catalogue is empty"}
          </p>
          <p className="max-w-[25rem] text-[11.5px] leading-5">
            {query || kind !== "All"
              ? "Clear the search or choose another filter to see the published papers."
              : copy.empty}
          </p>
          {query || kind !== "All" ? (
            <button
              type="button"
              onClick={() => { setQuery(""); setKind("All"); }}
              className="dash-btn dash-btn-secondary dash-btn-sm mt-1"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleTests.map((t) => {
            const done = attempted[t.title] ?? 0;
            return (
              <MockCard
                key={t.id}
                title={t.title}
                questions={Array.isArray(t.question_ids) ? t.question_ids.length : 0}
                minutes={displayMinutesOf(t)}
                marks={marksOf(t)}
                difficulty={dominantDifficulty(t.question_ids, bankById)}
                tag={t.tag}
                free={t.free}
                attempted={done}
                onStart={() => openSetup(t)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
