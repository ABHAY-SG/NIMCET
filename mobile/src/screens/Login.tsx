import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Alert, Spinner } from "../components/ui";
import { Icon } from "../components/icons";
import AuthShell from "../components/AuthShell";

export default function Login() {
  const {
    ready,
    configured,
    session,
    emailVerified,
    signIn,
    resendVerification,
    notice,
    clearNotice,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const verifiedBanner = params.get("verify") === "1";
  const from = location.state?.from ?? "/dashboard";

  useEffect(() => {
    if (ready && session && emailVerified) navigate(from, { replace: true });
  }, [ready, session, emailVerified, from, navigate]);

  if (!ready) return <Spinner label="Checking your session…" />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNeedsVerify(false);
    setResent(false);
    clearNotice();
    try {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err);
        setNeedsVerify(/verify your email/i.test(err));
        return;
      }
      navigate(from, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!email.trim()) {
      setError("Enter your email above, then tap resend.");
      return;
    }
    setResending(true);
    try {
      const { error: err } = await resendVerification(email);
      if (err) setError(err);
      else {
        setResent(true);
        setError(null);
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      mode="in"
      title="Welcome"
      accent="back."
      subtitle="Your papers, your progress and the next attempt — all waiting exactly where you left them."
      footer={
        <>
          New to NimCuet?{" "}
          <Link to="/signup">Create your account</Link>
        </>
      }
    >
      {!configured ? (
        <div className="mb-4">
          <Alert kind="error">
            Supabase is not configured for the app. Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>mobile/.env.local</code> and rebuild.
          </Alert>
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4">
          <Alert kind="error">{notice}</Alert>
        </div>
      ) : null}

      {verifiedBanner ? (
        <div className="mb-4">
          <Alert kind="ok">Email confirmed. Log in to continue.</Alert>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error ? (
          <Alert kind="error" shake>
            {error}
          </Alert>
        ) : null}
        {resent ? <Alert kind="ok">Confirmation email sent. Check your inbox.</Alert> : null}

        <label className="field">
          <span className="label">Email address</span>
          <span className="input-wrap">
            <span className="input-icon">
              <Icon name="mail" size={17} />
            </span>
            <input
              className="input has-icon"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </span>
        </label>

        <label className="field">
          <span className="label">Password</span>
          <span className="input-wrap">
            <span className="input-icon">
              <Icon name="lock" size={17} />
            </span>
            <input
              className="input has-icon has-action"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
            </button>
          </span>
        </label>

        <button className="btn btn-primary btn-block mt-1" type="submit" disabled={busy || !configured}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden />
              Signing in…
            </>
          ) : (
            <>
              Log in
              <Icon name="arrowRight" size={17} />
            </>
          )}
        </button>

        {needsVerify ? (
          <button
            className="btn btn-ghost btn-block"
            type="button"
            onClick={onResend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Resend confirmation email"}
          </button>
        ) : null}
      </form>

      <div className="divider">or continue with</div>
      <div className="oauth-row">
        <button className="oauth-btn" type="button" disabled title="Google sign-in is not available yet">
          <Icon name="google" size={15} />
          Google
          <span className="pill pill-neutral">Soon</span>
        </button>
        <button className="oauth-btn" type="button" disabled title="GitHub sign-in is not available yet">
          <Icon name="github" size={15} />
          GitHub
          <span className="pill pill-neutral">Soon</span>
        </button>
      </div>
      <p className="mt-3 text-center text-[10px] leading-4 text-faint">
        Social sign-in is being finished. Email works today.
      </p>
    </AuthShell>
  );
}
