"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import DashNav from "@/components/dash-nav";
import { getAuthClient, signOutAll } from "@/lib/supabase";

type Attempt = {
  id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

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
      className="rounded-2xl px-4 py-4 backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
    >
      <div className="mono text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{value}</div>
      <div className="mt-1 text-[13px] font-bold">{label}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [localAttempts, setLocalAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

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
        const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string; name?: string };
        const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || "";
        setDisplayName(full.trim() || (user.email ?? "").split("@")[0]);
        const { data, error } = await sb
          .from("attempts")
          .select("id,test,score,correct,wrong,skipped,created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) setNote("Attempts table not found yet — run the SQL from setup to enable history.");
        else setAttempts(data ?? []);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Auth is not configured yet.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Stats over cloud history; fall back to this-device history for new users.
  const statsSource = attempts.length > 0 ? attempts : localAttempts;
  const statsLabel = attempts.length > 0 ? "saved to cloud" : "on this device";
  const stats = useMemo(() => {
    if (statsSource.length === 0) return { total: "0", best: "—", avg: "—", acc: "—" };
    const scores = statsSource.map((a) => Number(a.score) || 0);
    const best = Math.max(...scores);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const correct = statsSource.reduce((s, a) => s + (Number(a.correct) || 0), 0);
    const wrong = statsSource.reduce((s, a) => s + (Number(a.wrong) || 0), 0);
    const answered = correct + wrong;
    return {
      total: String(statsSource.length),
      best: String(Math.round(best * 10) / 10),
      avg: String(Math.round(avg * 10) / 10),
      acc: answered === 0 ? "—" : `${Math.round((correct / answered) * 100)}%`,
    };
  }, [statsSource]);

  const clearLocal = () => {
    try {
      localStorage.removeItem("nimcuet-attempts");
    } catch {}
    setLocalAttempts([]);
  };

  return (
    <>
      {!loading && email && <DashNav email={email} onLogout={() => {}} />}
      <main id="attempts" className="mx-auto w-full max-w-4xl scroll-mt-24 px-4 pb-20 pt-24">
      <Reveal>
        <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
          Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          {loading ? "Loading…" : displayName ? `Hello ${displayName.split(" ").slice(0, 2).join(" ")}` : "Hello"}
        </h1>
      </Reveal>
      {note && (
        <p className="mt-4 rounded-xl px-4 py-3 text-[13px]" style={{ background: "var(--pill)" }}>{note}</p>
      )}
      <Reveal>
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCard label="Mocks" value={loading ? "…" : stats.total} sub={statsLabel} />
          <StatCard label="Best score" value={loading ? "…" : stats.best} sub={statsLabel} />
          <StatCard label="Avg score" value={loading ? "…" : stats.avg} sub={statsLabel} />
          <StatCard label="Accuracy" value={loading ? "…" : stats.acc} sub="correct ÷ answered" />
        </div>
      </Reveal>
      <Reveal>
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 backdrop-blur-xl"
          style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-sm font-extrabold tracking-tight">Ready for the next one?</div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>12 questions • 12 minutes • instant solutions. Scores save here automatically.</div>
          </div>
          <a
            href="/#demo"
            className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px"
            style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
          >
            Start practice mock →
          </a>
        </div>
      </Reveal>
      <Reveal>
        <h2 className="mt-8 text-lg font-extrabold tracking-tight">Saved attempts</h2>
        {attempts.length === 0 && !loading ? (
          <div
            className="mt-3 rounded-2xl p-6 text-center text-sm backdrop-blur-xl"
            style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}
          >
            No cloud attempts yet. Finish the demo mock on the homepage — it saves here when you are logged in.
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
