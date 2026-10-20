"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PLACEHOLDER,
  PASSWORD_RULE,
  passwordProblem,
} from "@/lib/password";
import AuthBg from "@/components/auth-bg";
import ThemeFab from "@/components/theme-fab";

// Only reachable with a real session (the recovery link creates one through
// /auth/callback?flow=recovery). Opening this page cold — no link, no session
// — used to show a form whose save always failed with "Auth session missing!";
// now it explains how to get a valid link instead.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (alive) setHasSession(!!data.session);
      } catch {
        if (alive) setHasSession(false);
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const problem = passwordProblem(password);
    if (problem) {
      setMsg(problem);
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match — retype the confirmation.");
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Link expired — request a fresh reset link from login.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthBg />
      <main className="relative mx-auto flex min-h-[100svh] w-full max-w-md flex-col justify-center px-4 py-10">
        <ThemeFab />
        <Link
          href="/login-choice"
          className="mb-4 inline-flex w-fit items-center gap-2 text-sm font-bold transition-transform hover:-translate-x-1"
          style={{ color: "var(--muted)" }}
        >
          <span aria-hidden>←</span> Back to login
        </Link>
        <div
          className="pop rounded-[26px] p-7 backdrop-blur-[28px] backdrop-saturate-150 sm:p-8"
          style={{
            background: "color-mix(in srgb, var(--bg) 72%, transparent)",
            border: "1px solid var(--border)",
            boxShadow: "0 40px 100px -30px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,255,255,0.22)",
          }}
        >
          <h1 className="display text-3xl">Set new password</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Choose a fresh password: {PASSWORD_RULE}
          </p>
          {checked && !hasSession ? (
            <div className="mt-6 rounded-2xl p-5 text-center" style={{ background: "var(--pill)", border: "1px dashed var(--border)" }}>
              <p className="text-sm font-bold">This page needs a reset link.</p>
              <p className="mt-2 text-[13px] leading-6" style={{ color: "var(--muted)" }}>
                Open the link we emailed you, or request a fresh one from the login page — then come back here.
              </p>
              <a
                href="/login-choice"
                className="cta-glow mt-4 inline-block rounded-full px-6 py-3 text-sm font-bold"
                style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
              >
                Go to login →
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5">
              <label htmlFor="reset-pass" className="mb-1.5 block text-[13px] font-bold">New password</label>
              <input
                id="reset-pass"
                type="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={PASSWORD_PLACEHOLDER}
                className="inp w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
              <label htmlFor="reset-confirm" className="mb-1.5 mt-4 block text-[13px] font-bold">Confirm new password</label>
              <input
                id="reset-confirm"
                type="password"
                required
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retype your password"
                className="inp w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--pill)", border: confirm && password !== confirm ? "1px solid #dc2626" : "1px solid var(--border)", color: "var(--text)" }}
              />
              {msg && (
                <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>{msg}</p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="cta-glow mt-5 w-full cursor-pointer rounded-xl py-3.5 text-sm font-extrabold transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                style={{
                  background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))",
                  color: "var(--accent-fg)",
                  boxShadow: "0 14px 30px -12px color-mix(in srgb, var(--accent) 60%, transparent)",
                }}
              >
                {busy ? "Please wait…" : "Save new password →"}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
