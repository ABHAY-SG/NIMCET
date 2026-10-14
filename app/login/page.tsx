"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          email,
          password,
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

  const inputCls =
    "w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-2";
  const inputStyle = {
    background: "var(--pill)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    ["--tw-ring-color" as string]: "var(--accent)",
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-20 pt-28">
      <Reveal className="text-center">
        <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
          {mode === "in" ? "Welcome back" : "Join NimCuet"}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          {mode === "in" ? "Log in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Save mock attempts and track progress across devices.
        </p>
      </Reveal>
      <Reveal>
        <form
          onSubmit={submit}
          className="mt-6 rounded-[22px] p-6 backdrop-blur-2xl sm:p-7"
          style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}
        >
          <label className="mb-1.5 block text-[13px] font-bold">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} style={inputStyle} />
          <label className="mb-1.5 mt-4 block text-[13px] font-bold">Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" className={inputCls} style={inputStyle} />
          {msg && (
            <p className="mt-4 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)", color: "var(--text)" }}>
              {msg}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="cta-glow mt-5 w-full rounded-full py-3 text-sm font-bold disabled:opacity-50"
            style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            {busy ? "Please wait…" : mode === "in" ? "Log in →" : "Create account →"}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}
            className="nlink nounder mt-4 w-full text-center text-sm font-semibold"
          >
            {mode === "in" ? "New here? Create an account" : "Have an account? Log in"}
          </button>
        </form>
      </Reveal>
    </main>
  );
}
