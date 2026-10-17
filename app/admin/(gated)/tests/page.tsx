"use client";
import { useMemo, useState } from "react";
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
import { fmtDate, fmtNum } from "@/lib/format";

type TestRow = {
  id: string;
  exam: string;
  title: string;
  tag: string;
  minutes: number;
  free: boolean;
  published: boolean;
  question_ids: string[];
  description: string;
  instructions: string;
  created_at: string;
  questionCount: number;
  maxMarks: number;
  minMarks: number;
};

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
};

type Editor = {
  id: string | null;
  title: string;
  exam: string;
  tag: string;
  minutes: string;
  free: boolean;
  published: boolean;
  description: string;
  instructions: string;
  questionIds: string[];
};

const LETTERS = ["A", "B", "C", "D"];

export default function AdminTests() {
  const toast = useToast();
  const per = usePageSize(20);

  const { data, error, loading, reload } = useAdminData<{ rows: TestRow[]; total: number; exams: string[]; migrated: boolean }>(
    "/api/admin/tests?limit=1000"
  );
  const bankData = useAdminData<{ rows: QRow[] }>("/api/admin/questions?limit=1000");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [exam, setExam] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [pickDiff, setPickDiff] = useState("all");

  const [preview, setPreview] = useState<TestRow | null>(null);
  const [previewQ, setPreviewQ] = useState<QRow[] | null>(null);
  const [showKey, setShowKey] = useState(false);

  const [confirmDel, setConfirmDel] = useState<TestRow | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDelOpen, setBulkDelOpen] = useState(false);

  const tests = data?.rows ?? [];
  const bank = bankData.data?.rows ?? [];
  const bankById = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);

  const filtered = useMemo(() => {
    let rows = tests;
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((t) => `${t.title} ${t.tag} ${t.exam}`.toLowerCase().includes(q));
    if (status === "published") rows = rows.filter((t) => t.published);
    if (status === "draft") rows = rows.filter((t) => !t.published);
    if (exam !== "all") rows = rows.filter((t) => t.exam === exam);
    switch (sort) {
      case "oldest":
        rows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "title":
        rows = [...rows].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "minutes":
        rows = [...rows].sort((a, b) => b.minutes - a.minutes);
        break;
      default:
        rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return rows;
  }, [tests, search, status, exam, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const safePage = Math.min(page, pages);
  const paged = filtered.slice((safePage - 1) * per, safePage * per);
  const exams = useMemo(() => [...new Set(tests.map((t) => t.exam))].sort(), [tests]);

  // ---- actions ----

  const togglePublish = async (t: TestRow) => {
    try {
      await adminMutate(`/api/admin/tests/${t.id}`, "PUT", { published: !t.published });
      toast(t.published ? `“${t.title}” unpublished.` : `“${t.title}” published.`);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed.", "error");
    }
  };

  const duplicate = async (t: TestRow) => {
    try {
      await adminMutate("/api/admin/tests", "POST", {
        exam: t.exam,
        title: `${t.title} (copy)`,
        tag: t.tag,
        minutes: t.minutes,
        free: t.free,
        published: false,
        description: t.description,
        instructions: t.instructions,
        question_ids: t.question_ids,
      });
      toast("Test duplicated as a draft.");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Duplicate failed.", "error");
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDelBusy(true);
    try {
      await adminMutate(`/api/admin/tests/${confirmDel.id}`, "DELETE");
      toast("Test deleted.");
      setConfirmDel(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed.", "error");
    } finally {
      setDelBusy(false);
    }
  };

  const runBulk = async (action: "publish" | "unpublish" | "free" | "paid" | "delete") => {
    try {
      const r = await adminMutate<{ affected: number }>("/api/admin/tests/bulk", "POST", {
        ids: [...selected],
        action,
      });
      toast(`${r.affected} test(s) updated.`);
      setSelected(new Set());
      setBulkDelOpen(false);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk action failed.", "error");
    }
  };

  // ---- editor ----

  const openEditor = (t?: TestRow) => {
    setPickSearch("");
    setPickDiff("all");
    if (t) {
      setEditor({
        id: t.id,
        title: t.title,
        exam: t.exam,
        tag: t.tag,
        minutes: String(t.minutes),
        free: t.free,
        published: t.published,
        description: t.description,
        instructions: t.instructions,
        questionIds: [...t.question_ids],
      });
    } else {
      setEditor({
        id: null,
        title: "",
        exam: "nimcet",
        tag: "",
        minutes: "30",
        free: true,
        published: false,
        description: "",
        instructions: "",
        questionIds: [],
      });
    }
  };

  const saveEditor = async () => {
    if (!editor) return;
    const title = editor.title.trim();
    if (title.length < 3) return toast("Title needs at least 3 characters.", "error");
    const minutes = Number(editor.minutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 180) {
      return toast("Duration must be 5–180 minutes.", "error");
    }
    if (editor.questionIds.length === 0) return toast("Pick at least one question.", "error");

    setEditorBusy(true);
    try {
      const payload = {
        title,
        exam: editor.exam.trim() || "nimcet",
        tag: editor.tag.trim(),
        minutes,
        free: editor.free,
        published: editor.published,
        description: editor.description,
        instructions: editor.instructions,
        question_ids: editor.questionIds,
      };
      if (editor.id) await adminMutate(`/api/admin/tests/${editor.id}`, "PUT", payload);
      else await adminMutate("/api/admin/tests", "POST", payload);
      toast(editor.id ? "Test updated." : "Test created.");
      setEditor(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setEditorBusy(false);
    }
  };

  const togglePick = (id: string) => {
    setEditor((ed) => {
      if (!ed) return ed;
      const has = ed.questionIds.includes(id);
      return {
        ...ed,
        questionIds: has ? ed.questionIds.filter((x) => x !== id) : [...ed.questionIds, id],
      };
    });
  };

  const movePick = (id: string, dir: -1 | 1) => {
    setEditor((ed) => {
      if (!ed) return ed;
      const idx = ed.questionIds.indexOf(id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= ed.questionIds.length) return ed;
      const next = [...ed.questionIds];
      [next[idx], next[to]] = [next[to], next[idx]];
      return { ...ed, questionIds: next };
    });
  };

  // ---- preview ----

  const openPreview = async (t: TestRow) => {
    setPreview(t);
    setPreviewQ(null);
    setShowKey(false);
    const have = new Map(bankById);
    const missing = t.question_ids.filter((id) => !have.has(id));
    if (missing.length > 0) {
      try {
        const r = await fetch(`/api/admin/questions?ids=${missing.slice(0, 200).join(",")}&limit=200`, {
          credentials: "same-origin",
        });
        const j = (await r.json()) as { rows?: QRow[] };
        if (r.ok) for (const q of j.rows ?? []) have.set(q.id, q);
      } catch {}
    }
    setPreviewQ(t.question_ids.map((id) => have.get(id)).filter((q): q is QRow => !!q));
  };

  const pickerList = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return bank
      .filter((b) => (pickDiff === "all" ? true : b.difficulty === pickDiff))
      .filter((b) => (q ? `${b.stem} ${b.topic} ${b.section}`.toLowerCase().includes(q) : true))
      .slice(0, 60);
  }, [bank, pickSearch, pickDiff]);

  return (
    <AdminLayout>
      {/* toolbar */}
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
            placeholder="Search tests by title, tag or exam…"
            className="pl-9"
            aria-label="Search tests"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="w-auto"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </Select>
        <Select
          value={exam}
          onChange={(e) => {
            setExam(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by exam"
          className="w-auto"
        >
          <option value="all">All exams</option>
          {exams.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort tests"
          className="w-auto"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
          <option value="minutes">Longest duration</option>
        </Select>
        <button
          type="button"
          className="admin-btn"
          onClick={async () => {
            try {
              await downloadFile("/api/admin/tests?format=csv", "tests.csv");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Export failed.", "error");
            }
          }}
        >
          <Icon name="download" size={14} /> Export CSV
        </button>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor()}>
          <Icon name="plus" size={14} /> New test
        </button>
      </Card>

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
            icon="tests"
            title={tests.length === 0 ? "No mock tests yet" : "No tests match these filters"}
            hint={tests.length === 0 ? "Create your first mock to get started." : "Try clearing the search or filters."}
            action={
              tests.length === 0 ? (
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor()}>
                  <Icon name="plus" size={14} /> New test
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
              <span className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} />
              <button type="button" className="admin-btn" onClick={() => runBulk("publish")}>
                Publish
              </button>
              <button type="button" className="admin-btn" onClick={() => runBulk("unpublish")}>
                Unpublish
              </button>
              <button type="button" className="admin-btn" onClick={() => runBulk("free")}>
                Mark free
              </button>
              <button type="button" className="admin-btn" onClick={() => runBulk("paid")}>
                Mark paid
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={() => setBulkDelOpen(true)}>
                <Icon name="trash" size={13} /> Delete
              </button>
              <button type="button" className="admin-btn ml-auto" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </Card>
          )}

          <Card className="px-2 pb-3 pt-1">
            <div className="admin-scroll overflow-x-auto">
              <table className="admin-table w-full min-w-[880px]">
                <thead>
                  <tr>
                    <th className="w-9">
                      <input
                        type="checkbox"
                        className="admin-check"
                        aria-label="Select all on page"
                        checked={paged.length > 0 && paged.every((t) => selected.has(t.id))}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const t of paged) {
                              if (e.target.checked) next.add(t.id);
                              else next.delete(t.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th>Test</th>
                    <th>Questions</th>
                    <th>Marks (max)</th>
                    <th>Duration</th>
                    <th>Access</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t) => (
                    <tr key={t.id} className="admin-row">
                      <td>
                        <input
                          type="checkbox"
                          className="admin-check"
                          aria-label={`Select ${t.title}`}
                          checked={selected.has(t.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(t.id)) next.delete(t.id);
                              else next.add(t.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="max-w-[300px]">
                        <span className="block truncate font-bold">{t.title}</span>
                        <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {t.exam}
                          {t.tag ? ` · ${t.tag}` : ""}
                        </span>
                      </td>
                      <td>{fmtNum(t.questionCount)}</td>
                      <td>{fmtNum(t.maxMarks, 1)}</td>
                      <td>{t.minutes} min</td>
                      <td>
                        <Badge tone={t.free ? "blue" : "violet"}>{t.free ? "Free" : "Paid"}</Badge>
                      </td>
                      <td>
                        <Badge tone={t.published ? "green" : "amber"}>{t.published ? "Live" : "Draft"}</Badge>
                      </td>
                      <td className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--muted)" }}>
                        {fmtDate(t.created_at)}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className="admin-btn px-2 py-1.5" title="Preview" onClick={() => openPreview(t)}>
                            <Icon name="eye" size={14} />
                          </button>
                          <button type="button" className="admin-btn px-2 py-1.5" title="Edit" onClick={() => openEditor(t)}>
                            <Icon name="edit" size={14} />
                          </button>
                          <button type="button" className="admin-btn px-2 py-1.5" title="Duplicate" onClick={() => duplicate(t)}>
                            <Icon name="copy" size={14} />
                          </button>
                          <button
                            type="button"
                            className={cx("admin-btn px-2 py-1.5", !t.published && "admin-btn-primary")}
                            title={t.published ? "Unpublish" : "Publish"}
                            onClick={() => togglePublish(t)}
                          >
                            <Icon name={t.published ? "eyeOff" : "check"} size={14} />
                          </button>
                          <button type="button" className="admin-btn admin-btn-danger px-2 py-1.5" title="Delete" onClick={() => setConfirmDel(t)}>
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

      {/* editor modal */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Edit test" : "New test"}
        subtitle="Title, schedule, access and the question sequence students will see."
        width="max-w-4xl"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setEditor(null)} disabled={editorBusy}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={saveEditor} disabled={editorBusy}>
              {editorBusy ? "Saving…" : editor?.id ? "Save changes" : "Create test"}
            </button>
          </>
        }
      >
        {editor && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title">
                <TextInput
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  placeholder="e.g. NIMCET Full Mock #5"
                />
              </Field>
              <Field label="Exam">
                <TextInput value={editor.exam} onChange={(e) => setEditor({ ...editor, exam: e.target.value })} placeholder="nimcet" />
              </Field>
              <Field label="Tag" hint="Short label shown to students, e.g. “Full mock” or “Algebra”.">
                <TextInput value={editor.tag} onChange={(e) => setEditor({ ...editor, tag: e.target.value })} placeholder="Full mock" />
              </Field>
              <Field label="Duration (minutes)" hint="5–180 minutes.">
                <TextInput
                  type="number"
                  min={5}
                  max={180}
                  value={editor.minutes}
                  onChange={(e) => setEditor({ ...editor, minutes: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
                <input type="checkbox" className="admin-check" checked={editor.free} onChange={(e) => setEditor({ ...editor, free: e.target.checked })} />
                Free access
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
                <input
                  type="checkbox"
                  className="admin-check"
                  checked={editor.published}
                  onChange={(e) => setEditor({ ...editor, published: e.target.checked })}
                />
                Published (visible to students)
              </label>
            </div>
            <Field label="Description" hint="Shown to students in the mock hub. Optional.">
              <TextArea
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                placeholder="What does this mock cover?"
                rows={2}
              />
            </Field>
            <Field label="Instructions" hint="Shown when the mock starts. Optional.">
              <TextArea
                value={editor.instructions}
                onChange={(e) => setEditor({ ...editor, instructions: e.target.value })}
                placeholder="e.g. 30 questions · +12 for correct · −3 for wrong · 30 minutes."
                rows={3}
              />
            </Field>

            {/* question picker */}
            <div className="rounded-2xl p-3" style={{ background: "var(--pill)" }}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-extrabold">
                  Questions <Badge tone="violet">{editor.questionIds.length} selected</Badge>
                </span>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Derived max marks:{" "}
                  <strong>
                    {fmtNum(
                      editor.questionIds.reduce((sum, id) => sum + (bankById.get(id)?.plus ?? 0), 0),
                      1
                    )}
                  </strong>{" "}
                  · negative marks come from each question
                </span>
              </div>

              {editor.questionIds.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {editor.questionIds.map((id, i) => {
                    const q = bankById.get(id);
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5"
                        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                      >
                        <span className="mono w-6 shrink-0 text-[11px] font-bold" style={{ color: "var(--muted)" }}>
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">
                          {q ? q.stem : `Question ${id.slice(0, 8)}… (not in bank view)`}
                        </span>
                        {q && <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Hard" ? "red" : "amber"}>{q.difficulty}</Badge>}
                        <button type="button" className="admin-btn px-1.5 py-1" onClick={() => movePick(id, -1)} title="Move up">
                          <Icon name="chevronLeft" size={12} className="rotate-90" />
                        </button>
                        <button type="button" className="admin-btn px-1.5 py-1" onClick={() => movePick(id, 1)} title="Move down">
                          <Icon name="chevronRight" size={12} className="rotate-90" />
                        </button>
                        <button type="button" className="admin-btn px-1.5 py-1" onClick={() => togglePick(id)} title="Remove">
                          <Icon name="x" size={12} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2 pb-2">
                <TextInput
                  value={pickSearch}
                  onChange={(e) => setPickSearch(e.target.value)}
                  placeholder="Search the question bank…"
                  className="max-w-xs"
                />
                <Select value={pickDiff} onChange={(e) => setPickDiff(e.target.value)} className="w-auto">
                  <option value="all">All difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </Select>
              </div>
              <div className="admin-scroll max-h-56 space-y-1 overflow-y-auto">
                {pickerList.length === 0 ? (
                  <p className="px-1 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
                    No questions match. Add questions in the Question Bank first.
                  </p>
                ) : (
                  pickerList.map((q) => {
                    const picked = editor.questionIds.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => togglePick(q.id)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors"
                        style={{
                          background: picked ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                          border: "1px solid",
                          borderColor: picked ? "color-mix(in srgb, var(--accent) 35%, transparent)" : "transparent",
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">{q.stem}</span>
                        <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Hard" ? "red" : "amber"}>{q.difficulty}</Badge>
                        <span className="mono shrink-0 text-[11px]" style={{ color: "var(--muted)" }}>
                          +{q.plus}/{q.minus}
                        </span>
                        <Icon name={picked ? "check" : "plus"} size={13} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* preview modal */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={`Preview — ${preview?.title ?? ""}`}
        subtitle="Student view. Answer key stays hidden until you reveal it."
        width="max-w-3xl"
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="violet">{preview.exam}</Badge>
              {preview.tag && <Badge tone="blue">{preview.tag}</Badge>}
              <Badge tone={preview.published ? "green" : "amber"}>{preview.published ? "Live" : "Draft"}</Badge>
              <Badge tone={preview.free ? "blue" : "violet"}>{preview.free ? "Free" : "Paid"}</Badge>
              <span className="text-[12.5px] font-bold" style={{ color: "var(--muted)" }}>
                {preview.minutes} min · {preview.questionCount} questions · max {fmtNum(preview.maxMarks, 1)} marks
              </span>
            </div>
            {preview.description && (
              <p className="rounded-xl px-3.5 py-2.5 text-[13px] leading-6" style={{ background: "var(--pill)" }}>
                {preview.description}
              </p>
            )}
            {preview.instructions && (
              <div className="rounded-xl px-3.5 py-2.5 text-[13px] leading-6" style={{ background: "var(--pill)" }}>
                <span className="mb-1 block text-[11px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
                  Instructions
                </span>
                {preview.instructions}
              </div>
            )}
            {previewQ === null ? (
              <Skeleton className="h-40" />
            ) : previewQ.length === 0 ? (
              <EmptyState icon="questions" title="Could not load this test's questions" />
            ) : (
              <ol className="space-y-4">
                {previewQ.map((q, i) => (
                  <li key={q.id} className="rounded-2xl p-3.5" style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-start gap-2">
                      <span className="mono text-[12px] font-extrabold" style={{ color: "var(--muted)" }}>
                        Q{i + 1}.
                      </span>
                      <p className="flex-1 text-[13.5px] leading-6 font-semibold">{q.stem}</p>
                      <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Hard" ? "red" : "amber"}>{q.difficulty}</Badge>
                    </div>
                    <ul className="mt-2.5 space-y-1.5 pl-6">
                      {(q.options ?? []).map((opt, oi) => (
                        <li
                          key={oi}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px]"
                          style={{
                            background: showKey && oi === q.answer ? "color-mix(in srgb, #10b981 14%, transparent)" : "var(--pill)",
                          }}
                        >
                          <span className="mono text-[11px] font-extrabold" style={{ color: "var(--muted)" }}>
                            {LETTERS[oi]}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {showKey && oi === q.answer && <Badge tone="green">Correct</Badge>}
                        </li>
                      ))}
                    </ul>
                    {showKey && q.explanation && (
                      <p className="mt-2 pl-6 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
                        <strong>Explanation:</strong> {q.explanation}
                      </p>
                    )}
                    {showKey && (
                      <p className="mono mt-1.5 pl-6 text-[11px]" style={{ color: "var(--muted)" }}>
                        +{q.plus} / {q.minus} marks
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Modal>

      {/* delete confirms */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Delete test?"
        tone="danger"
        confirmLabel="Delete test"
        busy={delBusy}
        requireText={confirmDel?.title}
        message={
          <>
            This permanently deletes <strong>“{confirmDel?.title}”</strong>. Tests with recorded
            attempts are blocked from deletion by the server — unpublish instead to preserve history.
          </>
        }
        onCancel={() => setConfirmDel(null)}
        onConfirm={doDelete}
      />
      <ConfirmDialog
        open={bulkDelOpen}
        title={`Delete ${selected.size} test(s)?`}
        tone="danger"
        confirmLabel="Delete selected"
        requireText="DELETE"
        message="Tests with recorded attempts are blocked by the server and nothing else in the selection is deleted either."
        onCancel={() => setBulkDelOpen(false)}
        onConfirm={() => runBulk("delete")}
      />
    </AdminLayout>
  );
}
