"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { getSupabase } from "@/lib/supabase";
import type { QuestionRow } from "@/lib/admin";

const EMPTY: Omit<QuestionRow, "id"> = {
  exam: "nimcet", section: "maths", topic: "", difficulty: "Medium",
  stem: "", options: ["", "", "", ""], answer: 0, explanation: "",
};

const SEED: Array<Omit<QuestionRow, "id">> = [
  { exam: "nimcet", section: "maths", topic: "Matrices", difficulty: "Easy", stem: "If A is 3×3 with det(A)=4, det(2A) = ?", options: ["8", "16", "32", "64"], answer: 2, explanation: "det(kA) = k³·det(A) = 8×4 = 32." },
  { exam: "nimcet", section: "maths", topic: "Probability", difficulty: "Medium", stem: "Two fair dice are thrown. P(sum = 9) = ?", options: ["1/9", "5/36", "1/6", "7/36"], answer: 0, explanation: "(3,6),(4,5),(5,4),(6,3) = 4/36 = 1/9." },
  { exam: "nimcet", section: "maths", topic: "Calculus", difficulty: "Medium", stem: "∫₀¹ x² dx = ?", options: ["1/3", "1/2", "1", "2"], answer: 0, explanation: "x³/3 from 0 to 1 = 1/3." },
  { exam: "nimcet", section: "reasoning", topic: "Series", difficulty: "Easy", stem: "2, 6, 12, 20, 30, ?", options: ["40", "42", "44", "36"], answer: 1, explanation: "n(n+1): 6×7 = 42." },
  { exam: "nimcet", section: "computer", topic: "DSA", difficulty: "Easy", stem: "Which discipline does a stack follow?", options: ["FIFO", "LIFO", "LILO", "Random"], answer: 1, explanation: "Stack = Last In, First Out." },
  { exam: "cuet-pg-mca", section: "cs", topic: "DSA", difficulty: "Medium", stem: "Time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], answer: 1, explanation: "Halving each step → O(log n)." },
];

export default function QuestionsAdmin() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [q, setQ] = useState("");
  const [exam, setExam] = useState("all");
  const [form, setForm] = useState<Omit<QuestionRow, "id">>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("questions").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      setRows((data ?? []) as QuestionRow[]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed — is the questions table created?");
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const sb = getSupabase();
      if (form.options.some((o) => !o.trim())) throw new Error("All 4 options are required.");
      if (!form.stem.trim() || !form.topic.trim()) throw new Error("Topic and question text are required.");
      if (editing) {
        const { error } = await sb.from("questions").update({ ...form }).eq("id", editing);
        if (error) throw error;
        setMsg("Question updated.");
      } else {
        const { error } = await sb.from("questions").insert({ ...form });
        if (error) throw error;
        setMsg("Question added.");
      }
      setForm(EMPTY);
      setEditing(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      const sb = getSupabase();
      const { error } = await sb.from("questions").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const seed = async () => {
    setBusy(true);
    setMsg("");
    try {
      const sb = getSupabase();
      const { error } = await sb.from("questions").insert(SEED);
      if (error) throw error;
      setMsg(`${SEED.length} starter questions added.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Seed failed.");
    } finally {
      setBusy(false);
    }
  };

  const list = rows.filter(
    (r) =>
      (exam === "all" || r.exam === exam) &&
      (q === "" || `${r.stem} ${r.topic} ${r.section}`.toLowerCase().includes(q.toLowerCase()))
  );

  const input = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2";
  const istyle = { background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" } as const;

  return (
    <AdminLayout title="Question Bank" crumbs={["Question Bank"]}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stem, topic…" className={`${input} max-w-xs`} style={istyle} />
        <select value={exam} onChange={(e) => setExam(e.target.value)} className={`${input} w-auto`} style={istyle}>
          <option value="all">All exams</option>
          <option value="nimcet">NIMCET</option>
          <option value="cuet-pg-mca">CUET PG</option>
        </select>
        <span className="mono ml-auto text-xs" style={{ color: "var(--muted)" }}>{list.length} shown</span>
        <button type="button" onClick={seed} disabled={busy} className="rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-50" style={{ border: "1px solid var(--border)" }}>
          + Seed 6 starters
        </button>
      </div>
      {msg && <p className="mt-3 rounded-xl px-4 py-2.5 text-[13px]" style={{ background: "var(--pill)" }}>{msg}</p>}

      <form onSubmit={save} className="mt-4 rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="text-sm font-extrabold">{editing ? "Edit question" : "Add question"}</div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
          <input value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value })} placeholder="exam: nimcet" className={input} style={istyle} />
          <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="section: maths" className={input} style={istyle} />
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Topic" className={input} style={istyle} />
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className={input} style={istyle}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </div>
        <textarea value={form.stem} onChange={(e) => setForm({ ...form, stem: e.target.value })} placeholder="Question stem…" rows={2} className={`${input} mt-2.5`} style={istyle} />
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button" title="Mark as correct answer" onClick={() => setForm({ ...form, answer: i })}
                className="mono flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                style={form.answer === i ? { background: "#16a34a", color: "#fff" } : { background: "var(--pill)", color: "var(--muted)" }}
              >
                {String.fromCharCode(65 + i)}
              </button>
              <input value={o} onChange={(e) => { const opts = [...form.options]; opts[i] = e.target.value; setForm({ ...form, options: opts }); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} className={input} style={istyle} />
            </div>
          ))}
        </div>
        <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} placeholder="Explanation (shown after submit)…" rows={2} className={`${input} mt-2.5`} style={istyle} />
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={busy} className="rounded-full px-5 py-2 text-sm font-bold disabled:opacity-50" style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
            {editing ? "Save changes" : "+ Add question"}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="rounded-full px-5 py-2 text-sm font-bold" style={{ border: "1px solid var(--border)" }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-4 space-y-2.5">
        {list.map((r) => (
          <div key={r.id} className="rounded-2xl p-4 text-sm backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--nav-bg) 60%, transparent)", border: "1px solid var(--border)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }}>{r.exam}</span>
              <span className="mono rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--pill)", color: "var(--muted)" }}>{r.section} • {r.topic} • {r.difficulty}</span>
              <span className="ml-auto flex gap-1.5">
                <button type="button" onClick={() => { setEditing(r.id); setForm({ exam: r.exam, section: r.section, topic: r.topic, difficulty: r.difficulty, stem: r.stem, options: r.options, answer: r.answer, explanation: r.explanation }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-full px-3 py-1 text-xs font-bold" style={{ border: "1px solid var(--border)" }}>Edit</button>
                <button type="button" onClick={() => remove(r.id)} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "#dc2626", color: "#fff" }}>Delete</button>
              </span>
            </div>
            <p className="mt-2 font-bold">{r.stem}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              {r.options.map((o, i) => (
                <span key={i} className={i === r.answer ? "font-bold" : ""} style={i === r.answer ? { color: "#16a34a" } : undefined}>
                  {i > 0 && " · "}({String.fromCharCode(65 + i)}) {o}
                </span>
              ))}
            </p>
          </div>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-sm" style={{ color: "var(--muted)" }}>No questions yet — add one above or seed the starters.</p>}
      </div>
    </AdminLayout>
  );
}
