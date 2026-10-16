"use client";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { getSupabase } from "@/lib/supabase";

type AttemptRow = { user_id: string; test: string; score: number; created_at: string };
type TestRow = { id: string; title: string; published: boolean; created_at: string; question_ids: string[] };

const RANGES = [7, 14, 30] as const;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortUid(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl px-5 py-4 backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}>
      <div className="mono text-[11px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>{label}</div>
      <div className="mono mt-1 text-3xl font-extrabold" style={{ color: "var(--text)" }}>{value}</div>
      <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}

function Bars({ data, color }: { data: Array<{ label: string; value: number }>; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 560, H = 150, PAD = 8;
  const bw = (W - PAD * 2) / Math.max(data.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img">
      {data.map((d, i) => {
        const h = Math.max(3, ((H - 34) * d.value) / max);
        const x = PAD + i * bw + bw * 0.22;
        return (
          <g key={d.label}>
            <rect x={x} y={H - 20 - h} width={Math.max(4, bw * 0.56)} height={h} rx="4" fill={color} opacity={0.85}>
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            {data.length <= 14 && (
              <text x={x + bw * 0.28} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">
                {d.label.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminHome() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [qCount, setQCount] = useState<number | null>(null);
  const [attCount, setAttCount] = useState<number | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>(14);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  // Anchor date is client-only: `new Date()` during render breaks static
  // prerender, so every date-derived value below waits for mount.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const [attRows, tRows, qHead, aHead] = await Promise.all([
          sb.from("attempts").select("user_id,test,score,created_at").order("created_at", { ascending: false }).limit(1000),
          sb.from("tests").select("id,title,published,created_at,question_ids").order("created_at", { ascending: false }).limit(100),
          sb.from("questions").select("id", { count: "exact", head: true }),
          sb.from("attempts").select("id", { count: "exact", head: true }),
        ]);
        if (attRows.error || tRows.error || qHead.error || aHead.error) {
          setNote("Some tables are missing — run the admin SQL from setup to create questions/tests and enable full stats.");
        }
        setAttempts((attRows.data ?? []) as AttemptRow[]);
        setTests((tRows.data ?? []) as TestRow[]);
        setQCount(qHead.count ?? 0);
        setAttCount(aHead.count ?? 0);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not load stats.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cutoff = useMemo(() => {
    if (!now) return new Date(0);
    const d = new Date(now);
    d.setDate(d.getDate() - (range - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now, range]);

  // Distinct users + first-seen dates (proxy: users table is not readable
  // with the anon key, so activity history stands in — labeled as such).
  const users = useMemo(() => {
    const first = new Map<string, Date>();
    for (const a of attempts) {
      const d = new Date(a.created_at);
      if (!a.user_id || Number.isNaN(d.getTime())) continue;
      if (!first.has(a.user_id) || d < (first.get(a.user_id) as Date)) first.set(a.user_id, d);
    }
    return first;
  }, [attempts]);

  const inRangeAttempts = useMemo(
    () => attempts.filter((a) => new Date(a.created_at) >= cutoff),
    [attempts, cutoff]
  );

  const newUsers7 = useMemo(() => {
    if (!now) return 0;
    const week = new Date(now);
    week.setDate(week.getDate() - 6);
    week.setHours(0, 0, 0, 0);
    let n = 0;
    users.forEach((d) => { if (d >= week) n++; });
    return n;
  }, [users, now]);

  const published = useMemo(() => tests.filter((t) => t.published), [tests]);
  const drafts = useMemo(() => tests.filter((t) => !t.published), [tests]);

  const avgScore = useMemo(() => {
    if (attempts.length === 0) return "—";
    const m = attempts.reduce((s, a) => s + (Number(a.score) || 0), 0) / attempts.length;
    return String(Math.round(m * 10) / 10);
  }, [attempts]);

  const days = useMemo(() => {
    if (!now) return [] as Array<{ key: string; label: string }>;
    const arr: Array<{ key: string; label: string }> = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      arr.push({ key: dayKey(d), label: dayKey(d) });
    }
    return arr;
  }, [now, range]);

  const attemptsByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of inRangeAttempts) {
      const d = new Date(a.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return days.map((d) => ({ label: d.label, value: m.get(d.key) ?? 0 }));
  }, [inRangeAttempts, days]);

  const usersByDay = useMemo(() => {
    const m = new Map<string, number>();
    users.forEach((d) => {
      if (d < cutoff) return;
      const k = dayKey(d);
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return days.map((d) => ({ label: d.label, value: m.get(d.key) ?? 0 }));
  }, [users, days, cutoff]);

  const topTests = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of inRangeAttempts) m.set(a.test, (m.get(a.test) ?? 0) + 1);
    return Array.from(m.entries()).sort((x, y) => y[1] - x[1]).slice(0, 5)
      .map(([label, value]) => ({ label: label.length > 22 ? `${label.slice(0, 21)}…` : label, value }));
  }, [inRangeAttempts]);

  const recent = attempts.slice(0, 5);

  const cardStyle: React.CSSProperties = {
    background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)",
    border: "1px solid var(--border)",
  };

  return (
    <AdminLayout title="Overview" crumbs={["Overview"]}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>Range:</span>
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold"
            style={range === r ? { background: "var(--btn-bg)", color: "var(--btn-text)" } : { border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            {r}d
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-4 animate-pulse space-y-2.5" aria-label="Loading">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--pill)" }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="ACTIVE USERS" value={String(users.size)} sub="distinct attempt makers" />
            <Stat label="NEW (7D)" value={String(newUsers7)} sub="first seen this week" />
            <Stat label="PUBLISHED" value={String(published.length)} sub="live mock tests" />
            <Stat label="QUESTIONS" value={qCount === null ? "—" : String(qCount)} sub="in the bank" />
            <Stat label="ATTEMPTS" value={attCount === null ? "—" : String(attCount)} sub="mock finishes saved" />
            <Stat label="AVG SCORE" value={avgScore} sub="last ≤1000 attempts" />
          </div>

          <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h2 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Attempts per day</h2>
              {attemptsByDay.every((d) => d.value === 0) ? (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No attempts in this range yet.</p>
              ) : (
                <Bars data={attemptsByDay} color="var(--accent)" />
              )}
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h2 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>First-seen users per day</h2>
              {usersByDay.every((d) => d.value === 0) ? (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No new users in this range yet.</p>
              ) : (
                <Bars data={usersByDay} color="#16a34a" />
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h2 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Most attempted tests</h2>
              {topTests.length === 0 ? (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No attempts in this range yet.</p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {topTests.map((t) => (
                    <div key={t.label}>
                      <div className="flex justify-between text-xs font-bold">
                        <span className="truncate" style={{ color: "var(--text)" }}>{t.label}</span>
                        <span className="mono ml-2" style={{ color: "var(--accent)" }}>{t.value}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((t.value / Math.max(topTests[0].value, 1)) * 100))}%`, background: "var(--accent)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h2 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Draft tests</h2>
              {drafts.length === 0 ? (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No drafts — everything published is live.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {drafts.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold" style={{ color: "var(--text)" }}>{t.title}</span>
                      <span className="mono shrink-0 text-[11px]" style={{ color: "var(--muted)" }}>
                        {Array.isArray(t.question_ids) ? t.question_ids.length : 0}Q • DRAFT
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-5" style={cardStyle}>
            <h2 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Recent attempts</h2>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No attempts yet.</p>
            ) : (
              <ul className="mt-2 divide-y text-sm" style={{ borderColor: "var(--border)" }}>
                {recent.map((a, i) => (
                  <li key={`${a.user_id}-${a.created_at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="mono text-xs" style={{ color: "var(--muted)" }} title={a.user_id}>{shortUid(a.user_id)}</span>
                    <span className="min-w-0 flex-1 truncate font-bold" style={{ color: "var(--text)" }}>{a.test}</span>
                    <span className="mono text-xs font-extrabold" style={{ color: "var(--accent)" }}>{a.score}</span>
                    <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>
                      {new Date(a.created_at).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {note && (
        <p className="mt-4 rounded-xl px-4 py-3 text-[13px]" style={{ background: "var(--pill)" }}>{note}</p>
      )}
    </AdminLayout>
  );
}
