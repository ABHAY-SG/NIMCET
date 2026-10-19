import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAsync } from "../lib/useAsync";
import { formatDate, listMyAttempts } from "../lib/data";
import { Card, ScreenTitle } from "../components/ui";

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
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title="Profile" />

      <Card>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-pill text-lg font-bold text-accent">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted">{user?.email}</div>
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <dl className="space-y-2 text-sm">
          <Row label="Email verified" value={user?.email_confirmed_at ? "Yes" : "No"} />
          <Row label="Member since" value={user?.created_at ? formatDate(user.created_at) : "—"} />
          <Row
            label="Last sign-in"
            value={user?.last_sign_in_at ? formatDate(user.last_sign_in_at) : "—"}
          />
          <Row
            label="Mock attempts"
            value={loading ? "…" : String(data?.length ?? 0)}
          />
          <Row label="Account ID" value={<span className="mono text-xs">{user?.id?.slice(0, 8)}…</span>} />
        </dl>
      </Card>

      <Card className="mt-3 border-dashed">
        <span className="pill mb-2">Coming soon</span>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>Edit display name and avatar</li>
          <li>Password reset (opens the website&apos;s existing reset flow in-app)</li>
          <li>Notification and theme preferences</li>
        </ul>
      </Card>

      <button className="btn btn-ghost btn-block mt-4" type="button" onClick={onSignOut} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
