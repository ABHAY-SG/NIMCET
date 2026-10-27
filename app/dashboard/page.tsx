"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  FlaskConical,
  Flame,
  Gem,
  HelpCircle,
  History,
  Info,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquare,
  Minus,
  Phone,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";
import Reveal from "@/components/reveal";
import CountUp from "@/components/count-up";
import DashNav from "@/components/dash-nav";
import DashSide, { type DashView } from "@/components/dash-side";
import MockCard from "@/components/mock-card";
import MockHub from "@/components/mock-hub";
import MockBuilder from "@/components/mock-builder";
import { getAuthClient, resolveAvatarUrl, signOutAll } from "@/lib/supabase";
import { formatStreak } from "@/lib/streak";
import {
  attemptFingerprint,
  calculateStats,
  type AttemptStats,
} from "@/lib/attempt-stats";

type Attempt = {
  id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

const RING_C = 2 * Math.PI * 52;
const MEDALS = ["#f59e0b", "#94a3b8", "#b45309"];

type SeriesTest = {
  id: string;
  exam: string;
  title: string;
  tag: string;
  minutes: number;
  free: boolean;
  published: boolean;
  question_ids: string[];
};

function examLabel(exam: string): string {
  const e = exam.toLowerCase();
  if (e === "nimcet") return "NIMCET";
  if (e === "cuet-pg-mca" || e === "cuet") return "CUET PG";
  return exam.toUpperCase();
}

const MEDAL_LABEL = ["#1", "#2", "#3"];

function AttemptRow({ a, cloud = false, best = 0, rank = 0 }: { a: Attempt; cloud?: boolean; best?: number; rank?: number }) {
  const pct = best > 0 ? Math.min(100, Math.round(((Number(a.score) || 0) / best) * 100)) : 0;
  return (
    <div
      className="dash-card dash-card-hover flex items-center gap-3 p-3.5 sm:px-4"
      style={{ boxShadow: "var(--dash-shadow-xs)" }}
    >
      {rank > 0 && rank <= 3 ? (
        <span
          title={`Top ${rank} by score`}
          className="dash-num flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
          style={{ background: MEDALS[rank - 1], boxShadow: "0 6px 14px -8px rgba(0,0,0,.5)" }}
        >
          {MEDAL_LABEL[rank - 1]}
        </span>
      ) : (
        <span aria-hidden className="dash-icon-tile dash-icon-tile-neutral dash-icon-tile-sm h-9 w-9 rounded-full">
          {cloud ? <FileText size={15} /> : <ClipboardList size={15} />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>{a.test}</span>
          {!cloud && <span className="dash-chip !px-1.5 !py-0.5 !text-[9px]">THIS DEVICE</span>}
          {rank > 0 && rank <= 3 && <span className="dash-chip dash-chip-warning !px-1.5 !py-0.5 !text-[9px]">TOP {rank}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px]" style={{ color: "var(--muted)" }}>
          <span className="dash-num">{new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1" style={{ color: "var(--dash-success)" }}><Check size={11} strokeWidth={2.5} />{a.correct}</span>
          <span className="inline-flex items-center gap-1" style={{ color: "var(--dash-danger)" }}><XCircle size={11} />{a.wrong}</span>
          <span className="inline-flex items-center gap-1"><Minus size={11} />{a.skipped}</span>
        </div>
        {best > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="dash-progress flex-1"><span style={{ width: `${pct}%` }} /></div>
            <span className="dash-num text-[9.5px] font-bold" style={{ color: "var(--muted)" }}>{pct}%</span>
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="dash-num text-[19px] font-extrabold leading-none" style={{ color: "var(--text)" }}>{a.score}</div>
        <div className="mt-1 text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".1em" }}>score</div>
      </div>
    </div>
  );
}

function TrendChart({ data, stats }: { data: Attempt[]; stats?: AttemptStats | null }) {
  // Oldest → newest, last 10.
  const pts = data.slice(0, 10).reverse();
  if (pts.length === 0) return null;
  const values = pts.map((a) => Number(a.score) || 0);
  const max = Math.max(...values, 1);
  const W = 580;
  const H = 176;
  const padX = 34;
  const padTop = 16;
  const padBottom = 24;
  const plotH = H - padTop - padBottom;
  const step = pts.length > 1 ? (W - padX * 2) / (pts.length - 1) : 0;
  const coords = values.map((v, i) => ({
    x: padX + i * step,
    y: padTop + plotH - (v / max) * plotH,
    v,
  }));
  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `M ${padX},${padTop + plotH} L ${coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} L ${coords[coords.length - 1].x.toFixed(1)},${padTop + plotH} Z`;
  const latest = values[values.length - 1];
  const earlier = values[0];
  const change = latest - earlier;

  const answered = stats ? stats.correct + stats.wrong : 0;
  const totalQ = answered + (stats?.skipped ?? 0);
  const pctOf = (n: number) => (totalQ > 0 ? Math.round((n / totalQ) * 100) : 0);
  const answerRows = [
    { label: "Correct", value: stats?.correct ?? 0, pct: pctOf(stats?.correct ?? 0), color: "var(--dash-success)", soft: "var(--dash-success-soft)" },
    { label: "Wrong", value: stats?.wrong ?? 0, pct: pctOf(stats?.wrong ?? 0), color: "var(--dash-danger)", soft: "var(--dash-danger-soft)" },
    { label: "Skipped", value: stats?.skipped ?? 0, pct: pctOf(stats?.skipped ?? 0), color: "var(--muted)", soft: "var(--dash-surface-muted)" },
  ];

  const papers = stats
    ? Object.entries(stats.byTest)
        .sort((a, b) => b[1].count - a[1].count || b[1].best - a[1].best)
        .slice(0, 4)
    : [];
  const bestOverall = stats?.best ?? max;

  return (
    <section className="dash-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--dash-line)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="dash-icon-tile dash-icon-tile-sm" style={{ background: "var(--dash-info-soft)", borderColor: "rgba(31,95,191,.16)", color: "var(--dash-info)" }}>
            <TrendingUp size={15} />
          </span>
          <div>
            <h2 className="dash-title-sm">Performance analytics</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
              Last {pts.length} mock{pts.length === 1 ? "" : "s"} · oldest to newest
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="dash-num text-[18px] font-extrabold leading-none" style={{ color: "var(--text)" }}>{latest}</div>
            <div className="mt-1 text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".1em" }}>latest</div>
          </div>
          <span
            className="dash-chip"
            style={change > 0
              ? { color: "var(--dash-success)", background: "var(--dash-success-soft)", borderColor: "rgba(15,122,68,.18)" }
              : change < 0
                ? { color: "var(--dash-danger)", background: "var(--dash-danger-soft)", borderColor: "rgba(197,48,48,.18)" }
                : undefined}
          >
            {change > 0 ? `+${change}` : change === 0 ? "level" : change} pts
          </span>
        </div>
      </div>

      <div className="px-2 pb-1 pt-2 sm:px-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Score trend: ${pts.map((a) => `${a.test} scored ${a.score}`).join(", ")}`}
        >
          <defs>
            <linearGradient id="dash-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.33, 0.66, 1].map((f) => {
            const y = padTop + plotH * f;
            return (
              <g key={f}>
                <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="var(--dash-line)" strokeWidth="1" strokeDasharray={f === 0 || f === 1 ? undefined : "3 5"} />
                <text x={padX - 7} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="var(--muted)">
                  {Math.round(max * (1 - f))}
                </text>
              </g>
            );
          })}
          <path d={area} fill="url(#dash-trend-fill)" />
          <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((p, i) => (
            <g key={pts[i]?.id ?? i}>
              <circle cx={p.x} cy={p.y} r="4.2" fill="var(--dash-surface)" stroke="var(--accent)" strokeWidth="2.2" />
              {(i === 0 || i === coords.length - 1 || pts.length <= 5) && (
                <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text)">{p.v}</text>
              )}
              <title>{`${pts[i]?.test ?? "Mock"}: ${p.v}`}</title>
            </g>
          ))}
        </svg>
      </div>

      {stats && totalQ > 0 && (
        <div className="grid gap-px border-t sm:grid-cols-3" style={{ borderColor: "var(--dash-line)", background: "var(--dash-line)" }}>
          {answerRows.map((row) => (
            <div key={row.label} className="px-4 py-3" style={{ background: "var(--dash-surface)" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".08em" }}>{row.label}</span>
                <span className="dash-num text-[12.5px] font-bold" style={{ color: row.color }}>{row.value}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: row.soft }}>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${row.pct}%`, background: row.color, transition: "width .8s var(--ease)" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {papers.length > 0 && (
        <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: "var(--dash-line)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".12em" }}>Paper-wise best</h3>
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>Top {papers.length} by attempts</span>
          </div>
          <ul className="mt-2.5 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
            {papers.map(([name, value]) => {
              const pct = bestOverall > 0 ? Math.min(100, Math.round((value.best / bestOverall) * 100)) : 0;
              return (
                <li key={name} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[11.5px] font-semibold" style={{ color: "var(--text)" }} title={name}>{name}</span>
                    <span className="dash-num shrink-0 text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>
                      {value.best} <span className="font-medium">· {value.count}×</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "var(--dash-surface-strong)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)", opacity: .75 }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [localAttempts, setLocalAttempts] = useState<Attempt[]>([]);
  const [series, setSeries] = useState<SeriesTest[]>([]);
  const [seriesReady, setSeriesReady] = useState(false);
  const [examFilter, setExamFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [serverStats, setServerStats] = useState<AttemptStats | null>(null);
  const [statsTruncated, setStatsTruncated] = useState(false);
  const [todayLine, setTodayLine] = useState("");
  const [sideOpen, setSideOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [view, setView] = useState<DashView>("home");
  const [notices, setNotices] = useState<Array<{ id: string; title: string; body: string; created_at: string }>>([]);
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [fb, setFb] = useState({ category: "general", subject: "", message: "" });
  const [fbBusy, setFbBusy] = useState(false);
  const [fbMsg, setFbMsg] = useState("");
  const [fbDone, setFbDone] = useState(false);

  // Server-side aggregate stats. Exact totals/best/avg/streak over the whole
  // history — never a slice of the 20 rows rendered below. The timezone
  // offset keeps day streaks in the student's local calendar.
  const loadCloudStats = useCallback(async (silent = false) => {
    try {
      const tz = new Date().getTimezoneOffset();
      const r = await fetch(`/api/student/stats?tzOffset=${tz}`, {
        credentials: "same-origin",
      });
      const j = (await r.json().catch(() => ({}))) as {
        attempts?: Attempt[];
        stats?: AttemptStats | null;
        truncated?: boolean;
        missingTable?: boolean;
        error?: string;
      };
      if (!r.ok) {
        if (!silent) setNote(j.error || `Could not load your statistics (${r.status}).`);
        return;
      }
      if (j.missingTable) {
        if (!silent) setNote("Attempts table not found yet — run the SQL from setup to enable history.");
        return;
      }
      setAttempts(Array.isArray(j.attempts) ? j.attempts : []);
      setServerStats(j.stats ?? null);
      setStatsTruncated(!!j.truncated);
    } catch {
      if (!silent) setNote("Could not reach the statistics service — check your connection and retry.");
    }
  }, []);

  // Dashboard scrolls without a visible scrollbar track.
  useEffect(() => {
    try {
      document.documentElement.classList.add("noscrollbar");
    } catch {}
    return () => {
      try {
        document.documentElement.classList.remove("noscrollbar");
      } catch {}
    };
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock text; rendering it during prerender would bake the build date into HTML.
      setTodayLine(new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nimcuet-attempts");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read of a browser-only store.
      if (raw) setLocalAttempts(JSON.parse(raw));
    } catch {}
  }, []);

  // Remember the sidebar's compact/expanded choice across dashboard visits.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read of a browser-only preference.
      setSideCollapsed(localStorage.getItem("nimcuet.dash.side.collapsed") === "1");
    } catch {}
  }, []);

  const toggleSideCollapsed = () => {
    setSideCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nimcuet.dash.side.collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const selectView = (next: DashView) => {
    setView(next);
    setSideOpen(false);
    try {
      const url = new URL(window.location.href);
      if (next === "home") url.searchParams.delete("view");
      else url.searchParams.set("view", next);
      window.history.replaceState(null, "", url);
    } catch {}
  };

  // Deep links from the header and profile sidebar: /dashboard?view=history.
  // Reading location on mount keeps the page prerender-safe.
  useEffect(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get("view");
      const allowed: DashView[] = [
        "home", "mock", "nimcet-pyq", "cuet-mock", "cuet-pyq",
        "builder", "history", "contact", "pricing", "feedback",
      ];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only URL state, unavailable while prerendering.
      if (requested && allowed.includes(requested as DashView)) setView(requested as DashView);
    } catch {}
  }, []);

  // Published notices from the admin panel. Drafts never reach this endpoint.
  // Failure is silent: the section simply doesn't render.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/student/announcements", { credentials: "same-origin" });
        const j = (await r.json()) as { rows?: Array<{ id: string; title: string; body: string; created_at: string }> };
        if (r.ok && Array.isArray(j.rows)) setNotices(j.rows);
      } catch {}
    })();
  }, []);

  // Student → admin feedback. Identity comes from the session server-side;
  // validation and rate limiting live in POST /api/student/feedback.
  const sendFeedback = async () => {
    const subject = fb.subject.trim();
    const message = fb.message.trim();
    if (subject.length < 3) { setFbMsg("Give the message a short subject (3+ characters)."); return; }
    if (message.length < 10) { setFbMsg("Add a few more details (at least 10 characters)."); return; }
    setFbBusy(true);
    setFbMsg("");
    try {
      const r = await fetch("/api/student/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: fb.category, subject, message }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || `Send failed (${r.status}).`);
      setFbDone(true);
      setFb({ category: "general", subject: "", message: "" });
    } catch (e) {
      setFbMsg(e instanceof Error ? e.message : "Send failed. Try again.");
    } finally {
      setFbBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const sb = getAuthClient();
        let user = (await sb.auth.getUser()).data.user;
        if (!user) {
          // Recovery beat: a cookie session set moments ago (or a token that
          // just rotated) can need one more pass before the auth server sees
          // it. Never bounce a signed-in student to login over one hiccup.
          await new Promise((r) => setTimeout(r, 700));
          try { user = (await sb.auth.getUser()).data.user; } catch {}
        }
        if (!user) { router.replace("/login"); return; }
        if (!user.email_confirmed_at) {
          try { await signOutAll(); } catch {}
          router.replace("/login?verify-required=1");
          return;
        }
        setEmail(user.email ?? "");
        const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string; name?: string };
        const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || "";
        setDisplayName(full.trim() || (user.email ?? "").split("@")[0]);
        setAvatarUrl(resolveAvatarUrl(user.user_metadata));
        await loadCloudStats();
        // Published test series for the catalog. Failure hides the section —
        // never a fake list.
        try {
          const { data: tdata, error: terror } = await sb
            .from("tests")
            .select("id,exam,title,tag,minutes,free,published,question_ids")
            .eq("published", true)
            .limit(12);
          if (!terror && tdata) setSeries(tdata as SeriesTest[]);
        } catch {}
        setSeriesReady(true);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Auth is not configured yet.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadCloudStats]);

  // Exact server aggregates when the cloud has attempts; otherwise the
  // device-local sample history (same formula). Never a 20-row slice.
  const localStats = useMemo(
    () =>
      localAttempts.length > 0
        ? calculateStats(localAttempts, new Date().getTimezoneOffset())
        : null,
    [localAttempts]
  );
  const displayStats =
    serverStats && serverStats.total > 0 ? serverStats : localStats;

  const derived = useMemo<{
    total: string;
    best: string;
    avg: string;
    acc: string;
    questions: string;
    streak: number;
    bestStreak: number;
    week: Array<{ label: string; active: boolean; isToday: boolean }>;
  } | null>(() => {
    if (loading || !displayStats) return null;
    return {
      total: String(displayStats.total),
      best: String(displayStats.best),
      avg: String(displayStats.avg),
      acc: displayStats.accuracy === null ? "—" : `${displayStats.accuracy}%`,
      questions: String(displayStats.questions),
      streak: displayStats.streak,
      bestStreak: displayStats.bestStreak,
      week: displayStats.week,
    };
  }, [displayStats, loading]);

  const statsLabel = serverStats && serverStats.total > 0 ? "saved to cloud" : "on this device";

  const exams = useMemo(() => {
    const set = new Set(series.map((t) => t.exam).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [series]);

  const visibleSeries = examFilter === "all" ? series : series.filter((t) => t.exam === examFilter);

  const attemptsForTitle = (title: string) => displayStats?.byTest[title]?.count ?? 0;

  // Per-test counts/best come from the full history aggregate, not just the
  // 20 rows rendered below.
  const attemptedCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [title, value] of Object.entries(displayStats?.byTest ?? {})) {
      m[title] = value.count;
    }
    return m;
  }, [displayStats]);

  // Device-local rows are shown only when they are not already represented by
  // a cloud row (fingerprint = title + counters + 5-minute bucket).
  const deviceOnly = useMemo(() => {
    const cloud = new Set(attempts.map(attemptFingerprint));
    return localAttempts.filter((a) => !cloud.has(attemptFingerprint(a)));
  }, [attempts, localAttempts]);

  // Best score (full history) + top-3 ranks among the rendered recent rows.
  const bestScore = useMemo(
    () =>
      displayStats?.best ??
      attempts.reduce((m, a) => Math.max(m, Number(a.score) || 0), 0),
    [displayStats, attempts]
  );
  const localBest = useMemo(
    () =>
      localStats?.best ??
      localAttempts.reduce((m, a) => Math.max(m, Number(a.score) || 0), 0),
    [localStats, localAttempts]
  );
  const rankMap = useMemo(() => {
    const sorted = [...attempts].sort((x, y) => (Number(y.score) || 0) - (Number(x.score) || 0));
    const m = new Map<string, number>();
    sorted.slice(0, 3).forEach((a, i) => m.set(a.id, i + 1));
    return m;
  }, [attempts]);

  // Stat tiles. Numeric values animate up when the async stats land; the
  // streak keeps its full label, so it renders as plain text.
  const statTiles: Array<{
    icon: React.ReactNode; label: string; num?: number | null; dec?: number;
    suffix?: string; fallback: string; text?: string; sub: string; tone: "accent" | "info" | "success" | "warning";
  }> = [
    { icon: <ClipboardList size={16} />, label: "Mocks taken", num: derived ? Number(derived.total) : null, fallback: loading ? "…" : "0", sub: statsLabel, tone: "accent" },
    { icon: <Trophy size={16} />, label: "Best score", num: derived ? parseFloat(derived.best) : null, dec: derived && !Number.isInteger(parseFloat(derived.best)) ? 1 : 0, fallback: loading ? "…" : "—", sub: "all-time high", tone: "warning" },
    { icon: <BarChart3 size={16} />, label: "Average score", num: derived ? parseFloat(derived.avg) : null, dec: derived && !Number.isInteger(parseFloat(derived.avg)) ? 1 : 0, fallback: loading ? "…" : "—", sub: "across all mocks", tone: "info" },
    { icon: <Target size={16} />, label: "Accuracy", num: derived && derived.acc !== "—" ? parseFloat(derived.acc) : null, suffix: derived && derived.acc !== "—" ? "%" : "", fallback: loading ? "…" : "—", sub: "correct ÷ answered", tone: "success" },
    { icon: <HelpCircle size={16} />, label: "Questions", num: derived ? Number(derived.questions) : null, fallback: loading ? "…" : "0", sub: "attempted in total", tone: "accent" },
    { icon: <Flame size={16} />, label: "Day streak", num: null, fallback: loading ? "…" : "No streak", text: loading ? "…" : `${derived?.streak ?? 0} days`, sub: derived?.bestStreak ? `best ${derived.bestStreak} days` : "attempt daily", tone: "warning" },
  ];

  const statTone = (tone: "accent" | "info" | "success" | "warning"): React.CSSProperties => {
    if (tone === "info") return { background: "var(--dash-info-soft)", borderColor: "rgba(37,99,235,.16)", color: "var(--dash-info)" };
    if (tone === "success") return { background: "var(--dash-success-soft)", borderColor: "rgba(21,128,61,.16)", color: "var(--dash-success)" };
    if (tone === "warning") return { background: "var(--dash-warning-soft)", borderColor: "rgba(180,83,9,.16)", color: "var(--dash-warning)" };
    return {};
  };

  const clearLocal = () => {
    try {
      localStorage.removeItem("nimcuet-attempts");
    } catch {}
    setLocalAttempts([]);
  };

  // Refresh history whenever returning to home/history (e.g. after finishing
  // a mock inside the dashboard) — silent, no spinners or notes.
  useEffect(() => {
    if (view !== "home" && view !== "history") return;
    (async () => {
      try {
        const sb = getAuthClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        await loadCloudStats(true);
        try {
          const raw = localStorage.getItem("nimcuet-attempts");
          if (raw) setLocalAttempts(JSON.parse(raw));
        } catch {}
      } catch {}
    })();
  }, [view, loadCloudStats]);
  const streakSummary = {
    current: derived?.streak ?? 0,
    best: derived?.bestStreak ?? 0,
    week: derived?.week ?? [],
  };

  const viewMeta: Record<DashView, { title: string; subtitle: string }> = {
    home: { title: "Overview", subtitle: "Your preparation at a glance" },
    mock: { title: "Mock tests", subtitle: "Full-length practice with instant scoring" },
    "nimcet-pyq": { title: "NIMCET past papers", subtitle: "Real papers, real timing" },
    "cuet-mock": { title: "CUET PG practice", subtitle: "Full-length CUET PG MCA practice" },
    "cuet-pyq": { title: "CUET PG past papers", subtitle: "Work through past papers" },
    builder: { title: "Custom mock", subtitle: "Build a focused practice set" },
    history: { title: "History", subtitle: "Every attempt in one place" },
    contact: { title: "Support", subtitle: "Get help from the NimCuet team" },
    pricing: { title: "Plans & pricing", subtitle: "Simple access to the full catalogue" },
    feedback: { title: "Send feedback", subtitle: "Help improve the question bank" },
  };
  const currentMeta = viewMeta[view];
  const greeting = "Welcome back";
  const streakPct = derived?.bestStreak ? Math.min(1, (derived.streak ?? 0) / derived.bestStreak) : 0;

  return (
    <div className="dash-app">
      {!loading && email && (
        <DashNav
          email={email}
          displayName={displayName}
          avatarUrl={avatarUrl}
          onLogout={() => {}}
          streak={streakSummary}
          onMenuClick={() => setSideOpen(true)}
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          notices={notices}
        />
      )}
      <main className="dash-main mx-auto w-full max-w-[1560px] px-3 pb-20 pt-20 sm:px-5 lg:px-7">
        <DashSide
          mobileOpen={sideOpen}
          onClose={() => setSideOpen(false)}
          view={view}
          onSelect={selectView}
          collapsed={sideCollapsed}
          onToggleCollapsed={toggleSideCollapsed}
          streak={streakSummary}
        />
        <div
          id="attempts"
          className={`min-w-0 scroll-mt-24 transition-[margin-left] duration-300 ease-out ${
            sideCollapsed ? "lg:ml-[5.75rem]" : "lg:ml-[17.5rem]"
          }`}
        >
          {view === "home" && (
            <div className="space-y-4">
              <Reveal>
                <section className="dash-hero px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
                  <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-stretch">
                    <div className="flex min-w-0 flex-col justify-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10.5px] font-semibold text-white/85">
                          <CalendarDays size={12} />
                          {todayLine || "Today"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10.5px] font-semibold text-white/75">
                          NIMCET &amp; CUET PG
                        </span>
                        {!loading && (derived?.streak ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10.5px] font-extrabold text-[#083b3a]">
                            <Flame size={12} />
                            {formatStreak(derived?.streak ?? 0)}
                          </span>
                        )}
                      </div>
                      <h1 className="dash-display mt-3.5 max-w-xl text-[clamp(1.75rem,1.3rem+1.6vw,2.65rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white">
                        {loading
                          ? "Preparing your workspace"
                          : `${greeting}${displayName ? `, ${displayName.trim().split(/\s+/)[0]}` : ""}`}
                      </h1>
                      <p className="mt-3 max-w-xl text-[13px] leading-6 text-white/80 sm:text-[13.5px]">
                        {!loading && derived
                          ? derived.total !== "0"
                            ? derived.streak > 0
                              ? `${formatStreak(derived.streak)}. Your best score is ${derived.best}${derived.acc !== "—" ? ` at ${derived.acc} accuracy` : ""} — build on it with a focused mock today.`
                              : `${derived.total} mock${derived.total === "1" ? "" : "s"} completed${derived.acc !== "—" ? ` at ${derived.acc} accuracy` : ""}. Your best is ${derived.best} — take another timed paper to keep the momentum.`
                            : "Your preparation history starts with one attempt. Take a mock and your real progress will appear here."
                          : "Mock tests, previous-year papers and honest performance tracking for NIMCET and CUET PG MCA."}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => selectView("mock")}
                          className="dash-btn bg-white text-[#08302f] shadow-lg shadow-black/25 hover:bg-white/92"
                        >
                          <Play size={14} fill="currentColor" />
                          Start a mock
                          <ArrowRight size={14} />
                        </button>
                        <a
                          href="#series"
                          className="dash-btn border-white/25 bg-white/10 text-white hover:bg-white/16"
                          style={{ borderColor: "rgba(255,255,255,.24)" }}
                        >
                          Browse test series
                        </a>
                      </div>
                    </div>

                    <div className="dash-hero-panel flex flex-col justify-between gap-4 p-4 sm:p-5">
                      <div className="flex items-center gap-4">
                        <div className="relative h-[86px] w-[86px] shrink-0">
                          <svg width="86" height="86" viewBox="0 0 120 120" role="img" aria-label={`Current streak ${streakSummary.current} days, best ${streakSummary.best} days`}>
                            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="9" />
                            <circle
                              cx="60"
                              cy="60"
                              r="52"
                              fill="none"
                              stroke="#fff"
                              strokeWidth="9"
                              strokeLinecap="round"
                              strokeDasharray={RING_C}
                              strokeDashoffset={RING_C * (1 - streakPct)}
                              transform="rotate(-90 60 60)"
                              style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Flame size={14} className="text-white/80" />
                            <span className="dash-num mt-0.5 text-[15px] font-extrabold text-white">{loading ? "—" : `${derived?.streak ?? 0}d`}</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9.5px] font-bold uppercase text-white/80" style={{ letterSpacing: ".15em" }}>Current streak</div>
                          <div className="mt-1 truncate text-[15px] font-extrabold text-white">{loading ? "Loading…" : formatStreak(derived?.streak ?? 0)}</div>
                          <div className="mt-0.5 text-[11px] font-medium text-white/80">
                            {loading ? "Reading your history" : derived?.bestStreak ? `Best ${derived.bestStreak} days` : "Attempt daily to begin"}
                          </div>
                        </div>
                      </div>

                      {!loading && streakSummary.week.length > 0 && (
                        <div className="flex gap-1.5" aria-hidden>
                          {streakSummary.week.map((d, i) => (
                            <span
                              key={i}
                              title={d.active ? "Mock attempted" : "Rest day"}
                              className="flex h-7 flex-1 items-center justify-center rounded-[7px] text-[9px] font-bold"
                              style={d.active
                                ? { background: "#fff", color: "#083b3a" }
                                : {
                                    background: "rgba(255,255,255,0.08)",
                                    color: "rgba(255,255,255,.9)",
                                    outline: d.isToday ? "1.5px solid rgba(255,255,255,.8)" : "1px solid rgba(255,255,255,.1)",
                                  }}
                            >
                              {d.label}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="border-t pt-3.5" style={{ borderColor: "rgba(255,255,255,.14)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9.5px] font-bold uppercase text-white/80" style={{ letterSpacing: ".15em" }}>Next best step</span>
                          <button
                            type="button"
                            onClick={() => selectView("builder")}
                            className="inline-flex items-center gap-1 text-[11.5px] font-bold text-white transition-opacity hover:opacity-80"
                          >
                            Build a custom mock <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </Reveal>

              {note && (
                <div className="dash-alert dash-alert-danger" role="alert">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">{note}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setNote("");
                      void loadCloudStats();
                    }}
                    className="dash-btn dash-btn-sm dash-btn-danger shrink-0"
                  >
                    <RefreshCw size={13} /> Retry
                  </button>
                </div>
              )}

              <Reveal>
                <section className="dash-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--dash-line)" }}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="dash-icon-tile dash-icon-tile-sm"><BarChart3 size={15} /></span>
                      <div className="min-w-0">
                        <h2 className="dash-title-sm">Performance snapshot</h2>
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                          Exact totals from {statsLabel === "saved to cloud" ? "your cloud history" : "this device"}.
                        </p>
                      </div>
                    </div>
                    <span className="dash-chip">
                      {loading ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      {loading ? "Loading" : statsLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-6" style={{ background: "var(--dash-line)" }}>
                    {statTiles.map((s) => (
                      <div key={s.label} className="dash-stat">
                        <div className="flex items-center gap-2">
                          <span className="dash-icon-tile dash-icon-tile-sm" style={statTone(s.tone)}>{s.icon}</span>
                          <span className="dash-stat-label">{s.label}</span>
                        </div>
                        <div className="dash-stat-value mt-2.5">
                          {loading ? (
                            <span className="dash-skeleton inline-block h-6 w-16 align-middle" />
                          ) : s.text !== undefined ? (
                            s.text
                          ) : (
                            <CountUp value={s.num ?? null} decimals={s.dec ?? 0} suffix={s.suffix ?? ""} fallback={s.fallback} />
                          )}
                        </div>
                        <div className="dash-stat-note mt-1">{s.sub}</div>
                      </div>
                    ))}
                  </div>
                  {statsTruncated && (
                    <p className="border-t px-4 py-2.5 text-[10.5px]" style={{ borderColor: "var(--dash-line)", color: "var(--muted)" }}>
                      Totals cover your most recent 20,000 attempts.
                    </p>
                  )}
                </section>
              </Reveal>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="min-w-0 space-y-4">
                  <Reveal>
                    {loading ? (
                      <div className="dash-card p-5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="dash-skeleton h-5 w-40" />
                          <span className="dash-skeleton h-7 w-20" />
                        </div>
                        <div className="dash-skeleton mt-5 h-40 w-full" />
                      </div>
                    ) : attempts.length > 0 || localAttempts.length > 0 ? (
                      <TrendChart data={attempts.length > 0 ? attempts : localAttempts} stats={displayStats} />
                    ) : (
                      <section className="dash-card p-5">
                        <div className="flex items-center gap-2">
                          <span className="dash-icon-tile dash-icon-tile-sm"><TrendingUp size={15} /></span>
                          <h2 className="dash-title-sm">Performance analytics</h2>
                        </div>
                        <div className="dash-empty mt-3">
                          <span className="dash-empty-icon"><BarChart3 size={18} /></span>
                          <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>No trend yet</p>
                          <p className="max-w-[22rem] text-[11.5px] leading-5">Complete a mock and your score line will start here. Nothing is estimated or invented.</p>
                          <button type="button" onClick={() => selectView("mock")} className="dash-btn dash-btn-primary dash-btn-sm mt-1">
                            <Play size={13} /> Take your first mock
                          </button>
                        </div>
                      </section>
                    )}
                  </Reveal>

                  <Reveal>
                    <section id="series" className="scroll-mt-24">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="dash-eyebrow">Practice catalogue</div>
                          <h2 className="dash-title-sm mt-1">Recommended tests</h2>
                          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                            Published by the NimCuet team — real papers, real timing.
                          </p>
                        </div>
                        {series.length > 0 && (
                          <div className="dash-segmented noscroll max-w-full overflow-x-auto" role="group" aria-label="Filter tests by exam">
                            {exams.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => setExamFilter(e)}
                                data-active={examFilter === e ? "true" : "false"}
                                aria-pressed={examFilter === e}
                              >
                                {e === "all" ? "All exams" : examLabel(e)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {!seriesReady ? (
                        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                          {[0, 1, 2, 3].map((i) => <div key={i} className="dash-skeleton h-[300px]" />)}
                        </div>
                      ) : series.length === 0 ? (
                        <div className="dash-empty mt-3.5">
                          <span className="dash-empty-icon"><BookOpen size={18} /></span>
                          <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>No test series published yet</p>
                          <p className="max-w-[24rem] text-[11.5px] leading-5">The catalogue is empty right now. Published mock tests and previous-year papers will appear here.</p>
                        </div>
                      ) : visibleSeries.length === 0 ? (
                        <div className="dash-empty mt-3.5">
                          <span className="dash-empty-icon"><BookOpen size={18} /></span>
                          <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>No tests in this exam</p>
                          <button type="button" onClick={() => setExamFilter("all")} className="dash-btn dash-btn-secondary dash-btn-sm mt-1">Show all exams</button>
                        </div>
                      ) : (
                        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                          {visibleSeries.map((t) => {
                            const done = attemptsForTitle(t.title);
                            const qcount = Array.isArray(t.question_ids) ? t.question_ids.length : 0;
                            return (
                              <MockCard
                                key={t.id}
                                title={t.title}
                                exam={examLabel(t.exam)}
                                typeLabel={t.tag || undefined}
                                questions={qcount}
                                minutes={t.minutes}
                                free={t.free}
                                attempted={done}
                                onStart={() => selectView("mock")}
                                statusLabel={done > 0 ? "Attempted · open the mock hub" : "Not attempted yet"}
                              />
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </Reveal>

                  <Reveal>
                    <section>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="dash-title-sm">Recent attempts</h2>
                          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>Your latest cloud results, newest first.</p>
                        </div>
                        {attempts.length > 0 && (
                          <button type="button" onClick={() => selectView("history")} className="dash-btn dash-btn-ghost dash-btn-sm">
                            View all <ChevronRight size={13} />
                          </button>
                        )}
                      </div>

                      {loading ? (
                        <div className="mt-3 grid gap-2.5">
                          {[0, 1, 2].map((i) => <div key={i} className="dash-skeleton h-[84px]" />)}
                        </div>
                      ) : attempts.length === 0 ? (
                        <div className="dash-empty mt-3">
                          <span className="dash-empty-icon"><FileText size={18} /></span>
                          <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>No cloud attempts yet</p>
                          <p className="max-w-[24rem] text-[11.5px] leading-5">Finish a mock while signed in and it will be saved here across devices.</p>
                          <button type="button" onClick={() => selectView("mock")} className="dash-btn dash-btn-primary dash-btn-sm mt-1">
                            <Play size={13} /> Attempt a mock
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2.5">
                          {attempts.slice(0, 5).map((a) => (
                            <AttemptRow key={a.id} a={a} cloud best={bestScore} rank={rankMap.get(a.id) ?? 0} />
                          ))}
                        </div>
                      )}
                    </section>
                  </Reveal>

                  {deviceOnly.length > 0 && (
                    <Reveal>
                      <section>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="dash-title-sm">On this device</h2>
                            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>Saved locally — sign in to keep results across devices.</p>
                          </div>
                          <button type="button" onClick={clearLocal} className="dash-btn dash-btn-secondary dash-btn-sm">Clear</button>
                        </div>
                        <div className="mt-3 grid gap-2.5">
                          {deviceOnly.slice(0, 4).map((a) => <AttemptRow key={a.id} a={a} best={localBest} />)}
                        </div>
                      </section>
                    </Reveal>
                  )}
                </div>

                <aside className="min-w-0 space-y-4">
                  <Reveal>
                    <section className="dash-card overflow-hidden">
                      <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5" style={{ borderColor: "var(--dash-line)" }}>
                        <div className="flex items-center gap-2">
                          <span className="dash-icon-tile dash-icon-tile-sm"><CalendarDays size={15} /></span>
                          <h2 className="dash-title-sm">Preparation overview</h2>
                        </div>
                        <span className="dash-chip !px-2 !py-0.5 !text-[9px]">2027</span>
                      </div>
                      <div className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>NIMCET 2027</span>
                          <span className="dash-chip !px-2 !py-0.5 !text-[9px]">Date TBA</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--muted)" }}>
                          June 2027 cycle. Official date awaited — the countdown starts when it is announced.
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          {[
                            { value: "120", label: "Questions", icon: <ListChecks size={13} /> },
                            { value: "1000", label: "Marks", icon: <Trophy size={13} /> },
                            { value: "120m", label: "Duration", icon: <Clock3 size={13} /> },
                          ].map((item) => (
                            <div key={item.label} className="rounded-[10px] border px-2 py-2.5 text-center" style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}>
                              <span className="mx-auto flex items-center justify-center" style={{ color: "var(--accent)" }}>{item.icon}</span>
                              <div className="dash-num mt-1 text-[12.5px] font-extrabold" style={{ color: "var(--text)" }}>{item.value}</div>
                              <div className="text-[8px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".08em" }}>{item.label}</div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => selectView("mock")}
                          className="dash-btn dash-btn-primary dash-btn-sm mt-3.5 w-full"
                        >
                          <Play size={13} fill="currentColor" /> Practise NIMCET pattern
                        </button>
                      </div>
                    </section>
                  </Reveal>

                  {notices.length > 0 && (
                    <Reveal>
                      <section className="dash-card p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="dash-icon-tile dash-icon-tile-sm" style={{ background: "var(--dash-warning-soft)", borderColor: "rgba(163,90,7,.16)", color: "var(--dash-warning)" }}><Megaphone size={15} /></span>
                            <h2 className="dash-title-sm">Notices</h2>
                          </div>
                          {notices.length > 2 && (
                            <button type="button" onClick={() => setShowAllNotices((v) => !v)} className="dash-btn dash-btn-ghost dash-btn-sm">
                              {showAllNotices ? "Show less" : `All (${notices.length})`}
                            </button>
                          )}
                        </div>
                        <div className="mt-3 grid gap-2">
                          {(showAllNotices ? notices : notices.slice(0, 2)).map((n) => (
                            <div key={n.id} className="rounded-[10px] border px-3 py-2.5" style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}>
                              <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                                <span className="text-[11.5px] font-bold" style={{ color: "var(--text)" }}>{n.title}</span>
                                <span className="dash-num text-[9.5px]" style={{ color: "var(--muted)" }}>
                                  {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[10.5px] leading-5" style={{ color: "var(--muted)" }}>{n.body}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    </Reveal>
                  )}

                  <Reveal>
                    <section className="dash-card p-4">
                      <div className="flex items-center gap-2">
                        <span className="dash-icon-tile dash-icon-tile-sm"><Sparkles size={15} /></span>
                        <h2 className="dash-title-sm">Quick actions</h2>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { label: "Previous years", icon: <BookOpen size={15} />, onClick: () => selectView("nimcet-pyq") },
                          { label: "Custom mock", icon: <FlaskConical size={15} />, onClick: () => selectView("builder") },
                          { label: "Test history", icon: <History size={15} />, onClick: () => selectView("history") },
                          { label: "Plans", icon: <Gem size={15} />, onClick: () => selectView("pricing") },
                        ].map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            onClick={action.onClick}
                            className="group flex flex-col items-start gap-2 rounded-[12px] border p-3 text-left transition-colors hover:border-[var(--dash-brand-line)] hover:bg-[var(--dash-brand-soft)]"
                            style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}
                          >
                            <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: "var(--dash-surface)", border: "1px solid var(--dash-line)", color: "var(--accent)" }}>
                              {action.icon}
                            </span>
                            <span className="flex w-full items-center justify-between gap-1 text-[11.5px] font-semibold" style={{ color: "var(--text)" }}>
                              {action.label}
                              <ArrowUpRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                            </span>
                          </button>
                        ))}
                      </div>
                      <a href="#support" onClick={(e) => { e.preventDefault(); selectView("contact"); }} className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                        Need help? Contact support <ChevronRight size={12} />
                      </a>
                    </section>
                  </Reveal>
                </aside>
              </div>
            </div>
          )}

          {view === "mock" && <MockHub attempted={attemptedCounts} exam="nimcet" />}
          {view === "nimcet-pyq" && <MockHub attempted={attemptedCounts} exam="nimcet" collection="pyq" />}
          {view === "cuet-mock" && <MockHub attempted={attemptedCounts} exam="cuet" />}
          {view === "cuet-pyq" && <MockHub attempted={attemptedCounts} exam="cuet" collection="pyq" />}
          {view === "builder" && <MockBuilder />}

          {view === "history" && (
            <div className="space-y-4">
              <Reveal>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="dash-eyebrow">Your record</div>
                    <h1 className="dash-title mt-1">Test history</h1>
                    <p className="dash-subtitle mt-1 max-w-2xl">
                      Your latest 20 cloud attempts, newest first, plus device-local results not already saved to your account.
                    </p>
                  </div>
                  <button type="button" onClick={() => selectView("mock")} className="dash-btn dash-btn-primary">
                    <Play size={14} /> New mock
                  </button>
                </div>
              </Reveal>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: "Cloud attempts", value: derived?.total ?? "—", icon: <History size={15} /> },
                  { label: "Best score", value: derived?.best ?? "—", icon: <Trophy size={15} /> },
                  { label: "Accuracy", value: derived?.acc ?? "—", icon: <Target size={15} /> },
                ].map((s) => (
                  <div key={s.label} className="dash-card p-3.5">
                    <span className="dash-icon-tile dash-icon-tile-sm">{s.icon}</span>
                    <div className="dash-stat-value mt-2 text-[19px]">{loading ? "…" : s.value}</div>
                    <div className="dash-stat-label mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <section className="dash-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--dash-line)" }}>
                  <h2 className="dash-title-sm">Recent cloud attempts</h2>
                  <span className="dash-chip"><CloudIcon /> Latest 20</span>
                </div>
                <div className="p-3 sm:p-4">
                  {loading ? (
                    <div className="grid gap-2.5">{[0, 1, 2, 3].map((i) => <div key={i} className="dash-skeleton h-[84px]" />)}</div>
                  ) : attempts.length === 0 ? (
                    <div className="dash-empty">
                      <span className="dash-empty-icon"><History size={18} /></span>
                      <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>No cloud attempts yet</p>
                      <p className="max-w-[24rem] text-[11.5px] leading-5">Finish a mock while signed in and it will land here.</p>
                      <button type="button" onClick={() => selectView("mock")} className="dash-btn dash-btn-primary dash-btn-sm mt-1"><Play size={13} /> Take a mock</button>
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      {attempts.map((a) => <AttemptRow key={a.id} a={a} cloud best={bestScore} rank={rankMap.get(a.id) ?? 0} />)}
                    </div>
                  )}
                </div>
              </section>

              {deviceOnly.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="dash-title-sm">On this device</h2>
                      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>Local only — not synced to your account.</p>
                    </div>
                    <button type="button" onClick={clearLocal} className="dash-btn dash-btn-secondary dash-btn-sm">Clear</button>
                  </div>
                  <div className="mt-3 grid gap-2.5">
                    {deviceOnly.map((a) => <AttemptRow key={a.id} a={a} best={localBest} />)}
                  </div>
                </section>
              )}
            </div>
          )}

          {view === "contact" && (
            <div className="max-w-4xl space-y-4">
              <Reveal>
                <div>
                  <div className="dash-eyebrow">Support</div>
                  <h1 className="dash-title mt-1">Contact</h1>
                  <p className="dash-subtitle mt-1 max-w-xl">
                    Syllabus confusion, a plan question, or a bug in a mock — send a message and it goes directly to the team.
                  </p>
                </div>
              </Reveal>
              <div className="grid gap-3 sm:grid-cols-2">
                <a href="mailto:abhayincodingworld@gmail.com" className="dash-card dash-card-hover flex items-start gap-3.5 p-5">
                  <span className="dash-icon-tile"><Mail size={17} /></span>
                  <span className="min-w-0">
                    <span className="dash-eyebrow">Email</span>
                    <span className="mt-1 block break-all text-[13px] font-bold" style={{ color: "var(--text)" }}>abhayincodingworld@gmail.com</span>
                    <span className="mt-1 block text-[11px] leading-5" style={{ color: "var(--muted)" }}>Best for detailed questions and account help.</span>
                  </span>
                </a>
                <a href="tel:+917425097293" className="dash-card dash-card-hover flex items-start gap-3.5 p-5">
                  <span className="dash-icon-tile"><Phone size={17} /></span>
                  <span className="min-w-0">
                    <span className="dash-eyebrow">Phone</span>
                    <span className="mt-1 block text-[13px] font-bold" style={{ color: "var(--text)" }}>+91-74250-97293</span>
                    <span className="mt-1 block text-[11px] leading-5" style={{ color: "var(--muted)" }}>Call for urgent test-day issues.</span>
                  </span>
                </a>
              </div>
              <section className="dash-card flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="flex items-start gap-3.5">
                  <span className="dash-icon-tile"><MessageSquare size={17} /></span>
                  <div>
                    <h2 className="dash-title-sm">Report a question issue</h2>
                    <p className="mt-1 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>Include the test name and question number so it can be fixed quickly.</p>
                  </div>
                </div>
                <button type="button" onClick={() => selectView("feedback")} className="dash-btn dash-btn-primary">
                  Open feedback form <ArrowRight size={14} />
                </button>
              </section>
            </div>
          )}

          {view === "pricing" && (
            <div className="space-y-4">
              <Reveal>
                <div>
                  <div className="dash-eyebrow">Access</div>
                  <h1 className="dash-title mt-1">Plans</h1>
                  <p className="dash-subtitle mt-1 max-w-2xl">
                    Start free. Paid plans activate over UPI within a day on your registered email — full policy in{" "}
                    <a href="/terms" className="dash-link underline underline-offset-2">Terms</a>.
                  </p>
                </div>
              </Reveal>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    name: "Free",
                    price: "₹0",
                    period: "forever",
                    note: "Try the experience before paying.",
                    features: ["Free 12-question sample mock", "Solutions and scorecard", "No card required"],
                    action: { label: "Start free", onClick: () => selectView("mock") },
                  },
                  {
                    name: "Monthly",
                    price: "₹149",
                    period: "/ month",
                    note: "For a focused preparation month.",
                    features: ["Unlimited mocks", "Full section analytics", "All previous-year sets", "Cancel anytime"],
                    action: { label: "Choose Monthly", href: "mailto:abhayincodingworld@gmail.com?subject=Activate%20NIMCET%20Monthly%20plan" },
                  },
                  {
                    name: "Annual",
                    price: "₹699",
                    period: "/ year",
                    note: "For the full admission cycle.",
                    features: ["12 months of full access", "Everything in Monthly", "Priority support"],
                    action: { label: "Choose Annual", href: "mailto:abhayincodingworld@gmail.com?subject=Activate%20NIMCET%20Annual%20plan" },
                  },
                ].map((plan) => (
                  <article key={plan.name} className="dash-card flex flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="dash-title-sm">{plan.name}</h2>
                      {plan.name === "Free" && <span className="dash-chip">Entry</span>}
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="mono text-[26px] font-extrabold leading-none" style={{ color: "var(--text)" }}>{plan.price}</span>
                      <span className="text-[10.5px] font-semibold" style={{ color: "var(--muted)" }}>{plan.period}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5" style={{ color: "var(--muted)" }}>{plan.note}</p>
                    <ul className="mt-4 grid gap-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[11.5px] leading-5" style={{ color: "var(--text)" }}>
                          <Check size={13} className="mt-0.5 shrink-0" style={{ color: "var(--dash-success)" }} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-5">
                      {"href" in plan.action ? (
                        <a href={plan.action.href} className="dash-btn dash-btn-secondary w-full">{plan.action.label} <ArrowRight size={13} /></a>
                      ) : (
                        <button type="button" onClick={plan.action.onClick} className="dash-btn dash-btn-primary w-full">{plan.action.label} <ArrowRight size={13} /></button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <p className="flex items-start gap-2 text-[10.5px] leading-5" style={{ color: "var(--muted)" }}>
                <Info size={13} className="mt-0.5 shrink-0" /> Plan changes are handled by the team over email; no payment details are stored in the dashboard.
              </p>
            </div>
          )}

          {view === "feedback" && (
            <div className="max-w-2xl space-y-4">
              <Reveal>
                <div>
                  <div className="dash-eyebrow">Product feedback</div>
                  <h1 className="dash-title mt-1">Feedback</h1>
                  <p className="dash-subtitle mt-1">
                    Found a wrong answer, a confusing explanation, or have a feature idea? Send it straight to the admin inbox.
                    Every message is read, and question fixes ship into future mocks.
                  </p>
                </div>
              </Reveal>

              {fbDone ? (
                <section className="dash-card p-6 text-center sm:p-8">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--dash-success-soft)", color: "var(--dash-success)" }}>
                    <CheckCircle2 size={23} />
                  </span>
                  <h2 className="dash-title-sm mt-3">Message sent to the admin inbox</h2>
                  <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                    It is already visible in the admin panel. You can send another message after a minute — this is a spam guard, not a limit on feedback.
                  </p>
                  <button type="button" onClick={() => setFbDone(false)} className="dash-btn dash-btn-primary mt-4">
                    Send another <ArrowRight size={14} />
                  </button>
                </section>
              ) : (
                <section className="dash-card p-5 sm:p-6">
                  <div className="grid gap-3.5">
                    <label className="grid gap-1.5">
                      <span className="dash-label">Topic</span>
                      <select
                        value={fb.category}
                        onChange={(e) => setFb({ ...fb, category: e.target.value })}
                        className="dash-input cursor-pointer"
                      >
                        <option value="general">General question</option>
                        <option value="test">Mock test issue</option>
                        <option value="content">Wrong answer / explanation</option>
                        <option value="bug">App bug</option>
                        <option value="other">Something else</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="dash-label">Subject</span>
                      <input
                        value={fb.subject}
                        onChange={(e) => setFb({ ...fb, subject: e.target.value })}
                        maxLength={140}
                        placeholder="One line — e.g. Q12 of Free Mock 1 looks wrong"
                        className="dash-input"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="dash-label">Details</span>
                      <textarea
                        value={fb.message}
                        onChange={(e) => setFb({ ...fb, message: e.target.value })}
                        rows={5}
                        maxLength={4000}
                        placeholder="What happened? Include the test name and question number where possible."
                        className="dash-input"
                      />
                      <span className="text-right text-[10.5px]" style={{ color: "var(--muted)" }}>{fb.message.length}/4000</span>
                    </label>
                    {fbMsg && (
                      <div className="dash-alert dash-alert-danger" role="alert">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" />
                        <span>{fbMsg}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" disabled={fbBusy} onClick={sendFeedback} className="dash-btn dash-btn-primary">
                        {fbBusy ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <>Send to admin <ArrowRight size={14} /></>}
                      </button>
                      <a href="mailto:abhayincodingworld@gmail.com?subject=NIMCET%20feedback" className="dash-link text-[12px]">
                        or email us directly
                      </a>
                    </div>
                    <p className="text-[10.5px] leading-5" style={{ color: "var(--muted)" }}>
                      Your message carries your account email automatically — no need to type it. Replies come to the email on your account.
                    </p>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function CloudIcon() {
  return <CheckCircle2 size={11} />;
}
