import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import {
  buildMarksByTitle,
  errorPayload,
  fetchAllQuestionsLite,
  fetchAllTests,
  normTitle,
  pctOf,
  round1,
} from "@/lib/admin-queries";
import type { AttemptLite } from "@/lib/admin-queries";

// GET /api/admin/students/[id] — one student's real profile + attempt history.
// Admin-only. Exposes only display/profile fields and attempt stats; never
// tokens, encrypted data or auth internals.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing student id." }, { status: 400 });

    const [userRes, attemptsRes, testsRes, questions] = await Promise.all([
      svc.auth.admin.getUserById(id),
      svc
        .from("attempts")
        .select("id,user_id,test,score,correct,wrong,skipped,created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(500),
      fetchAllTests(svc),
      fetchAllQuestionsLite(svc),
    ]);
    if (userRes.error) throw userRes.error;
    const u = userRes.data.user;
    if (!u) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    if (attemptsRes.error) throw attemptsRes.error;

    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const first = str(meta.first_name);
    const last = str(meta.last_name);
    const bannedUntil = (u as { banned_until?: string | null }).banned_until ?? null;

    const marks = buildMarksByTitle(testsRes.tests, questions);
    const attempts = (attemptsRes.data ?? []) as AttemptLite[];

    let sum = 0;
    let best = -Infinity;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let pctSum = 0;
    let pctCount = 0;
    const rows = attempts.map((a) => {
      const score = Number(a.score) || 0;
      sum += score;
      if (score > best) best = score;
      correct += a.correct;
      wrong += a.wrong;
      skipped += a.skipped;
      const stats = marks.get(normTitle(a.test));
      const pct = pctOf(score, stats);
      if (pct !== null) {
        pctSum += pct;
        pctCount++;
      }
      return { ...a, score, pct, maxMarks: stats?.max ?? null };
    });
    const answered = correct + wrong;

    return NextResponse.json({
      user: {
        id: u.id,
        email: u.email ?? "",
        first_name: first,
        last_name: last,
        dob: str(meta.dob),
        gender: str(meta.gender),
        custom_avatar: str(meta.custom_avatar),
        created_at: u.created_at ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        provider: (u.app_metadata?.provider as string | undefined) ?? "",
        disabled: !!bannedUntil && Date.parse(bannedUntil) > Date.now(),
      },
      attempts: rows,
      summary: {
        attempts: attempts.length,
        avg: attempts.length ? round1(sum / attempts.length) : 0,
        best: attempts.length ? best : 0,
        correct,
        wrong,
        skipped,
        accuracy: answered > 0 ? round1((correct / answered) * 100) : null,
        avgPct: pctCount > 0 ? round1(pctSum / pctCount) : null,
        unmapped: attempts.length - pctCount,
      },
      migrated: testsRes.migrated,
    });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
