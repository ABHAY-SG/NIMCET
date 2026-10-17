"use client";
import { useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Pagination,
  Select,
  Skeleton,
  TextArea,
  TextInput,
  cx,
  useToast,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { adminMutate, downloadFile, useAdminData, usePageSize } from "@/components/admin/hooks";
import { fmtDate } from "@/lib/format";

type QRow = {
  id: string;
  exam: string;
  section: string;
  topic: string;
  difficulty: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
  plus: number;
  minus: number;
  created_at?: string;
};

type Facets = {
  exams: Array<{ value: string; count: number }>;
  sections: Array<{ value: string; count: number }>;
  difficulties: Array<{ value: string; count: number }>;
  total: number;
};

type Editor = {
  id: string | null;
  exam: string;
  section: string;
  topic: string;
  difficulty: string;
  stem: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
  plus: string;
  minus: string;
};

const LETTERS = ["A", "B", "C", "D"];

function emptyEditor(): Editor {
  return {
    id: null,
    exam: "nimcet",
    section: "maths",
    topic: "",
    difficulty: "Medium",
    stem: "",
    options: ["", "", "", ""],
    answer: 0,
    explanation: "",
    plus: "12",
    minus: "-3",
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export default function AdminQuestions() {
  const toast = useToast();
  const per = usePageSize(20);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, error, loading, reload } = useAdminData<{ rows: QRow[] }>("/api/admin/questions?limit=1000");
  const facetsData = useAdminData<Facets>("/api/admin/questions?facets=1");

  const [search, setSearch] = useState("");
  const [exam, setExam] = useState("all");
  const [section, setSection] = useState("all");
  const [diff, setDiff] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [preview, setPreview] = useState<QRow | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [confirmDel, setConfirmDel] = useState<QRow | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const facets = facetsData.data;

  const filtered = useMemo(() => {
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => `${r.stem} ${r.topic} ${r.section}`.toLowerCase().includes(q));
    if (exam !== "all") out = out.filter((r) => r.exam === exam);
    if (section !== "all") out = out.filter((r) => r.section === section);
    if (diff !== "all") out = out.filter((r) => r.difficulty === diff);
    out = [...out].sort((a, b) =>
      sort === "oldest" ? (a.created_at ?? "").localeCompare(b.created_at ?? "") : (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
    return out;
  }, [rows, search, exam, section, diff, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const safePage = Math.min(page, pages);
  const paged = filtered.slice((safePage - 1) * per, safePage * per);

  const openEditor = (q?: QRow) => {
    if (q) {
      setEditor({
        id: q.id,
        exam: q.exam,
        section: q.section,
        topic: q.topic,
        difficulty: q.difficulty,
        stem: q.stem,
        options: [q.options?.[0] ?? "", q.options?.[1] ?? "", q.options?.[2] ?? "", q.options?.[3] ?? ""],
        answer: q.answer,
        explanation: q.explanation,
        plus: String(q.plus),
        minus: String(q.minus),
      });
    } else {
      setEditor(emptyEditor());
    }
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (editor.stem.trim().length < 5) return toast("Question text needs at least 5 characters.", "error");
    if (!editor.exam.trim()) return toast("Exam is required.", "error");
    if (!editor.topic.trim()) return toast("Topic is required.", "error");
    if (editor.options.some((o) => !o.trim())) return toast("All 4 options are required.", "error");
    const plus = Number(editor.plus);
    const minus = Number(editor.minus);
    if (!Number.isFinite(plus) || plus <= 0) return toast("Positive marks must be greater than 0.", "error");
    if (!Number.isFinite(minus) || minus > 0) return toast("Negative marks must be 0 or negative.", "error");

    setEditorBusy(true);
    try {
      const payload = {
        exam: editor.exam.trim(),
        section: editor.section.trim(),
        topic: editor.topic.trim(),
        difficulty: editor.difficulty,
        stem: editor.stem.trim(),
        options: editor.options.map((o) => o.trim()),
        answer: editor.answer,
        explanation: editor.explanation.trim(),
        plus,
        minus,
      };
      if (editor.id) await adminMutate(`/api/admin/questions/${editor.id}`, "PUT", payload);
      else await adminMutate("/api/admin/questions", "POST", payload);
      toast(editor.id ? "Question updated." : "Question added.");
      setEditor(null);
      reload();
      facetsData.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setEditorBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDelBusy(true);
    try {
      await adminMutate(`/api/admin/questions/${confirmDel.id}`, "DELETE");
      toast("Question deleted.");
      setConfirmDel(null);
      reload();
      facetsData.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed.", "error");
    } finally {
      setDelBusy(false);
    }
  };

  const runBulkDelete = async () => {
    try {
      const r = await adminMutate<{ affected: number }>("/api/admin/questions/bulk", "POST", {
        ids: [...selected],
        action: "delete",
      });
      toast(`${r.affected} question(s) deleted.`);
      setSelected(new Set());
      setBulkDelOpen(false);
      reload();
      facetsData.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk delete failed.", "error");
    }
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const rowsRaw = parseCsv(text);
    if (rowsRaw.length < 2) return toast("CSV has no data rows.", "error");
    const header = rowsRaw[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    for (const need of ["exam", "stem", "optiona", "optionb", "optionc", "optiond", "answer"]) {
      if (idx(need) < 0) {
        return toast(`CSV is missing the “${need}” column. Export a CSV first to see the exact format.`, "error");
      }
    }
    const mapped = rowsRaw.slice(1).map((r) => ({
      exam: r[idx("exam")] ?? "",
      section: idx("section") >= 0 ? r[idx("section")] ?? "" : "",
      topic: idx("topic") >= 0 ? r[idx("topic")] ?? "" : "",
      difficulty: idx("difficulty") >= 0 ? r[idx("difficulty")] ?? "" : "",
      stem: r[idx("stem")] ?? "",
      options: [r[idx("optiona")], r[idx("optionb")], r[idx("optionc")], r[idx("optiond")]].map((v) => v ?? ""),
      answer: r[idx("answer")] ?? "",
      explanation: idx("explanation") >= 0 ? r[idx("explanation")] ?? "" : "",
      plus: idx("plus") >= 0 ? r[idx("plus")] ?? "" : "",
      minus: idx("minus") >= 0 ? r[idx("minus")] ?? "" : "",
    }));
    if (mapped.length > 200) return toast("Import at most 200 rows per batch — split the file.", "error");
    setImportBusy(true);
    try {
      const res = await adminMutate<{ inserted: number }>("/api/admin/questions/import", "POST", { rows: mapped });
      toast(`${res.inserted} question(s) imported.`);
      reload();
      facetsData.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed.", "error");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <AdminLayout>
      <Card className="mb-3 flex flex-wrap items-center gap-2 px-3.5 py-3">
        <div className="relative min-w-[180px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
            <Icon name="search" size={14} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by question text, topic or section…"
            className="pl-9"
            aria-label="Search questions"
          />
        </div>
        <Select value={exam} onChange={(e) => { setExam(e.target.value); setPage(1); }} className="w-auto" aria-label="Exam filter">
          <option value="all">All exams</option>
          {(facets?.exams ?? []).map((f) => (
            <option key={f.value} value={f.value}>
              {f.value} ({f.count})
            </option>
          ))}
        </Select>
        <Select value={section} onChange={(e) => { setSection(e.target.value); setPage(1); }} className="w-auto" aria-label="Section filter">
          <option value="all">All sections</option>
          {(facets?.sections ?? []).map((f) => (
            <option key={f.value} value={f.value}>
              {f.value} ({f.count})
            </option>
          ))}
        </Select>
        <Select value={diff} onChange={(e) => { setDiff(e.target.value); setPage(1); }} className="w-auto" aria-label="Difficulty filter">
          <option value="all">All difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto" aria-label="Sort questions">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
        <button
          type="button"
          className="admin-btn"
          onClick={async () => {
            try {
              await downloadFile("/api/admin/questions?format=csv&limit=1000", "questions.csv");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Export failed.", "error");
            }
          }}
        >
          <Icon name="download" size={14} /> Export
        </button>
        <button type="button" className="admin-btn" disabled={importBusy} onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={14} /> {importBusy ? "Importing…" : "Import CSV"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = "";
          }}
        />
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor()}>
          <Icon name="plus" size={14} /> New question
        </button>
      </Card>

      <p className="mb-2 px-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
        Import format: export a CSV first — the same columns round-trip (exam, section, topic, difficulty,
        stem, optionA–D, answer as A–D, explanation, plus, minus). Up to 200 rows per batch.
      </p>

      {error && (
        <div className="mb-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {loading && !data ? (
        <Card className="px-5 py-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="questions"
            title={rows.length === 0 ? "Question bank is empty" : "No questions match these filters"}
            hint={
              rows.length === 0
                ? "Add questions one by one, or import a CSV exported from this page."
                : "Try clearing the search or filters."
            }
            action={
              rows.length === 0 ? (
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor()}>
                  <Icon name="plus" size={14} /> New question
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {selected.size > 0 && (
            <Card className="mb-3 flex flex-wrap items-center gap-2 px-3.5 py-2.5">
              <span className="text-[12.5px] font-extrabold">{selected.size} selected</span>
              <button type="button" className="admin-btn admin-btn-danger" onClick={() => setBulkDelOpen(true)}>
                <Icon name="trash" size={13} /> Delete selected
              </button>
              <button type="button" className="admin-btn ml-auto" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </Card>
          )}

          <Card className="px-2 pb-3 pt-1">
            <div className="admin-scroll overflow-x-auto">
              <table className="admin-table w-full min-w-[860px]">
                <thead>
                  <tr>
                    <th className="w-9">
                      <input
                        type="checkbox"
                        className="admin-check"
                        aria-label="Select all on page"
                        checked={paged.length > 0 && paged.every((q) => selected.has(q.id))}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const q of paged) {
                              if (e.target.checked) next.add(q.id);
                              else next.delete(q.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th>Question</th>
                    <th>Section / Topic</th>
                    <th>Difficulty</th>
                    <th>Answer</th>
                    <th>Marks</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((q) => (
                    <tr key={q.id} className="admin-row">
                      <td>
                        <input
                          type="checkbox"
                          className="admin-check"
                          aria-label="Select question"
                          checked={selected.has(q.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(q.id)) next.delete(q.id);
                              else next.add(q.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="max-w-[340px]">
                        <span className="block truncate font-semibold">{q.stem}</span>
                        <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {q.exam} · answer {LETTERS[q.answer] ?? "?"}
                        </span>
                      </td>
                      <td className="max-w-[160px]">
                        <span className="block truncate text-[12.5px]">{q.section || "—"}</span>
                        <span className="block truncate text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {q.topic || "—"}
                        </span>
                      </td>
                      <td>
                        <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Hard" ? "red" : "amber"}>{q.difficulty}</Badge>
                      </td>
                      <td className="mono font-bold">{LETTERS[q.answer] ?? "?"}</td>
                      <td className="mono text-[12px]">
                        +{q.plus} / {q.minus}
                      </td>
                      <td className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--muted)" }}>
                        {fmtDate(q.created_at)}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="admin-btn px-2 py-1.5"
                            title="Preview (student view)"
                            onClick={() => {
                              setPreview(q);
                              setShowKey(false);
                            }}
                          >
                            <Icon name="eye" size={14} />
                          </button>
                          <button type="button" className="admin-btn px-2 py-1.5" title="Edit" onClick={() => openEditor(q)}>
                            <Icon name="edit" size={14} />
                          </button>
                          <button type="button" className="admin-btn admin-btn-danger px-2 py-1.5" title="Delete" onClick={() => setConfirmDel(q)}>
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 pt-3">
              <Pagination page={safePage} pages={pages} total={filtered.length} per={per} onPage={setPage} />
            </div>
          </Card>
        </>
      )}

      {/* editor */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Edit question" : "New question"}
        subtitle="Stored in the bank with its answer key; students never see the key before submitting."
        width="max-w-3xl"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setEditor(null)} disabled={editorBusy}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={saveEditor} disabled={editorBusy}>
              {editorBusy ? "Saving…" : editor?.id ? "Save changes" : "Add question"}
            </button>
          </>
        }
      >
        {editor && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Exam">
                <TextInput list="exam-suggestions" value={editor.exam} onChange={(e) => setEditor({ ...editor, exam: e.target.value })} />
              </Field>
              <Field label="Section" hint="e.g. maths, reasoning, computer — free text, matched across the bank.">
                <TextInput list="section-suggestions" value={editor.section} onChange={(e) => setEditor({ ...editor, section: e.target.value })} />
              </Field>
              <Field label="Topic">
                <TextInput value={editor.topic} onChange={(e) => setEditor({ ...editor, topic: e.target.value })} placeholder="e.g. Probability" />
              </Field>
              <Field label="Difficulty">
                <Select value={editor.difficulty} onChange={(e) => setEditor({ ...editor, difficulty: e.target.value })}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </Select>
              </Field>
            </div>
            <datalist id="exam-suggestions">
              {(facets?.exams ?? []).map((f) => (
                <option key={f.value} value={f.value} />
              ))}
            </datalist>
            <datalist id="section-suggestions">
              {(facets?.sections ?? []).map((f) => (
                <option key={f.value} value={f.value} />
              ))}
            </datalist>

            <Field label="Question text">
              <TextArea value={editor.stem} onChange={(e) => setEditor({ ...editor, stem: e.target.value })} rows={3} />
            </Field>

            <div>
              <span className="mb-1.5 block text-[11.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>
                Options — click the circle to set the correct answer
              </span>
              <div className="space-y-2">
                {editor.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Mark option ${LETTERS[i]} correct`}
                      onClick={() => setEditor({ ...editor, answer: i })}
                      className={cx("flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[12.5px] font-extrabold")}
                      style={
                        editor.answer === i
                          ? { background: "#10b981", color: "#fff" }
                          : { background: "var(--pill)", color: "var(--muted)", border: "1px solid var(--border)" }
                      }
                    >
                      {LETTERS[i]}
                    </button>
                    <TextInput
                      value={opt}
                      onChange={(e) => {
                        const next = [...editor.options] as [string, string, string, string];
                        next[i] = e.target.value;
                        setEditor({ ...editor, options: next });
                      }}
                      placeholder={`Option ${LETTERS[i]}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Field label="Explanation" hint="Shown after submission in the result review.">
              <TextArea value={editor.explanation} onChange={(e) => setEditor({ ...editor, explanation: e.target.value })} rows={2} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Positive marks" hint="Credited for a correct answer.">
                <TextInput type="number" value={editor.plus} onChange={(e) => setEditor({ ...editor, plus: e.target.value })} />
              </Field>
              <Field label="Negative marks" hint="0 or negative, e.g. -3.">
                <TextInput type="number" value={editor.minus} onChange={(e) => setEditor({ ...editor, minus: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* preview */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Question preview"
        subtitle="Exactly how a student sees it. The key stays hidden until you reveal it."
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setShowKey((v) => !v)}>
              <Icon name={showKey ? "eyeOff" : "eye"} size={14} /> {showKey ? "Hide answer key" : "Show answer key"}
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => setPreview(null)}>
              Done
            </button>
          </>
        }
      >
        {preview && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="violet">{preview.exam}</Badge>
              {preview.section && <Badge tone="blue">{preview.section}</Badge>}
              {preview.topic && <Badge tone="neutral">{preview.topic}</Badge>}
              <Badge tone={preview.difficulty === "Easy" ? "green" : preview.difficulty === "Hard" ? "red" : "amber"}>{preview.difficulty}</Badge>
            </div>
            <p className="text-[14px] leading-7 font-semibold">{preview.stem}</p>
            <ul className="mt-3 space-y-2">
              {(preview.options ?? []).map((opt, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px]"
                  style={{
                    background: showKey && i === preview.answer ? "color-mix(in srgb, #10b981 14%, transparent)" : "var(--pill)",
                    border: showKey && i === preview.answer ? "1px solid color-mix(in srgb, #10b981 40%, transparent)" : "1px solid transparent",
                  }}
                >
                  <span className="mono text-[11.5px] font-extrabold" style={{ color: "var(--muted)" }}>
                    {LETTERS[i]}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {showKey && i === preview.answer && <Badge tone="green">Correct</Badge>}
                </li>
              ))}
            </ul>
            {showKey && (
              <div className="mt-4 space-y-1.5 rounded-xl px-3.5 py-3 text-[12.5px]" style={{ background: "var(--pill)" }}>
                <p>
                  <strong>Explanation:</strong> {preview.explanation || "—"}
                </p>
                <p className="mono" style={{ color: "var(--muted)" }}>
                  Marks: +{preview.plus} / {preview.minus}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="Delete question?"
        tone="danger"
        confirmLabel="Delete question"
        busy={delBusy}
        message={
          <>
            This permanently deletes the question starting with “{confirmDel?.stem.slice(0, 80)}…”. Questions
            still referenced by a test are blocked by the server.
          </>
        }
        onCancel={() => setConfirmDel(null)}
        onConfirm={doDelete}
      />
      <ConfirmDialog
        open={bulkDelOpen}
        title={`Delete ${selected.size} question(s)?`}
        tone="danger"
        confirmLabel="Delete selected"
        requireText="DELETE"
        message="Questions referenced by any test are blocked; nothing is deleted when the batch contains a referenced question."
        onCancel={() => setBulkDelOpen(false)}
        onConfirm={runBulkDelete}
      />
    </AdminLayout>
  );
}
