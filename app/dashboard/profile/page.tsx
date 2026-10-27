"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Flame,
  History,
  KeyRound,
  Mail,
  Pencil,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  UserRound,
} from "lucide-react";
import Reveal from "@/components/reveal";
import DashNav from "@/components/dash-nav";
import DashSide, { type DashView } from "@/components/dash-side";
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
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0" style={{ borderColor: "var(--dash-line)" }}>
      <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="min-w-0 truncate text-right text-[12px] font-bold" style={{ color: "var(--text)" }} title={value}>{value}</span>
    </div>
  );
}

function MiniStat({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border px-3 py-3.5 text-center" style={{ background: "var(--dash-surface-muted)", borderColor: "var(--dash-line)" }}>
      <div aria-hidden className="mx-auto flex h-8 w-8 items-center justify-center rounded-[8px]" style={{ background: "var(--dash-accent-soft)", color: "var(--accent)" }}>{icon}</div>
      <div className="mono mt-2 text-[19px] font-extrabold leading-none" style={{ color: "var(--text)" }}>{value}</div>
      <div className="mt-1 text-[8.5px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>{label}</div>
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
          <line key={f} x1={PADL} x2={W - PADR} y1={PADT + (H - PADT - PADB) * f} y2={PADT + (H - PADT - PADB) * f} stroke="var(--dash-line)" strokeWidth="1" />
        ))}
        <path d={area} fill="var(--accent)" opacity="0.1" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((a, i) => (
          <g key={a.id ?? i}>
            <circle cx={x(i)} cy={y(Number(a.score) || 0)} r="4.5" fill="var(--dash-surface)" stroke="var(--accent)" strokeWidth="2" />
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
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [curPw, setCurPw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);

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

  const goView = (next: DashView) => {
    setSideOpen(false);
    if (next === "home") router.push("/dashboard");
    else router.push(`/dashboard?view=${next}`);
  };

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
      // Changing a password ALWAYS requires the current one. Google/GitHub-only
      // accounts have no password yet — they add one from the one-time prompt
      // shown after sign-in (components/password-prompt.tsx), so this form
      // never doubles as a password-less shortcut.
      if (!curPw) { setFormMsg("Enter your current password."); setBusy(false); return; }
      // Re-authenticate against Supabase: proves the current password without
      // ever storing or logging it.
      const { data: { user } } = await sb.auth.getUser();
      if (!user?.email) throw new Error("Log in again, then retry.");
      const { error: reauthError } = await sb.auth.signInWithPassword({
        email: user.email,
        password: curPw,
      });
      if (reauthError) {
        if (/invalid login credentials/i.test(reauthError.message)) {
          throw new Error("Current password is incorrect. If you joined with Google/GitHub and never set one, use Forgot password on the login page.");
        }
        throw reauthError;
      }
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) throw error;
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      setFormMsg("Password changed.");
    } catch (err: unknown) {
      setFormMsg(err instanceof Error ? err.message : "Could not update password. Try again.");
    } finally {
      setBusy(false);
    }
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
          title="Profile"
          subtitle="Identity, security and account overview"
        />
      )}
      <main className="dash-main mx-auto w-full max-w-[1560px] px-3 pb-20 pt-20 sm:px-5 lg:px-7">
        <DashSide
          mobileOpen={sideOpen}
          onClose={() => setSideOpen(false)}
          view="home"
          onSelect={goView}
          collapsed={sideCollapsed}
          onToggleCollapsed={toggleSideCollapsed}
          streak={streakSummary}
        />
        <div className={`min-w-0 transition-[margin-left] duration-300 ease-out ${sideCollapsed ? "lg:ml-[5.75rem]" : "lg:ml-[17.5rem]"}`}>
          <div className="space-y-4">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="dash-eyebrow">Account</div>
                  <h1 className="dash-title mt-1">Profile & settings</h1>
                  <p className="dash-subtitle mt-1 max-w-xl">
                    Manage your identity, sign-in security and the performance snapshot attached to your account.
                  </p>
                </div>
                <span className="dash-chip"><ShieldCheck size={12} /> Protected account</span>
              </div>
            </Reveal>

            {note && (
              <div className="dash-alert dash-alert-danger" role="alert">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{note}</span>
              </div>
            )}
            {!panel && formMsg && (
              <div className={`dash-alert ${/changed/i.test(formMsg) ? "dash-alert-success" : "dash-alert-danger"}`} role="status">
                <Check size={15} className="mt-0.5 shrink-0" />
                <span>{formMsg}</span>
              </div>
            )}

            <Reveal>
              <section className="dash-card p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[18px] border" style={{ borderColor: "var(--dash-line)", boxShadow: "var(--dash-shadow-xs)" }}>
                      {avatarUrl && imgOk ? (
                        <img src={`/api/avatar?src=${encodeURIComponent(avatarUrl)}`} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="block h-full w-full object-cover" />
                      ) : (
                        <span className="dash-avatar-fallback h-full w-full text-[22px]">{initialsOf(displayName, email)}</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="dash-title-sm truncate">{loading ? "Loading profile…" : displayName || "Your profile"}</h2>
                      <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--muted)" }} title={email}>{email || "—"}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="dash-chip"><CalendarDays size={10} /> Joined {memberSince}</span>
                        <span className="dash-chip"><ShieldCheck size={10} /> {provider}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Choose profile photo"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }}
                      className="hidden"
                    />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="dash-btn dash-btn-secondary dash-btn-sm">
                      <Camera size={14} /> {uploading ? "Uploading…" : "Change photo"}
                    </button>
                    {avatarUrl && (
                      <button type="button" onClick={removePhoto} disabled={uploading} className="dash-btn dash-btn-ghost dash-btn-sm" style={{ color: "var(--dash-danger)" }}>
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="dash-rule my-4" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] leading-5" style={{ color: "var(--muted)" }}>
                    Your photo is cropped before upload. Nothing is published without your action.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { if (panel === "name") setPanel(null); else openNameEditor(); }}
                      className="dash-btn dash-btn-secondary dash-btn-sm"
                      aria-expanded={panel === "name"}
                    >
                      <Pencil size={13} /> Update profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPanel(panel === "password" ? null : "password"); setFormMsg(""); setCurPw(""); setNewPw(""); setConfirmPw(""); }}
                      className="dash-btn dash-btn-secondary dash-btn-sm"
                      aria-expanded={panel === "password"}
                    >
                      <KeyRound size={13} /> Change password
                    </button>
                  </div>
                </div>
                {photoMsg && (
                  <div className="dash-alert dash-alert-danger mt-3" role="alert">
                    <Camera size={14} className="mt-0.5 shrink-0" />
                    <span>{photoMsg}</span>
                  </div>
                )}
              </section>
            </Reveal>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
              <div className="min-w-0 space-y-4">
                {panel === "name" && (
                  <Reveal>
                    <section className="dash-card p-5 sm:p-6">
                      <div className="flex items-start gap-3">
                        <span className="dash-icon-tile"><UserRound size={17} /></span>
                        <div>
                          <h2 className="dash-title-sm">Update profile</h2>
                          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>These details appear on your account and scorecards.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="dash-label">First name</span>
                          <input id="profile-first" type="text" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" className="dash-input" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="dash-label">Last name</span>
                          <input id="profile-last" type="text" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" className="dash-input" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="dash-label">Date of birth</span>
                          <input id="profile-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="dash-input" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="dash-label">Gender</span>
                          <select id="profile-gender" value={gender} onChange={(e) => setGender(e.target.value)} className="dash-input">
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>
                      </div>
                      {formMsg && panel === "name" && (
                        <div className="dash-alert dash-alert-danger mt-3" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{formMsg}</span></div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={saveProfile} disabled={busy} className="dash-btn dash-btn-primary">
                          {busy ? "Saving…" : "Save changes"}
                        </button>
                        <button type="button" onClick={() => setPanel(null)} className="dash-btn dash-btn-secondary">Cancel</button>
                      </div>
                    </section>
                  </Reveal>
                )}

                {panel === "password" && (
                  <Reveal>
                    <section className="dash-card p-5 sm:p-6">
                      <div className="flex items-start gap-3">
                        <span className="dash-icon-tile"><KeyRound size={17} /></span>
                        <div>
                          <h2 className="dash-title-sm">Change password</h2>
                          <p className="mt-0.5 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                            We re-check your current password with the auth server before saving a new one.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid max-w-md gap-3">
                        <label className="grid gap-1.5">
                          <span className="dash-label">Current password</span>
                          <input id="profile-cur" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" placeholder="Your existing password" className="dash-input" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="dash-label">New password</span>
                          <input id="profile-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 characters + a number" className="dash-input" />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="dash-label">Confirm new password</span>
                          <input id="profile-pw2" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" placeholder="Retype your password" className="dash-input" style={confirmPw && newPw !== confirmPw ? { borderColor: "var(--dash-danger)" } : undefined} />
                        </label>
                        <p className="rounded-[10px] px-3 py-2 text-[10.5px] leading-5" style={{ background: "var(--dash-surface-muted)", color: "var(--muted)" }}>
                          Joined with Google or GitHub and never set a password? Use <a href="/login" className="dash-link underline underline-offset-2">Forgot password</a> or the prompt after login.
                        </p>
                      </div>
                      {formMsg && panel === "password" && (
                        <div className="dash-alert dash-alert-danger mt-3" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{formMsg}</span></div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={savePassword} disabled={busy} className="dash-btn dash-btn-primary">
                          {busy ? "Saving…" : "Update password"}
                        </button>
                        <button type="button" onClick={() => setPanel(null)} className="dash-btn dash-btn-secondary">Cancel</button>
                      </div>
                    </section>
                  </Reveal>
                )}

                <Reveal>
                  <section className="dash-card p-5">
                    <div className="flex items-center gap-2">
                      <span className="dash-icon-tile dash-icon-tile-sm"><UserRound size={15} /></span>
                      <h2 className="dash-title-sm">Personal details</h2>
                    </div>
                    <div className="mt-2">
                      <DetailRow label="Name" value={loading ? "…" : displayName || "—"} />
                      <DetailRow label="Email" value={email || "—"} />
                      <DetailRow
                        label="Date of birth"
                        value={loading ? "…" : dob ? (() => { try { return new Date(dob + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return dob; } })() : "—"}
                      />
                      <DetailRow label="Gender" value={loading ? "…" : gender || "—"} />
                      <DetailRow label="Member since" value={memberSince} />
                      <DetailRow label="Sign-in method" value={provider} />
                    </div>
                  </section>
                </Reveal>

                <Reveal>
                  <section className="dash-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="dash-icon-tile dash-icon-tile-sm"><BarChart3 size={15} /></span>
                        <div>
                          <h2 className="dash-title-sm">Performance analysis</h2>
                          <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--muted)" }}>Real attempt scores, newest on the right.</p>
                        </div>
                      </div>
                      <span className="dash-chip">{histSrc.length} attempt{histSrc.length === 1 ? "" : "s"}</span>
                    </div>
                    {mounted ? (
                      <PerformanceLine data={histSrc} />
                    ) : (
                      <div className="dash-skeleton mt-3 h-[170px] w-full" />
                    )}
                    <p className="mt-2 text-[10px] leading-5" style={{ color: "var(--muted)" }}>
                      Subject-wise and level-wise splits need per-question result storage, which doesn&apos;t exist yet — this line uses your real attempt scores.
                    </p>
                  </section>
                </Reveal>
              </div>

              <aside className="min-w-0 space-y-4">
                <Reveal>
                  <section className="dash-card p-4">
                    <div className="flex items-center gap-2">
                      <span className="dash-icon-tile dash-icon-tile-sm"><BarChart3 size={15} /></span>
                      <h2 className="dash-title-sm">Overview</h2>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <MiniStat icon={<FileText size={14} />} value={loading ? "…" : overview.tests} label="Tests" />
                      <MiniStat icon={<Target size={14} />} value={loading ? "…" : overview.questions} label="Questions" />
                      <MiniStat icon={<Trophy size={14} />} value={loading ? "…" : overview.best} label="Best score" />
                      <MiniStat icon={<Check size={14} />} value={loading ? "…" : overview.acc} label="Accuracy" />
                    </div>
                  </section>
                </Reveal>

                <Reveal>
                  <section className="dash-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="dash-icon-tile dash-icon-tile-sm" style={{ background: "var(--dash-warning-soft)", borderColor: "rgba(180,83,9,.16)", color: "var(--dash-warning)" }}><Flame size={15} /></span>
                        <h2 className="dash-title-sm">Daily streak</h2>
                      </div>
                      <span className="dash-chip">Best {streakSummary.best}d</span>
                    </div>
                    <div className="mt-3 text-[19px] font-extrabold" style={{ color: "var(--text)" }}>
                      {loading ? "…" : formatStreak(streakSummary.current)}
                    </div>
                    <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--muted)" }}>Current streak · best {streakSummary.best} days all-time</p>
                    {streakSummary.best > 0 && (
                      <div className="mt-3">
                        <div className="dash-progress" role="progressbar" aria-valuenow={streakSummary.current} aria-valuemin={0} aria-valuemax={streakSummary.best} aria-label="Progress toward best streak">
                          <span style={{ width: `${Math.min(100, Math.round((streakSummary.current / Math.max(streakSummary.best, 1)) * 100))}%` }} />
                        </div>
                        <p className="mt-1.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
                          {streakSummary.current >= streakSummary.best ? "All-time best — keep it going." : `${streakSummary.best - streakSummary.current} days to match your best.`}
                        </p>
                      </div>
                    )}
                    {streakSummary.week.length > 0 && (
                      <div className="mt-4 flex justify-between gap-1">
                        {streakSummary.week.map((d, i) => (
                          <div key={i} className="flex flex-1 flex-col items-center gap-1">
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                              style={d.active
                                ? { background: "var(--accent)", color: "var(--accent-fg)" }
                                : { background: "var(--dash-surface-muted)", color: "var(--muted)", border: d.isToday ? "1.5px solid var(--accent)" : "1px solid var(--dash-line)" }}
                            >
                              {d.active ? <Check size={12} strokeWidth={2.8} /> : d.label}
                            </span>
                            <span className="text-[8.5px] font-bold" style={{ color: d.isToday ? "var(--accent)" : "var(--muted)" }}>{d.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </Reveal>

                <Reveal>
                  <a href="/dashboard?view=history" className="dash-card dash-card-hover flex items-center justify-between gap-3 p-4">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="dash-icon-tile dash-icon-tile-sm"><History size={15} /></span>
                      <span className="min-w-0">
                        <span className="dash-title-sm block">Test history</span>
                        <span className="mt-0.5 block text-[10.5px]" style={{ color: "var(--muted)" }}>Review every saved attempt.</span>
                      </span>
                    </span>
                    <ChevronRight size={15} style={{ color: "var(--muted)" }} />
                  </a>
                </Reveal>

                <Reveal>
                  <section className="dash-card p-4">
                    <div className="flex items-center gap-2">
                      <span className="dash-icon-tile dash-icon-tile-sm"><Clock3 size={15} /></span>
                      <h2 className="dash-title-sm">Need help?</h2>
                    </div>
                    <p className="mt-2 text-[10.5px] leading-5" style={{ color: "var(--muted)" }}>Account, plan or test-day issue — the team is one message away.</p>
                    <a href="mailto:abhayincodingworld@gmail.com" className="dash-btn dash-btn-secondary dash-btn-sm mt-3 w-full">
                      <Mail size={13} /> Email support <ArrowRight size={12} className="ml-auto" />
                    </a>
                  </section>
                </Reveal>
              </aside>
            </div>
          </div>
        </div>
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
