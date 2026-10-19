import { getSupabase } from "./supabase";
import { apiGet } from "./api";

// ---------------------------------------------------------------------------
// Data access for the mobile app.
//
// Two sources, both already trusted by the website:
//   1. Supabase under RLS — `tests` (published) and `attempts` (own rows only).
//      These are exactly the reads the website does in the browser, so the app
//      is just another RLS-bound client. No service-role key is involved.
//   2. The existing student APIs over HTTPS with the bearer token (question
//      bank, announcements) — see lib/api.ts.
// ---------------------------------------------------------------------------

export type StudentTest = {
  id: string;
  exam: string;
  title: string;
  tag: string;
  minutes: number;
  free: boolean;
  question_ids: string[];
  sections: unknown;
  template: string | null;
  created_at: string;
};

export type AttemptRow = {
  id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

export type BankQuestion = {
  id: string;
  section: string;
  difficulty: string;
  plus: number;
  minus: number;
};

export type ExamPart = { label: string; minutes: number; count: number };

const TEST_COLS = "id,exam,title,tag,minutes,free,question_ids,sections,template,created_at";

export async function listPublishedTests(limit = 60): Promise<StudentTest[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tests")
    .select(TEST_COLS)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentTest[];
}

export async function getTest(id: string): Promise<StudentTest | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tests")
    .select(TEST_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StudentTest | null) ?? null;
}

export async function listMyAttempts(limit = 50): Promise<AttemptRow[]> {
  const sb = getSupabase();
  // RLS restricts this to the signed-in user's own rows (user_id = auth.uid()).
  const { data, error } = await sb
    .from("attempts")
    .select("id,test,score,correct,wrong,skipped,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AttemptRow[];
}

/** Question bank (metadata only — no answers leave the server) via bearer API. */
export async function fetchBank(limit = 300): Promise<BankQuestion[]> {
  const res = await apiGet<{ rows: BankQuestion[] }>(`/api/student/questions?limit=${limit}`);
  return Array.isArray(res.rows) ? res.rows : [];
}

export type Announcement = { id: string; title: string; body: string; created_at: string };

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await apiGet<{ rows: Announcement[] }>("/api/student/announcements");
  return Array.isArray(res.rows) ? res.rows : [];
}

// ---------------------------------------------------------------------------
// Display helpers (no data fabrication — only formatting of real values)

const FULL_MOCK_TEMPLATE = "nimcet-2026";

export function isFullMockTemplate(v: unknown): boolean {
  return typeof v === "string" && v.trim() === FULL_MOCK_TEMPLATE;
}

/** Official NIMCET subject scheme, mirroring the website's lib/nimcet-full-mock.ts. */
export const NIMCET_SUBJECTS = [
  { key: "maths", label: "Mathematics", short: "Maths", count: 50, plus: 12, minus: -3, part: 0 },
  { key: "reasoning", label: "Analytical Ability & Logical Reasoning", short: "Reasoning", count: 40, plus: 6, minus: -1.5, part: 1 },
  { key: "computer", label: "Computer Awareness", short: "Computer", count: 20, plus: 6, minus: -1.5, part: 2 },
  { key: "english", label: "General English", short: "English", count: 10, plus: 4, minus: -1, part: 2 },
] as const;

export const FULL_MOCK_MAX_MARKS = 1000; // 50×12 + 40×6 + 20×6 + 10×4

/** Official timed parts, used when a full-mock test has no stored `sections`. */
export function defaultFullMockParts(): ExamPart[] {
  return [
    { label: "Part I — Mathematics", minutes: 70, count: 50 },
    { label: "Part II — Analytical Ability & Logical Reasoning", minutes: 30, count: 40 },
    { label: "Part III — Computer Awareness & General English", minutes: 20, count: 30 },
  ];
}

/**
 * Strict, defensive parse of `tests.sections` — mirrors the website's
 * lib/exam-parts.ts. One malformed part, or a count that does not add up to the
 * question list, disables timed parts (caller falls back to `minutes`).
 */
export function parseSections(raw: unknown, totalQuestions: number): ExamPart[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 8) return null;
  const parts: ExamPart[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    const minutes = Number(o.minutes);
    const count = Number(o.count);
    if (!label || !Number.isFinite(minutes) || minutes <= 0) return null;
    if (!Number.isFinite(count) || count <= 0) return null;
    parts.push({ label, minutes, count });
  }
  const sum = parts.reduce((s, p) => s + p.count, 0);
  if (totalQuestions > 0 && sum !== totalQuestions) return null;
  return parts;
}

/** The parts a test will actually be served with (stored sections, or template). */
export function partsForTest(test: StudentTest): ExamPart[] | null {
  const stored = parseSections(test.sections, test.question_ids.length);
  if (stored) return stored;
  if (isFullMockTemplate(test.template)) return defaultFullMockParts();
  return null;
}

export function displayMinutes(test: StudentTest): number {
  const parts = partsForTest(test);
  return parts ? parts.reduce((s, p) => s + p.minutes, 0) : test.minutes;
}

/** Marks a test is worth for the official full-mock pattern; null for others. */
export function displayMarks(test: StudentTest): number | null {
  if (isFullMockTemplate(test.template)) return FULL_MOCK_MAX_MARKS;
  return null;
}

export type AttemptStats = {
  count: number;
  best: number;
  average: number;
  accuracy: number | null;
  attemptedQuestions: number;
};

export function computeStats(attempts: AttemptRow[]): AttemptStats | null {
  if (attempts.length === 0) return null;
  const scores = attempts.map((a) => Number(a.score) || 0);
  const best = Math.max(...scores);
  const average = scores.reduce((s, v) => s + v, 0) / scores.length;
  const correct = attempts.reduce((s, a) => s + (Number(a.correct) || 0), 0);
  const wrong = attempts.reduce((s, a) => s + (Number(a.wrong) || 0), 0);
  const skipped = attempts.reduce((s, a) => s + (Number(a.skipped) || 0), 0);
  const answered = correct + wrong;
  return {
    count: attempts.length,
    best: Math.round(best * 10) / 10,
    average: Math.round(average * 10) / 10,
    accuracy: answered === 0 ? null : Math.round((correct / answered) * 100),
    attemptedQuestions: correct + wrong + skipped,
  };
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
