import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { partsTotalMs } from "@/lib/exam-session";
import { buildResult, finalizeSession, loadSession } from "@/lib/exam-finalize";
import { templateParts } from "@/lib/nimcet-full-mock";

// POST /api/student/attempt/complete — { sessionId }
//
// Ends a template exam and returns the authoritative result: total score out
// of 1000, subject-wise breakdown, correct / wrong / skipped counts and every
// question's solution, all computed from the answer snapshots the server
// accepted during the live windows.
//
// Callable once the clock has run out (small slack for network/rounding).
// Calling it again is safe: a completed session is re-scored from its stored
// snapshots and never inserts a second attempt row.

export async function POST(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!isUuid(sessionId)) return NextResponse.json({ error: "Invalid session." }, { status: 400 });

    const session = await loadSession(svc, sessionId);
    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const parts = templateParts();
    const now = Date.now();

    if (!session.completed) {
      const startedMs = Date.parse(session.started_at);
      const elapsed = Number.isFinite(startedMs) ? now - startedMs : 0;
      if (elapsed < partsTotalMs(parts) - 3_000) {
        return NextResponse.json(
          {
            error: "The exam is still running — results appear when the final part ends.",
            remainingSec: Math.ceil((partsTotalMs(parts) - elapsed) / 1000),
            serverNow: now,
          },
          { status: 409 }
        );
      }
    }

    const { result, recorded } = session.completed
      ? { result: await buildResult(svc, session), recorded: session.attempt_id !== null }
      : await finalizeSession(svc, session);

    return NextResponse.json({ result, recorded, serverNow: now });
  } catch (e) {
    const p = errorPayload(e, "Could not finish the attempt.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
