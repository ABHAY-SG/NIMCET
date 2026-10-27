import {
  calcBestStreakFromDays,
  calcStreakFromDays,
  dayKeyFromIso,
  lastWeekActivityFromDays,
} from "./streak";

// Shapes shared by the dashboard and GET /api/student/stats. Kept framework-
// free so the aggregation itself is unit-testable.

export type AttemptRow = {
  id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

export type AttemptStats = {
  total: number;
  best: number;
  avg: number;
  correct: number;
  wrong: number;
  skipped: number;
  questions: number;
  answered: number;
  accuracy: number | null;
  streak: number;
  bestStreak: number;
  week: Array<{ label: string; active: boolean; isToday: boolean }>;
  byTest: Record<string, { count: number; best: number }>;
};

// Older attempts stored "Title (NQ)" while tests are keyed by title alone;
// compare on the base title so history from both formats lines up.
export function baseTestName(name: string): string {
  return String(name ?? "").replace(/\s*\(\d+\s*Q\)\s*$/i, "").trim();
}

// Device-local sample attempts and cloud attempts never represent the same
// submission today, but if they ever do, dedupe on test + counters + a
// five-minute time bucket instead of showing the same run twice.
export function attemptFingerprint(a: AttemptRow): string {
  const t = Date.parse(a.created_at);
  const bucket = Number.isFinite(t) ? Math.floor(t / 300_000) : String(a.created_at);
  return [
    baseTestName(a.test),
    Number(a.score) || 0,
    Number(a.correct) || 0,
    Number(a.wrong) || 0,
    Number(a.skipped) || 0,
    bucket,
  ].join("|");
}

/** Cloud rows win; local rows are appended only when not already present. */
export function mergeAttempts(cloud: AttemptRow[], local: AttemptRow[]): AttemptRow[] {
  const seen = new Set<string>();
  const out: AttemptRow[] = [];
  for (const row of [...cloud, ...local]) {
    const key = attemptFingerprint(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function calculateStats(rows: AttemptRow[], tzOffsetMinutes = 0, todayKey?: string): AttemptStats {
  const days = new Set<string>();
  for (const row of rows) {
    const key = dayKeyFromIso(row.created_at, tzOffsetMinutes);
    if (key) days.add(key);
  }
  const resolvedTodayKey =
    todayKey ||
    dayKeyFromIso(new Date().toISOString(), tzOffsetMinutes) ||
    new Date().toISOString().slice(0, 10);

  const total = rows.length;
  if (total === 0) {
    return {
      total: 0,
      best: 0,
      avg: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      questions: 0,
      answered: 0,
      accuracy: null,
      streak: 0,
      bestStreak: 0,
      week: lastWeekActivityFromDays(days, resolvedTodayKey),
      byTest: {},
    };
  }

  let best = Number(rows[0].score) || 0;
  let scoreSum = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const byTest: Record<string, { count: number; best: number }> = {};

  for (const row of rows) {
    const score = Number(row.score) || 0;
    const c = Number(row.correct) || 0;
    const w = Number(row.wrong) || 0;
    const s = Number(row.skipped) || 0;
    best = Math.max(best, score);
    scoreSum += score;
    correct += c;
    wrong += w;
    skipped += s;

    const key = baseTestName(row.test);
    if (key) {
      const entry = byTest[key] ?? { count: 0, best: score };
      entry.count += 1;
      entry.best = Math.max(entry.best, score);
      byTest[key] = entry;
    }
  }

  const answered = correct + wrong;
  return {
    total,
    best: Math.round(best * 10) / 10,
    avg: Math.round((scoreSum / total) * 10) / 10,
    correct,
    wrong,
    skipped,
    questions: correct + wrong + skipped,
    answered,
    accuracy: answered === 0 ? null : Math.round((correct / answered) * 100),
    streak: calcStreakFromDays(days, resolvedTodayKey),
    bestStreak: calcBestStreakFromDays(days),
    week: lastWeekActivityFromDays(days, resolvedTodayKey),
    byTest,
  };
}
