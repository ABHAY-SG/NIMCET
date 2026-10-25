import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { activeIndexAt, partRemainingMs, partWindows, SECTION_GRACE_MS } from "@/lib/exam-session";
import { asParts, fetchSafeQuestions, loadSession } from "@/lib/exam-finalize";
import { partRanges } from "@/lib/exam-parts";
import { sectionByKey, templateParts, templateSections } from "@/lib/nimcet-full-mock";

// POST /api/student/attempt/part — { sessionId, index }
//
// Serves one timed section's questions (answer-free) to its owner only, and
// only while that section is the active one:
//   - a future section is refused (no early access),
//   - a finished section is refused (no going back),
//   - an expired section returns { expired: true } so the client moves on.
// When the section is served, the student's clock is the SERVER's clock:
// both `serverNow` and `expiresAt` come from here.

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
    const sections = templateSections();
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0 || index >= parts.length) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }

    // Optional subject section. It must belong to the requested timed part;
    // a browser cannot ask for another part's subject through this window.
    const requestedSection = typeof body.section === "string" ? body.section.trim() : "";
    const section = requestedSection ? sectionByKey(requestedSection) : null;
    if (requestedSection && (!section || section.part !== index)) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }

    const startedMs = Date.parse(session.started_at);
    const now = Date.now();
    const elapsed = Number.isFinite(startedMs) ? Math.max(0, now - startedMs) : 0;
    const active = activeIndexAt(parts, elapsed);

    if (index > active) {
      return NextResponse.json(
        { error: "That section hasn't started yet.", activeIndex: active, serverNow: now },
        { status: 409 }
      );
    }
    if (index < active) {
      return NextResponse.json(
        { error: "That section is over — you can't return to it.", activeIndex: active, serverNow: now },
        { status: 409 }
      );
    }

    const wins = partWindows(parts);
    if (elapsed > wins[index].endMs + SECTION_GRACE_MS) {
      // Race with the clock: the section just ran out. Tell the client to move on.
      return NextResponse.json(
        { expired: true, index, activeIndex: activeIndexAt(parts, elapsed), serverNow: now }
      );
    }

    const ranges = partRanges(parts);
    const ids = section
      ? session.question_ids.slice(section.start, Math.min(section.end, session.question_ids.length))
      : session.question_ids.slice(ranges[index].start, ranges[index].end);
    const questions = await fetchSafeQuestions(svc, ids);
    // Stored snapshot for this timed part — filtered to the requested subject
    // so the browser never receives another section's answers or questions.
    const allowed = new Set(ids);
    const picks = (asParts(session.parts)[index]?.answers ?? []).filter((p) => allowed.has(p.id));

    return NextResponse.json({
      index,
      section: section?.key ?? null,
      label: section?.label ?? parts[index].label,
      partLabel: parts[index].label,
      sections,
      questions,
      picks,
      remainingSec: Math.ceil(partRemainingMs(parts, elapsed, index) / 1000),
      expiresAt: startedMs + wins[index].endMs,
      serverNow: now,
    });
  } catch (e) {
    const p = errorPayload(e, "Could not load the section.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
