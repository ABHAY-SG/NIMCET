export type AttemptLike = {
  created_at: string;
};

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
