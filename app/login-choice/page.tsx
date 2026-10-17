"use client";
import Link from "next/link";
import AuthBg from "@/components/auth-bg";
import ThemeFab from "@/components/theme-fab";

export default function LoginChoicePage() {
  return (
    <>
      <AuthBg />
      <main className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-center px-4 py-4">
        <ThemeFab />
        <Link href="/" className="mb-3 inline-flex w-fit items-center gap-2 text-sm font-bold transition-transform hover:-translate-x-1" style={{ color: "var(--muted)" }}>
          <span aria-hidden>←</span> Back to home
        </Link>
        <div
          className="auth-card pop relative grid overflow-hidden rounded-[26px] backdrop-blur-[28px] backdrop-saturate-150 md:grid-cols-2"
          style={{ border: "1px solid var(--border)", boxShadow: "0 40px 100px -30px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,255,255,0.22)" }}
        >
          <div className="auth-photo relative z-10 hidden flex-col justify-end p-8 md:flex">
            <span className="inline-flex w-fit items-center rounded-2xl bg-white/95 px-4 py-2.5" style={{ boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
              <img src="/logo.png" alt="NimCuet" className="block h-7 w-auto" />
            </span>
            <p className="mt-4 max-w-xs text-xl font-extrabold leading-snug text-white" style={{ textShadow: "0 2px 18px rgba(0,0,0,0.5)" }}>
              One account, two doors.
            </p>
            <p className="serif-it mt-2 max-w-xs text-[17px] leading-7 text-white/85" style={{ textShadow: "0 2px 14px rgba(0,0,0,0.5)" }}>
              “Consistency beats intensity — one mock at a time.”
            </p>
          </div>
          <div className="relative z-10 p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-[26px]">
              Welcome to NimCuet
            </h1>
            <p className="serif-it mt-1 text-[15px] leading-6" style={{ color: "var(--muted)" }}>
              “Consistency beats intensity — one mock at a time.”
            </p>
            <div className="mt-5 grid gap-2.5">
              <a
                href="/login"
                className="group block cursor-pointer rounded-2xl p-5 text-white transition-transform duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(120deg, #141b34 0%, #2b3a7a 55%, var(--accent) 130%)", boxShadow: "0 20px 45px -20px rgba(20, 27, 52, 0.7)", backgroundSize: "160% 160%" }}
              >
                <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)" }}>
                  Students
                </div>
                <div className="mt-1.5 text-lg font-extrabold tracking-tight">
                  Student Login <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
                <p className="mt-1 text-[13px] leading-5" style={{ color: "rgba(255,255,255,0.82)" }}>
                  Practice mock tests and track your progress.
                </p>
              </a>
              <a
                href="/admin/login"
                className="group block cursor-pointer rounded-2xl bg-white p-5 transition-transform duration-300 hover:-translate-y-1"
                style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
              >
                <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "var(--muted)" }}>
                  Staff
                </div>
                <div className="mt-1.5 text-lg font-extrabold tracking-tight" style={{ color: "#1e2952" }}>
                  Admin Login <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
                <p className="mt-1 text-[13px] leading-5" style={{ color: "var(--muted)" }}>
                  Manage questions, mock tests, and users.
                </p>
              </a>
            </div>
            <p className="mt-4 text-center text-[11px]" style={{ color: "var(--muted)" }}>● Secure & encrypted</p>
          </div>
        </div>
      </main>
    </>
  );
}
