import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import {
  buildMarksByTitle,
  errorPayload,
  fetchAllQuestionsLite,
  fetchAllTests,
  fullMockIssues,
  fullMockIssueText,
  normalizeFullMockIds,
  normTitle,
  toCsv,
} from "@/lib/admin-queries";
import { FULL_MOCK_MINUTES, FULL_MOCK_TEMPLATE, isFullMockTemplate, templateParts } from "@/lib/nimcet-full-mock";
import { logAdminAction } from "@/lib/audit";
import {
  compositionFindings,
  evaluateTestForPublish,
  qaBlockedMessage,
  recordQaReview,
} from "@/lib/qa/server";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function validate(body: Record<string, unknown>): string | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (body.title !== undefined && !s(body.title).trim()) return "Title is required.";
  if (body.title !== undefined && s(body.title).length > 160) return "Title must be under 160 characters.";
  if (body.minutes !== undefined) {
    const m = Number(body.minutes);
    if (!Number.isFinite(m) || m < 5 || m > 180) return "Duration must be 5–180 minutes.";
  }
  if (body.question_ids !== undefined) {
    const ids = Array.isArray(body.question_ids) ? body.question_ids : [];
    if (ids.length === 0) return "Pick at least one question.";
    if (ids.some((id) => typeof id !== "string" || !id.trim())) return "Invalid question reference.";
    if (ids.length > 200) return "A test can hold up to 200 questions.";
  }
  if (body.description !== undefined && s(body.description).length > 4000) {
    return "Description must be under 4000 characters.";
  }
  if (body.instructions !== undefined && s(body.instructions).length > 8000) {
    return "Instructions must be under 8000 characters.";
  }
  for (const k of ["free", "published"] as const) {
    if (body[k] !== undefined && typeof body[k] !== "boolean") return `${k} must be true or false.`;
  }
  if (body.template !== undefined && !(body.template === "" || isFullMockTemplate(body.template))) {
    return "Unknown test template.";
  }
  return null;
}

// GET /api/admin/tests?q=&published=&exam=&sort=&format=csv — with derived
// question counts and real max/min marks (sum of the assigned questions'
// plus/minus values; nothing is stored twice).
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const published = searchParams.get("published") || "all";
    const exam = (searchParams.get("exam") || "").trim();
    const sort = searchParams.get("sort") || "newest";
    const format = searchParams.get("format") || "";
    const limit = toNum(searchParams.get("limit"), 500, 1, 1000);

    const [{ tests, migrated, templated }, questions] = await Promise.all([
      fetchAllTests(svc, 1000),
      fetchAllQuestionsLite(svc),
    ]);
    const marks = buildMarksByTitle(tests, questions);

    let rows = tests;
    if (q) rows = rows.filter((t) => `${t.title} ${t.tag} ${t.exam}`.toLowerCase().includes(q));
    if (published === "true") rows = rows.filter((t) => t.published);
    if (published === "false") rows = rows.filter((t) => !t.published);
    if (exam && exam !== "all") rows = rows.filter((t) => t.exam === exam);

    switch (sort) {
      case "oldest":
        rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "title":
        rows.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "minutes":
        rows.sort((a, b) => b.minutes - a.minutes);
        break;
      default:
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    const enriched = rows.slice(0, limit).map((t) => {
      const stats = marks.get(normTitle(t.title));
      return {
        ...t,
        questionCount: t.question_ids.length,
        maxMarks: stats?.max ?? 0,
        minMarks: stats?.min ?? 0,
      };
    });

    if (format === "csv") {
      const csv = toCsv(
        ["id", "exam", "title", "tag", "minutes", "free", "published", "template", "questions", "max_marks", "min_marks", "description", "instructions", "question_ids", "created_at"],
        enriched.map((t) => [
          t.id,
          t.exam,
          t.title,
          t.tag,
          t.minutes,
          t.free,
          t.published,
          t.template,
          t.questionCount,
          t.maxMarks,
          t.minMarks,
          t.description,
          t.instructions,
          t.question_ids.join(";"),
          t.created_at,
        ])
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tests-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const exams = [...new Set(tests.map((t) => t.exam))].sort();
    return NextResponse.json({ rows: enriched, total: rows.length, exams, migrated, templated });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// POST /api/admin/tests — create. Starts usable; publish flag explicit.
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title || !(body.title as string).toString().trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    const bad = validate(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    // A test without questions would be unusable and break scoring later.
    const ids = Array.isArray(body.question_ids) ? (body.question_ids as string[]) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Pick at least one question for this test." }, { status: 400 });
    }
    const s = (v: unknown, d = "") => (typeof v === "string" ? v.trim() : d);
    const template = isFullMockTemplate(body.template) ? FULL_MOCK_TEMPLATE : "";

    const description = s(body.description);
    const instructions = s(body.instructions);
    let migrated = true;
    let templated = true;
    if (description || instructions || template) {
      const info = await fetchAllTests(svc, 1);
      migrated = info.migrated;
      templated = info.templated;
      if (!migrated) {
        return NextResponse.json(
          { error: "The database is missing the new test columns. Run supabase/migrations/0005_admin.sql, then retry." },
          { status: 503 }
        );
      }
      if (template && !templated) {
        return NextResponse.json(
          { error: "The database is missing the template column. Run supabase/migrations/0007_full_mock.sql, then retry." },
          { status: 503 }
        );
      }
    }

    const insert: Record<string, unknown> = {
      exam: s(body.exam) || "nimcet",
      title: s(body.title),
      tag: s(body.tag),
      minutes: body.minutes === undefined ? 30 : Number(body.minutes),
      free: body.free === undefined ? true : Boolean(body.free),
      // Always create as a draft: the QA state must exist before the DB
      // publish trigger can approve a published row. It is flipped below.
      published: false,
      question_ids: ids,
    };
    if (migrated) {
      insert.description = description;
      insert.instructions = instructions;
    }
    if (template) {
      // Template tests are governed by the template: fixed 120-minute paper
      // split into the official timed parts, questions stored in the official
      // subject order (the runner slices the list by position), and a
      // published full mock must already be structurally complete.
      insert.template = template;
      insert.minutes = FULL_MOCK_MINUTES;
      insert.sections = templateParts();
      const ordered = await normalizeFullMockIds(svc, ids);
      insert.question_ids = ordered;
      if (body.published === true) {
        const issues = await fullMockIssues(svc, ordered);
        if (issues.length > 0) {
          return NextResponse.json({ error: fullMockIssueText(issues) }, { status: 400 });
        }
      }
    }

    const { data, error } = await svc.from("tests").insert(insert).select("id").single();
    if (error) throw error;
    const id = (data as { id: string }).id;

    const requestedPublish = body.published === true;
    const overrideReason = typeof body.qa_override_reason === "string" ? body.qa_override_reason.trim() : "";
    let checked: Awaited<ReturnType<typeof evaluateTestForPublish>> = null;
    try {
      const extraFindings = template
        ? compositionFindings(await fullMockIssues(svc, insert.question_ids as string[]))
        : [];
      checked = await evaluateTestForPublish(svc, id, {
        extraFindings,
        overrideReason: overrideReason || undefined,
      });
    } catch (e) {
      await svc.from("tests").delete().eq("id", id);
      throw e;
    }

    if (requestedPublish) {
      if (!checked || !checked.result.eligible) {
        await recordQaReview(svc, {
          actorId: actor.id,
          testId: id,
          action: "publish_blocked",
          reason: overrideReason || null,
          findings: checked?.result.findings ?? [],
        });
        await svc.from("tests").delete().eq("id", id);
        return NextResponse.json(
          {
            error: `Publishing blocked. ${qaBlockedMessage(checked?.result)}`,
            qa: checked?.result ?? null,
          },
          { status: 400 }
        );
      }
      const { error: publishErr } = await svc.from("tests").update({ published: true }).eq("id", id);
      if (publishErr) {
        await svc.from("tests").delete().eq("id", id);
        throw publishErr;
      }
      if (overrideReason) {
        await recordQaReview(svc, {
          actorId: actor.id,
          testId: id,
          action: "override",
          reason: overrideReason,
          findings: checked.result.findings,
        });
      }
    }

    await logAdminAction(svc, {
      actor,
      action: "test.create",
      entity: "test",
      entityId: id,
      details: {
        title: s(body.title),
        questions: (insert.question_ids as string[] | undefined)?.length ?? 0,
        published: requestedPublish,
        ...(template ? { template } : {}),
      },
    });

    return NextResponse.json({ id, published: requestedPublish, qa: checked?.result ?? null });
  } catch (e) {
    const p = errorPayload(e, "Create failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
