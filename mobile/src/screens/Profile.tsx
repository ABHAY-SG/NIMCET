import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Card, ScreenTitle } from "../components/ui";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

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
            <div className="truncate text-sm font-semibold">{user?.email}</div>
            <div className="text-xs text-ok">Verified account</div>
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <span className="pill mb-2">Phase 2</span>
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
