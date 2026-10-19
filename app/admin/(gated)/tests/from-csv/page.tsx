"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";
import { Badge, Card, Field, Modal, Select, TextArea, TextInput, cx, useToast } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { adminMutate } from "@/components/admin/hooks";
import { FULL_LENGTH_QUESTIONS, type ParsedRow } from "@/lib/question-rows";
import { parseMockCsv, titleFromFilename, type MockTemplate, type SectionSummary, type SubjectSummary } from "@/lib/mock-csv";
import { FULL_MOCK_MAX_MARKS, FULL_MOCK_MINUTES, FULL_MOCK_QUESTIONS, FULL_MOCK_TEMPLATE, SUBJECTS } from "@/lib/nimcet-full-mock";
import { fmtNum } from "@/lib/format";

const LETTERS = ["A", "B", "C", "D", "E"];
const MAX_ERRORS_SHOWN = 8;

type CreatedResult = {
  id: string;
  title: string;
  questions: number;
  inserted: number;
  reused: number;
  published: boolean;
  template?: string;
};

type FileEntry = {
  key: number;
  name: string;
  size: string;
  text: string;
  title: string;
  status: "invalid" | "ready" | "creating" | "error" | "created";
  errors: string[];
  rows: ParsedRow[] | null;
  sections: SectionSummary[];
  /** Template mode only — required vs found per subject. */
  subjects: SubjectSummary[];
  maxMarks: number;
  serverError: string;
  result: CreatedResult | null;
};

let keySeq = 0;

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function diffTone(d: string): "green" | "amber" | "red" {
  return d === "Easy" ? "green" : d === "Hard" ? "red" : "amber";
}

export default function AdminTestsFromCsv() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [exam, setExam] = useState("nimcet");
  const [template, setTemplate] = useState<MockTemplate>(FULL_MOCK_TEMPLATE);
  const [minutes, setMinutes] = useState("120");
  const [plus, setPlus] = useState("12");
  const [minus, setMinus] = useState("-3");
  const [tag, setTag] = useState("Full mock");
  const [free, setFree] = useState(true);
  const [publish, setPublish] = useState<"draft" | "live">("draft");
  const [instructions, setInstructions] = useState("");

  const templateMode = template === FULL_MOCK_TEMPLATE;

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewKey, setPreviewKey] = useState<number | null>(null);
  const [showKey, setShowKey] = useState(true);
  /** Files whose full error list is expanded (keyed by FileEntry.key). */
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  // Sanitized defaults applied to every row that has no plus/minus/exam of its
  // own — kept valid so a half-typed scheme can never produce bad rows.
  const scheme = useMemo(() => {
    const p = Number(plus);
    const m = Number(minus);
    return {
      exam: exam.trim() || "nimcet",
      plus: Number.isFinite(p) && p > 0 && p <= 1000 ? p : 12,
      minus: Number.isFinite(m) && m <= 0 && m >= -1000 ? m : -3,
    };
  }, [exam, plus, minus]);

  // Re-run the pre-flight on every not-yet-created file when the shared
  // scheme (or the template) changes, so blank plus/minus cells pick up the
  // new defaults and template rules stay enforced.
  useEffect(() => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.status === "created" || f.status === "creating") return f;
        const out = parseMockCsv(f.text, scheme, template);
        return {
          ...f,
          errors: out.errors,
          rows: out.rows,
          sections: out.sections,
          subjects: out.subjects,
          maxMarks: out.maxMarks,
          status: out.errors.length > 0 ? ("invalid" as const) : ("ready" as const),
          serverError: "",
        };
      })
    );
  }, [scheme, template]);

  const ready = files.filter((f) => f.status === "ready" || f.status === "error");
  const created = files.filter((f) => f.result);
  const invalidCount = files.filter((f) => f.status === "invalid").length;

  const previewEntry = useMemo(() => files.find((f) => f.key === previewKey) ?? null, [files, previewKey]);

  // ---- files ----

  const addFiles = (list: FileList | File[]) => {
    const all = Array.from(list);
    const incoming = all.filter((f) => /\.csv$/i.test(f.name) || f.type === "text/csv");
    if (incoming.length < all.length) toast(`${all.length - incoming.length} non-CSV file(s) ignored.`, "error");
    if (incoming.length === 0) return;
    (async () => {
      const added: FileEntry[] = [];
      for (const f of incoming) {
        try {
          const text = await f.text();
          const out = parseMockCsv(text, scheme, template);
          added.push({
            key: ++keySeq,
            name: f.name,
            size: fmtSize(f.size),
            text,
            title: titleFromFilename(f.name),
            status: out.errors.length > 0 ? "invalid" : "ready",
            errors: out.errors,
            rows: out.rows,
            sections: out.sections,
            subjects: out.subjects,
            maxMarks: out.maxMarks,
            serverError: "",
            result: null,
          });
        } catch {
          toast(`Could not read “${f.name}”.`, "error");
        }
      }
      if (added.length === 0) return;
      setFiles((prev) => [...prev, ...added]);
      const bad = added.filter((a) => a.status === "invalid").length;
      if (bad > 0) {
        toast(`${bad} file(s) have CSV errors — see the details on each card.`, "error");
      } else if (added.length > 0) {
        toast(`${added.length} file(s) validated — ${added.length * FULL_LENGTH_QUESTIONS} questions ready.`);
      }
    })();
  };

  const renameFile = (key: number, title: string) => {
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, title } : f)));
  };

  const removeFile = (key: number) => {
    setFiles((prev) => prev.filter((f) => f.key !== key));
    setPreviewKey((k) => (k === key ? null : k));
  };

  const toggleErrors = (key: number) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---- create ----

  const checkSettings = (): boolean => {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins < 5 || mins > 180) {
      toast("Duration must be 5–180 minutes.", "error");
      return false;
    }
    if (templateMode && mins !== FULL_MOCK_MINUTES) {
      toast(`A NIMCET full mock is always ${FULL_MOCK_MINUTES} minutes (70 + 30 + 20).`, "error");
      return false;
    }
    return true;
  };

  const runCreate = async (entry: FileEntry): Promise<boolean> => {
    const title = entry.title.trim();
    if (title.length < 3) {
      setFiles((prev) =>
        prev.map((f) => (f.key === entry.key ? { ...f, serverError: "Title needs at least 3 characters." } : f))
      );
      return false;
    }
    setFiles((prev) => prev.map((f) => (f.key === entry.key ? { ...f, status: "creating", serverError: "" } : f)));
    try {
      const r = await adminMutate<CreatedResult>("/api/admin/tests/from-csv", "POST", {
        title,
        exam: scheme.exam,
        template,
        tag: tag.trim(),
        minutes: templateMode ? FULL_MOCK_MINUTES : Number(minutes),
        free,
        published: publish === "live",
        instructions: instructions.trim(),
        scheme: { plus: scheme.plus, minus: scheme.minus },
        rows: entry.rows,
      });
      setFiles((prev) => prev.map((f) => (f.key === entry.key ? { ...f, status: "created", result: r, serverError: "" } : f)));
      toast(
        `“${r.title}” ${r.published ? "created and published" : "saved as a draft"} — ${r.questions} questions${
          r.reused > 0 ? ` (${r.reused} reused from the bank)` : ""
        }.`
      );
      return true;
    } catch (e) {
      setFiles((prev) =>
        prev.map((f) =>
          f.key === entry.key ? { ...f, status: "error", serverError: e instanceof Error ? e.message : "Create failed." } : f
        )
      );
      return false;
    }
  };

  const createOne = async (key: number) => {
    const entry = files.find((f) => f.key === key);
    if (!entry || (entry.status !== "ready" && entry.status !== "error")) return;
    if (!checkSettings()) return;
    await runCreate(entry);
  };

  const createAll = async () => {
    if (!checkSettings()) return;
    const queue = files.filter((f) => f.status === "ready" || f.status === "error");
    if (queue.length === 0) {
      toast("No validated files waiting — nothing to create.", "error");
      return;
    }
    setBusyAll(true);
    setProgress({ done: 0, total: queue.length });
    let ok = 0;
    let failed = 0;
    for (const entry of queue) {
      const done = await runCreate(entry);
      if (done) ok += 1;
      else failed += 1;
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setProgress(null);
    setBusyAll(false);
    if (ok > 0) toast(`${ok} mock test(s) created.`);
    if (failed > 0) toast(`${failed} file(s) failed — open the card to see why.`, "error");
  };

  // ---- preview ----

  const previewBody = previewEntry && (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="blue">{previewEntry.rows?.length ?? 0} questions</Badge>
        <Badge tone="neutral">{minutes} min</Badge>
        <Badge tone="violet">Max {fmtNum(previewEntry.maxMarks, 1)} marks</Badge>
        <Badge tone={free ? "blue" : "violet"}>{free ? "Free" : "Paid"}</Badge>
        <Badge tone={publish === "live" ? "green" : "amber"}>{publish === "live" ? "Publishes live" : "Saves as draft"}</Badge>
        {tag.trim() && <Badge tone="neutral">{tag.trim()}</Badge>}
        <Badge tone="neutral">{scheme.exam}</Badge>
        {templateMode && <Badge tone="violet">NIMCET 2026 Full Mock</Badge>}
      </div>

      {previewEntry.sections.length > 1 && (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full min-w-[420px] text-[12.5px]">
            <thead>
              <tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
                <th className="py-1.5 pl-3 pr-2 text-left font-bold">SECTION</th>
                <th className="px-2 py-1.5 text-right font-bold">QUESTIONS</th>
                <th className="px-2 py-1.5 text-right font-bold">MARKS</th>
                <th className="py-1.5 pl-2 pr-3 text-right font-bold">MARKING</th>
              </tr>
            </thead>
            <tbody>
              {previewEntry.sections.map((sec) => (
                <tr key={sec.label} style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                  <td className="py-1.5 pl-3 pr-2 font-semibold">{sec.label}</td>
                  <td className="mono px-2 py-1.5 text-right">{sec.count}</td>
                  <td className="mono px-2 py-1.5 text-right">{fmtNum(sec.marks, 1)}</td>
                  <td className="mono py-1.5 pl-2 pr-3 text-right">
                    +{sec.plus} / {sec.minus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {instructions.trim() && (
        <div className="rounded-xl px-3.5 py-2.5 text-[13px] leading-6" style={{ background: "var(--pill)" }}>
          <span
            className="mb-1 block text-[11px] font-extrabold uppercase"
            style={{ color: "var(--muted)", letterSpacing: "0.1em" }}
          >
            Instructions
          </span>
          <span className="whitespace-pre-line">{instructions.trim()}</span>
        </div>
      )}

      <ol className="space-y-4">
        {(previewEntry.rows ?? []).map((q, i) => (
          <li key={i} className="rounded-2xl p-3.5" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-start gap-2">
              <span className="mono text-[12px] font-extrabold" style={{ color: "var(--muted)" }}>
                Q{i + 1}.
              </span>
              <p className="flex-1 text-[13.5px] font-semibold leading-6">{q.stem}</p>
              <Badge tone={diffTone(q.difficulty)}>{q.difficulty}</Badge>
            </div>
            <ul className="mt-2.5 space-y-1.5 pl-6">
              {q.options.map((opt, oi) => (
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
                {q.section || "General"} · +{q.plus} / {q.minus} marks
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );

  const createdLive = created.filter((f) => f.result?.published).length;

  return (
    <AdminLayout>
      <div className="mb-3">
        <Link
          href="/admin/tests"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold"
          style={{ color: "var(--muted)" }}
        >
          <Icon name="chevronLeft" size={14} /> Back to mock tests
        </Link>
      </div>

      <div className="space-y-4">
        {/* settings */}
        <Card className="p-4 sm:p-5">
          <h2 className="text-[15px] font-extrabold tracking-tight">Create full-length mocks from CSV</h2>
          <p className="mt-1 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
            Each CSV must hold exactly <strong>{FULL_LENGTH_QUESTIONS} questions</strong> — the same columns the Question
            Bank exports. The questions join the bank and the new test links them automatically, in CSV order, with no
            manual picking.
          </p>

          <div className="mt-4 max-w-xl">
            <Field
              label="Template"
              hint={
                templateMode
                  ? "Official structure enforced: 50/40/20/10 questions · 70 + 30 + 20 minutes · per-subject marks · exactly 4 options each."
                  : "Generic 120-question paper — your marking scheme applies, timing stays a single 120-minute clock."
              }
            >
              <Select
                value={template}
                onChange={(e) => {
                  const v = e.target.value as MockTemplate;
                  setTemplate(v);
                  if (v === FULL_MOCK_TEMPLATE) setMinutes(String(FULL_MOCK_MINUTES));
                }}
                disabled={busyAll}
              >
                <option value={FULL_MOCK_TEMPLATE}>NIMCET 2026 Full Mock (official structure)</option>
                <option value="">Custom full-length paper</option>
              </Select>
            </Field>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Exam">
              <TextInput value={exam} onChange={(e) => setExam(e.target.value)} placeholder="nimcet" disabled={busyAll} />
            </Field>
            <Field
              label="Duration (minutes)"
              hint={templateMode ? `Fixed at ${FULL_MOCK_MINUTES} minutes (70 + 30 + 20).` : "5–180 minutes."}
            >
              <TextInput
                type="number"
                min={5}
                max={180}
                value={templateMode ? String(FULL_MOCK_MINUTES) : minutes}
                onChange={(e) => setMinutes(e.target.value)}
                disabled={busyAll || templateMode}
              />
            </Field>
            <Field label="Tag" hint="Short label shown to students.">
              <TextInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Full mock" disabled={busyAll} />
            </Field>
            {!templateMode && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Marking +" hint="Default correct mark.">
                  <TextInput type="number" value={plus} onChange={(e) => setPlus(e.target.value)} disabled={busyAll} />
                </Field>
                <Field label="Marking −" hint="Default wrong mark.">
                  <TextInput type="number" value={minus} onChange={(e) => setMinus(e.target.value)} disabled={busyAll} />
                </Field>
              </div>
            )}
          </div>

          {templateMode && (
            <div className="mt-4 rounded-2xl p-3.5" style={{ background: "var(--pill)" }}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-extrabold">Subject-wise marking</span>
                <Badge tone="violet">Official NIMCET 2026 — enforced</Badge>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Every row must match its subject&rsquo;s marks — leave the plus/minus columns blank to fill them automatically.
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SUBJECTS.map((s) => (
                  <div
                    key={s.key}
                    className="rounded-xl px-3 py-2"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                  >
                    <p
                      className="text-[11px] font-extrabold uppercase"
                      style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
                    >
                      {s.short}
                    </p>
                    <p className="mono mt-0.5 text-[12.5px] font-bold">
                      {s.count} Q · +{s.plus} / {s.minus}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mono mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
                Total {FULL_MOCK_QUESTIONS} questions · {FULL_MOCK_MAX_MARKS} marks · {FULL_MOCK_MINUTES} minutes (70 + 30 + 20,
                Part III shares one clock).
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
              <input
                type="checkbox"
                className="admin-check"
                checked={free}
                onChange={(e) => setFree(e.target.checked)}
                disabled={busyAll}
              />
              Free access
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>
                After creating
              </span>
              <button
                type="button"
                className={cx("admin-btn px-2.5 py-1.5", publish === "draft" && "admin-btn-primary")}
                onClick={() => setPublish("draft")}
                disabled={busyAll}
              >
                Save as draft
              </button>
              <button
                type="button"
                className={cx("admin-btn px-2.5 py-1.5", publish === "live" && "admin-btn-primary")}
                onClick={() => setPublish("live")}
                disabled={busyAll}
              >
                Publish live
              </button>
            </div>
          </div>

          <div className="mt-3">
            <Field
              label="Instructions"
              hint="Optional — shown on the student's instructions screen before this mock starts."
            >
              <TextArea
                rows={3}
                maxLength={8000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={busyAll}
                placeholder={"One instruction per line, e.g.\nRough work must be done on the sheets provided only."}
              />
            </Field>
          </div>

          <p className="mt-2 text-[12px] leading-5" style={{ color: "var(--muted)" }}>
            {templateMode
              ? "Template mode: exactly 50/40/20/10 questions from the four NIMCET subjects, 4 options each, and the per-subject marks shown above are enforced on every row. Identical questions already in the bank are reused, never duplicated."
              : "Marking note: a row's own plus/minus values always win; the defaults above apply only where those columns are blank. Identical questions already in the bank are reused — never duplicated."}
          </p>
        </Card>

        {/* created banner */}
        {created.length > 0 && (
          <Card
            className="flex flex-wrap items-center gap-3 p-4"
            style={{
              background: "color-mix(in srgb, #10b981 8%, transparent)",
              border: "1px solid color-mix(in srgb, #10b981 30%, var(--border))",
            }}
          >
            <Badge tone="green">{created.length} created</Badge>
            <span className="text-[13px] font-semibold">
              {createdLive} live for students · {created.length - createdLive} draft
              {created.length - createdLive === 1 ? "" : "s"}
            </span>
            <Link href="/admin/tests" className="admin-btn ml-auto">
              <Icon name="external" size={14} /> Open Mock Tests
            </Link>
          </Card>
        )}

        {/* files */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-extrabold tracking-tight">CSV files</h2>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.CSV,text/csv,application/vnd.ms-excel"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button type="button" className="admin-btn" onClick={() => fileRef.current?.click()} disabled={busyAll}>
                <Icon name="upload" size={14} /> Choose CSV files
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={createAll}
                disabled={busyAll || ready.length === 0}
              >
                {progress
                  ? `Creating ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
                  : `Create ${ready.length > 0 ? ready.length : ""} mock${ready.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
          {files.length > 0 && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
              {ready.length} ready · {created.length} created
              {invalidCount > 0 ? ` · ${invalidCount} with errors` : ""}
            </p>
          )}

          <div
            className="mt-3 space-y-3 rounded-2xl"
            style={dragging ? { outline: "2px dashed var(--accent)", outlineOffset: 4 } : undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busyAll && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
          >
            {files.length === 0 ? (
              <div
                className="rounded-2xl px-4 py-8 text-center"
                style={{ border: "1.5px dashed var(--border)" }}
              >
                <p className="text-[13px] font-bold">Drag &amp; drop CSV files here</p>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
                  One file = one mock test. Select several at once for bulk creation.
                </p>
              </div>
            ) : (
              files.map((f) => (
                <div
                  key={f.key}
                  className="rounded-2xl p-3.5"
                  style={{
                    border:
                      f.status === "invalid" || f.status === "error"
                        ? "1px solid color-mix(in srgb, #ef4444 30%, var(--border))"
                        : f.status === "created"
                          ? "1px solid color-mix(in srgb, #10b981 30%, var(--border))"
                          : "1px solid var(--border)",
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "var(--pill)", color: "var(--accent)" }}
                    >
                      <Icon name="upload" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-extrabold" title={f.name}>
                        {f.name}
                      </p>
                      <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                        {f.size} · {f.rows ? `${f.rows.length} questions` : "no valid rows yet"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {f.status === "invalid" && <Badge tone="red">Needs fixes</Badge>}
                      {f.status === "ready" && <Badge tone="blue">Ready</Badge>}
                      {f.status === "creating" && <Badge tone="amber">Creating…</Badge>}
                      {f.status === "error" && <Badge tone="red">Server rejected</Badge>}
                      {f.status === "created" && <Badge tone="green">Created</Badge>}
                      <button
                        type="button"
                        className="admin-btn px-2.5 py-1.5"
                        disabled={!f.rows}
                        onClick={() => {
                          setShowKey(true);
                          setPreviewKey(f.key);
                        }}
                      >
                        <Icon name="eye" size={14} /> Preview
                      </button>
                      {f.status !== "created" && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-primary px-2.5 py-1.5"
                          disabled={f.status === "creating" || f.status === "invalid" || busyAll}
                          onClick={() => createOne(f.key)}
                        >
                          <Icon name="check" size={14} /> Create
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger px-2 py-1.5"
                        title="Remove file"
                        aria-label={`Remove ${f.name}`}
                        disabled={f.status === "creating"}
                        onClick={() => removeFile(f.key)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <Field label="Mock title">
                      <TextInput
                        value={f.title}
                        onChange={(e) => renameFile(f.key, e.target.value)}
                        disabled={f.status === "created" || busyAll}
                        placeholder="e.g. NIMCET MOCK - 05"
                      />
                    </Field>
                  </div>

                  {f.errors.length > 0 && (
                    <div
                      className="mt-3 rounded-xl px-3 py-2.5 text-[12.5px] leading-5"
                      style={{
                        background: "color-mix(in srgb, #ef4444 9%, transparent)",
                        border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
                      }}
                    >
                      <p className="font-extrabold" style={{ color: "#ef4444" }}>
                        {f.errors.length} problem{f.errors.length === 1 ? "" : "s"} found
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {f.errors
                          .slice(0, expandedErrors.has(f.key) ? f.errors.length : MAX_ERRORS_SHOWN)
                          .map((e, i) => (
                            <li key={i}>• {e}</li>
                          ))}
                      </ul>
                      {f.errors.length > MAX_ERRORS_SHOWN && (
                        <button
                          type="button"
                          className="mt-1 cursor-pointer font-extrabold underline underline-offset-2"
                          style={{ color: "#ef4444" }}
                          onClick={() => toggleErrors(f.key)}
                        >
                          {expandedErrors.has(f.key)
                            ? "Show fewer"
                            : `…and ${f.errors.length - MAX_ERRORS_SHOWN} more — show all`}
                        </button>
                      )}
                      <p className="mt-1.5" style={{ color: "var(--muted)" }}>
                        Row numbers count data rows after the header.
                      </p>
                    </div>
                  )}

                  {f.serverError && (
                    <div
                      className="mt-3 rounded-xl px-3 py-2.5 text-[12.5px] leading-5"
                      style={{
                        background: "color-mix(in srgb, #ef4444 9%, transparent)",
                        border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
                      }}
                    >
                      <p className="font-extrabold" style={{ color: "#ef4444" }}>
                        Could not create this mock
                      </p>
                      <p className="mt-1">{f.serverError}</p>
                    </div>
                  )}

                  {f.rows && f.errors.length === 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      {f.subjects.length > 0
                        ? f.subjects.map((s) => (
                            <Badge key={s.key} tone={s.found === s.required ? "green" : "red"}>
                              {s.label}: {s.found}/{s.required} · +{s.plus}/{s.minus}
                            </Badge>
                          ))
                        : f.sections.map((sec) => (
                            <Badge key={sec.label} tone="neutral">
                              {sec.label}: {sec.count}Q · +{sec.plus}/{sec.minus}
                            </Badge>
                          ))}
                      <span style={{ color: "var(--muted)" }}>Max marks {fmtNum(f.maxMarks, 1)}</span>
                    </div>
                  )}

                  {f.status === "created" && f.result && (
                    <p className="mt-2 text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
                      {f.result.published
                        ? "Live for students now."
                        : "Saved as a draft — publish it from Mock Tests when ready."}{" "}
                      {f.result.reused > 0 &&
                        `${f.result.reused} question(s) were already in the bank and were reused for this test.`}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <details className="mt-3 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ border: "1px solid var(--border)" }}>
            <summary className="cursor-pointer font-bold">CSV format &amp; rules</summary>
            <ul className="mt-2 space-y-1.5 leading-5" style={{ color: "var(--muted)" }}>
              <li>
                • Required columns: <code>stem</code>, <code>optionA</code>–<code>optionD</code>, <code>answer</code>{" "}
                (A–E — E needs <code>optionE</code>) — exactly {FULL_LENGTH_QUESTIONS} data rows.
              </li>
              <li>
                • Optional: <code>exam</code> (falls back to the Exam field above), <code>section</code>,{" "}
                <code>topic</code>, <code>difficulty</code> (Easy/Medium/Hard), <code>optionE</code>,{" "}
                <code>explanation</code>, <code>plus</code>, <code>minus</code>.
              </li>
              <li>• Export any list from the Question Bank to CSV — the file re-imports here as-is.</li>
              <li>
                • NIMCET Full Mock template: sections must map to Mathematics (50Q · +12/−3), Analytical Ability &amp;
                Logical Reasoning (40Q · +6/−1.5), Computer Awareness (20Q · +6/−1.5) and General English (10Q · +4/−1) —
                4–5 options each, 120 minutes in three timed parts.
              </li>
              <li>• Duplicate question text inside one file is rejected; identical text already in the bank is reused.</li>
            </ul>
          </details>
        </Card>
      </div>

      {/* preview modal */}
      <Modal
        open={!!previewEntry}
        onClose={() => setPreviewKey(null)}
        title={`Preview — ${previewEntry?.title ?? ""}`}
        subtitle="Paper view. Nothing is created until you press Create."
        width="max-w-4xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <button type="button" className="admin-btn" onClick={() => setShowKey((s) => !s)}>
              <Icon name="eye" size={14} /> {showKey ? "Hide answer key" : "Show answer key"}
            </button>
            <div className="flex items-center gap-2">
              <button type="button" className="admin-btn" onClick={() => setPreviewKey(null)}>
                Close
              </button>
              {previewEntry && (previewEntry.status === "ready" || previewEntry.status === "error") && (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={busyAll}
                  onClick={() => createOne(previewEntry.key)}
                >
                  <Icon name="check" size={14} /> Create this mock
                </button>
              )}
              {previewEntry?.status === "created" && (
                <Badge tone={previewEntry.result?.published ? "green" : "amber"}>
                  {previewEntry.result?.published ? "Published" : "Saved as draft"}
                </Badge>
              )}
            </div>
          </div>
        }
      >
        {previewBody}
      </Modal>
    </AdminLayout>
  );
}
