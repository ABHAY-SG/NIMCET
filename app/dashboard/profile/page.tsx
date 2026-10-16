"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import DashNav from "@/components/dash-nav";
import { getAuthClient } from "@/lib/supabase";
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

function initialsOf(name: string, email: string): string {
  const src = (name || "").trim() || email.split("@")[0].replace(/[._-]+/g, " ");
  const parts = src.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3.5 last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <span className="text-sm" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-right text-sm font-bold">{value}</span>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl px-3 py-4 text-center" style={{ background: "var(--pill)" }}>
      <div className="mono text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{value}</div>
      <div className="mono mt-1 text-[10px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>{label}</div>
    </div>
  );
}

function PerformanceLine({ data }: { data: Attempt[] }) {
  const pts = data.slice(0, 20).reverse();
  if (pts.length < 2) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
        Attempt at least two mocks to see your performance line. Every finished mock adds a point here — nothing is estimated.
      </p>
    );
  }
  const scores = pts.map((a) => Number(a.score) || 0);
  const max = Math.max(...scores, 1);
  const min = Math.min(...scores, 0);
  const W = 640, H = 200, PADL = 8, PADR = 8, PADT = 16, PADB = 28;
  const span = max - min || 1;
  const x = (i: number) => PADL + (i * (W - PADL - PADR)) / Math.max(pts.length - 1, 1);
  const y = (v: number) => PADT + ((H - PADT - PADB) * (max - v)) / span;
  const line = pts.map((a, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(a.score) || 0).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${(H - PADB).toFixed(1)} L${x(0).toFixed(1)},${(H - PADB).toFixed(1)} Z`;
  const firstDate = new Date(pts[0].created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const lastDate = new Date(pts[pts.length - 1].created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Test performance over time">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PADL} x2={W - PADR} y1={PADT + (H - PADT - PADB) * f} y2={PADT + (H - PADT - PADB) * f} stroke="var(--border)" strokeWidth="1" />
        ))}
        <path d={area} fill="var(--accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((a, i) => (
          <g key={a.id ?? i}>
            <circle cx={x(i)} cy={y(Number(a.score) || 0)} r="4.5" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />
            <title>{`${a.test}: ${a.score} (${new Date(a.created_at).toLocaleDateString("en-IN")})`}</title>
          </g>
        ))}
        <text x={PADL} y={H - 8} fontSize="11" fill="var(--muted)">{firstDate}</text>
        <text x={W - PADR} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="end">{lastDate}</text>
      </svg>
    </div>
  );
}

const PW_RULE = "Password needs 8+ characters with an uppercase letter, a number and a special character.";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [imgOk, setImgOk] = useState(true);
  const [memberSince, setMemberSince] = useState("—");
  const [provider, setProvider] = useState("—");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [panel, setPanel] = useState<null | "name" | "password">(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [streakSummary, setStreakSummary] = useState<{
    current: number;
    best: number;
    week: Array<{ label: string; active: boolean; isToday: boolean }>;
  }>({ current: 0, best: 0, week: [] });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setStreakSummary({
      current: calcStreak(attempts),
      best: calcBestStreak(attempts),
      week: lastWeekActivity(attempts),
    });
  }, [attempts]);

  useEffect(() => {
    (async () => {
      try {
        const sb = getAuthClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        if (!user.email_confirmed_at) {
          const { signOutAll } = await import("@/lib/supabase");
          try { await signOutAll(); } catch {}
          router.replace("/login?verify-required=1");
          return;
        }
        setEmail(user.email ?? "");
        const meta = (user.user_metadata ?? {}) as {
          first_name?: string; last_name?: string; full_name?: string; name?: string;
          avatar_url?: string; picture?: string;
        };
        const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || "";
        setDisplayName(full.trim() || (user.email ?? "").split("@")[0]);
        setAvatarUrl(meta.avatar_url || meta.picture || "");
        try {
          setMemberSince(new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
        } catch { setMemberSince("—"); }
        const prov = (user.app_metadata as { provider?: string } | null)?.provider;
        setProvider(prov === "google" ? "Google" : prov === "github" ? "GitHub" : prov === "email" ? "Email + password" : prov ? prov : "—");
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

  const overview = useMemo(() => {
    if (attempts.length === 0) return { tests: "0", questions: "0", best: "—", acc: "—" };
    const correct = attempts.reduce((s, a) => s + (Number(a.correct) || 0), 0);
    const wrong = attempts.reduce((s, a) => s + (Number(a.wrong) || 0), 0);
    const skipped = attempts.reduce((s, a) => s + (Number(a.skipped) || 0), 0);
    const answered = correct + wrong;
    return {
      tests: String(attempts.length),
      questions: String(correct + wrong + skipped),
      best: String(Math.max(...attempts.map((a) => Number(a.score) || 0))),
      acc: answered === 0 ? "—" : `${Math.round((correct / answered) * 100)}%`,
    };
  }, [attempts]);

  const openNameEditor = () => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    setFirst(parts[0] ?? "");
    setLast(parts.slice(1).join(" "));
    setFormMsg("");
    setPanel("name");
  };

  const saveName = async () => {
    const f = first.trim();
    const l = last.trim();
    if (!f) { setFormMsg("First name is required."); return; }
    setBusy(true);
    setFormMsg("");
    try {
      const sb = getAuthClient();
      const { error } = await sb.auth.updateUser({ data: { first_name: f, last_name: l } });
      if (error) throw error;
      setDisplayName([f, l].filter(Boolean).join(" "));
      setPanel(null);
    } catch (err: unknown) {
      setFormMsg(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setFormMsg("");
    if (newPw.length < 8 || !/\d/.test(newPw) || !/[A-Z]/.test(newPw) || !/[^A-Za-z0-9]/.test(newPw)) {
      setFormMsg(PW_RULE);
      return;
    }
    if (newPw !== confirmPw) { setFormMsg("Passwords do not match — retype the confirmation."); return; }
    setBusy(true);
    try {
      const sb = getAuthClient();
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw("");
      setConfirmPw("");
      setPanel(null);
      setFormMsg("");
    } catch (err: unknown) {
      setFormMsg(err instanceof Error ? err.message : "Could not update password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)",
    border: "1px solid var(--border)",
  };

  return (
    <>
      {!loading && email && (
        <DashNav email={email} displayName={displayName} avatarUrl={avatarUrl} onLogout={() => {}} streak={streakSummary} />
      )}
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-24">
        <Reveal>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            <a href="/dashboard" className="font-bold" style={{ color: "var(--accent)" }}>Dashboard</a>
            <span className="mx-1.5">/</span> Profile
          </p>
        </Reveal>
        <Reveal>
          <section className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-6 backdrop-blur-2xl sm:p-7" style={cardStyle}>
            <div className="flex min-w-0 items-center gap-4">
              <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                {avatarUrl && imgOk ? (
                  <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-white"
                    style={{ background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
                  >
                    {initialsOf(displayName, email)}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold tracking-tight">
                  {loading ? "Loading…" : displayName || "Profile"}
                </h1>
                <p className="mt-0.5 truncate text-sm" style={{ color: "var(--muted)" }}>{email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setPanel(panel === "name" ? null : "name"); setFormMsg(""); if (panel !== "name") openNameEditor(); }}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold"
                style={{ border: "1.5px solid var(--accent)", color: "var(--accent)" }}
              >
                ✎ Update Profile
              </button>
              <button
                type="button"
                onClick={() => { setPanel(panel === "password" ? null : "password"); setFormMsg(""); setNewPw(""); setConfirmPw(""); }}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold"
                style={{ border: "1px solid var(--border)" }}
              >
                🔒 Change Password
              </button>
            </div>
          </section>
        </Reveal>

        {formMsg && (
          <p className="mt-4 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>{formMsg}</p>
        )}
        {note && (
          <p className="mt-4 rounded-xl px-4 py-3 text-[13px]" style={{ background: "var(--pill)" }}>{note}</p>
        )}

        {panel === "name" && (
          <Reveal>
            <section className="mt-4 rounded-[22px] p-6 backdrop-blur-2xl sm:p-7" style={cardStyle}>
              <h2 className="text-lg font-extrabold tracking-tight">Update profile</h2>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-first" className="mb-1.5 block text-[13px] font-bold">First name</label>
                  <input id="profile-first" type="text" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                    style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <label htmlFor="profile-last" className="mb-1.5 block text-[13px] font-bold">Last name</label>
                  <input id="profile-last" type="text" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                    style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={saveName} disabled={busy}
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={() => setPanel(null)}
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{ border: "1px solid var(--border)" }}>
                  Cancel
                </button>
              </div>
            </section>
          </Reveal>
        )}

        {panel === "password" && (
          <Reveal>
            <section className="mt-4 rounded-[22px] p-6 backdrop-blur-2xl sm:p-7" style={cardStyle}>
              <h2 className="text-lg font-extrabold tracking-tight">Change password</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Works for every account — including Google/GitHub sign-ins, which gain a password login this way.
              </p>
              <div className="mt-3 grid max-w-md gap-2.5">
                <div>
                  <label htmlFor="profile-pw" className="mb-1.5 block text-[13px] font-bold">New password</label>
                  <input id="profile-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password"
                    placeholder="Min. 8 characters + a number" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                    style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <label htmlFor="profile-pw2" className="mb-1.5 block text-[13px] font-bold">Confirm new password</label>
                  <input id="profile-pw2" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password"
                    placeholder="Retype your password" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                    style={{ background: "var(--pill)", border: confirmPw && newPw !== confirmPw ? "1px solid #dc2626" : "1px solid var(--border)", color: "var(--text)" }} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={savePassword} disabled={busy}
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
                  {busy ? "Saving…" : "Update password"}
                </button>
                <button type="button" onClick={() => setPanel(null)}
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{ border: "1px solid var(--border)" }}>
                  Cancel
                </button>
              </div>
            </section>
          </Reveal>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Reveal>
            <section className="h-full rounded-[22px] p-6 backdrop-blur-2xl" style={cardStyle}>
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <span aria-hidden className="inline-block h-5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Personal Details
              </h2>
              <div className="mt-2">
                <DetailRow label="Name" value={loading ? "…" : displayName || "—"} />
                <DetailRow label="Email" value={email || "—"} />
                <DetailRow label="Member since" value={memberSince} />
                <DetailRow label="Sign-in method" value={provider} />
              </div>
            </section>
          </Reveal>
          <Reveal>
            <section className="h-full rounded-[22px] p-6 backdrop-blur-2xl" style={cardStyle}>
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <span aria-hidden className="inline-block h-5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Overview
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <MiniStat value={loading ? "…" : overview.tests} label="TESTS" />
                <MiniStat value={loading ? "…" : overview.questions} label="QUESTIONS" />
                <MiniStat value={loading ? "…" : overview.best} label="BEST SCORE" />
                <MiniStat value={loading ? "…" : overview.acc} label="ACCURACY" />
              </div>
            </section>
          </Reveal>
          <Reveal>
            <section className="h-full rounded-[22px] p-6 backdrop-blur-2xl" style={cardStyle}>
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <span aria-hidden className="inline-block h-5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Streak
              </h2>
              <div className="mono mt-4 text-4xl font-extrabold" style={{ color: "var(--accent)" }}>
                {loading ? "…" : `🔥 ${streakSummary.current}d`}
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>current • best {streakSummary.best}d all-time</p>
              <div className="mt-4 flex justify-between gap-1">
                {streakSummary.week.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                      style={d.active
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--pill)", color: "var(--muted)", border: d.isToday ? "1.5px solid var(--accent)" : "1px solid transparent" }}
                    >
                      {d.active ? "✓" : d.label}
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: "var(--muted)" }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        </div>

        <Reveal>
          <section className="mt-4 rounded-[22px] p-6 backdrop-blur-2xl sm:p-7" style={cardStyle}>
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <span aria-hidden className="inline-block h-5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Performance Analysis
            </h2>
            <h3 className="mt-4 text-center text-sm font-extrabold" style={{ color: "var(--muted)" }}>Test Performance Over Time</h3>
            {mounted ? (
              <PerformanceLine data={attempts} />
            ) : (
              <p className="mt-3 text-center text-sm" style={{ color: "var(--muted)" }}>Loading chart…</p>
            )}
            <p className="mt-2 text-center text-[11px]" style={{ color: "var(--muted)" }}>
              Subject-wise and level-wise splits need per-question result storage, which doesn&apos;t exist yet — this line uses your real attempt scores.
            </p>
          </section>
        </Reveal>

        <Reveal>
          <a
            href="/dashboard#attempts"
            className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-[22px] p-6 backdrop-blur-2xl transition-transform hover:-translate-y-px sm:p-7"
            style={cardStyle}
          >
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">View Test History</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Analyze your performance across all attempts and track your progress.
              </p>
            </div>
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: "var(--pill)", color: "var(--muted)" }}>🕘</span>
          </a>
        </Reveal>
      </main>
    </>
  );
}
