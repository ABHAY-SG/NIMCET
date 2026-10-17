"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { getSupabase } from "@/lib/supabase";

type UserStat = { id: string; attempts: number; best: number; last: string };

export default function UsersAdmin() {
  const [rows, setRows] = useState<UserStat[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/attempts?limit=1000", { credentials: "same-origin" });
        const j = (await r.json()) as { error?: string; rows?: Array<{ user_id: string; score: number; created_at: string }> };
        if (!r.ok) throw new Error(j.error || "Load failed.");
        const data = j.rows ?? [];
        const map = new Map<string, UserStat>();
        for (const r of (data ?? []) as Array<{ user_id: string; score: number; created_at: string }>) {
          const cur = map.get(r.user_id);
          if (!cur) {
            map.set(r.user_id, { id: r.user_id, attempts: 1, best: Number(r.score), last: r.created_at });
          } else {
            cur.attempts++;
            cur.best = Math.max(cur.best, Number(r.score));
            if (r.created_at > cur.last) cur.last = r.created_at;
          }
        }
        setRows([...map.values()].sort((a, b) => b.attempts - a.attempts));
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Load failed — admin read policy may be missing (see setup SQL).");
      }
    })();
  }, []);

  const list = rows.filter((r) => q === "" || r.id.toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminLayout title="Users" crumbs={["Users"]}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user ID…"
          className="w-full max-w-xs rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2"
          style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
        <span className="mono ml-auto text-xs" style={{ color: "var(--muted)" }}>{list.length} users with attempts</span>
      </div>
      {msg && <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px]" style={{ background: "var(--pill)" }}>{msg}</p>}
      <div className="mt-3 space-y-2.5">
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3.5 backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 60%, transparent)", border: "1px solid var(--border)" }}>
            <span className="mono flex h-10 w-10 items-center justify-center rounded-full text-xs font-extrabold" style={{ background: "var(--pill)", color: "var(--accent)" }}>
              {u.id.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mono truncate text-[13px]" title={u.id}>{u.id}</div>
              <div className="mono text-[11px]" style={{ color: "var(--muted)" }}>
                {u.attempts} attempts • best {u.best} • last {new Date(u.last).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-sm" style={{ color: "var(--muted)" }}>No users yet — emails live in Supabase Auth → Users.</p>}
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
        Full emails, bans and deletes live in your Supabase dashboard under Authentication → Users.
      </p>
    </AdminLayout>
  );
}
