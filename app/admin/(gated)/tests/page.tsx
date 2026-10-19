"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { MathText } from "@/components/math-text";
import {
  checkFullMockComposition,
  FULL_MOCK_MINUTES,
  FULL_MOCK_TEMPLATE,
  subjectForSection,
  SUBJECTS,
  subjectRank,
} from "@/lib/nimcet-full-mock";

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
  template: string;
  created_at: string;
  questionCount: number;
  maxMarks: number;
  minMarks: number;
};

// Prefers publishable questions when auto-filling a full mock from the bank.
function cleanScore(q: QRow, plus: number, minus: number): number {
  let s = 0;
  if (Array.isArray(q.options) && q.options.length === 4 && q.options.every((o) => String(o ?? "").trim())) s += 2;
  if (Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3) s += 2;
  if (Math.abs(Number(q.plus) - plus) < 1e-9 && Math.abs(Number(q.minus) - minus) < 1e-9) s += 2;
  return s;
}

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
  /** "" for custom tests; FULL_MOCK_TEMPLATE for the official NIMCET full mock. */
  template: string;
};

const LETTERS = ["A", "B", "C", "D", "E"];

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
  const [editorBase, setEditorBase] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [pickDiff, setPickDiff] = useState("all");
  const [pickSubject, setPickSubject] = useState("all");

  const [preview, setPreview] = useState<TestRow | null>(null);
  const [previewQ, setPreviewQ] = useState<QRow[] | null>(null);
  const [showKey, setShowKey] = useState(false);
  const previewSeq = useRef(0); // guards stale preview fetches (see openPreview)

  const [confirmDel, setConfirmDel] = useState<TestRow | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [bulkDelError, setBulkDelError] = useState<string | null>(null);
  const [bulkDelBusy, setBulkDelBusy] = useState(false);
  const [forceDel, setForceDel] = useState<{ ids: string[]; label: string; requireText: string } | null>(null);
  const [forceBusy, setForceBusy] = useState(false);
  const [forceError, setForceError] = useState<string | null>(null);

  const tests = useMemo(() => data?.rows ?? [], [data]);
  const bank = useMemo(() => bankData.data?.rows ?? [], [bankData.data]);
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
        template: t.template,
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
      // Keep the dialog open with the server's reason (e.g. recorded attempts)
      // instead of a toast that vanishes before it can be read.
      setDelError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDelBusy(false);
    }
  };

  const runBulk = async (action: "publish" | "unpublish" | "free" | "paid") => {
    try {
      const r = await adminMutate<{ affected: number }>("/api/admin/tests/bulk", "POST", {
        ids: [...selected],
        action,
      });
      toast(`${r.affected} test(s) updated.`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk action failed.", "error");
    }
  };

  const bulkDelete = async () => {
    setBulkDelBusy(true);
    try {
      const r = await adminMutate<{ affected: number }>("/api/admin/tests/bulk", "POST", {
        ids: [...selected],
        action: "delete",
      });
      toast(`${r.affected} test(s) deleted.`);
      setSelected(new Set());
      setBulkDelOpen(false);
      reload();
    } catch (e) {
      // The server blocks tests with recorded attempts; show that right in the
      // dialog so the click never looks like a no-op.
      setBulkDelError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBulkDelBusy(false);
    }
  };

  // ---- delete force path ----
  // A blocked delete is not a dead end: the admin can force it, which removes
  // the recorded attempts too — but only after a second dialog where the exact
  // test title (or FORCE DELETE for a multi-selection) must be typed.

  const isAttemptsBlock = (msg: string | null) => !!msg && /recorded attempt/i.test(msg);

  const openBulkForce = () => {
    const list = tests.filter((t) => selected.has(t.id));
    if (list.length === 0) return;
    setForceError(null);
    setBulkDelOpen(false);
    setForceDel({
      ids: list.map((t) => t.id),
      label: list.length === 1 ? `“${list[0].title}”` : `${list.length} selected tests`,
      requireText: list.length === 1 ? list[0].title : "FORCE DELETE",
    });
  };

  const openSingleForce = () => {
    if (!confirmDel) return;
    setForceError(null);
    setDelError(null);
    setForceDel({ ids: [confirmDel.id], label: `“${confirmDel.title}”`, requireText: confirmDel.title });
    setConfirmDel(null);
  };

  const runForceDelete = async () => {
    if (!forceDel) return;
    setForceBusy(true);
    try {
      const r = await adminMutate<{ affected: number; attemptsDeleted?: number }>("/api/admin/tests/bulk", "POST", {
        ids: forceDel.ids,
        action: "delete",
        force: true,
      });
      toast(
        r.attemptsDeleted
          ? `${r.affected} test(s) and ${r.attemptsDeleted} recorded attempt(s) deleted.`
          : `${r.affected} test(s) deleted.`
      );
      setSelected(new Set());
      setForceDel(null);
      reload();
    } catch (e) {
      setForceError(e instanceof Error ? e.message : "Force delete failed.");
    } finally {
      setForceBusy(false);
    }
  };

  // ---- editor ----

  const openEditor = (t?: TestRow) => {
    setPickSearch("");
    setPickDiff("all");
    setPickSubject("all");
    const ed: Editor = t
      ? {
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
          template: t.template,
        }
      : {
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
          template: "",
        };
    setEditor(ed);
    setEditorBase(JSON.stringify(ed));
  };

  // The editor holds a full paper (metadata + question list) — closing it with
  // unsaved edits asks first instead of dropping the work on a stray click.
  const closeEditor = () => {
    if (!editor || editorBusy) return;
    if (JSON.stringify(editor) !== editorBase) {
      setDiscardOpen(true);
      return;
    }
    setEditor(null);
  };

  const saveEditor = async () => {
    if (!editor) return;
    const title = editor.title.trim();
    if (title.length < 3) return toast("Title needs at least 3 characters.", "error");
    const templateMode = editor.template === FULL_MOCK_TEMPLATE;
    const minutes = templateMode ? FULL_MOCK_MINUTES : Number(editor.minutes);
    if (!templateMode && (!Number.isFinite(minutes) || minutes < 5 || minutes > 180)) {
      return toast("Duration must be 5–180 minutes.", "error");
    }
    if (editor.questionIds.length === 0) return toast("Pick at least one question.", "error");
    if (templateMode && editor.published) {
      const rows = editor.questionIds.map((id) => bankById.get(id)).filter((q): q is QRow => !!q);
      const issues = checkFullMockComposition(rows).issues;
      if (editor.questionIds.length !== rows.length) {
        issues.unshift("Some selected questions are not visible in the bank view — refresh the page and retry.");
      }
      if (issues.length > 0) return toast(`Can't publish this full mock: ${issues[0]}`, "error");
    }

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
        template: editor.template,
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

  // Template helper: top up every subject to its official count from the bank
  // (preferring fully valid questions), without touching what is selected.
  const autoFill = () => {
    setEditor((ed) => {
      if (!ed || ed.template !== FULL_MOCK_TEMPLATE) return ed;
      const picked = new Set(ed.questionIds);
      const additions: string[] = [];
      const countFor = (key: string) =>
        ed.questionIds
          .concat(additions)
          .filter((id) => subjectForSection(bankById.get(id)?.section)?.key === key).length;
      for (const s of SUBJECTS) {
        let need = s.count - countFor(s.key);
        if (need <= 0) continue;
        const candidates = bank
          .filter((q) => !picked.has(q.id) && subjectForSection(q.section)?.key === s.key)
          .sort((a, b) => cleanScore(b, s.plus, s.minus) - cleanScore(a, s.plus, s.minus));
        for (const q of candidates) {
          if (need <= 0) break;
          additions.push(q.id);
          picked.add(q.id);
          need -= 1;
        }
      }
      return { ...ed, questionIds: [...ed.questionIds, ...additions] };
    });
  };

  const sortPicks = () => {
    setEditor((ed) => {
      if (!ed || ed.template !== FULL_MOCK_TEMPLATE) return ed;
      const next = [...ed.questionIds].sort(
        (a, b) => subjectRank(bankById.get(a)?.section) - subjectRank(bankById.get(b)?.section)
      );
      return { ...ed, questionIds: next };
    });
  };

  // ---- preview ----

  const openPreview = async (t: TestRow) => {
    const seq = ++previewSeq.current;
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
        if (seq !== previewSeq.current) return; // a newer preview opened meanwhile
        const j = (await r.json()) as { rows?: QRow[] };
        if (r.ok) for (const q of j.rows ?? []) have.set(q.id, q);
      } catch {}
    }
    if (seq !== previewSeq.current) return;
    setPreviewQ(t.question_ids.map((id) => have.get(id)).filter((q): q is QRow => !!q));
  };

  const pickerList = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return bank
      .filter((b) => (pickDiff === "all" ? true : b.difficulty === pickDiff))
      .filter((b) => (pickSubject === "all" ? true : subjectForSection(b.section)?.key === pickSubject))
      .filter((b) => (q ? `${b.stem} ${b.topic} ${b.section}`.toLowerCase().includes(q) : true))
      .slice(0, 60);
  }, [bank, pickSearch, pickDiff, pickSubject]);

  // Live composition verdict for a template test being edited: subject
  // counters + every reason the paper is not publishable yet.
  const editorFull = useMemo(() => {
    if (!editor || editor.template !== FULL_MOCK_TEMPLATE) return null;
    const rows: QRow[] = [];
    for (const id of editor.questionIds) {
      const q = bankById.get(id);
      if (q) rows.push(q);
    }
    const outcome = checkFullMockComposition(rows);
    return { ...outcome, hidden: editor.questionIds.length - rows.length };
  }, [editor, bankById]);

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
              setSelected(new Set());
            }}
            placeholder="Search tests by title, tag or exam…"
            className="pl-9!"
            aria-label="Search tests"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setSelected(new Set());
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
            setSelected(new Set());
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
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
            setSelected(new Set());
          }}
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
              // The export honours whatever the list is currently showing.
              const p = new URLSearchParams({ format: "csv", sort });
              if (search.trim()) p.set("q", search.trim());
              if (status !== "all") p.set("published", status);
              if (exam !== "all") p.set("exam", exam);
              await downloadFile(`/api/admin/tests?${p.toString()}`, "tests.csv");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Export failed.", "error");
            }
          }}
        >
          <Icon name="download" size={14} /> Export CSV
        </button>
        <Link href="/admin/tests/from-csv" className="admin-btn">
          <Icon name="upload" size={14} /> From CSV
        </Link>
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
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link href="/admin/tests/from-csv" className="admin-btn">
                    <Icon name="upload" size={14} /> Create from CSV
                  </Link>
                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor()}>
                    <Icon name="plus" size={14} /> New test
                  </button>
                </div>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {selected.size > 0 && (
            <Card className="mb-3 flex flex-wrap items-center gap-2 px-3.5 py-2.5">
              <span className="text-[12.5px] font-extrabold">
                {selected.size} selected{selected.size >= 100 ? " · 100 max per batch" : ""}
              </span>
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
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => {
                  setBulkDelError(null);
                  setBulkDelOpen(true);
                }}
              >
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
                        ref={(el) => {
                          if (el) {
                            el.indeterminate =
                              paged.some((t) => selected.has(t.id)) && !paged.every((t) => selected.has(t.id));
                          }
                        }}
                        checked={paged.length > 0 && paged.every((t) => selected.has(t.id))}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const t of paged) {
                              if (e.target.checked) {
                                if (next.size >= 100) break; // server caps bulk batches at 100 ids
                                next.add(t.id);
                              } else next.delete(t.id);
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
                          onChange={() => {
                            // Server caps bulk batches at 100 ids.
                            if (!selected.has(t.id) && selected.size >= 100) {
                              toast("Up to 100 tests per batch — deselect some first.", "error");
                              return;
                            }
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(t.id)) next.delete(t.id);
                              else next.add(t.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="max-w-[300px]">
                        <span className="flex items-center gap-1.5">
                          <span className="min-w-0 truncate font-bold">{t.title}</span>
                          {t.template === FULL_MOCK_TEMPLATE && <Badge tone="violet">Full mock</Badge>}
                        </span>
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
                          <button type="button" className="admin-btn px-2 py-1.5" title="Preview" aria-label="Preview test" onClick={() => openPreview(t)}>
                            <Icon name="eye" size={14} />
                          </button>
                          <button type="button" className="admin-btn px-2 py-1.5" title="Edit" aria-label="Edit test" onClick={() => openEditor(t)}>
                            <Icon name="edit" size={14} />
                          </button>
                          <button type="button" className="admin-btn px-2 py-1.5" title="Duplicate" aria-label="Duplicate test" onClick={() => duplicate(t)}>
                            <Icon name="copy" size={14} />
                          </button>
                          <button
                            type="button"
                            className={cx("admin-btn px-2 py-1.5", !t.published && "admin-btn-primary")}
                            title={t.published ? "Unpublish" : "Publish"}
                            aria-label={t.published ? "Unpublish test" : "Publish test"}
                            onClick={() => togglePublish(t)}
                          >
                            <Icon name={t.published ? "eyeOff" : "check"} size={14} />
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger px-2 py-1.5"
                            title="Delete"
                            aria-label="Delete test"
                            onClick={() => {
                              setDelError(null);
                              setConfirmDel(t);
                            }}
                          >
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
        onClose={closeEditor}
        title={editor?.id ? "Edit test" : "New test"}
        subtitle="Title, schedule, access and the question sequence students will see."
        width="max-w-4xl"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={closeEditor} disabled={editorBusy}>
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
              <Field label="Template" hint="Template tests enforce the official NIMCET 2026 structure on the server.">
                <Select
                  value={editor.template}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditor({
                      ...editor,
                      template: v,
                      ...(v === FULL_MOCK_TEMPLATE ? { minutes: String(FULL_MOCK_MINUTES) } : {}),
                    });
                  }}
                >
                  <option value="">Custom / practice test</option>
                  <option value={FULL_MOCK_TEMPLATE}>NIMCET 2026 Full Mock (official)</option>
                </Select>
              </Field>
              <Field
                label="Duration (minutes)"
                hint={editor.template === FULL_MOCK_TEMPLATE ? `Fixed at ${FULL_MOCK_MINUTES} minutes (70 + 30 + 20).` : "5–180 minutes."}
              >
                <TextInput
                  type="number"
                  min={5}
                  max={180}
                  value={editor.template === FULL_MOCK_TEMPLATE ? String(FULL_MOCK_MINUTES) : editor.minutes}
                  onChange={(e) => setEditor({ ...editor, minutes: e.target.value })}
                  disabled={editor.template === FULL_MOCK_TEMPLATE}
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

              {editor.template === FULL_MOCK_TEMPLATE && editorFull && (
                <div className="mb-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SUBJECTS.map((s) => {
                      const n = editorFull.counts[s.key];
                      return (
                        <Badge key={s.key} tone={n === s.count ? "green" : n > s.count ? "red" : "amber"}>
                          {s.short}: {n}/{s.count} · +{s.plus}/{s.minus}
                        </Badge>
                      );
                    })}
                    <button type="button" className="admin-btn px-2 py-1 text-[12px]" onClick={autoFill}>
                      <Icon name="plus" size={12} /> Auto-fill missing
                    </button>
                    <button type="button" className="admin-btn px-2 py-1 text-[12px]" onClick={sortPicks}>
                      Sort by subject
                    </button>
                  </div>
                  {(editorFull.issues.length > 0 || editorFull.hidden > 0) && (
                    <ul className="space-y-1 rounded-xl px-3 py-2 text-[12px]" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                      {editorFull.hidden > 0 && (
                        <li>• {editorFull.hidden} selected question(s) are not visible in the bank view.</li>
                      )}
                      {editorFull.issues.slice(0, 4).map((iss, i) => (
                        <li key={i}>• {iss}</li>
                      ))}
                      {editorFull.issues.length > 4 && <li>• …and {editorFull.issues.length - 4} more.</li>}
                    </ul>
                  )}
                </div>
              )}

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
                          {q ? <MathText>{q.stem}</MathText> : `Question ${id.slice(0, 8)}… (not in bank view)`}
                        </span>
                        {q && <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Hard" ? "red" : "amber"}>{q.difficulty}</Badge>}
                        {editor.template === FULL_MOCK_TEMPLATE && q && (
                          <Badge tone="neutral">{subjectForSection(q.section)?.short ?? q.section ?? "—"}</Badge>
                        )}
                        {editor.template !== FULL_MOCK_TEMPLATE && (
                          <>
                            <button type="button" className="admin-btn px-1.5 py-1" onClick={() => movePick(id, -1)} title="Move up">
                              <Icon name="chevronLeft" size={12} className="rotate-90" />
                            </button>
                            <button type="button" className="admin-btn px-1.5 py-1" onClick={() => movePick(id, 1)} title="Move down">
                              <Icon name="chevronRight" size={12} className="rotate-90" />
                            </button>
                          </>
                        )}
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
                  aria-label="Search the question bank"
                />
                <Select value={pickDiff} onChange={(e) => setPickDiff(e.target.value)} className="w-auto" aria-label="Filter by difficulty">
                  <option value="all">All difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </Select>
                <Select value={pickSubject} onChange={(e) => setPickSubject(e.target.value)} className="w-auto" aria-label="Filter by subject">
                  <option value="all">All subjects</option>
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="admin-scroll max-h-56 space-y-1 overflow-y-auto">
                {bankData.error ? (
                  <ErrorState message={bankData.error} onRetry={bankData.reload} />
                ) : bankData.loading && !bankData.data ? (
                  <p className="px-1 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
                    Loading the question bank…
                  </p>
                ) : pickerList.length === 0 ? (
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
                        <span className="min-w-0 flex-1 truncate text-[12.5px]"><MathText>{q.stem}</MathText></span>
                        <Badge tone="neutral">{subjectForSection(q.section)?.short ?? (q.section || "—")}</Badge>
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
              {preview.template === FULL_MOCK_TEMPLATE && <Badge tone="violet">Full mock template</Badge>}
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
                      <p className="flex-1 text-[13.5px] leading-6 font-semibold"><MathText>{q.stem}</MathText></p>
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
                          <span className="flex-1"><MathText>{opt}</MathText></span>
                          {showKey && oi === q.answer && <Badge tone="green">Correct</Badge>}
                        </li>
                      ))}
                    </ul>
                    {showKey && q.explanation && (
                      <p className="mt-2 pl-6 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
                        <strong>Explanation:</strong> <MathText>{q.explanation}</MathText>
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

      {/* discard guard */}
      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        tone="danger"
        confirmLabel="Discard changes"
        message="Your edits to this test haven't been saved. Discarding them cannot be undone."
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          setEditor(null);
        }}
      />

      {/* delete confirms */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Delete test?"
        tone="danger"
        confirmLabel="Delete test"
        busy={delBusy}
        requireText={confirmDel?.title}
        error={delError}
        errorAction={
          isAttemptsBlock(delError) ? (
            <button type="button" className="admin-btn admin-btn-danger w-full justify-center" onClick={openSingleForce}>
              <Icon name="trash" size={14} /> Force delete (removes recorded attempts too)
            </button>
          ) : undefined
        }
        message={
          <>
            This permanently deletes <strong>“{confirmDel?.title}”</strong>. Tests with recorded
            attempts are blocked from deletion by the server — unpublish instead to preserve history.
          </>
        }
        onCancel={() => {
          setDelError(null);
          setConfirmDel(null);
        }}
        onConfirm={doDelete}
      />
      <ConfirmDialog
        open={bulkDelOpen}
        title={`Delete ${selected.size} test(s)?`}
        tone="danger"
        confirmLabel="Delete selected"
        busy={bulkDelBusy}
        requireText="DELETE"
        error={bulkDelError}
        errorAction={
          isAttemptsBlock(bulkDelError) ? (
            <button type="button" className="admin-btn admin-btn-danger w-full justify-center" onClick={openBulkForce}>
              <Icon name="trash" size={14} /> Force delete (removes recorded attempts too)
            </button>
          ) : undefined
        }
        message="Tests with recorded attempts are blocked by the server and nothing else in the selection is deleted either."
        onCancel={() => {
          setBulkDelError(null);
          setBulkDelOpen(false);
        }}
        onConfirm={bulkDelete}
      />
      <ConfirmDialog
        open={!!forceDel}
        title="Force delete?"
        tone="danger"
        confirmLabel="Force delete"
        busy={forceBusy}
        requireText={forceDel?.requireText}
        error={forceError}
        message={
          <>
            This permanently deletes {forceDel?.label} <strong>together with every recorded attempt</strong> attached to
            it. Student history for these mocks will be gone and cannot be recovered.
          </>
        }
        onCancel={() => {
          setForceError(null);
          setForceDel(null);
        }}
        onConfirm={runForceDelete}
      />
    </AdminLayout>
  );
}
