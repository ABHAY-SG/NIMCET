// Timed-part helpers for sectioned mocks (e.g. the NIMCET full-length paper).
// A part is a contiguous block of questions with its own clock. Parts are
// pure data (tests.sections) and entirely optional: tests without sections
// keep the original single continuous timer, and any malformed part data
// degrades to that same safe default instead of guessing.

export type ExamPart = { label: string; minutes: number; count: number };

// sessionStorage key for an in-progress server-scored run. v2 stores the run
// START time (plus marked-for-review flags); v1 (deadline only) is purged.
export const RUN_KEY = "nimcuet-run-v2";
export const LEGACY_RUN_KEY = "nimcuet-run-v1";

// Strict, defensive parse: one malformed part — or a count that does not add
// up to the question list — disables timed parts entirely (continuous clock).
export function parseParts(raw: unknown, totalQuestions: number): ExamPart[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 8) return null;
  const parts: ExamPart[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const minutes = Number(o.minutes);
    const count = Number(o.count);
    if (!label || label.length > 80) return null;
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) return null;
    if (!Number.isInteger(count) || count <= 0 || count > 500) return null;
    parts.push({ label, minutes: Math.floor(minutes), count });
  }
  let sum = 0;
  for (const p of parts) sum += p.count;
  if (sum !== totalQuestions) return null;
  return parts;
}

// Question index ranges of each part, in order.
export function partRanges(parts: ExamPart[]): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (const p of parts) {
    out.push({ start, end: start + p.count });
    start += p.count;
  }
  return out;
}

// Index of the part whose window contains `elapsedMs`, clamped to the last
// part once every window has passed.
export function activePartAt(parts: ExamPart[], elapsedMs: number): number {
  let acc = 0;
  for (let i = 0; i < parts.length; i++) {
    acc += parts[i].minutes * 60_000;
    if (elapsedMs < acc) return i;
  }
  return parts.length - 1;
}

export function totalMs(parts: ExamPart[]): number {
  return parts.reduce((s, p) => s + p.minutes, 0) * 60_000;
}

// Absolute epoch deadline of part `i` for a run that started at `startAt`.
export function partDeadline(parts: ExamPart[], startAt: number, i: number): number {
  let ms = 0;
  for (let k = 0; k <= i && k < parts.length; k++) ms += parts[k].minutes * 60_000;
  return startAt + ms;
}
