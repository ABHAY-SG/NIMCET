"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function CheckEmailContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setEmail(window.localStorage.getItem("nimcuet-pending-email") ?? "");
    } catch {}
  }, []);

  const resend = async () => {
    const target = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setMsg("Enter the email you registered with, then tap resend.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.resend({
        type: "signup",
        email: target,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMsg("Fresh confirmation link sent — click it in your inbox (and spam).");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Could not resend. Please try again.";
      setMsg(/rate.?limit|too many|after \d+ second|wait a moment|slow down|throttl/i.test(raw)
        ? "Too many requests — wait a couple of minutes, then tap resend once."
        : raw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl sm:p-10" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[26px]">Security Challenge</h1>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7" style={{ color: "var(--muted)" }}>
          To protect the security of your account, we sent an email to{" "}
          <strong style={{ color: "var(--text)" }}>{email || "your inbox"}</strong>{" "}
          to verify your identity — please click the link in the email to proceed.
        </p>
        <div className="mx-auto mt-6 h-12 w-12 animate-spin rounded-full" style={{ border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
        {msg && (
          <p role="status" aria-live="polite" className="mx-auto mt-5 max-w-sm rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>
            {msg}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold transition-transform hover:-translate-y-px disabled:opacity-50"
            style={{ border: "1px solid var(--border)" }}
          >
            {busy ? "Sending…" : "Resend confirmation email"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/signup")}
            className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold"
            style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            Cancel
          </button>
        </div>
      </section>
    </main>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
        </main>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
