import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAsync } from "../lib/useAsync";
import { formatDate, listMyAttempts } from "../lib/data";
import { SectionHead, Stat } from "../components/ui";
import { Icon } from "../components/icons";

function displayName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const meta = (user.user_metadata ?? {}) as {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    name?: string;
  };
  const full =
    [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim() ||
    (meta.full_name ?? "").trim() ||
    (meta.name ?? "").trim();
  return full || (user.email ?? "").split("@")[0] || "student";
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { loading, data } = useAsync(() => listMyAttempts(100), [user?.id]);

  const initial = (user?.email?.[0] ?? "?").toUpperCase();
  const name = user ? displayName(user) : "student";
  const verified = Boolean(user?.email_confirmed_at);
  const attemptCount = data?.length ?? 0;

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="screen-title mt-2">
            Profile <em>&amp; progress</em>
          </h1>
        </div>
      </header>

      <section className="hero reveal" style={{ padding: "20px" }}>
        <span aria-hidden className="hero-orb hero-orb-a" />
        <span aria-hidden className="hero-orb hero-orb-b" />
        <div className="relative z-10 flex items-center gap-4">
          <span className="avatar h-16 w-16 text-[26px]">{initial}</span>
          <div className="min-w-0 flex-1">
            <h2 className="display truncate text-[1.55rem]">{name}</h2>
            <p className="mt-1 truncate text-[12px] text-muted">{user?.email}</p>
            <span className={`pill mt-2 ${verified ? "pill-ok" : "pill-gold"}`}>
              <Icon name={verified ? "shield" : "alert"} size={11} strokeWidth={2} />
              {verified ? "Verified account" : "Verification pending"}
            </span>
          </div>
        </div>
      </section>

      <div className="stat-grid mt-3 reveal" style={{ "--d": "70ms" } as React.CSSProperties}>
        <Stat
          icon="book"
          label="Mock attempts"
          value={loading ? "…" : String(attemptCount)}
          note="saved to your account"
        />
        <Stat
          icon="calendar"
          label="Member since"
          value={user?.created_at ? formatDate(user.created_at) : "—"}
          note="your first day here"
        />
      </div>

      <SectionHead title="Account details" />
      <div className="card p-4">
        <div className="detail-row">
          <span className="detail-label flex items-center gap-2">
            <Icon name="mail" size={14} />
            Email
          </span>
          <span className="detail-value truncate">{user?.email ?? "—"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label flex items-center gap-2">
            <Icon name="shield" size={14} />
            Email verified
          </span>
          <span className="detail-value">{verified ? "Yes" : "No"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label flex items-center gap-2">
            <Icon name="clock" size={14} />
            Last sign-in
          </span>
          <span className="detail-value">
            {user?.last_sign_in_at ? formatDate(user.last_sign_in_at) : "—"}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label flex items-center gap-2">
            <Icon name="hash" size={14} />
            Account ID
          </span>
          <span className="detail-value mono text-[11px]">{user?.id?.slice(0, 8)}…</span>
        </div>
      </div>

      <SectionHead title="Coming to this space" />
      <div className="card card-quiet p-4">
        <ul className="space-y-3">
          {[
            "Display name and avatar editing",
            "Password reset inside the app",
            "Notification and study reminders",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2.5 text-[12.5px] text-muted">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(244,162,97,0.08)", color: "var(--accent)" }}>
                <Icon name="sparkles" size={12} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <button className="btn btn-danger btn-block mt-5" type="button" onClick={onSignOut} disabled={busy}>
        <Icon name="logout" size={16} />
        {busy ? "Signing out…" : "Sign out"}
      </button>

      <p className="mt-4 text-center text-[9.5px] font-bold uppercase tracking-[0.24em] text-faint">
        NimCuet · Exam Studio
      </p>
    </div>
  );
}
