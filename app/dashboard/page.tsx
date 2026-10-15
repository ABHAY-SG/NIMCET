"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/reveal";
import { getSupabase } from "@/lib/supabase";

type Attempt = {
  id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

function AttemptRow({ a, cloud = false }: { a: Attempt; cloud?: boolean }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3.5 backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}
    >
      <div>
        <div className="text-sm font-bold">
          {a.test}{" "}
          {!cloud && (
            <span className="mono rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--pill)", color: "var(--muted)" }}>
              THIS DEVICE
            </span>
          )}
        </div>
        <div className="mono text-[11px]" style={{ color: "var(--muted)" }}>
          {new Date(a.created_at).toLocaleString("en-IN")} • {a.correct}✔ {a.wrong}✘ {a.skipped}○
        </div>
      </div>
      <div className="mono text-xl font-extrabold" style={{ color: "var(--accent)" }}>{a.score}</div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [localAttempts, setLocalAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nimcuet-attempts");
      if (raw) setLocalAttempts(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        setEmail(user.email ?? "");
        const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string; name?: string };
        const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || "";
        setDisplayName(full.trim() || (user.email ?? "").split("@")[0]);
        const { data, error } = await sb
          .from("attempts")
          .select("id,test,score,correct,wrong,skipped,created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) setNote("Attempts table not found yet — run the SQL from setup to enable history.");
        else setAttempts(data ?? []);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Auth is not configured yet.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const signOut = async () => {
    try {
      const sb = getSupabase();
      await sb.auth.signOut();
    } catch {}
    router.push("/login");
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-28">
      <Reveal>
        <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.22em" }}>
          Dashboard
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {loading ? "Loading…" : displayName ? `Hello ${displayName.split(" ").slice(0, 2).join(" ")}` : "Hello"}
          </h1>
          <button
            type="button"
            onClick={signOut}
            className="rounded-full px-5 py-2 text-sm font-bold"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Log out
          </button>
        </div>
      </Reveal>
      {note && (
        <p className="mt-4 rounded-xl px-4 py-3 text-[13px]" style={{ background: "var(--pill)" }}>{note}</p>
      )}
      <Reveal>
        <h2 className="mt-8 text-lg font-extrabold tracking-tight">Saved attempts</h2>
        {attempts.length === 0 && !loading ? (
          <div
            className="mt-3 rounded-2xl p-6 text-center text-sm backdrop-blur-xl"
            style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}
          >
            No cloud attempts yet. Finish the demo mock on the homepage — it saves here when you are logged in.
          </div>
        ) : (
          <div className="mt-3 grid gap-2.5">
            {attempts.map((a) => (
              <AttemptRow key={a.id} a={a} cloud />
            ))}
          </div>
        )}
      </Reveal>
      {localAttempts.length > 0 && (
        <Reveal>
          <h2 className="mt-8 text-lg font-extrabold tracking-tight">On this device</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Saved locally — log in to keep them across devices.</p>
          <div className="mt-3 grid gap-2.5">
            {localAttempts.map((a) => (
              <AttemptRow key={a.id} a={a} />
            ))}
          </div>
        </Reveal>
      )}
    </main>
  );
}
