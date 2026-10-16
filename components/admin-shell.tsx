"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

const LINKS: Array<[string, string, string]> = [
  ["/admin", "Dashboard", "▦"],
  ["/admin/questions", "Questions", "?"],
  ["/admin/tests", "Mock Tests", "▤"],
  ["/admin/attempts", "Attempts", "✓"],
  ["/admin/users", "Users", "◉"],
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "noauth" | "denied" | "ok">("loading");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { setState("noauth"); return; }
        setEmail(user.email ?? "");
        setState(isAdminEmail(user.email) ? "ok" : "denied");
      } catch {
        setState("noauth");
      }
    })();
  }, []);

  if (state === "loading") {
    return <main className="mx-auto px-4 pb-20 pt-28 text-sm sm:px-6 lg:px-8" style={{ color: "var(--muted)" }}>Checking admin access…</main>;
  }

  if (state === "noauth") {
    return (
      <main className="mx-auto max-w-md px-4 pb-20 pt-28 text-center">
        <h1 className="text-2xl font-extrabold">Admins only</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Log in with an admin account first.</p>
        <div className="mt-5 flex justify-center gap-2">
          <a href="/login" className="rounded-full px-6 py-2.5 text-sm font-bold" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>Log in →</a>
          <button type="button" onClick={() => router.push("/")} className="rounded-full px-6 py-2.5 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>Home</button>
        </div>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="mx-auto max-w-md px-4 pb-20 pt-28 text-center">
        <h1 className="text-2xl font-extrabold">Not authorized</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Signed in as {email || "unknown"}. This account is not in the admin list — add it to NEXT_PUBLIC_ADMIN_EMAILS.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>
          ← Back home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mono text-[11px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.2em" }}>ADMIN PANEL</p>
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>{email}</p>
        </div>
        <Link href="/" className="rounded-full px-4 py-2 text-[13px] font-bold" style={{ border: "1px solid var(--border)" }}>
          ← View site
        </Link>
      </div>
      <nav className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {LINKS.map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
            style={path === href
              ? { background: "var(--btn-bg)", color: "var(--btn-text)" }
              : { border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            <span aria-hidden>{icon}</span> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </main>
  );
}
