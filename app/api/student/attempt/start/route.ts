import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { activeIndexAt, COMPLETE_GRACE_MS, partRemainingMs, partsTotalMs } from "@/lib/exam-session";
import {
  blankParts,
  finalizeSession,
  SESSION_COLS,
  type MockSessionRow,
} from "@/lib/exam-finalize";
import { isFullMockTemplate, templateParts } from "@/lib/nimcet-full-mock";

// POST /api/student/attempt/start — { testId }
//
// Opens (or resumes) a server-side exam session for a published NIMCET
// full-mock. The SERVER owns the clock: started_at is recorded here, every
// later part fetch / answer save / completion is judged against it.
//
// Resume rules:
//   - an unfinished session still inside its 120-minute window is returned
//     as-is (refresh-safe, same part, same remaining time);
//   - an unfinished session whose window has fully passed is scored and
//     recorded right away (abandoned attempts never silently vanish), then a
//     fresh session is opened so the student can genuinely retake the paper.

const TEST_COLS = "id,title,exam,minutes,free,published,question_ids,template";

export async function POST(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const testId = typeof body.testId === "string" ? body.testId.trim() : "";
    if (!isUuid(testId)) return NextResponse.json({ error: "Invalid test id." }, { status: 400 });

    const { data: rawTest, error: tErr } = await svc.from("tests").select(TEST_COLS).eq("id", testId).maybeSingle();
    if (tErr) throw tErr;
    if (!rawTest) return NextResponse.json({ error: "Test not found." }, { status: 404 });
    const test = rawTest as {
      id: string;
      title: string;
      published: boolean;
      question_ids: string[] | null;
      template: string;
    };
    if (!test.published) {
      return NextResponse.json({ error: "This test is not published yet." }, { status: 403 });
    }
    if (!isFullMockTemplate(test.template)) {
      return NextResponse.json(
        { error: "This test is not a template exam — open it from the mock list instead." },
        { status: 400 }
      );
    }

    const parts = templateParts();
    const now = Date.now();

    const { data: priorRows, error: pErr } = await svc
      .from("mock_sessions")
      .select(SESSION_COLS)
      .eq("user_id", user.id)
      .eq("test_id", test.id)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (pErr) throw pErr;

    const prior = ((priorRows ?? [])[0] ?? null) as MockSessionRow | null;
    let previous: { score: number; correct: number; wrong: number; skipped: number } | null = null;

    if (prior) {
      const startedMs = Date.parse(prior.started_at);
      const elapsed = Number.isFinite(startedMs) ? now - startedMs : Number.POSITIVE_INFINITY;
      if (elapsed >= 0 && elapsed < partsTotalMs(parts) + COMPLETE_GRACE_MS) {
        const index = activeIndexAt(parts, Math.max(0, elapsed));
        return NextResponse.json({
          sessionId: prior.id,
          resumed: true,
          parts,
          index,
          remainingSec: Math.ceil(partRemainingMs(parts, Math.max(0, elapsed), index) / 1000),
          serverNow: now,
        });
      }
      // Window fully over — record whatever was saved before opening a new run.
      const fin = await finalizeSession(svc, prior);
      if (fin.recorded) {
        previous = {
          score: fin.result.score,
          correct: fin.result.correct,
          wrong: fin.result.wrong,
          skipped: fin.result.skipped,
        };
      }
    }

    const { data: created, error: cErr } = await svc
      .from("mock_sessions")
      .insert({
        user_id: user.id,
        test_id: test.id,
        test_title: test.title,
        template: test.template,
        question_ids: Array.isArray(test.question_ids) ? test.question_ids : [],
        parts: blankParts(parts.length),
        started_at: new Date(now).toISOString(),
      })
      .select("id")
      .single();
    if (cErr) throw cErr;

    // Keep at most one open session per (user, test) — retire any strays left
    // by crashed parallel starts. Best-effort; never fails the request.
    try {
      await svc
        .from("mock_sessions")
        .update({ completed: true, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("test_id", test.id)
        .eq("completed", false)
        .neq("id", (created as { id: string }).id);
    } catch {}

    return NextResponse.json({
      sessionId: (created as { id: string }).id,
      resumed: false,
      parts,
      index: 0,
      remainingSec: parts[0].minutes * 60,
      serverNow: now,
      previous,
    });
  } catch (e) {
    const p = errorPayload(e, "Could not start the test.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
