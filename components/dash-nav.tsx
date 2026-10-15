"use client";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function DashNav({ email, onLogout }: { email: string; onLogout: () => void }) {
  const router = useRouter();
  const logout = async () => {
    try {
      const sb = getSupabase();
      await sb.auth.signOut();
    } catch {}
    onLogout();
    router.push("/login");
  };

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-2xl backdrop-saturate-150"
      style={{
        background: "color-mix(in srgb, var(--nav-bg) 82%, transparent)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 18px 48px -20px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.18)",
      }}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4">
        <a href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="NimCuet dashboard home">
          <img src="/logo.png" alt="" aria-hidden className="site-logo block h-7 w-auto" />
          <span className="mono rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }}>
            DASHBOARD
          </span>
        </a>
        <nav className="hidden items-center gap-1 sm:flex">
          <a href="/dashboard" className="rounded-full px-3.5 py-2 text-sm font-bold" style={{ background: "var(--pill)", color: "var(--text)" }}>
            Home
          </a>
          <a href="/dashboard#attempts" className="rounded-full px-3.5 py-2 text-sm font-medium" style={{ color: "var(--muted)" }}>
            My attempts
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <span className="mono hidden max-w-[180px] truncate text-xs sm:block" style={{ color: "var(--muted)" }} title={email}>
            {email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-transform hover:-translate-y-px"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
