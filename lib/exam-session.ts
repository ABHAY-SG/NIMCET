// Server-enforced section flow for template exams.
//
// Pure logic only (no database, no Next imports) so route handlers AND tests
// use the exact same timing/scoring math. A session's answers are stored as
// per-part snapshots; the final score is always computed here on the server —
// the browser never decides marks.

import type { ExamPart } from "./exam-parts";
import { isFullMockTemplate, subjectForSection, type SubjectKey } from "./nimcet-full-mock";

// Network grace: a part stays writable for this long after its window ends so
// a submit/autosave already in flight is not lost. It never re-opens a part.
export const SECTION_GRACE_MS = 20_000;
// The final result call may land this long after the last part ends.
export const COMPLETE_GRACE_MS = 60_000;

export function partsTotalMs(parts: ExamPart[]): number {
  return parts.reduce((s, p) => s + p.minutes, 0) * 60_000;
}

/** Absolute [start, end) offsets (ms from session start) of every part. */
export function partWindows(parts: ExamPart[]): Array<{ startMs: number; endMs: number }> {
  const out: Array<{ startMs: number; endMs: number }> = [];
  let acc = 0;
  for (const p of parts) {
    const ms = p.minutes * 60_000;
    out.push({ startMs: acc, endMs: acc + ms });
    acc += ms;
  }
  return out;
}

/** Index of the part whose window contains `elapsedMs`, clamped to the last. */
export function activeIndexAt(parts: ExamPart[], elapsedMs: number): number {
  const wins = partWindows(parts);
  for (let i = 0; i < wins.length; i++) {
    if (elapsedMs < wins[i].endMs) return i;
  }
  return parts.length - 1;
}

/** Time left in part `index` at `elapsedMs` (0 once the window has passed). */
export function partRemainingMs(parts: ExamPart[], elapsedMs: number, index: number): number {
  const wins = partWindows(parts);
  const w = wins[Math.max(0, Math.min(index, wins.length - 1))];
  if (!w) return 0;
  return Math.max(0, w.endMs - elapsedMs);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Answers

export type Pick = { id: string; answer: number | null };

// Strict sanitizer for client-submitted answer snapshots: only ids that belong
// to the part may travel, options are 0..4 (question option lists are validated
// at publish time), duplicates keep the LAST value. Returns null when the
// payload is not a well-formed answer list.
export function sanitizePicks(raw: unknown, allowed: Set<string>, max: number): Pick[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > Math.max(max, 1) * 2 + 8) return null;
  const out = new Map<string, number | null>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!id || !allowed.has(id)) return null;
    let answer: number | null = null;
    if (o.answer !== null && o.answer !== undefined) {
      const n = Number(o.answer);
      if (!Number.isInteger(n) || n < 0 || n > 4) return null;
      answer = n;
    }
    out.set(id, answer);
  }
  return [...out.entries()].map(([id, answer]) => ({ id, answer }));
}

/** Later parts override earlier ones when merging stored snapshots. */
export function mergePicks(parts: Array<{ answers?: unknown } | null | undefined>): Pick[] {
  const out = new Map<string, number | null>();
  for (const p of parts) {
    if (!p || !Array.isArray(p.answers)) continue;
    for (const item of p.answers as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string") continue;
      const a = o.answer === null || o.answer === undefined ? null : Number(o.answer);
      out.set(o.id, a === null || Number.isInteger(a) ? a : null);
    }
  }
  return [...out.entries()].map(([id, answer]) => ({ id, answer }));
}

// ---------------------------------------------------------------------------
// Scoring

export type SessionQuestion = {
  id: string;
  section: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
  plus: number;
  minus: number;
};

export type DetailRow = {
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

export type ScoreOutcome = {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  details: DetailRow[];
};

/** Marks actually used: template subjects always score by the official rule. */
export function marksUsed(
  q: { section: string; plus: number; minus: number },
  template: string
): { plus: number; minus: number } {
  if (isFullMockTemplate(template)) {
    const s = subjectForSection(q.section);
    if (s) return { plus: s.plus, minus: s.minus };
  }
  return { plus: Number(q.plus) || 0, minus: Number(q.minus) || 0 };
}

export function detailGroup(section: string): string {
  const s = subjectForSection(section);
  if (s) return s.label;
  return String(section ?? "").trim() || "General";
}

// Authoritative scoring: iterate the paper's questions in order, apply each
// question's marks, and record everything the result screen needs.
export function scoreQuestions(
  questions: SessionQuestion[],
  picks: Pick[],
  template: string
): ScoreOutcome {
  const byId = new Map(picks.map((p) => [p.id, p.answer]));
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const details: DetailRow[] = [];

  for (const q of questions) {
    const picked = byId.has(q.id) ? byId.get(q.id) ?? null : null;
    const marks = marksUsed(q, template);
    let points = 0;
    let ok = false;
    if (picked === null) skipped += 1;
    else if (picked === q.answer) {
      correct += 1;
      points = marks.plus;
      ok = true;
    } else {
      wrong += 1;
      points = marks.minus;
    }
    score += points;
    details.push({
      id: q.id,
      section: q.section,
      group: detailGroup(q.section),
      stem: q.stem,
      opts: q.options,
      picked,
      correct: q.answer,
      exp: q.explanation,
      ok,
      plus: marks.plus,
      minus: marks.minus,
      points: round1(points),
    });
  }

  return { score: round1(score), correct, wrong, skipped, details };
}

export type SubjectResult = {
  key: SubjectKey | "other";
  label: string;
  count: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  maxMarks: number;
};

/** Subject-wise roll-up in official paper order; unknown sections go last. */
export function subjectResults(details: DetailRow[]): SubjectResult[] {
  const order: Array<SubjectResult & { rank: number }> = [];
  const index = new Map<string, number>();
  for (const d of details) {
    let at = index.get(d.group);
    if (at === undefined) {
      const s = subjectForSection(d.section);
      at = order.length;
      index.set(d.group, at);
      order.push({
        key: (s?.key ?? "other") as SubjectKey | "other",
        label: d.group,
        count: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0,
        maxMarks: 0,
        rank: s ? ["maths", "reasoning", "computer", "english"].indexOf(s.key) : 99,
      });
    }
    const g = order[at];
    g.count += 1;
    if (d.picked === null) g.skipped += 1;
    else if (d.ok) g.correct += 1;
    else g.wrong += 1;
    g.score += d.points;
    g.maxMarks += d.plus;
  }
  order.sort((a, b) => a.rank - b.rank);
  return order.map((g) => ({ ...g, score: round1(g.score), maxMarks: round1(g.maxMarks) }));
}
