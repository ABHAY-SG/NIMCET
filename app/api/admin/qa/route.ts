import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fullMockIssues, isUuid } from "@/lib/admin-queries";
import {
  auditQuestionBank,
  auditTests,
  compositionFindings,
  evaluateTestForPublish,
  listQaQuestions,
  listQaTests,
  loadQaSummary,
  loadTestRecord,
  recordQaReview,
  validateAndPersistQuestion,
} from "@/lib/qa/server";
import type { QaStatus } from "@/lib/qa/types";

const STATUSES: QaStatus[] = ["PASS", "WARNING", "FAILED", "NEEDS_REVIEW"];

function intParam(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function bodyInt(v: unknown, fallback: number, min: number, max: number): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/qa — QA dashboard reads.
//   ?view=summary                   default: counts + recent findings
//   ?view=questions&status=&limit=  question-level states, newest first
//   ?view=tests&status=&limit=      test-level states, newest first
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "summary";
    const limit = intParam(searchParams.get("limit"), 100, 1, 500);
    const offset = intParam(searchParams.get("offset"), 0, 0, 100000);
    const rawStatus = searchParams.get("status") || "";

    if (view === "questions") {
      const status = STATUSES.includes(rawStatus as QaStatus)
        ? (rawStatus as QaStatus)
        : rawStatus === "stale"
          ? "stale"
          : undefined;
      return NextResponse.json({
        rows: await listQaQuestions(svc, { status, limit, offset }),
        total: await loadQaSummary(svc).then((s) => s.questions.total),
      });
    }
    if (view === "tests") {
      const status = STATUSES.includes(rawStatus as QaStatus) ? (rawStatus as QaStatus) : undefined;
      return NextResponse.json({
        rows: await listQaTests(svc, { status, limit, offset }),
        total: await loadQaSummary(svc).then((s) => s.tests.total),
      });
    }
    return NextResponse.json(await loadQaSummary(svc));
  } catch (e) {
    const p = errorPayload(e, "QA dashboard load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// POST /api/admin/qa — explicit validation / audit actions.
//   { action: "validate-question", id }
//   { action: "validate-test", id, qa_override_reason? }
//   { action: "audit-questions", limit?, offset? }
//   { action: "audit-tests", limit? }
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "validate-question") {
      const id = String(body.id ?? "");
      if (!isUuid(id)) return NextResponse.json({ error: "Invalid question id." }, { status: 400 });
      const checked = await validateAndPersistQuestion(svc, id);
      if (!checked) return NextResponse.json({ error: "Question not found." }, { status: 404 });
      await recordQaReview(svc, {
        actorId: actor.id,
        questionId: id,
        action: "validate",
        findings: checked.result.findings,
      });
      return NextResponse.json({ qa: checked.result });
    }

    if (action === "validate-test") {
      const id = String(body.id ?? "");
      if (!isUuid(id)) return NextResponse.json({ error: "Invalid test id." }, { status: 400 });
      const test = await loadTestRecord(svc, id);
      if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 });
      const overrideReason =
        typeof body.qa_override_reason === "string" ? body.qa_override_reason.trim() : "";
      const ids = Array.isArray(test.question_ids) ? test.question_ids.map(String) : [];
      const extraFindings =
        String(test.template ?? "") === "nimcet-2026"
          ? compositionFindings(await fullMockIssues(svc, ids))
          : [];
      const checked = await evaluateTestForPublish(svc, id, {
        extraFindings,
        overrideReason: overrideReason || undefined,
      });
      if (!checked) return NextResponse.json({ error: "Test not found." }, { status: 404 });
      await recordQaReview(svc, {
        actorId: actor.id,
        testId: id,
        action: overrideReason ? "override" : "validate",
        reason: overrideReason || null,
        findings: checked.result.findings,
      });
      return NextResponse.json({ qa: checked.result });
    }

    if (action === "audit-questions") {
      const summary = await auditQuestionBank(svc, {
        limit: bodyInt(body.limit, 200, 1, 2000),
        offset: bodyInt(body.offset, 0, 0, 100000),
      });
      await recordQaReview(svc, { actorId: actor.id, action: "audit" });
      return NextResponse.json({ summary });
    }

    if (action === "audit-tests") {
      const summary = await auditTests(svc, {
        limit: bodyInt(body.limit, 100, 1, 1000),
      });
      await recordQaReview(svc, { actorId: actor.id, action: "audit" });
      return NextResponse.json({ summary });
    }

    return NextResponse.json({ error: "Unknown QA action." }, { status: 400 });
  } catch (e) {
    const p = errorPayload(e, "QA action failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
