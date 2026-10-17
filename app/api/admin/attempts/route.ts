import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import {
  buildMarksByTitle,
  errorPayload,
  fetchAllAttempts,
  fetchAllQuestionsLite,
  fetchAllTests,
  fetchAllUsers,
  normTitle,
  pctOf,
  toCsv,
} from "@/lib/admin-queries";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/attempts — filtered, paginated result history with student
// emails (admin-only), real percentage vs. the test's max marks where the
// test can still be matched, and CSV export via ?format=csv.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const test = (searchParams.get("test") || "").trim();
    const userId = (searchParams.get("user") || "").trim();
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();
    const sort = searchParams.get("sort") || "newest";
    const format = searchParams.get("format") || "";
    const page = toNum(searchParams.get("page"), 1, 1, 100000);
    const per = toNum(searchParams.get("per"), 20, 5, 100);

    const [attempts, users, testsRes, questions] = await Promise.all([
      fetchAllAttempts(svc),
      fetchAllUsers(svc),
      fetchAllTests(svc),
      fetchAllQuestionsLite(svc),
    ]);
    const marks = buildMarksByTitle(testsRes.tests, questions);
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const facet = new Map<string, number>();
    for (const a of attempts) facet.set(a.test, (facet.get(a.test) ?? 0) + 1);
    const tests = [...facet.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);

    const fromTs = from ? Date.parse(`${from}T00:00:00Z`) : NaN;
    const toTs = to ? Date.parse(`${to}T23:59:59Z`) : NaN;

    let rows = attempts;
    if (test && test !== "all") rows = rows.filter((a) => a.test === test);
    if (userId) rows = rows.filter((a) => a.user_id === userId);
    if (Number.isFinite(fromTs)) rows = rows.filter((a) => Date.parse(a.created_at) >= fromTs);
    if (Number.isFinite(toTs)) rows = rows.filter((a) => Date.parse(a.created_at) <= toTs);
    if (q) {
      rows = rows.filter((a) =>
        `${a.test} ${emailById.get(a.user_id) ?? ""}`.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "oldest":
        rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "score_high":
        rows.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
        break;
      case "score_low":
        rows.sort((a, b) => (Number(a.score) || 0) - (Number(b.score) || 0));
        break;
      default:
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    const enriched = rows.map((a) => {
      const stats = marks.get(normTitle(a.test));
      const score = Number(a.score) || 0;
      return {
        id: a.id,
        user_id: a.user_id,
        email: emailById.get(a.user_id) ?? "",
        test: a.test,
        score,
        correct: a.correct,
        wrong: a.wrong,
        skipped: a.skipped,
        created_at: a.created_at,
        pct: pctOf(score, stats),
        maxMarks: stats?.max ?? null,
      };
    });

    if (format === "csv") {
      const capped = enriched.slice(0, 10000);
      const csv = toCsv(
        ["id", "student_email", "user_id", "test", "score", "max_marks", "pct", "correct", "wrong", "skipped", "created_at"],
        capped.map((r) => [
          r.id,
          r.email,
          r.user_id,
          r.test,
          r.score,
          r.maxMarks,
          r.pct,
          r.correct,
          r.wrong,
          r.skipped,
          r.created_at,
        ])
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attempts-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const total = enriched.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * per;

    return NextResponse.json({
      total,
      page: safePage,
      per,
      pages,
      rows: enriched.slice(start, start + per),
      tests,
      migrated: testsRes.migrated,
    });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
