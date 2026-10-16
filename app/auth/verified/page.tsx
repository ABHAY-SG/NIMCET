"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

// Minimal verification landing, styled like a plain email-auth success page:
// success message, then the tab tries to close itself. No clicks needed.
// Same-device confirmations carry a session (auto-dashboard via fallback);
// cross-device confirmations just close and let the original tab continue.
function VerifiedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const failed = searchParams.get("error") === "challenge";
  const oauth = searchParams.get("mode") === "oauth";
  const [phase, setPhase] = useState<"checking" | "ready" | "failed">(failed ? "failed" : "checking");
  const [count, setCount] = useState(3);
  const [target, setTarget] = useState("/login?verified=1");
  const [hasSession, setHasSession] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase();
        const { data: { session } } = await sb.auth.getSession();
        if (cancelled) return;
        const nextTarget = session ? "/dashboard" : "/login?verified=1";
        setTarget(nextTarget);
        setHasSession(!!session);
        // If this confirmation carried ?challenge=, mark the rendezvous row
        // (authenticated, so RLS passes) and wake the original waiting tab
        // via BroadcastChannel + storage event. Best-effort only.
        if (session) {
          try {
            const cid = searchParams.get("challenge");
            if (cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid)) {
              const { data: { user } } = await sb.auth.getUser();
              if (user && !cancelled) {
                await sb.from("signup_verification_sessions")
                  .update({ verified_at: new Date().toISOString() })
                  .eq("challenge_id", cid)
                  .eq("user_id", user.id)
                  .is("verified_at", null);
              }
            }
          } catch {}
          try {
            new BroadcastChannel("nimcuet-verify").postMessage({ verified: true, at: Date.now() });
          } catch {}
          try {
            window.localStorage.setItem("nimcuet-just-verified", String(Date.now()));
          } catch {}
        }
      } catch {
        if (!cancelled) setTarget(oauth ? "/dashboard" : "/login?verified=1");
      }
      if (!cancelled) setPhase("ready");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "ready" || doneRef.current) return;
    if (count <= 0) {
      doneRef.current = true;
      try { window.close(); } catch {}
      // window.close() is blocked unless a script opened this tab. When this
      // tab holds a session, fall back to the dashboard; otherwise stay on
      // this success page with a manual login link.
      if (hasSession) {
        window.setTimeout(() => {
          try {
            if (!document.hidden) router.replace(target);
          } catch {
            router.replace(target);
          }
        }, 800);
      }
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count, target, hasSession, router]);

  return (
    <main style={{ background: "#ffffff", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: 640, textAlign: "center" }}>
        <h1 style={{ color: "#555555", fontWeight: 500, fontSize: 28, letterSpacing: 0 }}>Email Authentication</h1>
        {phase === "checking" ? (
          <p style={{ color: "#333333", marginTop: 28, fontSize: 16 }}>Verifying your confirmation — one moment.</p>
        ) : phase === "failed" ? (
          <>
            <p style={{ color: "#333333", marginTop: 28, fontSize: 16 }}>
              Your email was confirmed, but this signup session has expired or could not be matched.
            </p>
            <p style={{ color: "#333333", marginTop: 20, fontSize: 16 }}>
              <a href="/login" style={{ color: "#1a73e8", textDecoration: "underline" }}>Continue to log in</a>.
            </p>
          </>
        ) : (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#7cb342", color: "#ffffff", fontSize: 28, lineHeight: "56px", margin: "36px auto 0" }}>✓</div>
            <p style={{ color: "#222222", marginTop: 32, fontSize: 17 }}>Email authentication is successful.</p>
            <p style={{ color: "#222222", marginTop: 28, fontSize: 17, lineHeight: 1.7 }}>
              This browser window/tab will attempt to automatically close in {count} second{count === 1 ? "" : "s"},
              or you may manually close.
            </p>
            {hasSession ? (
              <p style={{ color: "#555555", marginTop: 28, fontSize: 14 }}>
                Not working?{" "}
                <a href={target} style={{ color: "#1a73e8", textDecoration: "underline" }}>
                  Click Here To Continue
                </a>
                .
              </p>
            ) : (
              <p style={{ color: "#555555", marginTop: 28, fontSize: 14 }}>
                Your email is confirmed — close this tab and continue on your other device, or{" "}
                <a href="/login?verified=1" style={{ color: "#1a73e8", textDecoration: "underline" }}>
                  continue to log in
                </a>
                .
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function EmailVerifiedPage() {
  return (
    <Suspense
      fallback={
        <main style={{ background: "#ffffff", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#555555", fontSize: 15 }}>Verifying…</p>
        </main>
      }
    >
      <VerifiedContent />
    </Suspense>
  );
}
