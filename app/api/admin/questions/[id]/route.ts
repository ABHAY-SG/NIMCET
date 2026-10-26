import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";
import { validateAndPersistQuestion } from "@/lib/qa/server";

const DIFFS = ["Easy", "Medium", "Hard"];

function validate(body: Record<string, unknown>): string | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (body.exam !== undefined && !s(body.exam).trim()) return "Exam is required.";
  if (body.stem !== undefined && !s(body.stem).trim()) return "Question text is required.";
  if (body.topic !== undefined && !s(body.topic).trim()) return "Topic is required.";
  if (body.options !== undefined) {
    const opts = Array.isArray(body.options) ? body.options : [];
    if ((opts.length !== 4 && opts.length !== 5) || opts.some((o) => typeof o !== "string" || !o.trim())) {
      return "Provide 4 or 5 non-empty options.";
    }
  }
  if (body.answer !== undefined) {
    const ans = Number(body.answer);
    if (!Number.isInteger(ans) || ans < 0 || ans > 4) return "Answer must be option A–E.";
    if (Array.isArray(body.options) && ans >= body.options.length) {
      return "Answer must point to one of the provided options.";
    }
  }
  if (body.difficulty !== undefined && !DIFFS.includes(String(body.difficulty))) {
    return "Difficulty must be Easy, Medium or Hard.";
  }
  if (body.plus !== undefined) {
    const plus = Number(body.plus);
    if (!Number.isFinite(plus) || plus <= 0 || plus > 1000) return "Marks must be a positive number.";
  }
  if (body.minus !== undefined) {
    const minus = Number(body.minus);
    if (!Number.isFinite(minus) || minus > 0 || minus < -1000) {
      return "Negative marks must be zero or a negative number.";
    }
  }
  return null;
}

function pick(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : v);
  for (const k of ["exam", "section", "topic", "difficulty", "stem", "explanation"] as const) {
    if (body[k] !== undefined) out[k] = s(body[k]);
  }
  if (body.options !== undefined) out.options = (body.options as string[]).map((o) => String(o).trim());
  for (const k of ["answer", "plus", "minus"] as const) {
    if (body[k] !== undefined) out[k] = Number(body[k]);
  }
  if (body.qa_model !== undefined) out.qa_model = body.qa_model;
  return out;
}

// PUT /api/admin/questions/[id] — partial update, validated + audited.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    const body = (await req.json()) as Record<string, unknown>;
    const bad = validate(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });

    // An answer-only update must still point into the question's stored
    // options — 4- and 5-option rows both exist in the bank.
    if (body.answer !== undefined && body.options === undefined) {
      const { data: row, error: rErr } = await svc.from("questions").select("options").eq("id", id).maybeSingle();
      if (rErr) throw rErr;
      if (!row) return NextResponse.json({ error: "Question not found." }, { status: 404 });
      const stored = (row as { options?: unknown }).options;
      const len = Array.isArray(stored) ? stored.length : 0;
      if (Number(body.answer) >= len) {
        return NextResponse.json({ error: "Answer must point to one of this question's options." }, { status: 400 });
      }
    }

    const patch = pick(body);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const { data: updated, error } = await svc
      .from("questions")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    await logAdminAction(svc, {
      actor,
      action: "question.update",
      entity: "question",
      entityId: id,
      details: {
        changed: Object.keys(patch),
        ...(body.stem !== undefined ? { stem: String(body.stem).trim().slice(0, 80) } : {}),
      },
    });

    // The DB trigger marks the old result stale. Rerun immediately so the
    // editor and the QA dashboard see the new state, and so an affected test
    // can be revalidated before its next publish transition.
    let qa = null;
    let qaError: string | null = null;
    try {
      qa = (await validateAndPersistQuestion(svc, id))?.result ?? null;
    } catch (e) {
      qaError = e instanceof Error ? e.message : "QA validation failed.";
    }

    return NextResponse.json({ ok: true, qa, ...(qaError ? { qaError } : {}) });
  } catch (e) {
    const p = errorPayload(e, "Update failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// DELETE /api/admin/questions/[id] — blocked while any test references it.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    const { count, error: refErr } = await svc
      .from("tests")
      .select("id", { count: "exact", head: true })
      .filter("question_ids", "cs", `{${id}}`);
    if (refErr) throw refErr;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${count} test(s) still reference this question. Use force delete to remove it from those tests too.` },
        { status: 409 }
      );
    }
    const { data: row } = await svc.from("questions").select("stem").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    const { error } = await svc.from("questions").delete().eq("id", id);
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "question.delete",
      entity: "question",
      entityId: id,
      details: { stem: ((row as { stem?: string } | null)?.stem ?? "").slice(0, 80) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const p = errorPayload(e, "Delete failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
