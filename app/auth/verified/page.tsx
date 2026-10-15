"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function VerifiedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const failed = searchParams.get("error") === "challenge";
  const oauth = searchParams.get("mode") === "oauth";
  const [phase, setPhase] = useState<"checking" | "ready" | "failed">(failed ? "failed" : "checking");
  const [count, setCount] = useState(3);
  const [target, setTarget] = useState("/login?verified=1");

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase();
        const { data: { session } } = await sb.auth.getSession();
        if (cancelled) return;
        // Session present (same-device confirm or fresh OAuth): head for the
        // dashboard. Otherwise fall back to login — never strand the user,
        // and never falsely claim logged-in.
        const nextTarget = session ? "/dashboard" : "/login?verified=1";
        setTarget(nextTarget);
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
    if (phase !== "ready") return;
    if (count <= 0) {
      router.replace(target);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count, target, router]);

  if (phase === "failed") {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: "var(--pill)", color: "#dc2626" }}>!</div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Email confirmed</h1>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Your email was confirmed, but this signup session has expired or could not be matched. Return to the device where you signed up and log in there.
          </p>
          <a href="/login" className="mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: "var(--accent)" }}>
            Log in
          </a>
        </section>
      </main>
    );
  }

  if (phase === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="mx-auto h-14 w-14 animate-spin rounded-full" style={{ border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Security Challenge</h1>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Verifying your confirmation — one moment.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <h1 className="text-2xl font-extrabold tracking-tight">Email Authentication</h1>
        <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white" style={{ background: "#16a34a" }}>✓</div>
        <p className="mt-5 font-semibold">Email authentication is successful.</p>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
          Continuing in {count} second{count === 1 ? "" : "s"} — this tab will take you forward automatically, or close it and continue where you started.
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

export default function EmailVerifiedPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Checking verification status…</p>
        </main>
      }
    >
      <VerifiedContent />
    </Suspense>
  );
}
