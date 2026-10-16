"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient, signOutAll } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMsg("Enter a valid email address.");
      return;
    }
    if (!password) {
      setMsg("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      // Same Supabase authentication as everywhere else — no second system.
      const sb = getAuthClient();
      const { data, error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw new Error("Email not verified yet — complete verification first, then use this page.");
        }
        if (/invalid login credentials/i.test(error.message)) {
          throw new Error("Unable to log in with these details. Check your email and password.");
        }
        throw error;
      }
      // Allowlist decides — never the login form itself.
      if (data.user && isAdminEmail(data.user.email)) {
        router.push("/admin");
        return;
      }
      // Signed in but not an admin: leave no session behind.
      try { await signOutAll(); } catch {}
      throw new Error("This account is not authorized as an admin.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80svh] w-full max-w-md flex-col justify-center px-4 pb-20 pt-28">
      <div className="text-center">
        <p className="mono text-[11px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
          STAFF ONLY
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Admin Login</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          Manage questions, mock tests, and users.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="mt-6 rounded-[22px] p-6 backdrop-blur-2xl sm:p-7"
        style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}
      >
        <label htmlFor="admin-email" className="mb-1.5 block text-[13px] font-bold">Email</label>
        <input
          id="admin-email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com"
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2"
          style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
        <label htmlFor="admin-pass" className="mb-1.5 mt-4 block text-[13px] font-bold">Password</label>
        <div className="relative">
          <input
            id="admin-pass" type={show ? "text" : "password"} required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
            className="w-full rounded-xl py-2.5 pl-4 pr-11 text-sm outline-none focus:ring-2"
            style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: "var(--muted)" }}>
            {show ? "🙈" : "👁"}
          </button>
        </div>
        {msg && (
          <p role="status" aria-live="polite" className="mt-3 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--pill)" }}>{msg}</p>
        )}
        <button
          type="submit" disabled={busy}
          className="mt-4 w-full cursor-pointer rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }}
        >
          {busy ? "Please wait…" : "Log in →"}
        </button>
      </form>
      <a href="/login" className="mt-4 w-full cursor-pointer text-center text-sm" style={{ color: "var(--muted)" }}>
        Back to <strong style={{ color: "var(--accent)" }}>Student Login</strong>
      </a>
    </main>
  );
}
