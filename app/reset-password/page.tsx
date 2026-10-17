"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

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
    if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setMsg("Password needs 8+ characters with an uppercase letter, a number and a special character.");
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
    <main className="mx-auto w-full max-w-md px-4 pb-20 pt-28">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Set new password</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          Choose a fresh 8+ character password with a number.
        </p>
      </div>
      {checked && !hasSession ? (
        <div
          className="mt-6 rounded-[22px] p-6 text-center backdrop-blur-2xl sm:p-7"
          style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-bold">This page needs a reset link.</p>
          <p className="mt-2 text-[13px] leading-6" style={{ color: "var(--muted)" }}>
            Open the link we emailed you, or request a fresh one from the login page — then come back here.
          </p>
          <a
            href="/login-choice"
            className="mt-4 inline-block rounded-full px-6 py-3 text-sm font-bold"
            style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            Go to login →
          </a>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="mt-6 rounded-[22px] p-6 backdrop-blur-2xl sm:p-7"
          style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}
        >
          <label htmlFor="reset-pass" className="mb-1.5 block text-[13px] font-bold">New password</label>
          <input
            id="reset-pass"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters + a number"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
            style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          <label htmlFor="reset-confirm" className="mb-1.5 mt-4 block text-[13px] font-bold">Confirm new password</label>
          <input
            id="reset-confirm"
            type="password"
            required
            maxLength={128}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Retype your password"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
            style={{ background: "var(--pill)", border: confirm && password !== confirm ? "1px solid #dc2626" : "1px solid var(--border)", color: "var(--text)" }}
          />
          {msg && (
            <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>{msg}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full cursor-pointer rounded-xl py-3.5 text-sm font-extrabold disabled:opacity-50"
            style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            {busy ? "Please wait…" : "Save new password →"}
          </button>
        </form>
      )}
    </main>
  );
}
