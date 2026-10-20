"use client";
import { useEffect, useRef, useState } from "react";
import { getAuthClient } from "@/lib/supabase";

// One-time prompt for Google/GitHub-only accounts: they have NO password, so
// the profile pages (change-only, current password required) can never help
// them. This shows once after the first sign-in and lets them add a password
// so email + password login works too. "Maybe later" is remembered on the
// account (user_metadata), not just this browser.
//
// Detection is exact, not a heuristic: Supabase creates an EMAIL identity the
// first time a password is set on an OAuth account (GoTrue's
// ensureEmailIdentityForPassword, invoked when a password is added to a user
// without one). No email identity + at least one provider = no password yet.

const PW_RULE =
  "Password needs 8+ characters with an uppercase letter, a number and a special character.";

type PromptUser = {
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
  identities?: Array<{ provider?: string }> | null;
  user_metadata?: Record<string, unknown> | null;
};

function providerLabel(raw: string): string {
  if (raw === "github") return "GitHub";
  if (raw === "google") return "Google";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function needsPasswordSetup(user: PromptUser): boolean {
  const am = user.app_metadata ?? {};
  const providers = Array.isArray(am.providers)
    ? (am.providers as unknown[]).filter((p): p is string => typeof p === "string")
    : typeof am.provider === "string"
      ? [am.provider]
      : [];
  const identities = user.identities ?? [];
  const hasEmail = identities.some((i) => i.provider === "email") || providers.includes("email");
  const dismissed = user.user_metadata?.pw_prompt_dismissed === true;
  return !hasEmail && providers.length > 0 && !dismissed;
}

export default function PasswordPrompt() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("Google/GitHub");
  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = getAuthClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!alive || !user) return;
        if (!needsPasswordSetup(user)) return;
        const am = (user.app_metadata ?? {}) as { provider?: string; providers?: string[] };
        const first = Array.isArray(am.providers) && am.providers.length ? am.providers[0] : am.provider ?? "";
        setProvider(providerLabel(first || "Google/GitHub"));
        setEmail(user.email ?? "");
        setOpen(true);
      } catch {}
    })();
    return () => {
      alive = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const stampDismissed = async () => {
    try {
      await getAuthClient().auth.updateUser({ data: { pw_prompt_dismissed: true } });
    } catch {}
  };

  const dismiss = () => {
    setOpen(false);
    void stampDismissed();
  };

  useEffect(() => {
    if (!open || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done]);

  const save = async () => {
    setMsg("");
    if (newPw.length < 8 || !/\d/.test(newPw) || !/[A-Z]/.test(newPw) || !/[^A-Za-z0-9]/.test(newPw)) {
      setMsg(PW_RULE);
      return;
    }
    if (newPw !== confirmPw) {
      setMsg("Passwords do not match — retype the confirmation.");
      return;
    }
    setBusy(true);
    try {
      const sb = getAuthClient();
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) {
        if (/current.?password/i.test(error.message)) {
          throw new Error("This project requires the current password to change passwords — use Forgot password on the login page instead.");
        }
        throw error;
      }
      setNewPw("");
      setConfirmPw("");
      setDone(true);
      timerRef.current = window.setTimeout(() => setOpen(false), 1600);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not set the password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="download-modal-backdrop fixed inset-0 z-[90] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="pw-prompt-title">
      <button
        type="button"
        aria-label="Close"
        onClick={done ? undefined : dismiss}
        className="download-modal-scrim fixed inset-0 cursor-default"
      />
      <div
        className="download-modal-card dash-main relative w-full max-w-md rounded-[20px] border p-5 sm:p-6"
        style={{ background: "var(--dash-surface)", borderColor: "var(--dash-line)", color: "var(--text)" }}
      >
        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: "var(--pill)", color: "var(--accent)" }}>
              ✓
            </div>
            <h2 id="pw-prompt-title" className="dash-title-sm mt-4">Password set</h2>
            <p className="mt-1.5 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
              Email + password sign-in now works. {provider} sign-in keeps working too.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg" style={{ background: "var(--pill)", color: "var(--accent)" }}>
                🔒
              </span>
              <div className="min-w-0">
                <h2 id="pw-prompt-title" className="dash-title-sm">Add a password</h2>
                <p className="mt-1 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
                  You signed in with {provider}. Set a password so you can also sign in with your email
                  {email ? <> (<span className="font-semibold">{email}</span>)</> : null} — {provider} sign-in keeps working.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2.5">
              <div>
                <label htmlFor="pw-set-1" className="dash-label mb-1.5 block">New password</label>
                <input
                  id="pw-set-1"
                  type="password"
                  value={newPw}
                  autoFocus
                  autoComplete="new-password"
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters + a number"
                  className="dash-input"
                />
              </div>
              <div>
                <label htmlFor="pw-set-2" className="dash-label mb-1.5 block">Confirm password</label>
                <input
                  id="pw-set-2"
                  type="password"
                  value={confirmPw}
                  autoComplete="new-password"
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Retype your password"
                  className="dash-input"
                  style={confirmPw && newPw !== confirmPw ? { borderColor: "var(--dash-danger)" } : undefined}
                />
              </div>
            </div>
            {msg && (
              <p role="status" aria-live="polite" className="dash-alert mt-3 text-[11.5px]">
                {msg}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="dash-btn dash-btn-primary"
              >
                {busy ? "Saving…" : "Set password"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="dash-btn dash-btn-secondary"
              >
                Maybe later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
