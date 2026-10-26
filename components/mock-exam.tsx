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

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  Info,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  NAV_LEGEND,
  NAV_STATUS_LABEL,
  PALETTE,
  navStatus,
  type NavLegendKey,
} from "@/lib/cbt-nav";
import { sectionLockReason, sectionPhase } from "@/lib/cbt-sections";
import { MathText } from "./math-text";
import {
  clearExamMarks,
  marksForQuestions,
  readExamMarks,
  writeExamMarks,
} from "@/lib/exam-marks";

type Part = { label: string; minutes: number; count: number };
type Section = {
  key: string;
  label: string;
  short: string;
  count: number;
  part: number;
  start: number;
  end: number;
  plus: number;
  minus: number;
  minutes: number;
  shared: boolean;
};
type Q = { id: string; section: string; stem: string; options: string[]; image?: string; plus: number; minus: number };
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
  sections?: Section[];
  index?: number;
  section?: string | null;
  remainingSec?: number;
  serverNow?: number;
  previous?: { score: number; correct: number; wrong: number; skipped: number } | null;
};

type PartResponse = ApiError & {
  index?: number;
  section?: string | null;
  label?: string;
  partLabel?: string;
  sections?: Section[];
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
  const [sections, setSections] = useState<Section[]>([]);
  const [partIndex, setPartIndex] = useState(0);
  const [sectionKey, setSectionKey] = useState("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [marked, setMarked] = useState<Record<string, true>>({});
  const [visited, setVisited] = useState<Record<string, true>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const mountedRef = useRef(true);
  const sessionRef = useRef("");
  const partsRef = useRef<Part[]>([]);
  const sectionsRef = useRef<Section[]>([]);
  const indexRef = useRef(0);
  const sectionRef = useRef("");
  const questionsRef = useRef<Q[]>([]);
  const answersRef = useRef<Record<string, number | null>>({});
  const offsetRef = useRef(0); // serverNow - Date.now()
  const deadlineRef = useRef(0); // server-clock epoch ms of the active part's end
  const lastSentRef = useRef("[]"); // JSON of the snapshot the server has
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const transitioningRef = useRef(false);
  const endedRef = useRef(false);
  const completingRef = useRef<Promise<boolean> | null>(null);

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

  const saveNow = useCallback(async (): Promise<boolean> => {
    // Serialize saves: a subject switch must not load the next section while an
    // older snapshot is still in flight (that could drop the latest answer).
    if (saveInFlightRef.current) await saveInFlightRef.current;
    const sid = sessionRef.current;
    const qs = questionsRef.current;
    if (!sid || qs.length === 0 || endedRef.current) return true;
    const picks = picksNow(qs, answersRef.current);
    const payload = JSON.stringify(picks);
    if (payload === lastSentRef.current) return true;
    setSaveState("saving");
    const task = (async (): Promise<boolean> => {
      const j = await postJson<AnswersResponse>("/api/student/attempt/answers", {
        sessionId: sid,
        index: indexRef.current,
        section: sectionRef.current || undefined,
        answers: picks,
      });
      if (!mountedRef.current) return true;
      if (typeof j.serverNow === "number") offsetRef.current = j.serverNow - Date.now();
      if (j.ok || (j.error === undefined && j.saved !== undefined)) {
        lastSentRef.current = payload;
        setSaveState("saved");
        return true;
      }
      if (j.expired || j.finished) {
        // The section closed (or the attempt ended) — the 0:00 tick moves on.
        lastSentRef.current = payload;
        return true;
      }
      setSaveState("error");
      return false;
    })();
    saveInFlightRef.current = task;
    try {
      return await task;
    } finally {
      saveInFlightRef.current = null;
    }
  }, [picksNow]);

  const complete = useCallback(async (): Promise<boolean> => {
    // A timer tick and a "Finish now" click can fire together. Both share one
    // in-flight completion request, so the client can never post twice; the
    // server's finalize step is atomic as a second line of defence.
    if (completingRef.current) return completingRef.current;
    const sid = sessionRef.current;
    if (!sid || endedRef.current) return true;
    const task = (async (): Promise<boolean> => {
      const j = await postJson<CompleteResponse>("/api/student/attempt/complete", { sessionId: sid });
      if (!mountedRef.current) return true;
      if (typeof j.serverNow === "number") offsetRef.current = j.serverNow - Date.now();
      if (j.result) {
        endedRef.current = true;
        clearExamMarks(sid);
        setResult(j.result);
        setRecorded(Boolean(j.recorded));
        setSaveState("saved");
        setFinishing(false);
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
    })();
    completingRef.current = task;
    try {
      return await task;
    } finally {
      completingRef.current = null;
    }
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

  const finishNow = useCallback((): void => {
    setSubmitOpen(false);
    setFinishing(true);
    void finishWithRetry().finally(() => {
      if (mountedRef.current && !endedRef.current) setFinishing(false);
    });
  }, [finishWithRetry]);

  const loadSection = useCallback(
    async (i: number, key?: string): Promise<"ok" | "expired" | "finished" | "error"> => {
      const sid = sessionRef.current;
      if (!sid) return "error";
      const j = await postJson<PartResponse>("/api/student/attempt/part", {
        sessionId: sid,
        index: i,
        section: key || undefined,
      });
      if (!mountedRef.current || endedRef.current) return "error";
      if (typeof j.serverNow === "number") offsetRef.current = j.serverNow - Date.now();
      if (j.finished) return "finished";
      if (j.expired) return "expired";
      if (j.error || !Array.isArray(j.questions)) {
        setSaveState("error");
        setNote(j.error ?? "Could not load the section — retrying.");
        return "error";
      }
      if (Array.isArray(j.sections)) {
        sectionsRef.current = j.sections;
        setSections(j.sections);
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
      sectionRef.current = j.section ?? key ?? "";
      answersRef.current = ans;
      lastSentRef.current = JSON.stringify(picksNow(qs, ans));
      const leftSec = typeof j.remainingSec === "number" ? j.remainingSec : (partsRef.current[i]?.minutes ?? 0) * 60;
      deadlineRef.current = Date.now() + offsetRef.current + leftSec * 1000;
      setQuestions(qs);
      setPartIndex(i);
      setSectionKey(sectionRef.current);
      setAnswers(ans);
      setMarked(marksForQuestions(sid, qs.map((x) => x.id)));
      setPos(0);
      setRemaining(leftSec);
      setSaveState("idle");
      return "ok";
    },
    [picksNow]
  );

  // Give an in-flight answer snapshot a few chances to land before the part
  // closes. The server keeps a 20-second grace window, so a short retry loop
  // is enough to survive a transient network blip without extending the exam.
  const flushBeforeTransition = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await saveNow()) return true;
      await sleep(900);
    }
    return false;
  }, [saveNow]);

  const goNext = useCallback(async (): Promise<void> => {
    if (transitioningRef.current || endedRef.current) return;
    transitioningRef.current = true;
    setTransitioning(true);
    try {
      const saved = await flushBeforeTransition();
      if (!saved && mountedRef.current) {
        setNote("The section closed while the network was unavailable. Moving on — the server will keep the answers it already accepted.");
      }
      let i = indexRef.current + 1;
      const ps = partsRef.current;
      while (i < ps.length) {
        const first = sectionsRef.current.find((s) => s.part === i);
        let r = await loadSection(i, first?.key);
        if (r === "error") {
          await sleep(1500);
          r = await loadSection(i, first?.key);
        }
        if (r === "ok") return;
        if (r === "finished") {
          setFinishing(true);
          await finishWithRetry();
          if (!endedRef.current) setFinishing(false);
          return;
        }
        if (r === "error") {
          setNote("Connection trouble while moving to the next part — retrying…");
          return;
        }
        i += 1; // "expired": that section closed before it could open — skip on
      }
      setFinishing(true);
      await finishWithRetry();
      if (!endedRef.current) setFinishing(false);
    } finally {
      transitioningRef.current = false;
      if (mountedRef.current) setTransitioning(false);
    }
  }, [finishWithRetry, flushBeforeTransition, loadSection]);

  // Subject switch inside the active timed part (only Part III has two
  // subjects). The part clock keeps running; answers are flushed first.
  const switchSection = useCallback(
    async (key: string): Promise<void> => {
      if (transitioningRef.current || endedRef.current) return;
      const target = sectionsRef.current.find((s) => s.key === key);
      if (!target || target.part !== indexRef.current || target.key === sectionRef.current) return;
      transitioningRef.current = true;
      setTransitioning(true);
      setNavOpen(false);
      try {
        const saved = await flushBeforeTransition();
        if (!saved) {
          setNote("Could not save this subject — staying here so your answers are not lost. Retrying in the background.");
          return;
        }
        const r = await loadSection(target.part, target.key);
        if (r === "expired") {
          transitioningRef.current = false;
          await goNext();
        } else if (r === "finished") {
          setFinishing(true);
          await finishWithRetry();
          if (!endedRef.current) setFinishing(false);
        } else if (r === "error") {
          setNote("Could not open that subject — please retry.");
        }
      } finally {
        transitioningRef.current = false;
        if (mountedRef.current) setTransitioning(false);
      }
    },
    [finishWithRetry, flushBeforeTransition, goNext, loadSection]
  );

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
      if (Array.isArray(j.sections)) {
        sectionsRef.current = j.sections;
        setSections(j.sections);
      }
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
      const first = sectionsRef.current.find((s) => s.part === indexRef.current);
      const r = await loadSection(indexRef.current, first?.key ?? j.section ?? undefined);
      if (r === "finished") await finishWithRetry();
      else if (r === "expired") void goNext();
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [finishWithRetry, goNext, loadSection, testId]);

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

  // Track the questions actually shown so the navigator can distinguish
  // "Opened" from "Not Visited". Current is also derived from pos in render,
  // so the first paint never flashes white before this effect runs.
  /* eslint-disable react-hooks/set-state-in-effect -- visible-question tracking is a post-render UI bookkeeping update. */
  useEffect(() => {
    const id = questions[pos]?.id;
    if (!id) return;
    setVisited((v) => (v[id] ? v : { ...v, [id]: true }));
  }, [questions, pos]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          body: JSON.stringify({ sessionId: sid, index: indexRef.current, section: sectionRef.current || undefined, answers: picks }),
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

  // The CBT is a fixed viewport; prevent the document behind it from
  // scrolling. Also close the mobile navigator / submit dialog on Escape.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        setSubmitOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

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
    const next = { ...marked };
    if (next[q.id]) delete next[q.id];
    else next[q.id] = true;
    setMarked(next);
    // Merge with marks from other parts instead of overwriting them.
    const sid = sessionRef.current;
    const stored = readExamMarks(sid);
    if (next[q.id]) stored[q.id] = true;
    else delete stored[q.id];
    writeExamMarks(sid, stored);
  };
  const exitExam = () => {
    if (!window.confirm("Leave the exam? The server clock keeps running — come back before the current part ends to continue where you left off.")) return;
    onExit();
  };

  // ---- screens ----

  if (phase === "starting") {
    return (
      <div className="cbt cbt-state-screen" data-cbt-root>
        <div className="cbt-state-card" role="status">
          <div className="cbt-state-icon" aria-hidden>
            <Loader2 size={22} className="cbt-spin" />
          </div>
          <h1>Starting the server clock</h1>
          <p>Securing your session and loading the active NIMCET part.</p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="cbt cbt-state-screen" data-cbt-root>
        <div className="cbt-state-card" role="alert">
          <div className="cbt-state-icon" aria-hidden>
            <AlertTriangle size={22} />
          </div>
          <h1>Could not start the test</h1>
          <p>{fatal}</p>
          <button type="button" onClick={onExit} className="cbt-btn cbt-btn-primary">
            <ArrowLeft size={16} /> Back to mocks
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    const p = percent(result.score, result.maxMarks || 1000);
    return (
      <div className="cbt cbt-result" data-cbt-root>
        <header className="cbt-result-header">
          <div className="cbt-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
            <img src="/logo.png" alt="" aria-hidden className="cbt-logo" />
            <div>
              <p className="cbt-eyebrow">NIMCET 2026 · SERVER-SCORED</p>
              <h1 className="cbt-title">{result.testName || title}</h1>
            </div>
          </div>
          <button type="button" onClick={onExit} className="cbt-btn cbt-btn-light">
            <ArrowLeft size={16} /> Back to mocks
          </button>
        </header>
        <main className="cbt-result-scroll">
          <div className="cbt-result-inner space-y-4">
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
          className="cbt-btn cbt-btn-primary"
        >
          <ArrowLeft size={16} /> Back to mocks
        </button>
          </div>
        </main>
      </div>
    );
  }

  // ---- running ----
  const activeSection = sections.find((s) => s.key === sectionKey) ?? null;
  const sectionName = activeSection?.label ?? parts[partIndex]?.label ?? partShort(partIndex);
  const isVisited = (id: string) =>
    !!visited[id] || questions[pos]?.id === id || answers[id] != null || !!marked[id];
  const counts: Record<NavLegendKey, number> = {
    unvisited: questions.filter((x) => !isVisited(x.id)).length,
    visited: questions.filter((x) => isVisited(x.id) && answers[x.id] == null && !marked[x.id]).length,
    answered: questions.filter((x) => answers[x.id] != null && !marked[x.id]).length,
    marked: questions.filter((x) => answers[x.id] == null && !!marked[x.id]).length,
    both: questions.filter((x) => answers[x.id] != null && !!marked[x.id]).length,
  };
  const answeredCount = questions.filter((x) => answers[x.id] != null).length;
  const markedCount = questions.filter((x) => !!marked[x.id]).length;
  const low = remaining !== null && remaining <= 300;
  const critical = remaining !== null && remaining <= 60;
  const timerLevel = critical ? "critical" : low ? "warn" : "normal";

  const navigator = (
    <div className="cbt-nav-inner">
      <div className="cbt-nav-head">
        <div>
          <p className="cbt-eyebrow">Question navigator</p>
          <h2>{activeSection?.short ?? partShort(partIndex)}</h2>
        </div>
        <span className="cbt-nav-count">{questions.length} Q</span>
      </div>

      <div className="cbt-legend" aria-label="Question status legend">
        <div className="cbt-legend-item">
          <span aria-hidden className="cbt-swatch cbt-swatch-current" />
          <span className="cbt-legend-label">Current</span>
        </div>
        {NAV_LEGEND.map((r) => (
          <div key={r.key} className="cbt-legend-item" title={r.help}>
            <span aria-hidden className="cbt-swatch" style={PALETTE[r.key]} />
            <span className="cbt-legend-label">{r.label}</span>
            <span className="cbt-legend-count">{counts[r.key]}</span>
          </div>
        ))}
      </div>

      <div className="cbt-nav-grid" role="group" aria-label={`${sectionName} questions`}>
        {questions.map((qq, i) => {
          const status = navStatus(isVisited(qq.id), answers[qq.id] != null, !!marked[qq.id]);
          return (
            <button
              key={qq.id}
              type="button"
              onClick={() => {
                setPos(i);
                setNavOpen(false);
              }}
              aria-label={`Question ${i + 1}, ${NAV_STATUS_LABEL[status]}${i === pos ? ", current question" : ""}`}
              aria-current={i === pos ? "true" : undefined}
              data-state={status}
              data-current={i === pos ? "true" : undefined}
              data-answered={answers[qq.id] != null ? "true" : undefined}
              data-marked={marked[qq.id] ? "true" : undefined}
              className="cbt-qbtn"
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="cbt-nav-foot">
        <p className="cbt-save" data-state={saveState}>
          {saveState === "saving"
            ? "Saving your answers…"
            : saveState === "saved"
              ? "All answers saved on the server"
              : saveState === "error"
                ? "Save failed — retrying automatically"
                : "Answers save automatically"}
        </p>
        <p className="cbt-hint">
          {activeSection?.shared
            ? `This part submits itself at 0:00. ${activeSection.label} shares the official ${activeSection.minutes}-minute clock with the other Part III subject.`
            : "This part submits itself at 0:00. A finished part cannot be reopened."}
        </p>
        {remaining !== null && remaining <= 0 && (
          <button type="button" onClick={finishNow} className="cbt-btn cbt-btn-primary cbt-nav-finish">
            Finish now
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="cbt" data-cbt-root>
      <header className="cbt-header">
        <div className="cbt-header-top">
          <div className="cbt-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
            <img src="/logo.png" alt="" aria-hidden className="cbt-logo" />
            <div className="cbt-brand-copy">
              <p className="cbt-eyebrow">NIMCET 2026 · FULL MOCK</p>
              <h1 className="cbt-title" title={title}>{title}</h1>
            </div>
          </div>

          <div className="cbt-header-actions">
            <div
              className="cbt-timer"
              data-level={timerLevel}
              role="timer"
              aria-label={`Time remaining in ${sectionName}: ${fmtClock(remaining)}`}
            >
              <Clock3 size={17} aria-hidden />
              <span className="cbt-timer-value">{fmtClock(remaining)}</span>
              <span className="cbt-timer-label">
                {critical ? "Final minute" : low ? "Time left" : "Remaining"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="cbt-btn cbt-btn-submit"
              aria-label="Submit test"
            >
              <Send size={15} aria-hidden />
              <span>Submit</span>
            </button>

            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="cbt-icon-btn cbt-mobile-only"
              aria-label="Open question navigator"
              title="Question navigator"
            >
              <LayoutGrid size={18} />
            </button>

            <button
              type="button"
              onClick={exitExam}
              className="cbt-icon-btn cbt-exit"
              aria-label="Exit exam"
              title="Exit exam"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>

        {sections.length > 0 && (
          <div className="cbt-section-rail" aria-label="Exam sections">
            {sections.map((s) => {
              const phase = sectionPhase(s.part, partIndex);
              const current = phase === "active" && s.key === sectionKey;
              const lockText = sectionLockReason(phase);
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={phase !== "active" || current}
                  onClick={() => void switchSection(s.key)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`${s.label}: ${s.count} questions, ${s.minutes} minutes, ${
                    current
                      ? "current section"
                      : phase === "active"
                        ? "open in this part"
                        : phase === "completed"
                          ? "completed and locked"
                          : "locked until the previous part ends"
                  }`}
                  title={lockText || `${s.label} · ${s.count}Q · ${s.minutes} min${s.shared ? " shared" : ""}`}
                  data-state={phase}
                  data-current={current ? "true" : undefined}
                  className="cbt-section-chip"
                >
                  {phase === "locked" ? (
                    <Lock size={12} aria-hidden />
                  ) : phase === "completed" ? (
                    <Check size={12} aria-hidden />
                  ) : (
                    <span aria-hidden className="cbt-section-dot" />
                  )}
                  <span className="cbt-section-name">{s.short}</span>
                  <span className="cbt-section-count">{s.count}</span>
                </button>
              );
            })}
            <span className="cbt-section-note">
              {activeSection?.shared
                ? `Part III · both subjects share the ${activeSection.minutes}-minute clock`
                : `${partShort(partIndex)} of ${parts.length}`}
            </span>
          </div>
        )}
      </header>

      {note && (
        <div className="cbt-note" role="status">
          <Info size={15} aria-hidden />
          <span>{note}</span>
          <button type="button" onClick={() => setNote("")} aria-label="Dismiss message" className="cbt-note-close">
            <X size={15} />
          </button>
        </div>
      )}

      <main className="cbt-body">
        <section className="cbt-question-pane" aria-label={`Question ${pos + 1}`}>
          {q ? (
            <div className="cbt-question">
              <div className="cbt-qmeta">
                <span className="cbt-qnum">
                  Q{pos + 1}<span>/{questions.length}</span>
                </span>
                <span className="cbt-chip">{sectionName}</span>
                <span className="cbt-chip">{activeSection?.count ?? questions.length}Q section</span>
                <span className="cbt-chip">
                  +{fmtMarks(q.plus)} / {fmtMarks(q.minus)}
                </span>
                {marked[q.id] && (
                  <span className="cbt-chip cbt-chip-marked">
                    <Flag size={12} aria-hidden /> Marked for review
                  </span>
                )}
                <a href="/contact" target="_blank" rel="noopener" className="cbt-report">
                  <Flag size={13} aria-hidden /> Report question
                </a>
              </div>

              <div className="cbt-stem">
                <MathText>{q.stem}</MathText>
              </div>

              {q.image && (
                // Question images come from the question bank and may be hosted
                // on any configured storage domain, so they use a plain img.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.image}
                  alt={`Figure for question ${pos + 1}`}
                  loading="lazy"
                  className="cbt-question-image"
                />
              )}

              <fieldset className="cbt-options">
                <legend className="sr-only">Choose one answer for question {pos + 1}</legend>
                {q.options.map((opt, i) => {
                  const sel = answers[q.id] === i;
                  return (
                    <label key={i} className="cbt-option" data-selected={sel ? "true" : undefined}>
                      <input
                        type="radio"
                        name={`cbt-answer-${q.id}`}
                        value={i}
                        checked={sel}
                        onChange={() => choose(i)}
                      />
                      <span className="cbt-option-letter" aria-hidden>{LETTERS[i]}</span>
                      <span className="cbt-option-text"><MathText>{opt}</MathText></span>
                      <span className="cbt-radio" aria-hidden />
                    </label>
                  );
                })}
              </fieldset>
            </div>
          ) : (
            <div className="cbt-loading-section" role="status">
              <Loader2 size={22} className="cbt-spin" />
              <p>Loading this section…</p>
              <button
                type="button"
                onClick={() => void loadSection(indexRef.current, sectionRef.current || undefined)}
                className="cbt-btn cbt-btn-primary"
              >
                Try again
              </button>
            </div>
          )}
        </section>

        <aside className="cbt-nav-pane" aria-label="Question navigator">
          {navigator}
        </aside>
      </main>

      <footer className="cbt-footer">
        <div className="cbt-footer-summary">
          <span className="cbt-footer-part">{partShort(partIndex)} · {sectionName}</span>
          <span className="cbt-footer-stat">{answeredCount} answered · {markedCount} marked</span>
        </div>
        <div className="cbt-footer-actions">
          <button
            type="button"
            disabled={pos === 0}
            onClick={() => setPos((p) => Math.max(0, p - 1))}
            className="cbt-btn cbt-btn-secondary"
            aria-label="Previous question"
          >
            <ChevronLeft size={16} aria-hidden />
            <span className="cbt-btn-label">Previous</span>
          </button>
          <button
            type="button"
            onClick={clearAnswer}
            disabled={!q || answers[q.id] == null}
            className="cbt-btn cbt-btn-ghost"
            aria-label="Clear answer"
          >
            <RotateCcw size={15} aria-hidden />
            <span className="cbt-btn-label">Clear</span>
          </button>
          <button
            type="button"
            onClick={toggleMark}
            aria-pressed={q ? !!marked[q.id] : false}
            aria-label={q && marked[q.id] ? "Unmark" : "Mark"}
            className="cbt-btn cbt-btn-ghost cbt-mark-btn"
            data-marked={q && marked[q.id] ? "true" : undefined}
          >
            <Flag size={15} aria-hidden />
            <span className="cbt-btn-label">{q && marked[q.id] ? "Unmark" : "Mark"}</span>
          </button>
          <button
            type="button"
            disabled={pos === questions.length - 1}
            onClick={() => setPos((p) => Math.min(questions.length - 1, p + 1))}
            className="cbt-btn cbt-btn-primary"
            aria-label="Next question"
          >
            <span className="cbt-btn-label">Next</span>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </footer>

      {navOpen && (
        <div
          className="cbt-drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNavOpen(false);
          }}
        >
          <div className="cbt-drawer" role="dialog" aria-modal="true" aria-label="Question navigator">
            <div className="cbt-drawer-head">
              <div>
                <p className="cbt-eyebrow">Full-screen CBT</p>
                <h2>Question navigator</h2>
              </div>
              <button type="button" onClick={() => setNavOpen(false)} className="cbt-icon-btn" aria-label="Close navigator">
                <X size={18} />
              </button>
            </div>
            {navigator}
          </div>
        </div>
      )}

      {submitOpen && (
        <div
          className="cbt-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSubmitOpen(false);
          }}
        >
          <div className="cbt-modal" role="dialog" aria-modal="true" aria-labelledby="cbt-submit-title">
            <div className="cbt-modal-head">
              <div>
                <p className="cbt-eyebrow">Official NIMCET timing</p>
                <h2 id="cbt-submit-title">Submit test</h2>
              </div>
              <button type="button" onClick={() => setSubmitOpen(false)} className="cbt-icon-btn" aria-label="Close submit dialog">
                <X size={18} />
              </button>
            </div>
            <p className="cbt-modal-copy">
              {remaining !== null && remaining <= 0
                ? "The clock has ended. Your paper is being scored from the answers the server accepted during the live windows."
                : "This paper follows the configured NIMCET 2026 locked-part rules. It submits itself when Part III ends; early submission is not enabled for this template. Use every minute you are given."}
            </p>
            <div className="cbt-modal-stats">
              <div><span>Answered</span><strong>{answeredCount}/{questions.length}</strong></div>
              <div><span>Marked</span><strong>{markedCount}</strong></div>
              <div><span>Time left</span><strong>{fmtClock(remaining)}</strong></div>
            </div>
            <div className="cbt-modal-actions">
              <button type="button" onClick={() => setSubmitOpen(false)} className="cbt-btn cbt-btn-secondary">
                Continue exam
              </button>
              {remaining !== null && remaining <= 0 && (
                <button type="button" onClick={finishNow} className="cbt-btn cbt-btn-primary">
                  <ShieldCheck size={16} aria-hidden /> Finish now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {transitioning && !finishing && (
        <div className="cbt-overlay" role="status" aria-live="polite">
          <div className="cbt-overlay-card">
            <Loader2 size={24} className="cbt-spin" aria-hidden />
            <h2>Section closed</h2>
            <p>Opening the next timed part on the server clock…</p>
          </div>
        </div>
      )}

      {finishing && (
        <div className="cbt-overlay" role="status" aria-live="polite">
          <div className="cbt-overlay-card">
            <Loader2 size={24} className="cbt-spin" aria-hidden />
            <h2>Scoring your paper</h2>
            <p>The server is finalizing your attempt. Keep this tab open.</p>
          </div>
        </div>
      )}
    </div>
  );
}
