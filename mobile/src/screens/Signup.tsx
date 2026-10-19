import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Alert, Card, Spinner } from "../components/ui";

export default function Signup() {
  const { ready, configured, session, emailVerified, signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaiting, setAwaiting] = useState(false);

  if (!ready) return <Spinner label="Checking your session…" />;
  if (session && emailVerified) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error: err, needsVerification } = await signUp(email, password);
      if (err) {
        setError(err);
        return;
      }
      if (needsVerification) setAwaiting(true);
      else navigate("/dashboard", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (awaiting) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <div className="mt-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/15 text-2xl text-ok">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Check your inbox</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We sent a confirmation link to <span className="font-semibold text-fg">{email}</span>.
            Open it to verify your account — it will hand you back to NimCuet automatically. Then
            log in.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Link to="/login?verify=1" className="btn btn-primary btn-block">
            I&apos;ve verified — log in
          </Link>
          <Link to="/login" className="btn btn-ghost btn-block">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8 mt-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-btn text-2xl font-black text-btn-fg">
          N
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Mock tests, real timers, honest analytics.</p>
      </div>

      {!configured ? (
        <div className="mb-4">
          <Alert kind="error">
            Supabase is not configured for the app. Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>mobile/.env.local</code>.
          </Alert>
        </div>
      ) : null}

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error ? <Alert kind="error">{error}</Alert> : null}

          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          <label className="field">
            <span className="label">Confirm password</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
            />
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !configured}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Log in
        </Link>
      </p>
    </div>
  );
}
