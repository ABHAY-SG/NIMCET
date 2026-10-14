"use client";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin-shell";
import { getSupabase } from "@/lib/supabase";
import type { QuestionRow, TestRow } from "@/lib/admin";

export default function TestsAdmin() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [bank, setBank] = useState<QuestionRow[]>([]);
  const [title, setTitle] = useState("");
  const [exam, setExam] = useState("nimcet");
  const [minutes, setMinutes] = useState(30);
  const [free, setFree] = useState(true);
  const [published, setPublished] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const sb = getSupabase();
      const [{ data: t, error: e1 }, { data: q, error: e2 }] = await Promise.all([
        sb.from("tests").select("*").order("created_at", { ascending: false }).limit(50),
        sb.from("questions").select("id,exam,section,topic,stem").order("created_at", { ascending: false }).limit(300),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setTests((t ?? []) as TestRow[]);
      setBank((q ?? []) as QuestionRow[]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed — is the tests table created?");
    }
  };

  useEffect(() => { load(); }, []);

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (!title.trim()) throw new Error("Title is required.");
      if (picked.length === 0) throw new Error("Pick at least one question.");
      const sb = getSupabase();
      const { error } = await sb.from("tests").insert({
        exam, title: title.trim(), tag: `${picked.length}Q demo`, minutes, free, published, question_ids: picked,
      });
      if (error) throw error;
      setMsg(`Mock created with ${picked.length} questions.`);
      setTitle("");
      setPicked([]);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  };

  const flip = async (t: TestRow, field: "published" | "free") => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from("tests").update({ [field]: !t[field] }).eq("id", t.id);
      if (error) throw error;
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this mock test?")) return;
    try {
      const sb = getSupabase();
      const { error } = await sb.from("tests").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const input = "rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2";
  const istyle = { background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" } as const;
  const pool = bank.filter((b) => filter === "all" || b.exam === filter);

  return (
    <AdminShell>
      {msg && <p className="mb-3 rounded-xl px-4 py-2.5 text-[13px]" style={{ background: "var(--pill)" }}>{msg}</p>}
      <form onSubmit={create} className="rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="text-sm font-extrabold">New mock test</div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. NIMCET Mock 01" className={`${input} w-full lg:col-span-2`} style={istyle} />
          <select value={exam} onChange={(e) => setExam(e.target.value)} className={`${input} w-full`} style={istyle}>
            <option value="nimcet">NIMCET</option>
            <option value="cuet-pg-mca">CUET PG</option>
          </select>
          <input type="number" min={5} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${input} w-full`} style={istyle} />
          <div className="flex items-center gap-3 text-[13px] font-bold">
            <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-4 w-4 accent-current" /> Free</label>
            <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-current" /> Live</label>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[13px] font-bold">Pick questions ({picked.length})</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={input} style={istyle}>
            <option value="all">All exams</option>
            <option value="nimcet">NIMCET</option>
            <option value="cuet-pg-mca">CUET PG</option>
          </select>
          <button type="button" onClick={() => setPicked([])} className="text-xs font-bold" style={{ color: "var(--muted)" }}>Clear</button>
        </div>
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {pool.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 text-[13px]" style={{ background: picked.includes(b.id) ? "var(--pill)" : "transparent", border: "1px solid var(--border)" }}>
              <input type="checkbox" checked={picked.includes(b.id)} onChange={() => togglePick(b.id)} className="mt-1 h-4 w-4 shrink-0 accent-current" />
              <span>
                <span className="mono mr-2 text-[10px] font-bold" style={{ color: "var(--accent)" }}>{b.exam}·{b.section}</span>
                <strong>{b.topic}</strong> — <span style={{ color: "var(--muted)" }}>{b.stem.slice(0, 90)}{b.stem.length > 90 ? "…" : ""}</span>
              </span>
            </label>
          ))}
          {pool.length === 0 && <p className="py-4 text-center text-sm" style={{ color: "var(--muted)" }}>No questions in bank — add some first.</p>}
        </div>
        <button type="submit" disabled={busy} className="mt-3 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-50" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
          Create mock →
        </button>
      </form>

      <div className="mt-4 space-y-2.5">
        {tests.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 60%, transparent)", border: "1px solid var(--border)" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{t.title}</div>
              <div className="mono text-[11px]" style={{ color: "var(--muted)" }}>
                {t.exam} • {t.question_ids.length}Q • {t.minutes} min • {t.free ? "FREE" : "PREMIUM"} • {t.published ? "LIVE" : "DRAFT"}
              </div>
            </div>
            <button type="button" onClick={() => flip(t, "published")} className="rounded-full px-3 py-1 text-xs font-bold" style={{ border: "1px solid var(--border)" }}>
              {t.published ? "Unpublish" : "Publish"}
            </button>
            <button type="button" onClick={() => flip(t, "free")} className="rounded-full px-3 py-1 text-xs font-bold" style={{ border: "1px solid var(--border)" }}>
              {t.free ? "Make paid" : "Make free"}
            </button>
            <button type="button" onClick={() => remove(t.id)} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "#dc2626", color: "#fff" }}>Delete</button>
          </div>
        ))}
        {tests.length === 0 && <p className="py-6 text-center text-sm" style={{ color: "var(--muted)" }}>No mock tests yet.</p>}
      </div>
    </AdminShell>
  );
}
