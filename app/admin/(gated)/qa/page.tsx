"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Select,
  Skeleton,
  TextArea,
  cx,
  useToast,
  type BadgeTone,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { adminMutate, useAdminData } from "@/components/admin/hooks";
import { MathText } from "@/components/math-text";
import { fmtDate } from "@/lib/format";
import type { QaCounts, QaFinding, QaStatus } from "@/lib/qa/types";

// Admin Question QA dashboard. Reads only the persisted server-side results;
// validation itself always runs in the API against the current question rows.
// The page never edits a question or publishes a test silently: reruns and
// overrides are explicit actions with an audit trail.

type QaSummary = {
  available: boolean;
  questions: { total: number; pass: number; warning: number; review: number; failed: number; stale: number };
  tests: { total: number; eligible: number; blocked: number };
  recentQuestions: QRow[];
  recentTests: TRow[];
  engineVersion: string;
  policyVersion: string;
};

type QRow = {
  question_id: string;
  status: QaStatus;
  counts: QaCounts;
  findings: QaFinding[];
  checked_at: string;
  stale: boolean;
  kind?: string | null;
  computed_answer?: number | null;
  deterministic_verified?: boolean | null;
  stem: string;
  section: string;
  topic: string;
};

type TRow = {
  test_id: string;
  status: QaStatus;
  counts: QaCounts;
  findings: QaFinding[];
  question_statuses: Record<QaStatus, number>;
  eligible: boolean;
  override_reason: string | null;
  checked_at: string;
  title: string;
  published: boolean;
};

type Detail = { kind: "question"; row: QRow } | { kind: "test"; row: TRow } | null;

const STATUS_TONE: Record<QaStatus, BadgeTone> = {
  PASS: "green",
  WARNING: "amber",
  NEEDS_REVIEW: "violet",
  FAILED: "red",
};

const STATUS_LABEL: Record<QaStatus, string> = {
  PASS: "Pass",
  WARNING: "Warning",
  NEEDS_REVIEW: "Needs review",
  FAILED: "Failed",
};

const SEVERITY_TONE: Record<QaFinding["severity"], BadgeTone> = {
  critical: "red",
  review: "violet",
  warning: "amber",
  info: "neutral",
};

function statusBadge(status: QaStatus, stale = false) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      {stale && <Badge tone="red">stale</Badge>}
    </span>
  );
}

function short(text: string, n = 110): string {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function Findings({ findings }: { findings: QaFinding[] }) {
  if (!findings.length) {
    return <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>No findings recorded.</p>;
  }
  return (
    <div className="space-y-2">
      {findings.map((f, i) => (
        <div
          key={`${f.code}-${i}`}
          className="rounded-xl border px-3 py-2.5"
          style={{ borderColor: "var(--border)", background: "var(--pill)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge>
            <code className="text-[11px] font-bold">{f.code}</code>
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              {f.category} · {f.field} · {f.validator}
              {f.deterministic ? "" : " · heuristic"}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] font-semibold leading-5">{f.message}</p>
          {f.suggestion && (
            <p className="mt-1 text-[12px] leading-5" style={{ color: "var(--muted)" }}>
              <strong>Suggested fix:</strong> {f.suggestion}
            </p>
          )}
          {f.evidence && (
            <p className="mt-1 break-words mono text-[11px]" style={{ color: "var(--muted)" }}>
              {f.evidence}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "red" | "violet" | "amber" | "green" }) {
  const color =
    tone === "red"
      ? "#ef4444"
      : tone === "violet"
        ? "#8b5cf6"
        : tone === "amber"
          ? "#d97706"
          : tone === "green"
            ? "#10b981"
            : "var(--text)";
  return (
    <Card className="px-4 py-3">
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-[24px] font-black leading-none" style={{ color }}>
        {value}
      </div>
    </Card>
  );
}

export default function QuestionQaPage() {
  const toast = useToast();
  const [view, setView] = useState<"questions" | "tests">("questions");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<Detail>(null);
  const [busy, setBusy] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const summary = useAdminData<QaSummary>("/api/admin/qa");
  const listUrl = `/api/admin/qa?view=${view}${status !== "all" ? `&status=${encodeURIComponent(status)}` : ""}&limit=200`;
  const list = useAdminData<{ rows: QRow[] | TRow[] }>(listUrl);

  const rows = useMemo(() => (list.data?.rows ?? []) as Array<QRow | TRow>, [list.data]);
  const counts = summary.data?.questions;

  const refresh = () => {
    summary.reload();
    list.reload();
  };

  const runAudit = async (kind: "questions" | "tests") => {
    setBusy(`audit-${kind}`);
    try {
      const out = await adminMutate<{ summary: { checked: number; pass: number; warning: number; review: number; failed: number } }>(
        "/api/admin/qa",
        "POST",
        { action: kind === "questions" ? "audit-questions" : "audit-tests", limit: kind === "questions" ? 2000 : 1000 }
      );
      const s = out.summary;
      toast(`${s.checked} ${kind === "questions" ? "question" : "test"}(s) checked — ${s.pass} pass, ${s.warning} warning, ${s.review} review, ${s.failed} failed.`);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "QA audit failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const rerunQuestion = async () => {
    if (!detail || detail.kind !== "question") return;
    const id = detail.row.question_id;
    setBusy("question");
    try {
      const out = await adminMutate<{ qa: { status: QaStatus; counts: QaCounts; findings: QaFinding[]; checkedAt: string } }>(
        "/api/admin/qa",
        "POST",
        { action: "validate-question", id }
      );
      const qa = out.qa;
      const next: QRow = {
        ...detail.row,
        status: qa.status,
        counts: qa.counts,
        findings: qa.findings,
        checked_at: qa.checkedAt,
        stale: false,
      };
      setDetail({ kind: "question", row: next });
      toast(`Question QA: ${STATUS_LABEL[qa.status]}.`);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Rerun failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const rerunTest = async () => {
    if (!detail || detail.kind !== "test") return;
    const id = detail.row.test_id;
    setBusy("test");
    try {
      const out = await adminMutate<{
        qa: {
          status: QaStatus;
          counts: QaCounts;
          findings: QaFinding[];
          questionStatuses: Record<QaStatus, number>;
          eligible: boolean;
          overrideReason?: string;
          checkedAt: string;
        };
      }>("/api/admin/qa", "POST", {
        action: "validate-test",
        id,
        ...(overrideReason.trim() ? { qa_override_reason: overrideReason.trim() } : {}),
      });
      const qa = out.qa;
      setDetail({
        kind: "test",
        row: {
          ...detail.row,
          status: qa.status,
          counts: qa.counts,
          findings: qa.findings,
          question_statuses: qa.questionStatuses,
          eligible: qa.eligible,
          override_reason: qa.overrideReason ?? null,
          checked_at: qa.checkedAt,
        },
      });
      toast(`Test QA: ${STATUS_LABEL[qa.status]}${qa.eligible ? " (publishable)" : " (blocked)"}.`);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Validation failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const publishTest = async () => {
    if (!detail || detail.kind !== "test") return;
    const row = detail.row;
    if (row.status === "FAILED") {
      toast("Critical failures block publishing. Fix them first.", "error");
      return;
    }
    if (row.status === "NEEDS_REVIEW" && overrideReason.trim().length < 8) {
      toast("Enter a short acknowledgement reason (at least 8 characters) before publishing a review-level test.", "error");
      return;
    }
    setBusy("publish");
    try {
      await adminMutate(`/api/admin/tests/${row.test_id}`, "PUT", {
        published: true,
        ...(overrideReason.trim() ? { qa_override_reason: overrideReason.trim() } : {}),
      });
      toast("Test published with its current QA result.");
      setDetail(null);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Publish failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const loading = summary.loading || list.loading;
  const error = summary.error || list.error;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-black leading-tight">Question QA</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
            Deterministic checks for every question and paper. Critical failures block publishing; review-level
            findings need an explicit admin acknowledgement. Engine {summary.data?.engineVersion ?? "—"} · policy{" "}
            {summary.data?.policyVersion ?? "—"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="admin-btn" onClick={() => runAudit("questions")} disabled={!!busy}>
            {busy === "audit-questions" ? <Icon name="refresh" size={14} /> : <Icon name="pulse" size={14} />}
            Audit questions
          </button>
          <button type="button" className="admin-btn" onClick={() => runAudit("tests")} disabled={!!busy}>
            {busy === "audit-tests" ? <Icon name="refresh" size={14} /> : <Icon name="tests" size={14} />}
            Audit tests
          </button>
          <button type="button" className="admin-btn" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {summary.data && !summary.data.available && (
        <Card className="mb-3 px-4 py-3">
          <p className="text-[12.5px] font-semibold">
            QA storage is not installed yet. Run <code className="mono">supabase/migrations/0011_question_qa.sql</code>,
            then reload this page.
          </p>
        </Card>
      )}

      {counts && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Stat label="Checked" value={counts.total} />
          <Stat label="Pass" value={counts.pass} tone="green" />
          <Stat label="Warnings" value={counts.warning} tone="amber" />
          <Stat label="Needs review" value={counts.review} tone="violet" />
          <Stat label="Failed" value={counts.failed} tone="red" />
          <Stat label="Stale" value={counts.stale} tone="red" />
        </div>
      )}

      {summary.data && (
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <Card className="px-4 py-3">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
              Test results
            </div>
            <div className="mt-1 text-[13px] font-bold">
              {summary.data.tests.total} checked · {summary.data.tests.eligible} publishable ·{" "}
              <span style={{ color: "#ef4444" }}>{summary.data.tests.blocked} blocked</span>
            </div>
          </Card>
          <Card className="px-4 py-3 sm:col-span-2">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
              How the gate behaves
            </div>
            <p className="mt-1 text-[12px] leading-5" style={{ color: "var(--muted)" }}>
              Failures always block. Warnings publish normally. Review-level findings require an acknowledgement
              reason. Any question edit invalidates its stored result and hides it from students until rerun.
            </p>
          </Card>
        </div>
      )}

      <Card className="mb-3 flex flex-wrap items-center gap-2 px-3.5 py-3">
        <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            className={cx("admin-btn border-0", view === "questions" && "admin-btn-primary")}
            onClick={() => {
              setView("questions");
              setStatus("all");
            }}
          >
            Questions
          </button>
          <button
            type="button"
            className={cx("admin-btn border-0", view === "tests" && "admin-btn-primary")}
            onClick={() => {
              setView("tests");
              setStatus("all");
            }}
          >
            Tests
          </button>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="QA status filter">
          <option value="all">All statuses</option>
          <option value="PASS">Pass</option>
          <option value="WARNING">Warning</option>
          <option value="NEEDS_REVIEW">Needs review</option>
          <option value="FAILED">Failed</option>
          {view === "questions" && <option value="stale">Stale (question edited)</option>}
        </Select>
        <span className="ml-auto text-[12px]" style={{ color: "var(--muted)" }}>
          {rows.length} shown
        </span>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading && rows.length === 0 ? (
        <Card className="px-5 py-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="pulse"
            title={summary.data?.available ? "No QA results match this view" : "QA results are not available yet"}
            hint={
              summary.data?.available
                ? "Run an audit, or open a question/test and rerun validation."
                : "Apply migration 0011, then run an audit from this page."
            }
          />
        </Card>
      ) : view === "questions" ? (
        <Card className="px-2 pb-3 pt-1">
          <div className="admin-scroll overflow-x-auto">
            <table className="admin-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Question</th>
                  <th>Section / topic</th>
                  <th>Findings</th>
                  <th>Checked</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(rows as QRow[]).map((q) => (
                  <tr key={q.question_id} className="admin-row">
                    <td>{statusBadge(q.status, q.stale)}</td>
                    <td className="max-w-[420px]">
                      <button
                        type="button"
                        className="text-left text-[12.5px] font-semibold leading-5 hover:underline"
                        onClick={() => {
                          setOverrideReason("");
                          setDetail({ kind: "question", row: q });
                        }}
                      >
                        {short(q.stem)}
                      </button>
                    </td>
                    <td className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {q.section || "—"} / {q.topic || "—"}
                    </td>
                    <td className="mono text-[12px]">{q.counts?.total ?? 0}</td>
                    <td className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {fmtDate(q.checked_at)}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="admin-btn px-2.5"
                        onClick={() => {
                          setOverrideReason("");
                          setDetail({ kind: "question", row: q });
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="px-2 pb-3 pt-1">
          <div className="admin-scroll overflow-x-auto">
            <table className="admin-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Test</th>
                  <th>Questions</th>
                  <th>Publishable</th>
                  <th>Checked</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(rows as TRow[]).map((t) => (
                  <tr key={t.test_id} className="admin-row">
                    <td>{statusBadge(t.status)}</td>
                    <td className="max-w-[420px]">
                      <button
                        type="button"
                        className="text-left text-[12.5px] font-semibold leading-5 hover:underline"
                        onClick={() => {
                          setOverrideReason(t.override_reason ?? "");
                          setDetail({ kind: "test", row: t });
                        }}
                      >
                        {t.title}
                      </button>
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                        {t.published ? "Published" : "Draft"}
                        {t.override_reason ? " · override acknowledged" : ""}
                      </div>
                    </td>
                    <td className="mono text-[12px]">
                      {Object.entries(t.question_statuses ?? {})
                        .filter(([, n]) => n > 0)
                        .map(([s, n]) => `${s}:${n}`)
                        .join(" ")}
                    </td>
                    <td>
                      <Badge tone={t.eligible ? "green" : "red"}>{t.eligible ? "Yes" : "No"}</Badge>
                    </td>
                    <td className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {fmtDate(t.checked_at)}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="admin-btn px-2.5"
                        onClick={() => {
                          setOverrideReason(t.override_reason ?? "");
                          setDetail({ kind: "test", row: t });
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!detail}
        onClose={() => {
          if (!busy) setDetail(null);
        }}
        title={detail?.kind === "question" ? "Question QA detail" : "Test QA detail"}
        width="max-w-4xl"
      >
        {detail?.kind === "question" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(detail.row.status, detail.row.stale)}
              <Badge tone="neutral">{detail.row.kind || "general"}</Badge>
              <Badge tone="blue">{detail.row.section || "no section"}</Badge>
              <Badge tone="neutral">{detail.row.topic || "no topic"}</Badge>
              <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                checked {fmtDate(detail.row.checked_at)}
              </span>
            </div>
            <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-[13px] font-semibold leading-6">
                <MathText>{detail.row.stem}</MathText>
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--muted)" }}>
                Findings
              </h3>
              <Findings findings={detail.row.findings} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/admin/questions" className="admin-btn">
                Open question bank
              </Link>
              <button type="button" className="admin-btn admin-btn-primary" onClick={rerunQuestion} disabled={!!busy}>
                {busy === "question" ? <Icon name="refresh" size={14} /> : <Icon name="pulse" size={14} />}
                Rerun question QA
              </button>
            </div>
          </div>
        )}

        {detail?.kind === "test" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(detail.row.status)}
              <Badge tone={detail.row.published ? "green" : "neutral"}>{detail.row.published ? "Published" : "Draft"}</Badge>
              <Badge tone={detail.row.eligible ? "green" : "red"}>
                {detail.row.eligible ? "Publishable" : "Blocked"}
              </Badge>
              <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                checked {fmtDate(detail.row.checked_at)}
              </span>
            </div>
            <div>
              <h3 className="mb-2 text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--muted)" }}>
                Question status mix
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(detail.row.question_statuses ?? {}).map(([s, n]) => (
                  <Badge key={s} tone={STATUS_TONE[s as QaStatus] ?? "neutral"}>
                    {s}: {n}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--muted)" }}>
                Findings
              </h3>
              <Findings findings={detail.row.findings} />
            </div>
            {(detail.row.status === "NEEDS_REVIEW" || detail.row.override_reason) && !detail.row.published && (
              <Field label="Admin acknowledgement reason">
                <TextArea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why the review-level findings are acceptable for this paper. Stored in the QA audit trail."
                />
              </Field>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/admin/tests" className="admin-btn">
                Open mock tests
              </Link>
              <button type="button" className="admin-btn" onClick={rerunTest} disabled={!!busy}>
                {busy === "test" ? <Icon name="refresh" size={14} /> : <Icon name="pulse" size={14} />}
                Rerun test QA
              </button>
              {!detail.row.published && (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={publishTest}
                  disabled={!!busy || detail.row.status === "FAILED"}
                >
                  Publish
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
