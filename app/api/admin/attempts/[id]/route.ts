import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import {
  buildMarksByTitle,
  errorPayload,
  fetchAllQuestionsLite,
  fetchAllTests,
  normTitle,
  round1,
} from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

type AttemptRow = {
  id: string;
  user_id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

// GET /api/admin/attempts/[id] — one attempt with the student's email and the
// matched test's real mark range (sum of plus/minus of its questions).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const [attemptRes, testsRes, questions] = await Promise.all([
      svc.from("attempts").select("*").eq("id", id).maybeSingle(),
      fetchAllTests(svc),
      fetchAllQuestionsLite(svc),
    ]);
    if (attemptRes.error) throw attemptRes.error;
    const a = attemptRes.data as AttemptRow | null;
    if (!a) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });

    const userRes = await svc.auth.admin.getUserById(a.user_id);
    const stats = buildMarksByTitle(testsRes.tests, questions).get(normTitle(a.test)) ?? null;

    return NextResponse.json({
      attempt: { ...a, score: Number(a.score) || 0 },
      email: userRes.error ? "" : (userRes.data.user?.email ?? ""),
      stats: stats ? { max: stats.max, min: stats.min, count: stats.count } : null,
    });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// PUT /api/admin/attempts/[id] — audited score correction. Validated against
// the test's real mark range when the test is matched; a reason is mandatory
// and the before/after values are written to the audit log.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const body = (await req.json()) as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 500) {
      return NextResponse.json({ error: "A correction reason (3–500 characters) is required." }, { status: 400 });
    }

    const score = Number(body.score);
    if (!Number.isFinite(score)) {
      return NextResponse.json({ error: "Score must be a number." }, { status: 400 });
    }
    const int = (v: unknown, field: string): number | string => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 500) return `${field} must be a whole number between 0 and 500.`;
      return n;
    };
    const correct = int(body.correct, "Correct count");
    if (typeof correct === "string") return NextResponse.json({ error: correct }, { status: 400 });
    const wrong = int(body.wrong, "Wrong count");
    if (typeof wrong === "string") return NextResponse.json({ error: wrong }, { status: 400 });
    const skipped = int(body.skipped, "Skipped count");
    if (typeof skipped === "string") return NextResponse.json({ error: skipped }, { status: 400 });

    const [attemptRes, testsRes, questions] = await Promise.all([
      svc.from("attempts").select("*").eq("id", id).maybeSingle(),
      fetchAllTests(svc),
      fetchAllQuestionsLite(svc),
    ]);
    if (attemptRes.error) throw attemptRes.error;
    const a = attemptRes.data as AttemptRow | null;
    if (!a) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });

    const stats = buildMarksByTitle(testsRes.tests, questions).get(normTitle(a.test)) ?? null;
    const rounded = round1(score);
    if (stats) {
      if (rounded < stats.min - 0.01 || rounded > stats.max + 0.01) {
        return NextResponse.json(
          {
            error: `Score must be between ${stats.min} and ${stats.max} for “${a.test}” (sum of the test's minus/plus marks).`,
          },
          { status: 400 }
        );
      }
      if (correct + wrong + skipped > stats.count) {
        return NextResponse.json(
          { error: `Correct + wrong + skipped cannot exceed the test's ${stats.count} question(s).` },
          { status: 400 }
        );
      }
    } else if (rounded < -1000 || rounded > 10000) {
      return NextResponse.json({ error: "Score must be between -1000 and 10000." }, { status: 400 });
    }

    const { error } = await svc
      .from("attempts")
      .update({ score: rounded, correct, wrong, skipped })
      .eq("id", id);
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "attempt.correct",
      entity: "attempt",
      entityId: id,
      details: {
        test: a.test,
        reason,
        before: { score: Number(a.score) || 0, correct: a.correct, wrong: a.wrong, skipped: a.skipped },
        after: { score: rounded, correct, wrong, skipped },
        matchedMarks: stats ? { min: stats.min, max: stats.max } : null,
      },
    });

    return NextResponse.json({ ok: true, score: rounded });
  } catch (e) {
    const p = errorPayload(e, "Correction failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
