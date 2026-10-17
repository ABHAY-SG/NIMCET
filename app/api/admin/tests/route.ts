import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import {
  buildMarksByTitle,
  errorPayload,
  fetchAllQuestionsLite,
  fetchAllTests,
  normTitle,
  toCsv,
} from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

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

    const [{ tests, migrated }, questions] = await Promise.all([
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
        ["id", "exam", "title", "tag", "minutes", "free", "published", "questions", "max_marks", "min_marks", "description", "instructions", "question_ids", "created_at"],
        enriched.map((t) => [
          t.id,
          t.exam,
          t.title,
          t.tag,
          t.minutes,
          t.free,
          t.published,
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
    return NextResponse.json({ rows: enriched, total: rows.length, exams, migrated });
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

    const description = s(body.description);
    const instructions = s(body.instructions);
    let migrated = true;
    if (description || instructions) {
      migrated = (await fetchAllTests(svc, 1)).migrated;
      if (!migrated) {
        return NextResponse.json(
          { error: "The database is missing the new test columns. Run supabase/migrations/0005_admin.sql, then retry." },
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
      published: body.published === undefined ? false : Boolean(body.published),
      question_ids: ids,
    };
    if (migrated) {
      insert.description = description;
      insert.instructions = instructions;
    }

    const { data, error } = await svc.from("tests").insert(insert).select("id").single();
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "test.create",
      entity: "test",
      entityId: (data as { id: string }).id,
      details: { title: s(body.title), questions: (body.question_ids as string[] | undefined)?.length ?? 0, published: insert.published as boolean },
    });

    return NextResponse.json({ id: (data as { id: string }).id });
  } catch (e) {
    const p = errorPayload(e, "Create failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
