"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import CountUp from "@/components/count-up";
import DashNav from "@/components/dash-nav";
import DashSide, { type DashView } from "@/components/dash-side";
import MockHub from "@/components/mock-hub";
import MockBuilder from "@/components/mock-builder";
import { getAuthClient, resolveAvatarUrl, signOutAll } from "@/lib/supabase";
import { calcBestStreak, calcStreak, formatStreak, lastWeekActivity } from "@/lib/streak";

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

// Older attempts stored "Title (NQ)" while tests are keyed by title alone;
// compare on the base title so history from both formats lines up.
function baseTestName(name: string): string {
  return name.replace(/\s*\(\d+\s*Q\)\s*$/i, "").trim();
}

const MEDAL_LABEL = ["#1", "#2", "#3"];

function AttemptRow({ a, cloud = false, best = 0, rank = 0 }: { a: Attempt; cloud?: boolean; best?: number; rank?: number }) {
  const pct = best > 0 ? Math.min(100, Math.round(((Number(a.score) || 0) / best) * 100)) : 0;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl card-bg px-4 py-3.5"
      style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
    >
      {rank > 0 && rank <= 3 ? (
        <span title={`Top ${rank} by score`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: MEDALS[rank - 1] }}>
          {MEDAL_LABEL[rank - 1]}
        </span>
      ) : (
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ background: "var(--pill)" }}>📝</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-extrabold" style={{ color: "var(--text)" }}>
          {a.test}{" "}
          {!cloud && (
            <span className="mono rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--pill)", color: "var(--muted)" }}>
              THIS DEVICE
            </span>
          )}
        </div>
        <div className="mono mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
          {new Date(a.created_at).toLocaleString("en-IN")} • {a.correct}✔ {a.wrong}✘ {a.skipped}○
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
          <div className="grow-bar h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))" }} />
        </div>
      </div>
      <div className="mono shrink-0 text-xl font-extrabold" style={{ color: "var(--accent)" }}>{a.score}</div>
    </div>
  );
}

function TrendChart({ data }: { data: Attempt[] }) {
  // Oldest → newest, last 10.
  const pts = data.slice(0, 10).reverse();
  if (pts.length === 0) return null;
  const max = Math.max(...pts.map((a) => Number(a.score) || 0), 1);
  const W = 560, H = 150, PAD = 8;
  const bw = (W - PAD * 2) / pts.length;
  return (
    <div
      className="mt-3 rounded-2xl card-bg px-5 py-4"
      style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
    >
      <div className="flex items-baseline justify-between">
        <div className="dash-display text-sm font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Score trend</div>
        <div className="text-[11px]" style={{ color: "#64748b" }}>last {pts.length} mocks • oldest → newest</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Score trend chart">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {pts.map((a, i) => {
          const v = Number(a.score) || 0;
          const h = Math.max(4, ((H - 30) * v) / max);
          const x = PAD + i * bw + bw * 0.22;
          return (
            <g key={a.id ?? i}>
              <rect x={x} y={H - 14 - h} width={Math.max(6, bw * 0.56)} height={h} rx="5" fill="var(--accent)" opacity={0.85} className="chart-bar" style={{ animationDelay: `${i * 60}ms` }} />
              <text x={x + bw * 0.28} y={H - 18 - h} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">{v}</text>
            </g>
          );
        })}
      </svg>
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
  const [todayLine, setTodayLine] = useState("");
  const [sideOpen, setSideOpen] = useState(false);
  const [view, setView] = useState<DashView>("home");
  const [notices, setNotices] = useState<Array<{ id: string; title: string; body: string; created_at: string }>>([]);
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [fb, setFb] = useState({ category: "general", subject: "", message: "" });
  const [fbBusy, setFbBusy] = useState(false);
  const [fbMsg, setFbMsg] = useState("");
  const [fbDone, setFbDone] = useState(false);

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
        const { data: { user } } = await sb.auth.getUser();
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
        const { data, error } = await sb
          .from("attempts")
          .select("id,test,score,correct,wrong,skipped,created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) setNote("Attempts table not found yet — run the SQL from setup to enable history.");
        else setAttempts(data ?? []);
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
  }, [router]);

  // Stats + streak are derived from attempt dates. The memo short-circuits
  // while loading (and during prerender), so no date logic runs at build time.
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
    if (loading) return null;
    const src = attempts.length > 0 ? attempts : localAttempts;
    if (src.length === 0) return null;
    const scores = src.map((a) => Number(a.score) || 0);
    const best = Math.max(...scores);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const correct = src.reduce((s, a) => s + (Number(a.correct) || 0), 0);
    const wrong = src.reduce((s, a) => s + (Number(a.wrong) || 0), 0);
    const skipped = src.reduce((s, a) => s + (Number(a.skipped) || 0), 0);
    const answered = correct + wrong;
    return {
      total: String(src.length),
      best: String(Math.round(best * 10) / 10),
      avg: String(Math.round(avg * 10) / 10),
      acc: answered === 0 ? "—" : `${Math.round((correct / answered) * 100)}%`,
      questions: String(correct + wrong + skipped),
      streak: calcStreak(src),
      bestStreak: calcBestStreak(src),
      week: lastWeekActivity(src),
    };
  }, [attempts, localAttempts, loading]);

  const statsLabel = attempts.length > 0 ? "saved to cloud" : "on this device";

  const exams = useMemo(() => {
    const set = new Set(series.map((t) => t.exam).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [series]);

  const visibleSeries = examFilter === "all" ? series : series.filter((t) => t.exam === examFilter);

  const attemptsForTitle = (title: string) => attempts.filter((a) => baseTestName(a.test) === title).length;

  // Attempt counts per test title (for catalog badges) — render-safe.
  const attemptedCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of attempts) {
      const k = baseTestName(a.test);
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [attempts]);

  // Best score + top-3 ranks by score (render-safe arithmetic only).
  const bestScore = useMemo(
    () => attempts.reduce((m, a) => Math.max(m, Number(a.score) || 0), 0),
    [attempts]
  );
  const localBest = useMemo(
    () => localAttempts.reduce((m, a) => Math.max(m, Number(a.score) || 0), 0),
    [localAttempts]
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
    icon: string; label: string; num?: number | null; dec?: number;
    suffix?: string; fallback: string; text?: string; sub: string;
  }> = [
    { icon: "📝", label: "Mocks", num: derived ? Number(derived.total) : null, fallback: loading ? "…" : "0", sub: statsLabel },
    { icon: "🏆", label: "Best score", num: derived ? parseFloat(derived.best) : null, dec: derived && !Number.isInteger(parseFloat(derived.best)) ? 1 : 0, fallback: loading ? "…" : "—", sub: statsLabel },
    { icon: "📊", label: "Avg score", num: derived ? parseFloat(derived.avg) : null, dec: derived && !Number.isInteger(parseFloat(derived.avg)) ? 1 : 0, fallback: loading ? "…" : "—", sub: statsLabel },
    { icon: "🎯", label: "Accuracy", num: derived && derived.acc !== "—" ? parseFloat(derived.acc) : null, suffix: derived && derived.acc !== "—" ? "%" : "", fallback: loading ? "…" : "—", sub: "correct ÷ answered" },
    { icon: "❓", label: "Questions", num: derived ? Number(derived.questions) : null, fallback: loading ? "…" : "0", sub: "attempted total" },
    { icon: "🔥", label: "Day streak", num: null, fallback: loading ? "…" : "No streak", text: loading ? "…" : formatStreak(derived?.streak ?? 0), sub: derived?.bestStreak ? `best ${derived.bestStreak}d all-time` : "attempt daily" },
  ];

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
        const { data, error } = await sb
          .from("attempts")
          .select("id,test,score,correct,wrong,skipped,created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        if (!error) setAttempts(data ?? []);
        try {
          const raw = localStorage.getItem("nimcuet-attempts");
          if (raw) setLocalAttempts(JSON.parse(raw));
        } catch {}
      } catch {}
    })();
  }, [view]);
  const streakSummary = {
    current: derived?.streak ?? 0,
    best: derived?.bestStreak ?? 0,
    week: derived?.week ?? [],
  };

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
        />
      )}
      <main className="mx-auto w-full px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        <DashSide mobileOpen={sideOpen} onClose={() => setSideOpen(false)} view={view} onSelect={(v) => setView(v)} />
        <div id="attempts" className="min-w-0 scroll-mt-24 md:ml-[18.5rem]">
      {view === "home" && (
      <>
      <Reveal>
        <section
          className="bg-pan relative overflow-hidden rounded-[26px] px-6 py-8 text-white sm:px-10 sm:py-10"
          style={{ background: "linear-gradient(120deg, #141b34 0%, #2b3a7a 55%, var(--accent) 130%)", boxShadow: "var(--shadow-3)" }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 220px at 85% 0%, rgba(255,255,255,0.16), transparent 65%), radial-gradient(500px 260px at 0% 100%, rgba(255,255,255,0.08), transparent 60%)" }} />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-3 py-1 text-[11px] font-extrabold uppercase" style={{ letterSpacing: "0.18em", background: "rgba(255,255,255,0.14)", color: "#fff" }}>
                  {todayLine}
                </span>
                {!loading && (derived?.streak ?? 0) > 0 && (
                  <span className="rounded-full px-3 py-1 text-[11px] font-extrabold uppercase" style={{ letterSpacing: "0.18em", background: "#fff", color: "#1e2952" }}>
                    🔥 {formatStreak(derived?.streak ?? 0)}
                  </span>
                )}
              </div>
              <h1 className="dash-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {loading ? "Loading…" : displayName ? `Hello ${displayName.trim().split(/\s+/)[0]}` : "Hello"}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-6" style={{ color: "rgba(255,255,255,0.82)" }}>
                {!loading && derived
                  ? derived.streak > 0
                    ? `🔥 ${formatStreak(derived.streak)}. Your best so far is ${derived.best} — go beat it.`
                    : "Your history is warming up — attempt a mock to start your streak."
                  : "Your preparation home: stats, test series and history live here."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setView("mock")}
                  className="cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold transition-transform hover:-translate-y-px"
                  style={{ color: "#1e2952" }}
                >
                  Start practice mock →
                </button>
                <a
                  href="#series"
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-px"
                  style={{ border: "1.5px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)" }}
                >
                  Browse test series
                </a>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4 rounded-2xl px-5 py-4" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <div className="relative h-[104px] w-[104px] shrink-0">
                <svg width="104" height="104" viewBox="0 0 120 120" role="img" aria-label="Streak progress toward best">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="11" />
                  <circle
                    cx="60" cy="60" r="52" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - (derived?.bestStreak ? Math.min((derived?.streak ?? 0) / derived.bestStreak, 1) : 0))}
                    transform="rotate(-90 60 60)" style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))", transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span aria-hidden className="text-2xl leading-none">🔥</span>
                  <span className="mono mt-0.5 text-sm font-extrabold text-white">{loading ? "…" : `${derived?.streak ?? 0}d`}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold leading-tight text-white">{loading ? "…" : formatStreak(derived?.streak ?? 0)}</div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {loading ? "warming up" : derived?.bestStreak ? `best ${derived.bestStreak}d all-time` : "attempt daily"}
                </div>
                {!loading && streakSummary.week.length > 0 && (
                  <div className="mt-2 flex gap-1.5" aria-hidden>
                    {streakSummary.week.map((d, i) => (
                      <span
                        key={i}
                        title={d.active ? "Mock attempted" : "Rest day"}
                        className="h-2.5 w-2.5 rounded-full"
                        style={d.active
                          ? { background: "#fff", boxShadow: "0 0 10px rgba(255,255,255,0.9)" }
                          : { background: "rgba(255,255,255,0.25)", outline: d.isToday ? "1.5px solid #fff" : "none" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {note && (
        <p className="mt-4 rounded-xl card-bg px-4 py-3 text-[13px]" style={{ border: "1px solid var(--border)" }}>{note}</p>
      )}

      <Reveal>
        <section
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl card-bg px-5 py-4"
          style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>N</span>
            <div>
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>NIMCET 2027 <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>DATE TBA</span></div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>June 2027 cycle • official date awaited — countdown starts on announcement.</div>
            </div>
          </div>
          <div className="flex gap-2 text-center">
            {[["120", "Questions"], ["1000", "Marks"], ["120 min", "Duration"]].map(([v, l]) => (
              <div key={l} className="rounded-xl px-3.5 py-2" style={{ background: "var(--pill)" }}>
                <div className="mono text-sm font-extrabold" style={{ color: "var(--text)" }}>{v}</div>
                <div className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{l}</div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {notices.length > 0 && (
        <Reveal>
          <section
            className="mt-4 rounded-2xl card-bg px-5 py-4"
            style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm" style={{ background: "var(--pill)" }}>📢</span>
                <h2 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Notices from admin</h2>
              </div>
              {notices.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllNotices((v) => !v)}
                  className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold"
                  style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
                >
                  {showAllNotices ? "Show less" : `Show all (${notices.length})`}
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3">
              {(showAllNotices ? notices : notices.slice(0, 2)).map((n) => (
                <div key={n.id} className="rounded-xl px-4 py-3" style={{ background: "var(--pill)" }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-extrabold" style={{ color: "var(--text)" }}>{n.title}</span>
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-6" style={{ color: "var(--muted)" }}>{n.body}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <div
          className="mt-4 overflow-hidden rounded-2xl card-bg"
          style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
        >
          <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6" style={{ background: "var(--border)" }}>
            {statTiles.map((s) => (
              <div key={s.label} className="group card-bg px-4 py-4">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" style={{ background: "var(--pill)" }}>{s.icon}</span>
                  <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{s.label}</span>
                </div>
                <div className="mono mt-1.5 text-xl font-extrabold" style={{ color: "var(--accent)" }}>
                  {s.text !== undefined ? s.text : (
                    <CountUp value={s.num ?? null} decimals={s.dec ?? 0} suffix={s.suffix ?? ""} fallback={s.fallback} />
                  )}
                </div>
                <div className="mt-0.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {!loading && attempts.length > 0 && (
        <Reveal>
          <TrendChart data={attempts} />
        </Reveal>
      )}

      {seriesReady && series.length > 0 && (
        <Reveal>
          <div id="series" className="mt-10 scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="dash-display text-lg font-extrabold tracking-tight">Test series</h2>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Published by admin • practice opens the demo mock.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exams.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setExamFilter(e)}
                    className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition-transform hover:-translate-y-px"
                    style={examFilter === e
                      ? { background: "var(--btn-bg)", color: "var(--btn-text)" }
                      : { border: "1px solid var(--border)", color: "var(--muted)" }}
                  >
                    {e === "all" ? "All" : examLabel(e)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {visibleSeries.map((t) => {
                const done = attemptsForTitle(t.title);
                const qcount = Array.isArray(t.question_ids) ? t.question_ids.length : 0;
                return (
                  <div
                    key={t.id}
                    className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl card-bg px-5 py-4 pl-7 transition-transform duration-300 hover:-translate-y-0.5"
                    style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
                  >
                    <span aria-hidden className="absolute bottom-0 left-0 top-0 w-1.5" style={{ background: "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))" }} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }}>
                          {examLabel(t.exam)}
                        </span>
                        {t.free && (
                          <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#16a34a", color: "#fff" }}>FREE</span>
                        )}
                        {done > 0 && (
                          <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                            ATTEMPTED ×{done}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 truncate text-sm font-extrabold" style={{ color: "var(--text)" }}>{t.title}</div>
                      <div className="mono mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                        {qcount}Q • {t.minutes} min{t.tag ? ` • ${t.tag}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setView("mock")}
                      className="shrink-0 cursor-pointer rounded-xl px-4 py-2 text-[13px] font-extrabold transition-transform hover:-translate-y-px"
                      style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))", color: "var(--accent-fg)" }}
                    >
                      Practice →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}

      <Reveal>
        <h2 className="dash-display mt-10 text-lg font-extrabold tracking-tight">Recent attempts</h2>
        {attempts.length === 0 && !loading ? (
          <div
            className="mt-3 rounded-2xl card-bg p-6 text-center text-sm"
            style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}
          >
            No attempts yet.{" "}
            <button type="button" onClick={() => setView("mock")} className="cursor-pointer font-bold underline" style={{ color: "var(--accent)" }}>
              Attempt the demo mock
            </button>{" "}
            — it saves here when you are logged in.
          </div>
        ) : (
          <div className="mt-3 grid gap-2.5">
            {attempts.map((a) => (
              <AttemptRow key={a.id} a={a} cloud best={bestScore} rank={rankMap.get(a.id) ?? 0} />
            ))}
          </div>
        )}
      </Reveal>
      {localAttempts.length > 0 && (
        <Reveal>
          <div className="mt-10 flex items-center justify-between gap-2">
            <h2 className="dash-display text-lg font-extrabold tracking-tight">On this device</h2>
            <button
              type="button"
              onClick={clearLocal}
              className="cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              Clear
            </button>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Saved locally — log in to keep them across devices.</p>
          <div className="mt-3 grid gap-2.5">
            {localAttempts.map((a) => (
              <AttemptRow key={a.id} a={a} best={localBest} />
            ))}
          </div>
        </Reveal>
      )}
      </>
      )}
      {view === "mock" && (
        <MockHub attempted={attemptedCounts} />
      )}
      {view === "builder" && (
        <MockBuilder />
      )}
      {view === "history" && (
        <>
          <Reveal>
            <h1 className="text-2xl font-extrabold tracking-tight">Test history</h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              Every attempt, newest first — cloud history plus this device.
            </p>
          </Reveal>
          <Reveal>
            <div className="mt-4 grid gap-2.5">
              {attempts.length === 0 && !loading ? (
                <div className="rounded-2xl p-6 text-center text-sm backdrop-blur-xl" style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}>
                  No cloud attempts yet — finish a mock and it lands here.
                </div>
              ) : (
                attempts.map((a) => <AttemptRow key={a.id} a={a} cloud best={bestScore} rank={rankMap.get(a.id) ?? 0} />)
              )}
            </div>
          </Reveal>
          {localAttempts.length > 0 && (
            <Reveal>
              <h2 className="mt-8 text-lg font-extrabold tracking-tight">On this device</h2>
              <div className="mt-3 grid gap-2.5">
                {localAttempts.map((a) => (
                  <AttemptRow key={a.id} a={a} />
                ))}
              </div>
            </Reveal>
          )}
        </>
      )}
      {view === "contact" && (
        <Reveal>
          <h1 className="text-2xl font-extrabold tracking-tight">Contact</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
            Syllabus confusion, plan help, or a bug in a mock — one message away.
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <a
              href="mailto:abhayincodingworld@gmail.com"
              className="rounded-2xl px-5 py-4 backdrop-blur-xl transition-transform hover:-translate-y-px"
              style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
            >
              <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>Email</div>
              <div className="mt-1 break-all text-sm font-extrabold">abhayincodingworld@gmail.com</div>
            </a>
            <a
              href="tel:+917425097293"
              className="rounded-2xl px-5 py-4 backdrop-blur-xl transition-transform hover:-translate-y-px"
              style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
            >
              <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>Phone</div>
              <div className="mt-1 text-sm font-extrabold">+91-74250-97293</div>
            </a>
          </div>
        </Reveal>
      )}
      {view === "pricing" && (
        <Reveal>
          <h1 className="text-2xl font-extrabold tracking-tight">Pricing</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
            Start free. Paid plans activate over UPI within a day on your registered email — full policy in{" "}
            <a href="/terms" className="font-bold underline" style={{ color: "var(--accent)" }}>Terms</a>.
          </p>
          <div className="mt-4 grid gap-2.5 md:grid-cols-3">
            <div className="rounded-2xl card-bg px-5 py-5" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}>
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Free</div>
              <div className="mono mt-1 text-2xl font-extrabold" style={{ color: "var(--text)" }}>₹0 <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>forever</span></div>
              <ul className="mt-3 space-y-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
                <li>• Free 12Q sample mock</li>
                <li>• Solutions + scorecard</li>
                <li>• No card, no login needed</li>
              </ul>
              <button type="button" onClick={() => setView("mock")}
                className="mt-4 w-full cursor-pointer rounded-xl py-2.5 text-sm font-bold"
                style={{ border: "1px solid var(--border)" }}>
                Start free →
              </button>
            </div>
            <div className="rounded-2xl card-bg px-5 py-5" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}>
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Monthly</div>
              <div className="mono mt-1 text-2xl font-extrabold" style={{ color: "var(--text)" }}>₹149 <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>/month</span></div>
              <ul className="mt-3 space-y-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
                <li>• Unlimited mocks</li>
                <li>• Full section analytics</li>
                <li>• All PYQ sets</li>
                <li>• Cancel anytime</li>
              </ul>
              <a href="mailto:abhayincodingworld@gmail.com?subject=Activate%20NIMCET%20Monthly%20plan"
                className="mt-4 block w-full cursor-pointer rounded-xl py-2.5 text-center text-sm font-bold"
                style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
                Choose Monthly →
              </a>
            </div>
            <div className="rounded-2xl card-bg px-5 py-5" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}>
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Annual</div>
              <div className="mono mt-1 text-2xl font-extrabold" style={{ color: "var(--text)" }}>₹699 <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>/year</span></div>
              <ul className="mt-3 space-y-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
                <li>• 12 months full access</li>
                <li>• Everything in Monthly</li>
                <li>• Priority support</li>
              </ul>
              <a href="mailto:abhayincodingworld@gmail.com?subject=Activate%20NIMCET%20Annual%20plan"
                className="mt-4 block w-full cursor-pointer rounded-xl py-2.5 text-center text-sm font-bold"
                style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
                Choose Annual →
              </a>
            </div>
          </div>
        </Reveal>
      )}
      {view === "feedback" && (
        <Reveal>
          <h1 className="text-2xl font-extrabold tracking-tight">Feedback</h1>
          <p className="mt-1 max-w-lg text-[13px] leading-6" style={{ color: "var(--muted)" }}>
            Found a wrong answer, a confusing explanation, or have a feature idea? Send it straight to the
            admin inbox — every message is read, and question fixes ship into future mocks.
          </p>
          {fbDone ? (
            <div
              className="mt-4 max-w-lg rounded-2xl card-bg px-5 py-7 text-center"
              style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
            >
              <div aria-hidden className="text-3xl">✅</div>
              <div className="mt-2 text-sm font-extrabold" style={{ color: "var(--text)" }}>Message sent to the admin inbox</div>
              <p className="mt-1 text-[12.5px] leading-6" style={{ color: "var(--muted)" }}>
                Thanks — it is already visible in the admin panel. You can send another message after a minute
                (spam guard).
              </p>
              <button
                type="button"
                onClick={() => setFbDone(false)}
                className="mt-4 cursor-pointer rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-transform hover:-translate-y-px"
                style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))", color: "var(--accent-fg)" }}
              >
                Send another
              </button>
            </div>
          ) : (
            <div
              className="mt-4 max-w-lg rounded-2xl card-bg px-5 py-5"
              style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
            >
              <div className="grid gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>Topic</span>
                  <select
                    value={fb.category}
                    onChange={(e) => setFb({ ...fb, category: e.target.value })}
                    className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold"
                    style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                  >
                    <option value="general">General question</option>
                    <option value="test">Mock test issue</option>
                    <option value="content">Wrong answer / explanation</option>
                    <option value="bug">App bug</option>
                    <option value="other">Something else</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>Subject</span>
                  <input
                    value={fb.subject}
                    onChange={(e) => setFb({ ...fb, subject: e.target.value })}
                    maxLength={140}
                    placeholder="One line — e.g. Q12 of Free Mock 1 looks wrong"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                    style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>Details</span>
                  <textarea
                    value={fb.message}
                    onChange={(e) => setFb({ ...fb, message: e.target.value })}
                    rows={5}
                    maxLength={4000}
                    placeholder="What happened? Include the test name and question number where possible."
                    className="w-full resize-y rounded-xl px-3.5 py-2.5 text-sm leading-6 outline-none"
                    style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                  />
                  <span className="text-right text-[11px]" style={{ color: "var(--muted)" }}>{fb.message.length}/4000</span>
                </label>
                {fbMsg && (
                  <p className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
                    {fbMsg}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={fbBusy}
                    onClick={sendFeedback}
                    className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-extrabold transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))", color: "var(--accent-fg)" }}
                  >
                    {fbBusy ? "Sending…" : "Send to admin"}
                  </button>
                  <a
                    href="mailto:abhayincodingworld@gmail.com?subject=NIMCET%20feedback"
                    className="text-[12.5px] font-bold underline"
                    style={{ color: "var(--muted)" }}
                  >
                    or email us directly
                  </a>
                </div>
                <p className="text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                  Your message carries your account email automatically — no need to type it. Replies come to
                  the email on your account.
                </p>
              </div>
            </div>
          )}
        </Reveal>
      )}
        </div>
    </main>
    </>
  );
}
