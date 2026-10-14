"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin-shell";
import { getSupabase } from "@/lib/supabase";

export default function AdminHome() {
  const [stats, setStats] = useState({ users: "-", attempts: "-", questions: "-", tests: "-" });
  const [recent, setRecent] = useState<Array<{ id: string; test: string; score: number; created_at: string }>>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const [att, q, t] = await Promise.all([
          sb.from("attempts").select("id", { count: "exact", head: true }),
          sb.from("questions").select("id", { count: "exact", head: true }),
          sb.from("tests").select("id", { count: "exact", head: true }),
        ]);
        if (att.error || q.error || t.error) {
          setNote("Some tables are missing — run the admin SQL from setup to create questions/tests and enable full stats.");
        }
        const { data: users } = await sb.from("attempts").select("user_id").limit(1000);
        const uniq = new Set((users ?? []).map((u: { user_id: string }) => u.user_id));
        setStats({
          users: String(uniq.size),
          attempts: String(att.count ?? 0),
          questions: String(q.count ?? 0),
          tests: String(t.count ?? 0),
        });
        const { data: rec } = await sb.from("attempts").select("id,test,score,created_at").order("created_at", { ascending: false }).limit(5);
        setRecent(rec ?? []);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not load stats.");
      }
    })();
  }, []);

  const cards: Array<[string, string, string]> = [
    ["Active users", stats.users, "unique attempt makers"],
    ["Total attempts", stats.attempts, "mock finishes saved"],
    ["Questions", stats.questions, "in the bank"],
    ["Mock tests", stats.tests, "published + drafts"],
  ];

  return (
    <AdminShell>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([t, v, d]) => (
          <div key={t} className="rounded-2xl p-5 backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 65%, transparent)", border: "1px solid var(--border)" }}>
            <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>{t}</div>
            <div className="mono mt-1 text-4xl font-extrabold">{v}</div>
            <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{d}</div>
          </div>
        ))}
      </div>
      {note && <p className="mt-4 rounded-xl px-4 py-3 text-[13px]" style={{ background: "var(--pill)" }}>{note}</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="font-extrabold">Recent attempts</div>
          <div className="mt-3 space-y-2 text-sm">
            {recent.length === 0 && <p style={{ color: "var(--muted)" }}>None yet.</p>}
            {recent.map((r) => (
              <div key={r.id} className="flex justify-between gap-2" style={{ borderBottom: "1px dashed var(--border)" }}>
                <span className="truncate">{r.test}</span>
                <span className="mono font-bold" style={{ color: "var(--accent)" }}>{r.score}</span>
              </div>
            ))}
          </div>
          <Link href="/admin/attempts" className="mt-3 inline-block text-sm font-bold" style={{ color: "var(--accent)" }}>View all →</Link>
        </div>
        <div className="rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="font-extrabold">Quick actions</div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/admin/questions" className="rounded-full px-4 py-2" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>+ Add question</Link>
            <Link href="/admin/tests" className="rounded-full px-4 py-2" style={{ border: "1px solid var(--border)" }}>+ New mock test</Link>
            <Link href="/admin/users" className="rounded-full px-4 py-2" style={{ border: "1px solid var(--border)" }}>Browse users</Link>
          </div>
          <p className="mt-4 text-xs leading-5" style={{ color: "var(--muted)" }}>
            Set your admin emails in <span className="mono">NEXT_PUBLIC_ADMIN_EMAILS</span> (comma-separated) and restart. RLS policies in the setup SQL enforce the same list in the database.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
