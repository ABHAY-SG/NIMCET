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
  Flame,
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
  Trophy,
  XCircle,
} from "lucide-react";
import Reveal from "@/components/reveal";
import CountUp from "@/components/count-up";
import DashNav from "@/components/dash-nav";
import DashSide, { type DashView } from "@/components/dash-side";
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
      className="dash-card dash-card-hover flex items-center gap-3 px-3.5 py-3 sm:px-4"
      style={{ boxShadow: "var(--dash-shadow-xs)" }}
    >
      {rank > 0 && rank <= 3 ? (
        <span
          title={`Top ${rank} by score`}
          className="mono flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
          style={{ background: MEDALS[rank - 1] }}
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
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px]" style={{ color: "var(--muted)" }}>
          <span className="mono">{new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1" style={{ color: "var(--dash-success)" }}><Check size={11} strokeWidth={2.5} />{a.correct}</span>
          <span className="inline-flex items-center gap-1" style={{ color: "var(--dash-danger)" }}><XCircle size={11} />{a.wrong}</span>
          <span className="inline-flex items-center gap-1"><Minus size={11} />{a.skipped}</span>
        </div>
        {best > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="dash-progress flex-1"><span style={{ width: `${pct}%` }} /></div>
            <span className="mono text-[9.5px] font-bold" style={{ color: "var(--muted)" }}>{pct}% of best</span>
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="mono text-[19px] font-extrabold leading-none" style={{ color: "var(--text)" }}>{a.score}</div>
        <div className="mt-1 text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".1em" }}>score</div>
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: Attempt[] }) {
  // Oldest → newest, last 10.
  const pts = data.slice(0, 10).reverse();
  if (pts.length === 0) return null;
  const values = pts.map((a) => Number(a.score) || 0);
  const max = Math.max(...values, 1);
  const W = 580;
  const H = 190;
  const padX = 34;
  const padTop = 18;
  const padBottom = 28;
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

  return (
    <div className="dash-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="dash-icon-tile dash-icon-tile-sm"><BarChart3 size={15} /></span>
            <h2 className="dash-title-sm">Performance trend</h2>
          </div>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>Last {pts.length} mock{pts.length === 1 ? "" : "s"} · oldest to newest</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="mono text-[18px] font-extrabold leading-none" style={{ color: "var(--text)" }}>{latest}</div>
            <div className="mt-1 text-[9.5px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".1em" }}>latest</div>
          </div>
          <span
            className="dash-chip"
            style={change > 0
              ? { color: "var(--dash-success)", background: "var(--dash-success-soft)", borderColor: "rgba(21,128,61,.18)" }
              : change < 0
                ? { color: "var(--dash-danger)", background: "var(--dash-danger-soft)", borderColor: "rgba(220,38,38,.18)" }
                : undefined}
          >
            {change > 0 ? `+${change}` : change === 0 ? "level" : change} pts
          </span>
        </div>
      </div>
      <div className="px-2 pb-2 sm:px-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Score trend: ${pts.map((a) => `${a.test} scored ${a.score}`).join(", ")}`}
        >
          <defs>
            <linearGradient id="dash-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.33, 0.66, 1].map((f) => {
            const y = padTop + plotH * f;
            return (
              <g key={f}>
                <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="var(--dash-line)" strokeWidth="1" />
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
    </div>
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
    <>
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
                <section className="dash-hero welcome-hero">
                  <div className="welcome-hero-top">
                    <div className="welcome-greeting">
                      <p className="welcome-salutation">{getGreeting?.() ?? "Good evening,"}</p>
                      <h1 className="welcome-title">{loading ? "WELCOME!" : <>{(displayName?.trim().split(/\\s+/)[0] || "STUDENT").toUpperCase()}! <span className="welcome-wave" aria-hidden="true">👋</span></>}</h1>
                      <p className="welcome-description">
                        {!loading && derived?.streak
                          ? "Great start! Keep taking tests to see your improvement!"
                          : "Great start! Keep taking tests to see your improvement!"}
                      </p>
                    </div>
                    <div className="welcome-mini-stats">
                      <div className="welcome-mini-stat">
                        <span className="welcome-mini-icon"><Flame size={19} fill="currentColor" /></span>
                        <strong>{loading ? "—" : `${derived?.streak ?? 0} Day${(derived?.streak ?? 0) === 1 ? "" : "s"}`}</strong>
                        <span>Streak</span>
                      </div>
                      <div className="welcome-mini-stat">
                        <span className="welcome-mini-icon"><Trophy size={19} /></span>
                        <strong>PREMIUM</strong>
                        <span>Plan</span>
                      </div>
                    </div>
                  </div>
                  <div className="welcome-quick-links">
                    <button type="button" className="welcome-quick-link" onClick={() => selectView("history")}>
                      <History size={21} />
                      <span><small>History</small><strong>Test History</strong></span>
                    </button>
                    <a href="#series" className="welcome-quick-link">
                      <BookOpen size={22} />
                      <span><small>NIMCET</small><strong>NIMCET PYQ</strong></span>
                    </a>
                    <a href="#series" className="welcome-quick-link">
                      <BarChart3 size={21} />
                      <span><small>Other PYQ</small><strong>MCA-CUET 2024, MCA-C...</strong></span>
                    </a>
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
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--dash-line)" }}>
                    <div>
                      <h2 className="dash-title-sm">Performance snapshot</h2>
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                        Exact totals from {statsLabel === "saved to cloud" ? "your cloud history" : "this device"}.
                      </p>
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
                    ) : attempts.length > 0 ? (
                      <TrendChart data={attempts} />
                    ) : (
                      <section className="dash-card p-5">
                        <div className="flex items-center gap-2">
                          <span className="dash-icon-tile dash-icon-tile-sm"><BarChart3 size={15} /></span>
                          <h2 className="dash-title-sm">Performance trend</h2>
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
                          <h2 className="dash-title-sm">Recommended tests</h2>
                          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>Published by the NimCuet team.</p>
                        </div>
                        {series.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {exams.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => setExamFilter(e)}
                                className="dash-chip transition-colors"
                                style={examFilter === e
                                  ? { background: "var(--dash-accent-soft)", borderColor: "var(--dash-accent-line)", color: "var(--accent)" }
                                  : undefined}
                                aria-pressed={examFilter === e}
                              >
                                {e === "all" ? "All exams" : examLabel(e)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {!seriesReady ? (
                        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                          {[0, 1, 2, 3].map((i) => <div key={i} className="dash-skeleton h-[148px]" />)}
                        </div>
                      ) : series.length === 0 ? (
                        <div className="dash-empty mt-3">
                          <span className="dash-empty-icon"><BookOpen size={18} /></span>
                          <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>No test series published yet</p>
                          <p className="max-w-[24rem] text-[11.5px] leading-5">The catalogue is empty right now. Published mock tests and previous-year papers will appear here.</p>
                        </div>
                      ) : visibleSeries.length === 0 ? (
                        <div className="dash-empty mt-3">
                          <span className="dash-empty-icon"><BookOpen size={18} /></span>
                          <p className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>No tests in this exam</p>
                          <button type="button" onClick={() => setExamFilter("all")} className="dash-btn dash-btn-secondary dash-btn-sm mt-1">Show all exams</button>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                          {visibleSeries.map((t) => {
                            const done = attemptsForTitle(t.title);
                            const qcount = Array.isArray(t.question_ids) ? t.question_ids.length : 0;
                            return (
                              <article key={t.id} className="dash-card dash-card-hover flex flex-col p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="dash-icon-tile dash-icon-tile-sm"><BookOpen size={15} /></span>
                                  <div className="flex flex-wrap justify-end gap-1">
                                    <span className="dash-chip dash-chip-accent !px-2 !py-0.5 !text-[9.5px]">{examLabel(t.exam)}</span>
                                    {t.free && <span className="dash-chip dash-chip-success !px-2 !py-0.5 !text-[9.5px]">Free</span>}
                                    {done > 0 && <span className="dash-chip !px-2 !py-0.5 !text-[9.5px]">Taken {done}×</span>}
                                  </div>
                                </div>
                                <h3 className="mt-3 line-clamp-2 text-[13.5px] font-bold leading-5" style={{ color: "var(--text)" }} title={t.title}>{t.title}</h3>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]" style={{ color: "var(--muted)" }}>
                                  <span className="inline-flex items-center gap-1"><ListChecks size={12} /> {qcount} questions</span>
                                  <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {t.minutes} min</span>
                                  {t.tag && <span className="truncate">{t.tag}</span>}
                                </div>
                                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                                  <span className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{done > 0 ? "Ready to revisit" : "Not attempted yet"}</span>
                                  <button type="button" onClick={() => selectView("mock")} className="dash-btn dash-btn-secondary dash-btn-sm">
                                    Practice <ArrowUpRight size={13} />
                                  </button>
                                </div>
                              </article>
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
                    <section className="dash-card p-4">
                      <div className="flex items-center gap-2">
                        <span className="dash-icon-tile dash-icon-tile-sm"><CalendarDays size={15} /></span>
                        <h2 className="dash-title-sm">Exam snapshot</h2>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>NIMCET 2027</span>
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
                          <div key={item.label} className="rounded-[10px] border px-2 py-2 text-center" style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}>
                            <span className="mx-auto flex items-center justify-center" style={{ color: "var(--muted)" }}>{item.icon}</span>
                            <div className="mono mt-1 text-[12px] font-extrabold" style={{ color: "var(--text)" }}>{item.value}</div>
                            <div className="text-[8.5px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: ".08em" }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </Reveal>

                  {notices.length > 0 && (
                    <Reveal>
                      <section className="dash-card p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="dash-icon-tile dash-icon-tile-sm" style={{ background: "var(--dash-warning-soft)", borderColor: "rgba(180,83,9,.16)", color: "var(--dash-warning)" }}><Megaphone size={15} /></span>
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
                                <span className="mono text-[9.5px]" style={{ color: "var(--muted)" }}>
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
                        <h2 className="dash-title-sm">Study tools</h2>
                      </div>
                      <div className="mt-3 grid gap-1.5">
                        <button type="button" onClick={() => selectView("nimcet-pyq")} className="dash-btn dash-btn-secondary !justify-start">
                          <BookOpen size={15} /> Previous-year papers <ChevronRight size={13} className="ml-auto" />
                        </button>
                        <button type="button" onClick={() => selectView("builder")} className="dash-btn dash-btn-secondary !justify-start">
                          <SlidersIcon /> Build a custom mock <ChevronRight size={13} className="ml-auto" />
                        </button>
                        <button type="button" onClick={() => selectView("feedback")} className="dash-btn dash-btn-secondary !justify-start">
                          <MessageSquare size={15} /> Send feedback <ChevronRight size={13} className="ml-auto" />
                        </button>
                      </div>
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
    </>
  );
}

function SlidersIcon() {
  return <ListChecks size={15} />;
}

function CloudIcon() {
  return <CheckCircle2 size={11} />;
}
