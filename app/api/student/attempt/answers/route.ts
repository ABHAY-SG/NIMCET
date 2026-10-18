import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { activeIndexAt, partWindows, sanitizePicks, SECTION_GRACE_MS } from "@/lib/exam-session";
import { asParts, loadSession } from "@/lib/exam-finalize";
import { partRanges } from "@/lib/exam-parts";
import { templateParts } from "@/lib/nimcet-full-mock";

// POST /api/student/attempt/answers — { sessionId, index, answers }
//
// Autosaves one section's answer snapshot. Accepted only while that section is
// the active one and inside its window (+ a short network grace); submissions
// for a future or finished section are rejected with { expired } so the client
// can realign. The snapshot REPLACES the stored one — the last accepted state
// is what the final score is computed from.

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
    if (session.completed) {
      return NextResponse.json({ error: "This attempt is already finished.", finished: true }, { status: 409 });
    }

    const parts = templateParts();
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0 || index >= parts.length) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }

    const startedMs = Date.parse(session.started_at);
    const now = Date.now();
    const elapsed = Number.isFinite(startedMs) ? Math.max(0, now - startedMs) : 0;
    const active = activeIndexAt(parts, elapsed);

    const wins = partWindows(parts);
    if (index !== active || elapsed > wins[index].endMs + SECTION_GRACE_MS) {
      return NextResponse.json(
        { error: "That section is closed.", expired: true, activeIndex: active, serverNow: now },
        { status: 409 }
      );
    }

    const ranges = partRanges(parts);
    const ids = session.question_ids.slice(ranges[index].start, ranges[index].end);
    const picks = sanitizePicks(body.answers, new Set(ids), ids.length);
    if (picks === null) {
      return NextResponse.json({ error: "Invalid answers payload." }, { status: 400 });
    }

    const stored = asParts(session.parts);
    while (stored.length < parts.length) stored.push({ answers: [], lockedAt: null });
    stored[index] = { ...stored[index], answers: picks };

    const { data: updated, error: uErr } = await svc
      .from("mock_sessions")
      .update({ parts: stored, updated_at: new Date(now).toISOString() })
      .eq("id", session.id)
      .eq("completed", false)
      .select("id");
    if (uErr) throw uErr;
    if (!Array.isArray(updated) || updated.length === 0) {
      return NextResponse.json({ error: "This attempt is already finished.", finished: true }, { status: 409 });
    }

    return NextResponse.json({ ok: true, saved: picks.length, serverNow: now });
  } catch (e) {
    const p = errorPayload(e, "Could not save answers.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
