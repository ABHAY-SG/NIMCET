"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import { getSupabase } from "@/lib/supabase";

function EyeIcon({ off = false }: { off?: boolean }) {
  return off ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A16.6 16.6 0 0 0 2 12s3 7 10 7c1.5 0 2.9-.3 4.1-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.8 3.6-4.9 6.8-4.9z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function AuthForm({ initialMode }: { initialMode: "in" | "up" }) {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const sb = getSupabase();
      if (mode === "up") {
        const { error } = await sb.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMsg("Account created — check your email to confirm, then log in.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "github") => {
    setMsg("");
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : `${provider} login is not enabled yet.`);
    }
  };

  const forgot = async () => {
    if (!email) { setMsg("Type your email above first, then tap Forgot password."); return; }
    setMsg("");
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setMsg("Reset link sent — check your inbox.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const inputCls = "w-full rounded-xl py-3 pl-11 pr-11 text-sm outline-none transition-shadow focus:ring-2";

  const BG: Array<[string, string, string]> = [
    ["authbg-light", "https://picsum.photos/seed/nimcuet-light/1600/1000", "var(--bg)"],
    ["authbg-midnight", "https://picsum.photos/seed/nimcuet-night/1600/1000", "#070b18"],
    ["authbg-ocean", "https://picsum.photos/seed/nimcuet-ocean/1600/1000", "#0c2a3f"],
    ["authbg-forest", "https://picsum.photos/seed/nimcuet-forest/1600/1000", "#0b1512"],
    ["authbg-sunset", "https://picsum.photos/seed/nimcuet-sunset/1600/1000", "#431407"],
  ];

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {BG.map(([cls, src, fallback]) => (
          <img
            key={cls}
            src={src}
            alt=""
            loading="eager"
            className={`authbg absolute inset-0 h-full w-full object-cover ${cls}`}
            style={{ background: fallback, filter: "saturate(1.2)" }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 62%, transparent), color-mix(in srgb, var(--bg) 82%, transparent))", backdropFilter: "blur(3px)" }}
        />
      </div>
      <main className="relative mx-auto w-full max-w-md px-4 pb-20 pt-28">
      <div
        className="rounded-[22px] p-6 backdrop-blur-2xl sm:p-7"
        style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}
      >
      <div className="text-center">
        <img src="/logo.png" alt="NimCuet" className="site-logo mx-auto block h-10 w-auto" />
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
          {mode === "in" ? "Welcome back" : "Join NimCuet"}
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {mode === "in" ? "Log in to continue to your dashboard." : "One account for mocks, reports and streaks."}
        </p>
      </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button" onClick={() => oauth("google")}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-transform hover:-translate-y-px"
            style={{ border: "1px solid var(--border)", background: "var(--pill)" }}
          >
            <GoogleIcon /> Google
          </button>
          <button
            type="button" onClick={() => oauth("github")}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-transform hover:-translate-y-px"
            style={{ border: "1px solid var(--border)", background: "var(--pill)" }}
          >
            <GithubIcon /> GitHub
          </button>
        </div>
        <div className="my-4 flex items-center gap-3 text-[11px] font-bold" style={{ color: "var(--muted)" }}>
          <span className="h-px flex-1" style={{ background: "var(--border)" }} /> OR <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>
        <form onSubmit={submit}>
          <label className="mb-1.5 block text-[13px] font-bold">Email</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: "var(--muted)" }}>✉</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className={inputCls}
              style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </div>
          <div className="mb-1.5 mt-4 flex items-center justify-between">
            <label className="text-[13px] font-bold">Password</label>
            {mode === "in" && (
              <button type="button" onClick={forgot} className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="10" width="16" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            </span>
            <input type={show ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className={inputCls}
              style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
              <EyeIcon off={!show} />
            </button>
          </div>
          {msg && (
            <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>{msg}</p>
          )}
          <button
            type="submit" disabled={busy}
            className="cta-glow mt-4 w-full rounded-xl py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
          >
            {busy ? "Please wait…" : mode === "in" ? "Log in →" : "Create account →"}
          </button>
        </form>
        <a href={mode === "in" ? "/signup" : "/login"} className="mt-5 block w-full text-center text-sm" style={{ color: "var(--muted)" }}>
          {mode === "in" ? "Don't have an account? " : "Have an account? "}
          <strong style={{ color: "var(--accent)" }}>{mode === "in" ? "Create account" : "Log in"}</strong>
        </a>
        <p className="mt-4 text-center text-[11px]" style={{ color: "var(--muted)" }}>● Secure & encrypted</p>
      </div>
    </main>
    </>
  );
}
