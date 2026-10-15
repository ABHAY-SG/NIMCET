"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import AuthBg from "@/components/auth-bg";

const POLL_MS = 4000;
const MAX_WAIT_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_S = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Phase = "waiting" | "verified-session" | "verified-nosession" | "timeout";

function isRateLimit(raw: string) {
  return /rate.?limit|too many|after \d+ second|wait a moment|slow down|throttl|email rate/i.test(raw);
}

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [msg, setMsg] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [count, setCount] = useState(3);
  const [target, setTarget] = useState("/login?verified=1");
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>("waiting");
  const challengeIdRef = useRef<string | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    challengeIdRef.current = challengeId;
  }, [challengeId]);

  // Init: URL ?email=&challenge= wins, fallback to localStorage, then persist.
  useEffect(() => {
    try {
      const qEmail = (searchParams.get("email") ?? "").trim();
      const qChallenge = (searchParams.get("challenge") ?? "").trim();
      const sEmail = (window.localStorage.getItem("nimcuet-pending-email") ?? "").trim();
      const sChallenge = (window.localStorage.getItem("nimcuet-pending-challenge") ?? "").trim();
      const sAt = Number(window.localStorage.getItem("nimcuet-pending-at") ?? "0");
      const nextEmail = qEmail || sEmail;
      const rawChallenge = qChallenge || sChallenge;
      const nextChallenge = UUID_RE.test(rawChallenge) ? rawChallenge : null;
      if (nextEmail) setEmail(nextEmail);
      if (nextChallenge) setChallengeId(nextChallenge);
      try {
        if (nextEmail) window.localStorage.setItem("nimcuet-pending-email", nextEmail);
        if (nextChallenge) {
          window.localStorage.setItem("nimcuet-pending-challenge", nextChallenge);
          if (!sAt) window.localStorage.setItem("nimcuet-pending-at", String(Date.now()));
        }
      } catch {}
      if (sAt && Date.now() - sAt > 24 * 60 * 60 * 1000) {
        setMsg("This waiting session is older than 24 hours — confirmation links expire. Request a fresh link below.");
      }
      // Restore resend cooldown across reloads so a refresh can't bypass
      // the guard and trip Supabase's "email rate limit exceeded".
      try {
        const lastResend = Number(window.localStorage.getItem("nimcuet-resend-at") ?? "0");
        if (lastResend) {
          const elapsed = Math.floor((Date.now() - lastResend) / 1000);
          if (elapsed < RESEND_COOLDOWN_S) setCooldown(RESEND_COOLDOWN_S - elapsed);
        }
      } catch {}
    } catch {}
  }, [searchParams]);

  const checkOnce = useCallback(async (manual = false) => {
    if (phaseRef.current !== "waiting") return false;
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        try {
          const { data: { user } } = await sb.auth.getUser();
          if (user && user.email_confirmed_at) {
            setTarget("/dashboard");
            setPhase("verified-session");
            try {
              window.localStorage.removeItem("nimcuet-pending-at");
            } catch {}
            return true;
          }
        } catch {}
      }
      const cid = challengeIdRef.current;
      if (cid) {
        try {
          const sb2 = getSupabase();
          const { data } = await sb2
            .from("signup_verification_sessions")
            .select("verified_at")
            .eq("challenge_id", cid)
            .maybeSingle();
          const verifiedAt = (data as { verified_at?: string | null } | null)?.verified_at;
          if (verifiedAt) {
            // Email confirmed (possibly on another device). This browser has no
            // session, so never claim logged-in — send them to log in.
            if (session) {
              setTarget("/dashboard");
              setPhase("verified-session");
            } else {
              setTarget("/login?verified=1");
              setPhase("verified-nosession");
            }
            return true;
          }
        } catch {}
      }
      if (manual) {
        setMsg("We couldn't confirm yet — check your inbox and spam, click the newest link, wait a few seconds, then try again.");
      }
      return false;
    } catch {
      if (manual) setMsg("Could not reach the server. Check your connection and try again.");
      return false;
    }
  }, []);

  // Poll for verification + timeout. Stops on success/timeout/unmount.
  // First tick fires after POLL_MS; BroadcastChannel/storage events trigger
  // an immediate check when the verification tab confirms same-browser.
  useEffect(() => {
    startRef.current = Date.now();
    const id = window.setInterval(async () => {
      if (phaseRef.current !== "waiting") {
        window.clearInterval(id);
        return;
      }
      if (Date.now() - startRef.current > MAX_WAIT_MS) {
        setPhase("timeout");
        window.clearInterval(id);
        return;
      }
      const done = await checkOnce(false);
      if (done) window.clearInterval(id);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [checkOnce, challengeId]);

  // Instant wake-up when the verification tab confirms in the same browser.
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("nimcuet-verify");
      ch.onmessage = () => { checkOnce(false); };
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nimcuet-just-verified") checkOnce(false);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      try { ch?.close(); } catch {}
    };
  }, [checkOnce]);

  // Cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-redirect after verified.
  useEffect(() => {
    if (phase !== "verified-session" && phase !== "verified-nosession") return;
    if (count <= 0) {
      router.replace(target);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count, target, router]);

  const resend = async () => {
    const targetEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setMsg("Enter the email you registered with, then tap resend.");
      return;
    }
    if (resendBusy || cooldown > 0) return;
    setResendBusy(true);
    setMsg("");
    try {
      let cid = challengeId;
      if (!cid || !UUID_RE.test(cid)) {
        cid = crypto.randomUUID();
        setChallengeId(cid);
        try {
          window.localStorage.setItem("nimcuet-pending-email", targetEmail);
          window.localStorage.setItem("nimcuet-pending-challenge", cid);
          window.localStorage.setItem("nimcuet-pending-at", String(Date.now()));
        } catch {}
      }
      const sb = getSupabase();
      const { error } = await sb.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?challenge=${cid}` },
      });
      if (error) throw error;
      try {
        window.localStorage.setItem("nimcuet-pending-email", targetEmail);
        window.localStorage.setItem("nimcuet-resend-at", String(Date.now()));
      } catch {}
      setCooldown(RESEND_COOLDOWN_S);
      setMsg("Request accepted — if this email is still unconfirmed, the newest email holds the fresh link (check spam). If already confirmed, no new email is sent — try logging in.");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Could not resend. Please try again.";
      if (/already (registered|confirmed)|already exists/i.test(raw)) {
        setMsg("This email looks already confirmed — try logging in with your password instead of resending.");
        return;
      }
      if (isRateLimit(raw)) {
        // Supabase throttles confirmation mail strictly; hammering resend
        // only extends the block. Back off longer — the first email stays valid.
        setCooldown(180);
        setMsg(`Email limit hit — wait a few minutes before resending. Your first email is still valid (check spam). (Supabase: ${raw})`);
        return;
      }
      setMsg(raw);
    } finally {
      setResendBusy(false);
    }
  };

  const manualCheck = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    try {
      await checkOnce(true);
    } finally {
      setVerifyBusy(false);
    }
  };

  if (phase === "verified-session" || phase === "verified-nosession") {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-5 py-12" style={{ color: "var(--text)" }}>
        <AuthBg />
        <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h1 className="text-2xl font-extrabold tracking-tight">Email Authentication</h1>
          <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white" style={{ background: "#16a34a" }}>✓</div>
          <p className="mt-5 font-semibold">Email authentication is successful.</p>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
            {phase === "verified-session"
              ? `Continuing to your dashboard in ${count} second${count === 1 ? "" : "s"} — this tab will take you forward automatically.`
              : `Email confirmed on another device. Continuing to log in in ${count} second${count === 1 ? "" : "s"} — use your password there.`}
          </p>
          <p className="mt-5 text-sm" style={{ color: "var(--muted)" }}>
            Not working?{" "}
            <a href={target} className="font-bold underline" style={{ color: "var(--accent)" }}>
              Click Here To Continue
            </a>
            .
          </p>
        </section>
      </main>
    );
  }

  if (phase === "timeout") {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-5 py-12" style={{ color: "var(--text)" }}>
        <AuthBg />
        <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl sm:p-10" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[26px]">Still waiting for confirmation</h1>
          <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7" style={{ color: "var(--muted)" }}>
            We haven&apos;t seen a confirmation for <strong style={{ color: "var(--text)" }}>{email || "your email"}</strong> yet.
            Click the newest link in your inbox (and spam), then continue. Links expire after 24 hours.
          </p>
          {msg && (
            <p role="status" aria-live="polite" className="mx-auto mt-5 max-w-sm rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>
              {msg}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={manualCheck}
              disabled={verifyBusy}
              className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold disabled:opacity-50"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              {verifyBusy ? "Checking…" : "I've verified — continue"}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={resendBusy || cooldown > 0}
              className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold transition-transform hover:-translate-y-px disabled:opacity-50"
              style={{ border: "1px solid var(--border)" }}
            >
              {resendBusy ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend confirmation email"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/login?verified=1")}
              className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold"
              style={{ border: "1px solid var(--border)" }}
            >
              Go to log in
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12" style={{ color: "var(--text)" }}>
      <AuthBg />
      <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl sm:p-10" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[26px]">Security Challenge</h1>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7" style={{ color: "var(--muted)" }}>
          To protect the security of your account, we sent an email to{" "}
          <strong style={{ color: "var(--text)" }}>{email || "your inbox"}</strong>{" "}
          to verify your identity — please click the link in the email to proceed.
        </p>
        <div className="mx-auto mt-6 h-12 w-12 animate-spin rounded-full" style={{ border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
        <p className="mx-auto mt-3 max-w-sm text-xs" style={{ color: "var(--muted)" }}>
          This page detects confirmation automatically — keep it open while you verify.
        </p>
        <div className="mx-auto mt-4 max-w-sm text-left">
          <label htmlFor="check-email-input" className="mb-1.5 block text-[13px] font-bold">Confirmation email</label>
          <input
            id="check-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
            style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>
        {msg && (
          <p role="status" aria-live="polite" className="mx-auto mt-5 max-w-sm rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>
            {msg}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={manualCheck}
            disabled={verifyBusy}
            className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold disabled:opacity-50"
            style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            {verifyBusy ? "Checking…" : "I've verified — continue"}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={resendBusy || cooldown > 0}
            className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold transition-transform hover:-translate-y-px disabled:opacity-50"
            style={{ border: "1px solid var(--border)" }}
          >
            {resendBusy ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend confirmation email"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/signup")}
            className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold"
            style={{ border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold"
            style={{ border: "1px solid var(--border)" }}
          >
            Go to log in
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
        <main className="relative flex min-h-screen items-center justify-center px-5 py-12" style={{ color: "var(--text)" }}>
          <AuthBg />
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
        </main>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
