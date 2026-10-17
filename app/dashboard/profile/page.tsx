"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import DashNav from "@/components/dash-nav";
import PhotoCropper from "@/components/photo-cropper";
import { getAuthClient, resolveAvatarUrl } from "@/lib/supabase";
import { calcBestStreak, calcStreak, formatStreak, lastWeekActivity } from "@/lib/streak";

// Hydration flag as an external store: false on the server, true right after
// the first client paint — reads browser-only data without an effect setState.
const subscribeNothing = () => () => {};

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

function MiniStat({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="rounded-2xl px-3 py-4 text-center" style={{ background: "var(--pill)" }}>
      <div aria-hidden className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>{icon}</div>
      <div className="mono mt-2 text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{value}</div>
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
          <line key={f} x1={PADL} x2={W - PADR} y1={PADT + (H - PADT - PADB) * f} y2={PADT + (H - PADT - PADB) * f} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <path d={area} fill="var(--accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((a, i) => (
          <g key={a.id ?? i}>
            <circle cx={x(i)} cy={y(Number(a.score) || 0)} r="4.5" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />
            <title>{`${a.test}: ${a.score} (${new Date(a.created_at).toLocaleDateString("en-IN")})`}</title>
          </g>
        ))}
        <text x={PADL} y={H - 8} fontSize="11" fill="#64748b">{firstDate}</text>
        <text x={W - PADR} y={H - 8} fontSize="11" fill="#64748b" textAnchor="end">{lastDate}</text>
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
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [curPw, setCurPw] = useState("");
  const [pwMode, setPwMode] = useState<"change" | "set">("change");
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { setPhotoMsg("Choose an image file (JPG, PNG or WebP)."); return; }
    if (file.size > 10 * 1024 * 1024) { setPhotoMsg("That file is too large to edit — pick one under 10 MB."); return; }
    try {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    } catch {}
    setPhotoMsg("");
    setCropSrc(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = "";
  };

  const closeCropper = () => {
    try {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    } catch {}
    setCropSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [localAttempts, setLocalAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nimcuet-attempts");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read of a browser-only store.
      if (raw) setLocalAttempts(JSON.parse(raw));
    } catch {}
  }, []);

  // Same source rule as the dashboard: cloud first, this-device fallback.
  const histSrc = attempts.length > 0 ? attempts : localAttempts;

  // Streak stats derive purely from attempt dates; the empty-source guard
  // keeps date logic out of prerender.
  const streakSummary = useMemo(() => {
    if (histSrc.length === 0) return { current: 0, best: 0, week: [] as Array<{ label: string; active: boolean; isToday: boolean }> };
    return {
      current: calcStreak(histSrc),
      best: calcBestStreak(histSrc),
      week: lastWeekActivity(histSrc),
    };
  }, [histSrc]);

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
          dob?: string; gender?: string;
        };
        const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || "";
        setDisplayName(full.trim() || (user.email ?? "").split("@")[0]);
        setAvatarUrl(resolveAvatarUrl(user.user_metadata));
        setDob(typeof meta.dob === "string" ? meta.dob : "");
        setGender(typeof meta.gender === "string" ? meta.gender : "");
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
    if (histSrc.length === 0) return { tests: "0", questions: "0", best: "—", acc: "—" };
    const correct = histSrc.reduce((s, a) => s + (Number(a.correct) || 0), 0);
    const wrong = histSrc.reduce((s, a) => s + (Number(a.wrong) || 0), 0);
    const skipped = histSrc.reduce((s, a) => s + (Number(a.skipped) || 0), 0);
    const answered = correct + wrong;
    return {
      tests: String(histSrc.length),
      questions: String(correct + wrong + skipped),
      best: String(Math.max(...histSrc.map((a) => Number(a.score) || 0))),
      acc: answered === 0 ? "—" : `${Math.round((correct / answered) * 100)}%`,
    };
  }, [histSrc]);

  const openNameEditor = () => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    setFirst(parts[0] ?? "");
    setLast(parts.slice(1).join(" "));
    setFormMsg("");
    setPanel("name");
  };

  const saveProfile = async () => {
    const f = first.trim();
    const l = last.trim();
    if (!f) { setFormMsg("First name is required."); return; }
    if (dob && Number.isNaN(Date.parse(dob))) { setFormMsg("Pick a valid date of birth."); return; }
    setBusy(true);
    setFormMsg("");
    try {
      const sb = getAuthClient();
      const { error } = await sb.auth.updateUser({
        data: { first_name: f, last_name: l, dob, gender },
      });
      if (error) throw error;
      setDisplayName([f, l].filter(Boolean).join(" "));
      setPanel(null);
    } catch (err: unknown) {
      setFormMsg(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Uploads only the user-confirmed crop. The file input never uploads
  // directly — selection always opens the crop editor first.
  const changePhoto = async (blob: Blob) => {
    if (!blob.type.startsWith("image/")) { setPhotoMsg("Choose an image file (JPG, PNG or WebP)."); return; }
    if (blob.size > 2 * 1024 * 1024) { setPhotoMsg("Keep the photo under 2 MB."); return; }
    setUploading(true);
    setPhotoMsg("");
    try {
      const sb = getAuthClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Log in again, then retry.");
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await sb.storage.from("avatars").upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
      });
      if (upErr) throw upErr;
      // Store the STORAGE PATH (not a public URL): display goes through
      // GET /api/avatar, which mints owner-only signed URLs. Works once the
      // bucket is private; legacy full-URL values keep working via the same
      // endpoint (path is extracted from them).
      const { error: metaErr } = await sb.auth.updateUser({ data: { custom_avatar: path } });
      if (metaErr) throw metaErr;
      setAvatarUrl(path);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Upload failed.";
      setPhotoMsg(/bucket|not found|row-level|policy|permission/i.test(raw)
        ? `${raw} — admin must create the public 'avatars' bucket first (SQL in the release notes).`
        : raw);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    setPhotoMsg("");
    try {
      const sb = getAuthClient();
      const { error } = await sb.auth.updateUser({ data: { custom_avatar: "" } });
      if (error) throw error;
      // Cleared photo falls back to the neutral placeholder — never to a
      // provider picture.
      setAvatarUrl("");
    } catch (err: unknown) {
      setPhotoMsg(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      setUploading(false);
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
      if (pwMode === "change") {
        // Re-authenticate against Supabase: proves the current password
        // without ever storing or logging it. OAuth-only accounts have no
        // password, so this correctly fails for them — they use Set mode.
        if (!curPw) { setFormMsg("Enter your current password."); setBusy(false); return; }
        const { data: { user } } = await sb.auth.getUser();
        if (!user?.email) throw new Error("Log in again, then retry.");
        const { error: reauthError } = await sb.auth.signInWithPassword({
          email: user.email,
          password: curPw,
        });
        if (reauthError) {
          if (/invalid login credentials/i.test(reauthError.message)) {
            throw new Error("Current password is incorrect. If you joined with Google/GitHub and never set one, use Set password instead.");
          }
          throw reauthError;
        }
      }
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) throw error;
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      setPanel(null);
      setFormMsg(pwMode === "set" ? "Password set — you can now sign in with email + password too. Google/GitHub login still works." : "");
    } catch (err: unknown) {
      setFormMsg(err instanceof Error ? err.message : "Could not update password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)",
    color: "var(--text)",
  };

  return (
    <>
      {!loading && email && (
        <DashNav email={email} displayName={displayName} avatarUrl={avatarUrl} onLogout={() => {}} streak={streakSummary} />
      )}
      <main className="mx-auto w-full px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            <a href="/dashboard" className="font-bold" style={{ color: "var(--accent)" }}>Dashboard</a>
            <span className="mx-1.5">/</span> Profile
          </p>
        </Reveal>
        <Reveal>
          <section
            className="relative mt-3 overflow-hidden rounded-[26px] p-6 text-white sm:p-8"
            style={{ background: "linear-gradient(120deg, #141b34 0%, #2b3a7a 55%, var(--accent) 130%)", boxShadow: "0 40px 90px -35px rgba(20, 27, 52, 0.7)" }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 220px at 85% 0%, rgba(255,255,255,0.16), transparent 65%), radial-gradient(500px 260px at 0% 100%, rgba(255,255,255,0.08), transparent 60%)" }} />
            <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-3xl" style={{ border: "2px solid rgba(255,255,255,0.55)", boxShadow: "0 14px 36px -12px rgba(0,0,0,0.55)" }}>
                {avatarUrl && imgOk ? (
                  <img src={`/api/avatar?src=${encodeURIComponent(avatarUrl)}`} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-3xl font-extrabold"
                    style={{ background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))", color: "var(--accent-fg)" }}
                  >
                    {initialsOf(displayName, email)}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <h1 className="dash-display truncate text-2xl font-extrabold tracking-tight sm:text-[28px]">
                  {loading ? "Loading…" : displayName || "Profile"}
                </h1>
                <p className="mt-0.5 truncate text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }}
                    className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold text-white transition-transform hover:-translate-y-px disabled:opacity-50"
                    style={{ border: "1.5px solid rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.12)" }}>
                    {uploading ? "Uploading…" : "📷 Change photo"}
                  </button>
                  {avatarUrl && (
                    <button type="button" onClick={removePhoto} disabled={uploading}
                      className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition-transform hover:-translate-y-px disabled:opacity-50"
                      style={{ color: "rgba(255,255,255,0.85)" }}>
                      Remove
                    </button>
                  )}
                </div>
                {photoMsg && <p className="mt-1.5 max-w-sm text-xs font-semibold" style={{ color: "#ffd7d7" }}>{photoMsg}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setPanel(panel === "name" ? null : "name"); setFormMsg(""); if (panel !== "name") openNameEditor(); }}
                className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold transition-transform hover:-translate-y-px"
                style={{ color: "#1e2952" }}
              >
                ✎ Update Profile
              </button>
              <button
                type="button"
                onClick={() => { setPanel(panel === "password" ? null : "password"); setFormMsg(""); setCurPw(""); setNewPw(""); setConfirmPw(""); setPwMode("change"); }}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-px"
                style={{ border: "1.5px solid rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.12)" }}
              >
                🔒 Change Password
              </button>
            </div>
            </div>
          </section>
        </Reveal>

        {!panel && formMsg && (
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
                <div>
                  <label htmlFor="profile-dob" className="mb-1.5 block text-[13px] font-bold">Date of Birth</label>
                  <input id="profile-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                    style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <label htmlFor="profile-gender" className="mb-1.5 block text-[13px] font-bold">Gender</label>
                  <select id="profile-gender" value={gender} onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                    style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              {formMsg && panel === "name" && (
                <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>{formMsg}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={saveProfile} disabled={busy}
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
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
              <h2 className="text-lg font-extrabold tracking-tight">{pwMode === "set" ? "Set password" : "Change password"}</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {pwMode === "set"
                  ? "For Google/GitHub sign-ins adding their first password — no current password needed. Afterwards email + password login works, and Google/GitHub login keeps working."
                  : "Email + password accounts: confirm your current password first."}
              </p>
              <div className="mt-3 flex gap-2 text-[13px]">
                <button type="button" onClick={() => { setPwMode("change"); setFormMsg(""); }}
                  className="cursor-pointer rounded-xl px-4 py-1.5 font-bold"
                  style={pwMode === "change" ? { background: "var(--btn-bg)", color: "var(--btn-text)" } : { border: "1px solid var(--border)" }}>
                  Change
                </button>
                <button type="button" onClick={() => { setPwMode("set"); setFormMsg(""); }}
                  className="cursor-pointer rounded-xl px-4 py-1.5 font-bold"
                  style={pwMode === "set" ? { background: "var(--btn-bg)", color: "var(--btn-text)" } : { border: "1px solid var(--border)" }}>
                  Set (Google/GitHub)
                </button>
              </div>
              <div className="mt-3 grid max-w-md gap-2.5">
                {pwMode === "change" && (
                  <div>
                    <label htmlFor="profile-cur" className="mb-1.5 block text-[13px] font-bold">Current password</label>
                    <input id="profile-cur" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password"
                      placeholder="Your existing password" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                      style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }} />
                  </div>
                )}
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
              {formMsg && panel === "password" && (
                <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>{formMsg}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={savePassword} disabled={busy}
                  className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                  style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
                  {busy ? "Saving…" : pwMode === "set" ? "Set password" : "Update password"}
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
              <h2 className="dash-display flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "var(--pill)", color: "var(--accent)" }}>👤</span> Personal Details
              </h2>
              <div className="mt-2">
                <DetailRow label="Name" value={loading ? "…" : displayName || "—"} />
                <DetailRow label="Email" value={email || "—"} />
                <DetailRow
                  label="Date of Birth"
                  value={loading ? "…" : dob ? (() => { try { return new Date(dob + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return dob; } })() : "—"}
                />
                <DetailRow label="Gender" value={loading ? "…" : gender || "—"} />
                <DetailRow label="Member since" value={memberSince} />
                <DetailRow label="Sign-in method" value={provider} />
              </div>
            </section>
          </Reveal>
          <Reveal>
            <section className="h-full rounded-[22px] p-6 backdrop-blur-2xl" style={cardStyle}>
              <h2 className="dash-display flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "var(--pill)", color: "var(--accent)" }}>📊</span> Overview
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <MiniStat icon="📝" value={loading ? "…" : overview.tests} label="TESTS" />
                <MiniStat icon="❓" value={loading ? "…" : overview.questions} label="QUESTIONS" />
                <MiniStat icon="🏆" value={loading ? "…" : overview.best} label="BEST SCORE" />
                <MiniStat icon="🎯" value={loading ? "…" : overview.acc} label="ACCURACY" />
              </div>
            </section>
          </Reveal>
          <Reveal>
            <section className="h-full rounded-[22px] p-6 backdrop-blur-2xl" style={cardStyle}>
              <h2 className="dash-display flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "var(--pill)", color: "var(--accent)" }}>🔥</span> Streak
              </h2>
              <div className="mono mt-4 text-2xl font-extrabold" style={{ color: "var(--accent)" }}>
                {loading ? "…" : `🔥 ${formatStreak(streakSummary.current)}`}
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>current • best {streakSummary.best}d all-time</p>
              {streakSummary.best > 0 && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--pill)" }} role="progressbar"
                    aria-valuenow={streakSummary.current} aria-valuemin={0} aria-valuemax={streakSummary.best}
                    aria-label="Progress toward best streak">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((streakSummary.current / Math.max(streakSummary.best, 1)) * 100))}%`,
                        background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))",
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                    {streakSummary.current >= streakSummary.best && streakSummary.best > 0
                      ? "🏆 All-time best — now extend it."
                      : `${streakSummary.best - streakSummary.current}d to match your best.`}
                  </p>
                </div>
              )}
              <div className="mt-4 flex justify-between gap-1">
                {streakSummary.week.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                      style={d.active
                        ? { background: "var(--accent)", color: "var(--accent-fg)" }
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
            <h2 className="dash-display flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: "var(--pill)", color: "var(--accent)" }}>📈</span> Performance Analysis
            </h2>
            <h3 className="mt-4 text-center text-sm font-extrabold" style={{ color: "var(--muted)" }}>Test Performance Over Time</h3>
            {mounted ? (
              <PerformanceLine data={histSrc} />
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
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onCancel={closeCropper}
          onConfirm={(blob) => { closeCropper(); changePhoto(blob); }}
        />
      )}
    </>
  );
}
