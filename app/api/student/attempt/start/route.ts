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
import { isFullMockTemplate, templateParts, templateSections } from "@/lib/nimcet-full-mock";
import { qaAccessForTest } from "@/lib/student-question-access";
import { loadQaAccess } from "@/lib/qa/server";

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
//
// CONCURRENCY: the database enforces at most one open session per
// (user_id, test_id) with the partial unique index added by migration 0008.
// Two simultaneous starts therefore cannot both win: the loser receives
// 23505 and returns the winner's session. This route NEVER marks another
// session completed — completion only happens through finalizeSession(),
// which records the attempt and releases the claim atomically.

const TEST_COLS = "id,title,exam,minutes,free,published,question_ids,template";
const MAX_START_ROUNDS = 3;

function errorCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

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
    const sections = templateSections();

    const openSession = async (): Promise<MockSessionRow | null> => {
      const { data, error } = await svc
        .from("mock_sessions")
        .select(SESSION_COLS)
        .eq("user_id", user.id)
        .eq("test_id", test.id)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as MockSessionRow | null;
    };

    let previous: { score: number; correct: number; wrong: number; skipped: number } | null = null;

    for (let round = 0; round < MAX_START_ROUNDS; round++) {
      const now = Date.now();
      const prior = await openSession();

      if (prior) {
        const startedMs = Date.parse(prior.started_at);
        const elapsed = Number.isFinite(startedMs) ? now - startedMs : Number.POSITIVE_INFINITY;
        if (elapsed >= 0 && elapsed < partsTotalMs(parts) + COMPLETE_GRACE_MS) {
          const index = activeIndexAt(parts, Math.max(0, elapsed));
          return NextResponse.json({
            sessionId: prior.id,
            resumed: true,
            parts,
            sections,
            index,
            section: sections.find((s) => s.part === index)?.key ?? null,
            remainingSec: Math.ceil(partRemainingMs(parts, Math.max(0, elapsed), index) / 1000),
            serverNow: now,
          });
        }
        // Window fully over — record whatever was saved before opening a new
        // run. finalizeSession() claims the row itself, so a concurrent
        // finalizer cannot double-record it.
        const fin = await finalizeSession(svc, prior);
        if (fin.recorded) {
          previous = {
            score: fin.result.score,
            correct: fin.result.correct,
            wrong: fin.result.wrong,
            skipped: fin.result.skipped,
          };
        }
        // Another request may have opened a fresh session in the meantime.
        continue;
      }

      const qa = await loadQaAccess(svc);
      const gate = qaAccessForTest(qa, test.id, Array.isArray(test.question_ids) ? test.question_ids : []);
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.reason }, { status: 403 });
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

      if (!cErr) {
        return NextResponse.json({
          sessionId: (created as { id: string }).id,
          resumed: false,
          parts,
          sections,
          index: 0,
          section: sections.find((s) => s.part === 0)?.key ?? null,
          remainingSec: parts[0].minutes * 60,
          serverNow: now,
          previous,
        });
      }

      // 23505 = the partial unique index rejected a second open session.
      // Someone else won the race; return their session on the next round.
      if (errorCode(cErr) !== "23505") throw cErr;
    }

    // Three consecutive races is pathological (or migration 0008 is missing
    // and duplicates are already present). Fail explicitly instead of
    // silently invalidating anyone's attempt.
    return NextResponse.json(
      { error: "Could not open the test right now — please retry in a moment." },
      { status: 409 }
    );
  } catch (e) {
    const p = errorPayload(e, "Could not start the test.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
