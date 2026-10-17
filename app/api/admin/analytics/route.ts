import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import {
  buildMarksByTitle,
  countByDay,
  dayKey,
  errorPayload,
  fetchAllAttempts,
  fetchAllQuestionsLite,
  fetchAllTests,
  fetchAllUsers,
  groupMean,
  groupSeries,
  isWithinDays,
  lastNDayKeys,
  normTitle,
  pctOf,
  round1,
  scorePctBuckets,
} from "@/lib/admin-queries";

const RANGES: readonly number[] = [7, 30, 90, 365];

// GET /api/admin/analytics?days=7|30|90|365 — everything is computed from real
// rows (Auth users, attempts, tests, questions). No estimated or synthetic
// values; attempts whose test cannot be matched are reported as `unmapped`
// instead of being folded into a fabricated bucket. Day bucketing is UTC.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const rawDays = Number(searchParams.get("days"));
    const days = RANGES.includes(rawDays) ? rawDays : 30;

    const [users, attempts, testsRes, questions] = await Promise.all([
      fetchAllUsers(svc),
      fetchAllAttempts(svc),
      fetchAllTests(svc),
      fetchAllQuestionsLite(svc),
    ]);
    const marks = buildMarksByTitle(testsRes.tests, questions);
    const dayKeys = lastNDayKeys(days);
    const inRange = attempts.filter((a) => isWithinDays(a.created_at, days));

    // ---- daily series ----
    const registrations = countByDay(users.map((u) => u.created_at), dayKeys);
    const attemptsDaily = countByDay(inRange.map((a) => a.created_at), dayKeys);

    const sumBy = new Map<string, number>();
    const cntBy = new Map<string, number>();
    for (const a of inRange) {
      const k = dayKey(a.created_at);
      sumBy.set(k, (sumBy.get(k) ?? 0) + (Number(a.score) || 0));
      cntBy.set(k, (cntBy.get(k) ?? 0) + 1);
    }
    const daySums = dayKeys.map((k) => sumBy.get(k) ?? 0);
    const dayCounts = dayKeys.map((k) => cntBy.get(k) ?? 0);

    const regChart = groupSeries(dayKeys, registrations, 60);
    const attChart = groupSeries(dayKeys, attemptsDaily, 60);
    const avgChart = groupMean(dayKeys, daySums, dayCounts, 60);

    // ---- summary ----
    let pctSum = 0;
    let pctCnt = 0;
    for (const a of inRange) {
      const p = pctOf(Number(a.score), marks.get(normTitle(a.test)));
      if (p !== null) {
        pctSum += p;
        pctCnt++;
      }
    }
    const dist = scorePctBuckets(inRange, marks);

    // ---- per-test comparison (id-keyed), capped at 50 rows ----
    const testsTable = testsRes.tests
      .map((t) => {
        const key = normTitle(t.title);
        const rel = inRange.filter((a) => normTitle(a.test) === key);
        const stats = marks.get(key);
        let ps = 0;
        let pc = 0;
        for (const a of rel) {
          const p = pctOf(Number(a.score), stats);
          if (p !== null) {
            ps += p;
            pc++;
          }
        }
        return {
          id: t.id,
          title: t.title,
          exam: t.exam,
          published: t.published,
          minutes: t.minutes,
          questions: t.question_ids.length,
          maxMarks: stats?.max ?? null,
          attempts: rel.length,
          students: new Set(rel.map((a) => a.user_id)).size,
          avg: rel.length ? round1(rel.reduce((s, a) => s + (Number(a.score) || 0), 0) / rel.length) : 0,
          avgPct: pc ? round1(ps / pc) : null,
        };
      })
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 50);

    // ---- question bank composition (real rows, read-only) ----
    const bySection = new Map<string, number>();
    for (const q of questions) {
      const label = q.section.trim() || "—";
      bySection.set(label, (bySection.get(label) ?? 0) + 1);
    }
    const sections = [...bySection.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
    const difficulties = ["Easy", "Medium", "Hard"].map((d) => ({
      label: d,
      value: questions.filter((q) => q.difficulty === d).length,
    }));

    return NextResponse.json({
      days,
      summary: {
        attempts: inRange.length,
        uniqueStudents: new Set(inRange.map((a) => a.user_id)).size,
        avgScore: inRange.length
          ? round1(inRange.reduce((s, a) => s + (Number(a.score) || 0), 0) / inRange.length)
          : 0,
        avgPct: pctCnt ? round1(pctSum / pctCnt) : null,
        mapped: dist.mapped,
        unmapped: dist.unmapped,
        newStudents: users.filter((u) => isWithinDays(u.created_at, days)).length,
        totalStudents: users.length,
        totalAttempts: attempts.length,
      },
      charts: {
        labels: attChart.labels,
        registrations: regChart.values,
        attempts: attChart.values,
        avgScore: avgChart.values,
      },
      scoreDist: dist.slices,
      testsTable,
      bank: { total: questions.length, sections, difficulties },
      migrated: testsRes.migrated,
    });
  } catch (e) {
    const p = errorPayload(e, "Analytics load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
