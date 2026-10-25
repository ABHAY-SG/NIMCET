import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { activeIndexAt, partWindows, sanitizePicks, SECTION_GRACE_MS } from "@/lib/exam-session";
import { asParts, loadSession } from "@/lib/exam-finalize";
import { partRanges } from "@/lib/exam-parts";
import { sectionByKey, templateParts } from "@/lib/nimcet-full-mock";

// POST /api/student/attempt/answers — { sessionId, index, section?, answers }
//
// Autosaves one subject section's answer snapshot. Accepted only while that
// section's timed part is active and inside its window (+ a short network
// grace); submissions for a future or finished part are rejected with
// { expired } so the client can realign. When a section is supplied, only that
// subject's picks are replaced, so saving English cannot erase Computer
// Awareness answers inside Part III. Without a section (legacy clients), the
// whole timed-part snapshot is replaced as before.

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

    const requestedSection = typeof body.section === "string" ? body.section.trim() : "";
    const section = requestedSection ? sectionByKey(requestedSection) : null;
    if (requestedSection && (!section || section.part !== index)) {
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
    const ids = section
      ? session.question_ids.slice(section.start, Math.min(section.end, session.question_ids.length))
      : session.question_ids.slice(ranges[index].start, ranges[index].end);
    const picks = sanitizePicks(body.answers, new Set(ids), ids.length);
    if (picks === null) {
      return NextResponse.json({ error: "Invalid answers payload." }, { status: 400 });
    }

    const stored = asParts(session.parts);
    while (stored.length < parts.length) stored.push({ answers: [], lockedAt: null });
    if (section) {
      // Save one subject at a time. Keeping the other subjects' picks means
      // switching between Computer Awareness and English inside Part III can
      // never erase the answers saved for the other subject.
      const allowed = new Set(ids);
      const kept = (stored[index]?.answers ?? []).filter((p) => !allowed.has(p.id));
      stored[index] = { ...stored[index], answers: [...kept, ...picks] };
    } else {
      // Legacy/full-part save: the snapshot replaces the whole timed part.
      stored[index] = { ...stored[index], answers: picks };
    }

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

    return NextResponse.json({ ok: true, saved: picks.length, section: section?.key ?? null, serverNow: now });
  } catch (e) {
    const p = errorPayload(e, "Could not save answers.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
