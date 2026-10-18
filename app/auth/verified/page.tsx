"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthClient } from "@/lib/supabase";
import { safeNextPath } from "@/lib/admin";

// Minimal verification landing: success message, then the tab tries to
// close itself. No clicks needed. Same-device confirmations carry a session
// (auto-dashboard via fallback); cross-device confirmations just close and
// let the original tab continue.
//
// Additive: ?mobile=1 asks this page to hand control back to the NimCuet app
// (nimcuet:// deep link) instead of counting down and trying to close a tab
// that never existed. Never present on website signups, so the browser flow
// below is unchanged.
function VerifiedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const failed = searchParams.get("error") === "challenge";
  const oauth = searchParams.get("mode") === "oauth";
  const mobile = searchParams.get("mobile") === "1";
  // Validated once here rather than inside the effects below.
  const rawChallenge = searchParams.get("challenge");
  const challenge =
    rawChallenge && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawChallenge)
      ? rawChallenge
      : "";
  const [phase, setPhase] = useState<"checking" | "ready" | "failed">(failed ? "failed" : "checking");
  const [count, setCount] = useState(3);
  const [target, setTarget] = useState("/login?verified=1");
  const [hasSession, setHasSession] = useState(false);
  const doneRef = useRef(false);
  const mobileRef = useRef(false);

  // The app-facing deep link. Carries no secret: only the outcome and the
  // challenge id already known to the app that started the signup. The app
  // must still confirm verification against Supabase — this URL is a wake-up
  // nudge, never proof.
  const deepLink = (() => {
    const q = new URLSearchParams();
    if (failed) q.set("error", "challenge");
    else q.set("ok", "1");
    if (challenge) q.set("challenge", challenge);
    return `nimcuet://auth/verified?${q.toString()}`;
  })();

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = getAuthClient();
        const { data: { session } } = await sb.auth.getSession();
        if (cancelled) return;
        const nextTarget = session ? "/dashboard" : "/login?verified=1";
        setTarget(nextTarget);
        setHasSession(!!session);
        // OAuth return path (e.g. admin login): honor a fresh stored
        // redirect instead of the dashboard. Timestamped + validated.
        if (session) {
          try {
            const stored = window.localStorage.getItem("nimcuet-post-login-redirect");
            window.localStorage.removeItem("nimcuet-post-login-redirect");
            if (stored) {
              const sep = stored.indexOf(":");
              const at = Number(stored.slice(0, sep));
              const dest = safeNextPath(sep > 0 ? stored.slice(sep + 1) : null);
              if (dest && Date.now() - at < 15 * 60 * 1000) setTarget(dest);
            }
          } catch {}
        }
        // If this confirmation carried ?challenge=, mark the rendezvous row
        // (authenticated, so RLS passes) and wake the original waiting tab
        // via BroadcastChannel + storage event. Best-effort only.
        if (session) {
          try {
            if (challenge) {
              const { data: { user } } = await sb.auth.getUser();
              if (user && !cancelled) {
                await sb.from("signup_verification_sessions")
                  .update({ verified_at: new Date().toISOString() })
                  .eq("challenge_id", challenge)
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

  // MOBILE HAND-OFF (inert unless ?mobile=1). /auth/callback has already
  // confirmed the email and written verified_at server-side, so this page's
  // only remaining job is to give the app control back. If nothing claims the
  // scheme (app not installed) we deliberately do nothing further: the success
  // UI and the manual link below stay usable rather than guessing.
  useEffect(() => {
    if (!mobile || phase !== "ready" || mobileRef.current) return;
    mobileRef.current = true;
    let timer = 0;
    const onVis = () => {
      // Hidden page = the OS handed the URL to the app; stop the cleanup timer.
      if (document.hidden) window.clearTimeout(timer);
    };
    document.addEventListener("visibilitychange", onVis);
    try {
      window.location.href = deepLink;
    } catch {}
    timer = window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onVis);
    }, 1600);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mobile, phase, deepLink]);

  useEffect(() => {
    // The mobile path owns its own hand-off; never also try to close the tab.
    if (mobile) return;
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
  }, [mobile, phase, count, target, hasSession, router]);

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
            {mobile ? (
              <>
                <p style={{ color: "#222222", marginTop: 28, fontSize: 17, lineHeight: 1.7 }}>
                  Returning you to the NimCuet app…
                </p>
                <p style={{ color: "#555555", marginTop: 28, fontSize: 14 }}>
                  Nothing happened?{" "}
                  <a href={deepLink} style={{ color: "#1a73e8", textDecoration: "underline" }}>
                    Open NimCuet
                  </a>
                  {" "}— or just close this tab and continue in the app.
                </p>
              </>
            ) : (
              <>
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
