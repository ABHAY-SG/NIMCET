"use client";
import Reveal from "@/components/reveal";

export default function LoginCta() {
  return (
    <section id="login" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <Reveal>
        <div className="text-center">
          <p className="mono text-[11px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
            GET STARTED
          </p>
          <h2 className="mx-auto mt-2 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Log in to continue
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6" style={{ color: "var(--muted)" }}>
            One NIMCET account, two doors — pick yours.
          </p>
        </div>
      </Reveal>
      <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-2">
        <Reveal>
          <div
            className="flex h-full flex-col rounded-[22px] p-6 text-white sm:p-7"
            style={{ background: "linear-gradient(120deg, #141b34 0%, #2b3a7a 55%, var(--accent) 130%)", boxShadow: "0 40px 90px -35px rgba(20, 27, 52, 0.7)" }}
          >
            <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)" }}>
              Students
            </div>
            <div className="mt-2 text-xl font-extrabold tracking-tight">Student Login</div>
            <p className="mt-1.5 text-sm leading-6" style={{ color: "rgba(255,255,255,0.82)" }}>
              Practice mock tests and track your progress.
            </p>
            <a
              href="/login"
              className="mt-5 inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold transition-transform hover:-translate-y-px"
              style={{ color: "#1e2952" }}
            >
              Log in as student →
            </a>
          </div>
        </Reveal>
        <Reveal>
          <div
            className="flex h-full flex-col rounded-[22px] bg-white p-6 sm:p-7"
            style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
          >
            <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "var(--muted)" }}>
              Staff
            </div>
            <div className="mt-2 text-xl font-extrabold tracking-tight" style={{ color: "#1e2952" }}>Admin Login</div>
            <p className="mt-1.5 text-sm leading-6" style={{ color: "var(--muted)" }}>
              Manage questions, mock tests, and users.
            </p>
            <a
              href="/admin/login"
              className="mt-5 inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-px"
              style={{ border: "1.5px solid var(--border)", color: "var(--text)" }}
            >
              Log in as admin →
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
