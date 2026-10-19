"use client";

// Server-enforced runner for NIMCET full-mock template tests (tests.template
// = "nimcet-2026"). The server is the referee: it owns the start time, the
// per-section windows, which section may be fetched, which answers are
// accepted and the final score. This component only renders that state and
// pushes answer snapshots back — it never decides timing or marks.
//
// Flow: start → (resume or new session) → load the active part → autosave
// answers while it runs → at 0:00 the next part opens automatically → after
// Part III the attempt is scored on the server and the result screen appears.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { PALETTE } from "./mock-instructions";
import { MathText } from "./math-text";

type Part = { label: string; minutes: number; count: number };
type Q = { id: string; section: string; stem: string; options: string[]; plus: number; minus: number };
type Pick = { id: string; answer: number | null };

type Detail = {
  id: string;
  section: string;
  group: string;
  stem: string;
  opts: string[];
  picked: number | null;
  correct: number;
  exp: string;
  ok: boolean;
  plus: number;
  minus: number;
  points: number;
};

type SubjectResult = {
  key: string;
  label: string;
  count: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  maxMarks: number;
};

type Result = {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  details: Detail[];
  sections: SubjectResult[];
  maxMarks: number;
  testName: string;
};

type ApiError = { error?: string };

const LETTERS = ["A", "B", "C", "D", "E"];
const PART_SHORT = ["Part I", "Part II", "Part III"];
const partShort = (i: number) => PART_SHORT[i] ?? `Part ${i + 1}`;

const fmtMarks = (n: number) => String(Math.round(n * 10) / 10);

function fmtClock(sec: number | null): string {
  if (sec === null) return "--:--";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(ss).padStart(2, "0")}`;
}

function percent(score: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
}

async function postJson<T extends ApiError>(url: string, body: unknown): Promise<T> {
  try {
    const r = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as T;
    if (!r.ok && !j.error) return { ...(j as object), error: `Request failed (${r.status}).` } as T;
    return j;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error — retrying." } as T;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type StartResponse = ApiError & {
  sessionId?: string;
  resumed?: boolean;
  parts?: Part[];
  index?: number;
  remainingSec?: number;
  serverNow?: number;
  previous?: { score: number; correct: number; wrong: number; skipped: number } | null;
};

type PartResponse = ApiError & {
  index?: number;
  questions?: Q[];
  picks?: Pick[];
  remainingSec?: number;
  serverNow?: number;
  expired?: boolean;
  finished?: boolean;
};

type AnswersResponse = ApiError & {
  ok?: boolean;
  saved?: number;
  serverNow?: number;
  expired?: boolean;
  finished?: boolean;
};

type CompleteResponse = ApiError & {
  result?: Result;
  recorded?: boolean;
  remainingSec?: number;
  serverNow?: number;
};

export default function MockExam({
  testId,
  title,
  onExit,
}: {
  testId: string;
  title: string;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<"starting" | "running" | "done" | "error">("starting");
  const [fatal, setFatal] = useState("");
  const [note, setNote] = useState("");
  const [parts, setParts] = useState<Part[]>([]);
  const [partIndex, setPartIndex] = useState(0);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [marked, setMarked] = useState<Record<string, true>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [recorded, setRecorded] = useState(false);

  const mountedRef = useRef(true);
  const sessionRef = useRef("");
  const partsRef = useRef<Part[]>([]);
  const indexRef = useRef(0);
  const questionsRef = useRef<Q[]>([]);
  const answersRef = useRef<Record<string, number | null>>({});
  const offsetRef = useRef(0); // serverNow - Date.now()
  const deadlineRef = useRef(0); // server-clock epoch ms of the active part's end
  const lastSentRef = useRef("[]"); // JSON of the snapshot the server has
  const savingRef = useRef(false);
  const transitioningRef = useRef(false);
  const endedRef = useRef(false);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const picksNow = useCallback((qs: Q[], ans: Record<string, number | null>): Pick[] => {
    const out: Pick[] = [];
    for (const q of qs) {
      const a = ans[q.id];
      if (a !== null && a !== undefined) out.push({ id: q.id, answer: a });
    }
    return out;
  }, []);

  const saveNow = useCallback(async (): Promise<void> => {
    const sid = sessionRef.current;
    const qs = questionsRef.current;
    if (!sid || qs.length === 0 || endedRef.current) return;
    const picks = picksNow(qs, answersRef.current);
    const payload = JSON.stringify(picks);
    if (payload === lastSentRef.current || savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    const j = await postJson<AnswersResponse>("/api/student/attempt/answers", {
      sessionId: sid,
      index: indexRef.current,
      answers: picks,
    });
    savingRef.current = false;
    if (!mountedRef.current) return;
    if (typeof j.serverNow === "number") offsetRef.current = j.serverNow - Date.now();
    if (j.ok || (j.error === undefined && j.saved !== undefined)) {
      lastSentRef.current = payload;
      setSaveState("saved");
    } else if (j.expired || j.finished) {
      // The section closed (or the attempt ended) — the 0:00 tick moves on.
      lastSentRef.current = payload;
    } else {
      setSaveState("error");
    }
  }, [picksNow]);

  const complete = useCallback(async (): Promise<boolean> => {
    const sid = sessionRef.current;
    if (!sid || endedRef.current) return true;
    const j = await postJson<CompleteResponse>("/api/student/attempt/complete", { sessionId: sid });
    if (!mountedRef.current) return true;
    if (typeof j.serverNow === "number") offsetRef.current = j.serverNow - Date.now();
    if (j.result) {
      endedRef.current = true;
      setResult(j.result);
      setRecorded(Boolean(j.recorded));
      setSaveState("saved");
      setPhase("done");
      return true;
    }
    if (typeof j.remainingSec === "number") {
      // The server still sees time on the clock (rounding/skew) — realign.
      deadlineRef.current = Date.now() + offsetRef.current + j.remainingSec * 1000;
      setRemaining(j.remainingSec);
    }
    setNote(j.error ?? "Finishing up…");
    return false;
  }, []);

  const finishWithRetry = useCallback(async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const done = await complete();
      if (done || endedRef.current) return;
      await sleep(2000);
    }
    if (mountedRef.current) {
      setNote("Could not reach the server to finish. Your answers are saved — use “Finish now” to retry.");
    }
  }, [complete]);

  const loadPart = useCallback(
    async (i: number): Promise<"ok" | "expired" | "finished" | "error"> => {
      const sid = sessionRef.current;
      if (!sid) return "error";
      const j = await postJson<PartResponse>("/api/student/attempt/part", { sessionId: sid, index: i });
      if (!mountedRef.current || endedRef.current) return "error";
      if (typeof j.serverNow === "number") offsetRef.current = j.serverNow - Date.now();
      if (j.finished) return "finished";
      if (j.expired) return "expired";
      if (j.error || !Array.isArray(j.questions)) {
        setSaveState("error");
        setNote(j.error ?? "Could not load the section — retrying.");
        return "error";
      }
      const qs = j.questions;
      const ans: Record<string, number | null> = {};
      const ids = new Set(qs.map((q) => q.id));
      for (const p of j.picks ?? []) {
        if (p && typeof p.id === "string" && ids.has(p.id)) {
          ans[p.id] = p.answer === null || p.answer === undefined ? null : Number(p.answer);
        }
      }
      questionsRef.current = qs;
      indexRef.current = i;
      answersRef.current = ans;
      lastSentRef.current = JSON.stringify(picksNow(qs, ans));
      const leftSec = typeof j.remainingSec === "number" ? j.remainingSec : (partsRef.current[i]?.minutes ?? 0) * 60;
      deadlineRef.current = Date.now() + offsetRef.current + leftSec * 1000;
      setQuestions(qs);
      setPartIndex(i);
      setAnswers(ans);
      setMarked({});
      setPos(0);
      setRemaining(leftSec);
      setSaveState("idle");
      return "ok";
    },
    [picksNow]
  );

  const goNext = useCallback(async (): Promise<void> => {
    if (transitioningRef.current || endedRef.current) return;
    transitioningRef.current = true;
    try {
      await saveNow();
      let i = indexRef.current + 1;
      const ps = partsRef.current;
      while (i < ps.length) {
        let r = await loadPart(i);
        if (r === "error") {
          await sleep(1500);
          r = await loadPart(i);
        }
        if (r === "ok") return;
        if (r === "finished") {
          await finishWithRetry();
          return;
        }
        if (r === "error") {
          setNote("Connection trouble while moving to the next section — retrying…");
          return;
        }
        i += 1; // "expired": that section closed before it could open — skip on
      }
      await finishWithRetry();
    } finally {
      transitioningRef.current = false;
    }
  }, [finishWithRetry, loadPart, saveNow]);

  // Kick the whole flow off exactly once per mount.
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const j = await postJson<StartResponse>("/api/student/attempt/start", { testId });
      if (!mountedRef.current) return;
      if (!j.sessionId || !Array.isArray(j.parts) || j.parts.length === 0) {
        setFatal(j.error ?? "The test could not be started.");
        setPhase("error");
        return;
      }
      if (typeof j.serverNow === "number") offsetRef.current = j.serverNow - Date.now();
      sessionRef.current = j.sessionId;
      partsRef.current = j.parts;
      setParts(j.parts);
      indexRef.current = Math.max(0, Math.min(j.index ?? 0, j.parts.length - 1));
      if (j.previous) {
        setNote(
          `Your earlier unfinished attempt was recorded — score ${fmtMarks(j.previous.score)}/1000 (${j.previous.correct} correct, ${j.previous.wrong} wrong). This is a fresh attempt.`
        );
      } else if (j.resumed) {
        setNote("Resumed — the server clock kept running and your saved answers were restored.");
      }
      setPhase("running");
      if (j.resumed && typeof j.remainingSec === "number") {
        setRemaining(j.remainingSec);
        deadlineRef.current = Date.now() + offsetRef.current + j.remainingSec * 1000;
      }
      const r = await loadPart(indexRef.current);
      if (r === "finished") await finishWithRetry();
      else if (r === "expired") void goNext();
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [finishWithRetry, goNext, loadPart, testId]);

  // The clock: one 500 ms tick, straight from the server-anchored deadline.
  useEffect(() => {
    if (phase !== "running") return;
    const iv = window.setInterval(() => {
      if (deadlineRef.current <= 0) return;
      const left = Math.max(0, Math.ceil((deadlineRef.current - (Date.now() + offsetRef.current)) / 1000));
      setRemaining(left);
      if (left <= 0) void goNext();
    }, 500);
    return () => window.clearInterval(iv);
  }, [phase, goNext]);

  // Autosave: debounce after every answer change, plus a slow heartbeat.
  useEffect(() => {
    if (phase !== "running" || questions.length === 0) return;
    const t = window.setTimeout(() => {
      void saveNow();
    }, 900);
    return () => window.clearTimeout(t);
  }, [answers, phase, questions, saveNow]);

  useEffect(() => {
    if (phase !== "running") return;
    const iv = window.setInterval(() => {
      void saveNow();
    }, 12000);
    return () => window.clearInterval(iv);
  }, [phase, saveNow]);

  // Best-effort flush when the tab is hidden or closed mid-section.
  useEffect(() => {
    if (phase !== "running") return;
    const flush = () => {
      const sid = sessionRef.current;
      const qs = questionsRef.current;
      if (!sid || qs.length === 0 || endedRef.current) return;
      const picks = picksNow(qs, answersRef.current);
      const payload = JSON.stringify(picks);
      if (payload === lastSentRef.current) return;
      try {
        void fetch("/api/student/attempt/answers", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, index: indexRef.current, answers: picks }),
          keepalive: true,
        });
        lastSentRef.current = payload;
      } catch {}
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase, picksNow]);

  // ---- actions ----
  const q = questions[pos] as Q | undefined;
  const choose = (optIdx: number) => {
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
  };
  const clearAnswer = () => {
    if (!q) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
  };
  const toggleMark = () => {
    if (!q) return;
    setMarked((prev) => {
      const next = { ...prev };
      if (next[q.id]) delete next[q.id];
      else next[q.id] = true;
      return next;
    });
  };
  const exitExam = () => {
    if (!window.confirm("Leave the exam? The server clock keeps running — come back before the section ends to continue where you left off.")) return;
    onExit();
  };

  // ---- screens ----

  if (phase === "starting") {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl p-10" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="h-6 w-6 animate-spin rounded-full" style={{ border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
        <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
          Starting the server clock…
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-2xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-extrabold" style={{ color: "#dc2626" }}>
          Could not start the test
        </p>
        <p className="mt-1 text-[13px] leading-5" style={{ color: "var(--muted)" }}>
          {fatal}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 cursor-pointer rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          Back to mocks
        </button>
      </div>
    );
  }

  if (phase === "done" && result) {
    const p = percent(result.score, result.maxMarks || 1000);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="mono text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.16em" }}>
            FULL MOCK · RESULT
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
            {result.testName || title}
          </h2>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="dash-display text-4xl font-extrabold" style={{ color: "var(--text)" }}>
                {fmtMarks(result.score)}
                <span className="text-lg" style={{ color: "var(--muted)" }}>
                  {" "}
                  / {fmtMarks(result.maxMarks)}
                </span>
              </p>
              <div className="mt-2 h-2 w-56 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
                <div className="h-full rounded-full" style={{ width: `${p}%`, background: "var(--accent)" }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[12px] font-bold">
              <span className="rounded-lg px-2.5 py-1 text-white" style={{ background: "#16a34a" }}>
                {result.correct} correct
              </span>
              <span className="rounded-lg px-2.5 py-1 text-white" style={{ background: "#dc2626" }}>
                {result.wrong} wrong
              </span>
              <span className="rounded-lg px-2.5 py-1" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                {result.skipped} unattempted
              </span>
            </div>
          </div>
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
            {recorded
              ? "This attempt was saved to your history."
              : "No answers were recorded for this attempt, so nothing was added to your history."}
          </p>
        </div>

        {result.sections.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
              Subject-wise performance
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
                    <th className="py-1.5 pr-3 text-left font-bold">SUBJECT</th>
                    <th className="px-2 py-1.5 text-right font-bold">QUESTIONS</th>
                    <th className="px-2 py-1.5 text-right font-bold">CORRECT</th>
                    <th className="px-2 py-1.5 text-right font-bold">WRONG</th>
                    <th className="px-2 py-1.5 text-right font-bold">SKIPPED</th>
                    <th className="py-1.5 pl-3 text-right font-bold">SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sections.map((s) => (
                    <tr key={s.label} style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                      <td className="py-2 pr-3 font-semibold">{s.label}</td>
                      <td className="mono px-2 py-2 text-right">{s.count}</td>
                      <td className="mono px-2 py-2 text-right" style={{ color: "#16a34a" }}>{s.correct}</td>
                      <td className="mono px-2 py-2 text-right" style={{ color: "#dc2626" }}>{s.wrong}</td>
                      <td className="mono px-2 py-2 text-right">{s.skipped}</td>
                      <td className="mono py-2 pl-3 text-right font-extrabold">
                        {fmtMarks(s.score)} <span style={{ color: "var(--muted)" }}>/ {fmtMarks(s.maxMarks)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
            Solutions &amp; review
          </h3>
          <ol className="mt-3 space-y-3">
            {result.details.map((d, i) => (
              <li key={d.id || i} className="rounded-xl p-3.5" style={{ border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2">
                  <span className="mono text-[12px] font-extrabold" style={{ color: "var(--muted)" }}>
                    Q{i + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold leading-6" style={{ color: "var(--text)" }}>
                      <MathText>{d.stem}</MathText>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="mono rounded px-2 py-0.5 font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                        {d.group}
                      </span>
                      <span
                        className="mono rounded px-2 py-0.5 font-bold"
                        style={{
                          background: "var(--pill)",
                          color: d.ok ? "#16a34a" : d.picked === null ? "var(--muted)" : "#dc2626",
                        }}
                      >
                        {d.ok ? `+${fmtMarks(d.plus)}` : d.picked === null ? "0 · skipped" : `${fmtMarks(d.minus)}`}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {d.opts.map((opt, oi) => {
                        const isCorrect = oi === d.correct;
                        const isPicked = oi === d.picked;
                        return (
                          <li
                            key={oi}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px]"
                            style={{
                              background: isCorrect
                                ? "color-mix(in srgb, #16a34a 14%, transparent)"
                                : isPicked
                                  ? "color-mix(in srgb, #dc2626 12%, transparent)"
                                  : "var(--pill)",
                              color: "var(--text)",
                            }}
                          >
                            <span className="mono text-[11px] font-extrabold" style={{ color: "var(--muted)" }}>
                              {LETTERS[oi]}
                            </span>
                            <span className="flex-1"><MathText>{opt}</MathText></span>
                            {isCorrect && (
                              <span className="text-[10.5px] font-bold" style={{ color: "#16a34a" }}>
                                correct
                              </span>
                            )}
                            {isPicked && !isCorrect && (
                              <span className="text-[10.5px] font-bold" style={{ color: "#dc2626" }}>
                                your answer
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {d.exp && (
                      <p className="mt-2 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
                        <strong>Why:</strong> <MathText>{d.exp}</MathText>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          Back to mocks
        </button>
      </div>
    );
  }

  // ---- running ----
  const visAnswered = questions.filter((x) => answers[x.id] != null).length;
  const visMarked = questions.filter((x) => marked[x.id]).length;
  const visBoth = questions.filter((x) => answers[x.id] != null && marked[x.id]).length;
  const legend: Array<{ key: keyof typeof PALETTE; label: string; count: number }> = [
    { key: "unanswered", label: "Unattempted", count: questions.length - visAnswered },
    { key: "answered", label: "Answered", count: visAnswered - visBoth },
    { key: "marked", label: "Marked", count: visMarked - visBoth },
    { key: "both", label: "Answered + marked", count: visBoth },
  ];
  const low = remaining !== null && remaining <= 60;

  return (
    <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}>
      {/* exam top bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="min-w-0 flex-1">
          <p className="mono text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.14em" }}>
            FULL MOCK · SERVER-TIMED
          </p>
          <h2 className="truncate text-[15px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {parts.map((pt, i) => {
            const state = i < partIndex ? "done" : i === partIndex ? "cur" : "next";
            return (
              <span
                key={pt.label}
                title={`${pt.label} · ${pt.minutes} min · ${pt.count}Q`}
                className="mono rounded-lg px-2 py-1 text-[10.5px] font-bold"
                style={
                  state === "cur"
                    ? { background: "var(--accent)", color: "var(--accent-fg)" }
                    : state === "done"
                      ? { background: "var(--pill)", color: "var(--muted)", textDecoration: "line-through" }
                      : { background: "var(--pill)", color: "var(--muted)", opacity: 0.65 }
                }
              >
                {partShort(i)}
              </span>
            );
          })}
        </div>
        <span className="mono rounded-xl px-3 py-1.5 text-lg font-extrabold tabular-nums" style={{ background: low ? "color-mix(in srgb, #dc2626 12%, transparent)" : "var(--pill)", color: low ? "#dc2626" : "var(--text)" }}>
          {fmtClock(remaining)}
        </span>
        <button type="button" onClick={exitExam} className="cursor-pointer text-[12.5px] font-bold" style={{ color: "var(--muted)" }}>
          Exit
        </button>
      </div>

      {note && (
        <div className="flex items-start gap-2 px-4 py-2.5 text-[12.5px] leading-5" style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--accent) 6%, transparent)", color: "var(--text)" }}>
          <span className="flex-1">{note}</span>
          <button type="button" onClick={() => setNote("")} aria-label="Dismiss" className="cursor-pointer font-bold" style={{ color: "var(--muted)" }}>
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_270px]">
        {/* question card */}
        <div>
          {q ? (
            <div className="rounded-2xl p-4" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="mono font-bold" style={{ color: "var(--muted)" }}>
                  Q{pos + 1} / {questions.length}
                </span>
                <span className="mono rounded px-2 py-0.5 font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }}>
                  {parts[partIndex]?.label ?? partShort(partIndex)}
                </span>
                <span className="mono rounded px-2 py-0.5" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                  +{fmtMarks(q.plus)} / {fmtMarks(q.minus)}
                </span>
                {marked[q.id] && (
                  <span className="rounded px-2 py-0.5 font-bold text-white" style={{ background: "#d97706" }}>
                    Marked for review
                  </span>
                )}
              </div>
              <p className="mt-3 text-[15px] font-semibold leading-7" style={{ color: "var(--text)" }}>
                <MathText>{q.stem}</MathText>
              </p>
              <div className="mt-4 space-y-2">
                {q.options.map((opt, i) => {
                  const sel = answers[q.id] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => choose(i)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] transition-colors"
                      style={
                        sel
                          ? { background: "color-mix(in srgb, var(--accent) 14%, transparent)", border: "1.5px solid var(--accent)", color: "var(--text)" }
                          : { background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }
                      }
                    >
                      <span
                        className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                        style={sel ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)" }}
                      >
                        {LETTERS[i]}
                      </span>
                      <span className="flex-1"><MathText>{opt}</MathText></span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pos === 0}
                  onClick={() => setPos((p) => Math.max(0, p - 1))}
                  className="cursor-pointer rounded-xl px-3 py-2 text-[12.5px] font-bold disabled:cursor-default disabled:opacity-40"
                  style={{ background: "var(--pill)", color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={clearAnswer}
                  disabled={answers[q.id] === undefined}
                  className="cursor-pointer rounded-xl px-3 py-2 text-[12.5px] font-bold disabled:cursor-default disabled:opacity-40"
                  style={{ background: "var(--pill)", color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  Clear response
                </button>
                <button
                  type="button"
                  onClick={toggleMark}
                  className="cursor-pointer rounded-xl px-3 py-2 text-[12.5px] font-bold"
                  style={marked[q.id] ? { background: "#d97706", color: "#ffffff" } : { background: "var(--pill)", color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  {marked[q.id] ? "Unmark" : "Mark for review"}
                </button>
                <button
                  type="button"
                  disabled={pos === questions.length - 1}
                  onClick={() => setPos((p) => Math.min(questions.length - 1, p + 1))}
                  className="cursor-pointer rounded-xl px-3 py-2 text-[12.5px] font-bold disabled:cursor-default disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                >
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 text-center" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
                Loading this section…
              </p>
              <button
                type="button"
                onClick={() => void loadPart(indexRef.current)}
                className="mt-3 cursor-pointer rounded-xl px-4 py-2 text-[12.5px] font-bold"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* navigator + status */}
        <div>
          <div className="rounded-2xl p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <p className="mono text-[10px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
              {partShort(partIndex).toUpperCase()} NAVIGATOR
            </p>
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              {questions.map((qq, i) => {
                const isAns = answers[qq.id] != null;
                const isMark = !!marked[qq.id];
                const base = isAns && isMark ? PALETTE.both : isAns ? PALETTE.answered : isMark ? PALETTE.marked : PALETTE.unanswered;
                const s: CSSProperties = { ...base };
                if (i === pos) s.boxShadow = `${s.boxShadow ? `${s.boxShadow}, ` : ""}0 0 0 2.5px color-mix(in srgb, var(--accent) 55%, transparent)`;
                return (
                  <button key={qq.id} type="button" onClick={() => setPos(i)} className="mono cursor-pointer rounded-lg py-1.5 text-[11px] font-bold" style={s}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 space-y-1">
              {legend.map((r) => (
                <div key={r.key} className="flex items-center gap-2 text-[11.5px]">
                  <span aria-hidden className="shrink-0 rounded" style={{ ...PALETTE[r.key], width: 14, height: 14 }} />
                  <span className="flex-1 font-semibold" style={{ color: "var(--muted)" }}>
                    {r.label}
                  </span>
                  <span className="mono font-bold" style={{ color: "var(--text)" }}>
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
              {saveState === "saving"
                ? "Saving your answers…"
                : saveState === "saved"
                  ? "All answers saved on the server ✓"
                  : saveState === "error"
                    ? "Save failed — retrying automatically"
                    : "Answers save automatically"}
            </p>
            <p className="mt-2 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
              This section submits itself at 0:00, and a finished section cannot be reopened.
            </p>
            {remaining !== null && remaining <= 0 && (
              <button
                type="button"
                onClick={() => void finishWithRetry()}
                className="mt-2 w-full cursor-pointer rounded-xl py-2 text-[12.5px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                Finish now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
