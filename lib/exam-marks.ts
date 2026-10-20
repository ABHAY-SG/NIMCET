// Per-session "mark for review" persistence.
//
// Marks are UI-only (they never affect scoring), but they used to live in
// component state and were wiped every time a timed part loaded — switching
// sections or refreshing silently lost them. They are now mirrored into
// sessionStorage under the server session id, so:
//   - a refresh during the exam restores the same marks;
//   - a user who leaves and resumes the SAME session gets them back;
//   - a finished session clears its key (no stale marks in a later attempt).
//
// sessionStorage (not localStorage) is deliberate: marks belong to one tab's
// live exam, never to the device or the account.

const PREFIX = "nimcuet-exam-marks:";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function examMarksKey(sessionId: string): string {
  return `${PREFIX}${sessionId}`;
}

function validId(sessionId: string): boolean {
  return typeof sessionId === "string" && sessionId.length > 0;
}

/** Reads this session's marks; malformed/absent data is an empty object. */
export function readExamMarks(sessionId: string): Record<string, true> {
  if (!validId(sessionId)) return {};
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(examMarksKey(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, true> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof id === "string" && id && value === true) out[id] = true;
    }
    return out;
  } catch {
    return {};
  }
}

/** Writes marks; an empty set removes the key instead of storing `{}`. */
export function writeExamMarks(
  sessionId: string,
  marks: Record<string, true>
): void {
  if (!validId(sessionId)) return;
  const s = storage();
  if (!s) return;
  try {
    const clean: Record<string, true> = {};
    for (const [id, value] of Object.entries(marks)) {
      if (typeof id === "string" && id && value === true) clean[id] = true;
    }
    if (Object.keys(clean).length === 0) {
      s.removeItem(examMarksKey(sessionId));
      return;
    }
    s.setItem(examMarksKey(sessionId), JSON.stringify(clean));
  } catch {
    // Quota/privacy-mode failures must never break the exam UI.
  }
}

export function clearExamMarks(sessionId: string): void {
  if (!validId(sessionId)) return;
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(examMarksKey(sessionId));
  } catch {}
}

/** Intersects stored marks with the questions currently on screen. */
export function marksForQuestions(
  sessionId: string,
  questionIds: string[]
): Record<string, true> {
  const stored = readExamMarks(sessionId);
  const out: Record<string, true> = {};
  for (const id of questionIds) if (stored[id]) out[id] = true;
  return out;
}
