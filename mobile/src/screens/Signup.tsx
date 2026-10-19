import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Alert, Spinner } from "../components/ui";
import { Icon } from "../components/icons";
import AuthShell from "../components/AuthShell";

export default function Signup() {
  const { ready, configured, session, emailVerified, signUp, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

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

  async function onResend() {
    setResending(true);
    try {
      const { error: err } = await resendVerification(email);
      if (err) setError(err);
      else setResent(true);
    } finally {
      setResending(false);
    }
  }

  const strength = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /[^A-Za-z]/.test(password) || /\d/.test(password),
  ];
  const strengthCount = strength.filter(Boolean).length;

  if (awaiting) {
    return (
      <AuthShell
        mode="up"
        title="One last"
        accent="step."
        subtitle="Your account is created. Confirm the email and the practice room unlocks."
        footer={
          <>
            Already verified? <Link to="/login?verify=1">Log in</Link>
          </>
        }
      >
        <div className="verify-panel">
          <span className="verify-seal">
            <Icon name="mail" size={27} />
          </span>
          <h2 className="display mt-4 text-[1.65rem]">Check your inbox</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            We sent a confirmation link to <span className="font-semibold text-fg">{email}</span>.
            Opening it hands you straight back to NimCuet.
          </p>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert kind="error">{error}</Alert>
          </div>
        ) : null}
        {resent ? (
          <div className="mt-4">
            <Alert kind="ok">Confirmation email sent again.</Alert>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <Link to="/login?verify=1" className="btn btn-primary btn-block">
            I&apos;ve verified — log in
            <Icon name="arrowRight" size={17} />
          </Link>
          <button
            className="btn btn-ghost btn-block"
            type="button"
            onClick={onResend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Resend confirmation email"}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="up"
      title="Begin your"
      accent="ascent."
      subtitle="A sharper way to prepare for NIMCET and CUET PG MCA — real papers, honest scorecards and a room of your own."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      {!configured ? (
        <div className="mb-4">
          <Alert kind="error">
            Supabase is not configured for the app. Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>mobile/.env.local</code>.
          </Alert>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error ? (
          <Alert kind="error" shake>
            {error}
          </Alert>
        ) : null}

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
          <span className="strength" aria-hidden>
            {strength.map((on, i) => (
              <span key={i} data-on={on ? "true" : "false"} />
            ))}
          </span>
          <span className="text-[10px] text-faint">
            {password.length === 0
              ? "Use 8+ characters. Longer is stronger."
              : strengthCount >= 3
                ? "Strong — ready to go."
                : strengthCount === 2
                  ? "Good. Add length or a symbol to strengthen it."
                  : "Keep going — 8+ characters minimum."}
          </span>
        </label>

        <label className="field">
          <span className="label">Confirm password</span>
          <span className="input-wrap">
            <span className="input-icon">
              <Icon name="shield" size={17} />
            </span>
            <input
              className="input has-icon has-action"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              aria-pressed={showConfirm}
            >
              <Icon name={showConfirm ? "eyeOff" : "eye"} size={18} />
            </button>
          </span>
        </label>

        <button className="btn btn-primary btn-block mt-1" type="submit" disabled={busy || !configured}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <Icon name="arrowRight" size={17} />
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-[10px] leading-4 text-faint">
        By creating an account you agree to the NimCuet terms and privacy policy.
      </p>
    </AuthShell>
  );
}
