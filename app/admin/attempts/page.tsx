"use client";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin-shell";
import { getSupabase } from "@/lib/supabase";
import type { AttemptRow } from "@/lib/admin";

export default function AttemptsAdmin() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb.from("attempts").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        setRows((data ?? []) as AttemptRow[]);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Load failed — admin read policy may be missing (see setup SQL).");
      }
    })();
  }, []);

  const list = rows.filter(
    (r) => q === "" || `${r.test} ${r.user_id} ${r.score}`.toLowerCase().includes(q.toLowerCase())
  );

  const avg = list.length > 0 ? (list.reduce((a, r) => a + Number(r.score), 0) / list.length).toFixed(1) : "—";

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search test, user, score…"
          className="w-full max-w-xs rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2"
          style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
        <span className="mono ml-auto text-xs" style={{ color: "var(--muted)" }}>
          {list.length} attempts • avg {avg}
        </span>
      </div>
      {msg && <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px]" style={{ background: "var(--pill)" }}>{msg}</p>}
      <div className="mt-3 overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr style={{ background: "var(--pill)", color: "var(--muted)" }}>
              {["Test", "User", "Score", "C / W / S", "When"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase" style={{ letterSpacing: "0.1em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-2.5 font-bold">{r.test}</td>
                <td className="mono px-4 py-2.5 text-[11px]" style={{ color: "var(--muted)" }} title={r.user_id}>
                  {r.user_id.slice(0, 8)}…
                </td>
                <td className="mono px-4 py-2.5 font-extrabold" style={{ color: "var(--accent)" }}>{r.score}</td>
                <td className="mono px-4 py-2.5">{r.correct} / {r.wrong} / {r.skipped}</td>
                <td className="mono px-4 py-2.5 text-[11px]" style={{ color: "var(--muted)" }}>
                  {new Date(r.created_at).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-6 text-center text-sm" style={{ color: "var(--muted)" }}>No attempts found.</p>}
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
        User emails need the service key — user IDs above map to Supabase Auth → Users in your dashboard.
      </p>
    </AdminShell>
  );
}
