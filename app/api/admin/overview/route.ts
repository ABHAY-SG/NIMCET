import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import {
  buildMarksByTitle,
  countByDay,
  errorPayload,
  fetchAllAttempts,
  fetchAllQuestionsLite,
  fetchAllTests,
  fetchAllUsers,
  isWithinDays,
  lastNDayKeys,
  normTitle,
  pctOf,
  round1,
  scorePctBuckets,
} from "@/lib/admin-queries";

// GET /api/admin/overview — every number below is computed from real rows
// (Supabase Auth users, attempts, tests, questions). Nothing is estimated.
export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const [users, attempts, testsRes, questions] = await Promise.all([
      fetchAllUsers(svc),
      fetchAllAttempts(svc),
      fetchAllTests(svc),
      fetchAllQuestionsLite(svc),
    ]);
    const marks = buildMarksByTitle(testsRes.tests, questions);
    const dayKeys = lastNDayKeys(30);
    const in30 = attempts.filter((a) => isWithinDays(a.created_at, 30));
    const activeIds = new Set(in30.map((a) => a.user_id));
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    let pctSum = 0;
    let pctCnt = 0;
    for (const a of in30) {
      const p = pctOf(Number(a.score), marks.get(normTitle(a.test)));
      if (p !== null) {
        pctSum += p;
        pctCnt++;
      }
    }
    const dist = scorePctBuckets(in30, marks);

    const tableOk = async (t: string) => {
      try {
        const r = await svc.from(t).select("id", { count: "exact", head: true });
        return !r.error;
      } catch {
        return false;
      }
    };
    const bucketOk = async () => {
      try {
        const r = await svc.storage.getBucket("avatars");
        return !r.error;
      } catch {
        return false;
      }
    };

    const [feedbackOk, announcementsOk, auditOk, avatars] = await Promise.all([
      tableOk("feedback"),
      tableOk("announcements"),
      tableOk("admin_audit_log"),
      bucketOk(),
    ]);

    let unreadFeedback = 0;
    if (feedbackOk) {
      const { count, error } = await svc
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (!error) unreadFeedback = count ?? 0;
    }

    return NextResponse.json({
      students: {
        total: users.length,
        active30: users.filter((u) => isWithinDays(u.last_sign_in_at, 30) || activeIds.has(u.id)).length,
        new30: users.filter((u) => isWithinDays(u.created_at, 30)).length,
      },
      tests: {
        total: testsRes.tests.length,
        published: testsRes.tests.filter((t) => t.published).length,
        migrated: testsRes.migrated,
      },
      questions: { total: questions.length },
      attempts: {
        total: attempts.length,
        last30: in30.length,
        avgScore: in30.length
          ? round1(in30.reduce((s, a) => s + (Number(a.score) || 0), 0) / in30.length)
          : 0,
        avgPct: pctCnt ? round1(pctSum / pctCnt) : null,
        unmapped: in30.length - pctCnt,
      },
      feedback: { unread: unreadFeedback, available: feedbackOk },
      scoreDist: dist.slices,
      trends: {
        labels: dayKeys,
        registrations: countByDay(
          users.map((u) => u.created_at),
          dayKeys
        ),
        attempts: countByDay(
          in30.map((a) => a.created_at),
          dayKeys
        ),
      },
      recentAttempts: attempts.slice(0, 8).map((a) => ({
        id: a.id,
        email: emailById.get(a.user_id) ?? "",
        test: a.test,
        score: Number(a.score) || 0,
        created_at: a.created_at,
      })),
      recentTests: testsRes.tests.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        published: t.published,
        created_at: t.created_at,
        questions: t.question_ids.length,
      })),
      status: {
        feedback: feedbackOk,
        announcements: announcementsOk,
        auditLog: auditOk,
        avatars,
      },
    });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
