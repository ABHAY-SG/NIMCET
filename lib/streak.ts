export type AttemptLike = {
  created_at: string;
};

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Day key in the CLIENT's timezone, encoded as UTC midnight so it sorts and
 * parses identically on the server. `tzOffsetMinutes` is the value from
 * Date#getTimezoneOffset() (e.g. IST = -330).
 */
export function dayKeyFromIso(iso: string, tzOffsetMinutes = 0): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const offset = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  return new Date(t - offset * 60_000).toISOString().slice(0, 10);
}

export function calcStreakFromDays(days: Set<string>, todayKey: string): number {
  let streak = 0;
  const cursor = new Date(`${todayKey}T00:00:00.000Z`);
  if (!days.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function calcBestStreakFromDays(days: Set<string>): number {
  if (days.size === 0) return 0;
  const sorted = Array.from(days).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(`${sorted[i - 1]}T00:00:00.000Z`);
    const cur = Date.parse(`${sorted[i]}T00:00:00.000Z`);
    if (Math.round((cur - prev) / 86400000) === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

export function lastWeekActivityFromDays(
  days: Set<string>,
  todayKey: string
): Array<{ label: string; active: boolean; isToday: boolean }> {
  const out: Array<{ label: string; active: boolean; isToday: boolean }> = [];
  const dow = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: dow[d.getUTCDay()], active: days.has(key), isToday: i === 0 });
  }
  return out;
}

function activeDays(all: AttemptLike[]): Set<string> {
  const days = new Set<string>();
  for (const a of all) {
    const d = new Date(a.created_at);
    if (!Number.isNaN(d.getTime())) days.add(dayKey(d));
  }
  return days;
}

// Current streak: consecutive active days ending today (or yesterday, so an
// untouched today doesn't kill yesterday's streak).
export function calcStreak(all: AttemptLike[]): number {
  const days = activeDays(all);
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Best streak ever: longest consecutive-day run in the full history.
export function calcBestStreak(all: AttemptLike[]): number {
  const days = activeDays(all);
  if (days.size === 0) return 0;
  const sorted = Array.from(days).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const cur = new Date(sorted[i] + "T00:00:00");
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

// Human label: 0 → "No streak", 1 → "1 Day Streak", n → "N Days Streak".
export function formatStreak(days: number): string {
  if (days <= 0) return "No streak";
  return days === 1 ? "1 Day Streak" : `${days} Days Streak`;
}
// Last 7 days ending today, for the weekly activity row.
export function lastWeekActivity(all: AttemptLike[]): Array<{ label: string; active: boolean; isToday: boolean }> {
  const days = activeDays(all);
  const out: Array<{ label: string; active: boolean; isToday: boolean }> = [];
  const dow = ["S", "M", "T", "W", "T", "F", "S"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ label: dow[d.getDay()], active: days.has(dayKey(d)), isToday: i === 0 });
  }
  return out;
}
