import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Alert, Card, Spinner } from "../components/ui";

export default function Login() {
  const { ready, configured, session, emailVerified, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifiedBanner = params.get("verify") === "1";
  const from = location.state?.from ?? "/dashboard";

  // Already signed in (and verified) → straight into the app.
  useEffect(() => {
    if (ready && session && emailVerified) navigate(from, { replace: true });
  }, [ready, session, emailVerified, from, navigate]);

  if (!ready) return <Spinner label="Checking your session…" />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(
          // Supabase's raw text for an unconfirmed account is not helpful, so
          // map it to the same instruction the server's 403 gives.
          /email not confirmed/i.test(err)
            ? "Verify your email first — open the confirmation link we sent, then log in."
            : err
        );
        return;
      }
      navigate(from, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8 mt-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-btn text-2xl font-black text-btn-fg">
          N
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log in to continue your NIMCET prep.</p>
      </div>

      {!configured ? (
        <Alert kind="error">
          Supabase is not configured for the app. Add <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> to <code>mobile/.env.local</code> and rebuild.
        </Alert>
      ) : null}

      {verifiedBanner ? (
        <div className="mb-4">
          <Alert kind="ok">Email confirmed. Log in to continue.</Alert>
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !configured}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
      </Card>

      <OAuthButtons />

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-accent">
          Create an account
        </Link>
      </p>
    </div>
  );
}

/**
 * Google / GitHub buttons. Intentionally disabled in Phase 1: the provider
 * hand-off lands on the website callback, whose PKCE exchange runs server-side
 * and cannot see the app's code verifier — completing it on-device is a Phase 2
 * task. Showing them disabled (rather than faking a login) is deliberate.
 */
function OAuthButtons() {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 py-2">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="flex flex-col gap-2">
        <button className="btn btn-ghost btn-block" type="button" disabled>
          Continue with Google
        </button>
        <button className="btn btn-ghost btn-block" type="button" disabled>
          Continue with GitHub
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Google / GitHub sign-in arrives in the next update.
      </p>
    </div>
  );
}
