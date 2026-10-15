"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function VerifiedContent() {
  const searchParams = useSearchParams();
  const failed = searchParams.get("error") === "challenge";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <section className="w-full max-w-md rounded-3xl border p-8 text-center shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: "var(--pill)", color: failed ? "#dc2626" : "var(--accent)" }}>
          {failed ? "!" : "✓"}
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
          {failed ? "Email confirmed" : "Email verified"}
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
          {failed
            ? "Your email was confirmed, but this signup session has expired or could not be matched. Return to the device where you signed up and log in there."
            : "Your email has been confirmed. Return to the device where you started signup; it will sign you in automatically. You can close this page."}
        </p>
        {failed && (
          <a href="/login" className="mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: "var(--accent)" }}>
            Log in
          </a>
        )}
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
