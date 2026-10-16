"use client";
import Reveal from "@/components/reveal";

export default function LoginChoicePage() {
  return (
    <main className="mx-auto flex min-h-[85svh] w-full max-w-4xl flex-col justify-center px-4 pb-20 pt-28">
      <Reveal>
        <div className="text-center">
          <img src="/logo.png" alt="NimCuet" className="site-logo mx-auto block h-10 w-auto" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome to NIMCET</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Choose how you want to continue.
          </p>
        </div>
      </Reveal>
      <div className="mx-auto mt-8 grid w-full gap-3 sm:grid-cols-2">
        <Reveal>
          <a
            href="/login"
            className="flex h-full flex-col rounded-[22px] p-6 text-white transition-transform hover:-translate-y-1 sm:p-7"
            style={{ background: "linear-gradient(120deg, #141b34 0%, #2b3a7a 55%, var(--accent) 130%)", boxShadow: "0 40px 90px -35px rgba(20, 27, 52, 0.7)" }}
          >
            <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)" }}>
              Students
            </div>
            <div className="mt-2 text-xl font-extrabold tracking-tight">Student Login</div>
            <p className="mt-1.5 text-sm leading-6" style={{ color: "rgba(255,255,255,0.82)" }}>
              Practice mock tests and track your progress.
            </p>
            <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold" style={{ color: "#1e2952" }}>
              Continue →
            </span>
          </a>
        </Reveal>
        <Reveal>
          <a
            href="/admin/login"
            className="flex h-full flex-col rounded-[22px] bg-white p-6 transition-transform hover:-translate-y-1 sm:p-7"
            style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
          >
            <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "var(--muted)" }}>
              Staff
            </div>
            <div className="mt-2 text-xl font-extrabold tracking-tight" style={{ color: "#1e2952" }}>Admin Login</div>
            <p className="mt-1.5 text-sm leading-6" style={{ color: "var(--muted)" }}>
              Manage questions, mock tests, and users.
            </p>
            <span
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
              style={{ border: "1.5px solid var(--border)", color: "var(--text)" }}
            >
              Continue →
            </span>
          </a>
        </Reveal>
      </div>
      <Reveal>
        <a href="/" className="mx-auto mt-6 inline-flex w-fit items-center gap-2 self-center text-sm font-bold transition-transform hover:-translate-x-1" style={{ color: "var(--muted)" }}>
          <span aria-hidden>←</span> Back to Home
        </a>
      </Reveal>
    </main>
  );
}
