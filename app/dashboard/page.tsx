"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import DashNav from "@/components/dash-nav";
import { getAuthClient, signOutAll } from "@/lib/supabase";
import { calcBestStreak, calcStreak, lastWeekActivity } from "@/lib/streak";

type Attempt = {
  id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

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

function AttemptRow({ a, cloud = false }: { a: Attempt; cloud?: boolean }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3.5 backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
    >
      <div>
        <div className="text-sm font-bold">
          {a.test}{" "}
          {!cloud && (
            <span className="mono rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--pill)", color: "var(--muted)" }}>
              THIS DEVICE
            </span>
          )}
        </div>
        <div className="mono text-[11px]" style={{ color: "var(--muted)" }}>
          {new Date(a.created_at).toLocaleString("en-IN")} • {a.correct}✔ {a.wrong}✘ {a.skipped}○
        </div>
      </div>
      <div className="mono text-xl font-extrabold" style={{ color: "var(--accent)" }}>{a.score}</div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      className="rounded-2xl bg-white px-4 py-4 backdrop-blur-xl"
      style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
    >
      <div className="mono text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{value}</div>
      <div className="mt-1 text-[13px] font-bold" style={{ color: "#1e2952" }}>{label}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>
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
      className="mt-3 rounded-2xl bg-white px-5 py-4"
      style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-extrabold tracking-tight" style={{ color: "#1e2952" }}>Score trend</div>
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>last {pts.length} mocks • oldest → newest</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Score trend chart">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="var(--border)" strokeWidth="1" />
        ))}
        {pts.map((a, i) => {
          const v = Number(a.score) || 0;
          const h = Math.max(4, ((H - 30) * v) / max);
          const x = PAD + i * bw + bw * 0.22;
          return (
            <g key={a.id ?? i}>
              <rect x={x} y={H - 14 - h} width={Math.max(6, bw * 0.56)} height={h} rx="5" fill="var(--accent)" opacity={0.85} />
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

  useEffect(() => {
    try {
      setTodayLine(new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nimcuet-attempts");
      if (raw) setLocalAttempts(JSON.parse(raw));
    } catch {}
  }, []);

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
        const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string; name?: string; avatar_url?: string; picture?: string };
        const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || "";
        setDisplayName(full.trim() || (user.email ?? "").split("@")[0]);
        // OAuth providers (Google/GitHub) supply a profile photo URL in the
        // user metadata — shown in the navbar, no storage needed.
        setAvatarUrl(meta.avatar_url || meta.picture || "");
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

  // Stats + streak are derived from attempt dates, so they are computed in a
  // client-only effect (never during prerender).
  const [derived, setDerived] = useState<{
    total: string;
    best: string;
    avg: string;
    acc: string;
    questions: string;
    streak: number;
    bestStreak: number;
    week: Array<{ label: string; active: boolean; isToday: boolean }>;
  } | null>(null);

  useEffect(() => {
    if (loading) return;
    const src = attempts.length > 0 ? attempts : localAttempts;
    if (src.length === 0) { setDerived(null); return; }
    const scores = src.map((a) => Number(a.score) || 0);
    const best = Math.max(...scores);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const correct = src.reduce((s, a) => s + (Number(a.correct) || 0), 0);
    const wrong = src.reduce((s, a) => s + (Number(a.wrong) || 0), 0);
    const skipped = src.reduce((s, a) => s + (Number(a.skipped) || 0), 0);
    const answered = correct + wrong;
    setDerived({
      total: String(src.length),
      best: String(Math.round(best * 10) / 10),
      avg: String(Math.round(avg * 10) / 10),
      acc: answered === 0 ? "—" : `${Math.round((correct / answered) * 100)}%`,
      questions: String(correct + wrong + skipped),
      streak: calcStreak(src),
      bestStreak: calcBestStreak(src),
      week: lastWeekActivity(src),
    });
  }, [attempts, localAttempts, loading]);

  const statsLabel = attempts.length > 0 ? "saved to cloud" : "on this device";

  const exams = useMemo(() => {
    const set = new Set(series.map((t) => t.exam).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [series]);

  const visibleSeries = examFilter === "all" ? series : series.filter((t) => t.exam === examFilter);

  const attemptsForTitle = (title: string) => attempts.filter((a) => a.test === title).length;

  const clearLocal = () => {
    try {
      localStorage.removeItem("nimcuet-attempts");
    } catch {}
    setLocalAttempts([]);
  };

  // Navbar streak panel data (same source as the stat strip).
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
        />
      )}
      <main id="attempts" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-20 pt-24">
      <Reveal>
        <section
          className="relative overflow-hidden rounded-[26px] px-6 py-8 text-white sm:px-10 sm:py-10"
          style={{ background: "linear-gradient(120deg, #141b34 0%, #2b3a7a 55%, var(--accent) 130%)", boxShadow: "0 40px 90px -35px rgba(20, 27, 52, 0.7)" }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 220px at 85% 0%, rgba(255,255,255,0.16), transparent 65%), radial-gradient(500px 260px at 0% 100%, rgba(255,255,255,0.08), transparent 60%)" }} />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.22em", color: "rgba(255,255,255,0.7)" }}>
                {todayLine}
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {loading ? "Loading…" : displayName ? `Hello ${displayName.split(" ").slice(0, 2).join(" ")}` : "Hello"}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-6" style={{ color: "rgba(255,255,255,0.82)" }}>
                {!loading && derived
                  ? derived.streak > 0
                    ? `🔥 ${derived.streak}-day streak. Your best so far is ${derived.best} — go beat it.`
                    : "Your history is warming up — attempt a mock to start your streak."
                  : "Your preparation home: stats, test series and history live here."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <a
                  href="/#demo"
                  className="cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold transition-transform hover:-translate-y-px"
                  style={{ color: "#1e2952" }}
                >
                  Start practice mock →
                </a>
                <a
                  href="#series"
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-px"
                  style={{ border: "1.5px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)" }}
                >
                  Browse test series
                </a>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl px-5 py-4" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <div className="text-3xl font-extrabold">🔥</div>
              <div>
                <div className="mono text-2xl font-extrabold">{loading ? "…" : `${derived?.streak ?? 0}d`}</div>
                <div className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>day streak</div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {note && (
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-[13px]" style={{ border: "1px solid var(--border)" }}>{note}</p>
      )}

      <Reveal>
        <section
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4"
          style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold text-white" style={{ background: "var(--accent)" }}>N</span>
            <div>
              <div className="text-sm font-extrabold" style={{ color: "#1e2952" }}>NIMCET 2027 <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>DATE TBA</span></div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>June 2027 cycle • official date awaited — countdown starts on announcement.</div>
            </div>
          </div>
          <div className="flex gap-2 text-center">
            {[["120", "Questions"], ["1000", "Marks"], ["120 min", "Duration"]].map(([v, l]) => (
              <div key={l} className="rounded-xl px-3.5 py-2" style={{ background: "var(--pill)" }}>
                <div className="mono text-sm font-extrabold" style={{ color: "#1e2952" }}>{v}</div>
                <div className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{l}</div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Mocks" value={loading ? "…" : (derived?.total ?? "0")} sub={statsLabel} />
          <StatCard label="Best score" value={loading ? "…" : (derived?.best ?? "—")} sub={statsLabel} />
          <StatCard label="Avg score" value={loading ? "…" : (derived?.avg ?? "—")} sub={statsLabel} />
          <StatCard label="Accuracy" value={loading ? "…" : (derived?.acc ?? "—")} sub="correct ÷ answered" />
          <StatCard label="Questions" value={loading ? "…" : (derived?.questions ?? "0")} sub="attempted total" />
          <StatCard label="Day streak" value={loading ? "…" : `${derived?.streak ?? 0}d`} sub="consecutive days" />
        </div>
      </Reveal>

      {!loading && attempts.length > 0 && (
        <Reveal>
          <TrendChart data={attempts} />
        </Reveal>
      )}

      {seriesReady && series.length > 0 && (
        <Reveal>
          <div id="series" className="mt-8 scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Test series</h2>
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4"
                    style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
                  >
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
                      <div className="mt-1.5 truncate text-sm font-extrabold" style={{ color: "#1e2952" }}>{t.title}</div>
                      <div className="mono mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                        {qcount}Q • {t.minutes} min{t.tag ? ` • ${t.tag}` : ""}
                      </div>
                    </div>
                    <a
                      href="/#demo"
                      className="shrink-0 cursor-pointer rounded-xl px-4 py-2 text-[13px] font-extrabold text-white transition-transform hover:-translate-y-px"
                      style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
                    >
                      Practice →
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}

      <Reveal>
        <h2 className="mt-8 text-lg font-extrabold tracking-tight">Recent attempts</h2>
        {attempts.length === 0 && !loading ? (
          <div
            className="mt-3 rounded-2xl bg-white p-6 text-center text-sm"
            style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}
          >
            No attempts yet. <a href="/#demo" className="font-bold underline" style={{ color: "var(--accent)" }}>Attempt the demo mock</a> — it saves here when you are logged in.
          </div>
        ) : (
          <div className="mt-3 grid gap-2.5">
            {attempts.map((a) => (
              <AttemptRow key={a.id} a={a} cloud />
            ))}
          </div>
        )}
      </Reveal>
      {localAttempts.length > 0 && (
        <Reveal>
          <div className="mt-8 flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold tracking-tight">On this device</h2>
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
              <AttemptRow key={a.id} a={a} />
            ))}
          </div>
        </Reveal>
      )}
    </main>
    </>
  );
}
