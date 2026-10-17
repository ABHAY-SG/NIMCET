import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fetchAllTests } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

function validate(body: Record<string, unknown>): string | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (body.title !== undefined && !s(body.title).trim()) return "Title is required.";
  if (body.title !== undefined && s(body.title).length > 160) return "Title must be under 160 characters.";
  if (body.minutes !== undefined) {
    const m = Number(body.minutes);
    if (!Number.isFinite(m) || m < 5 || m > 180) return "Duration must be 5–180 minutes.";
  }
  if (body.question_ids !== undefined) {
    const ids = Array.isArray(body.question_ids) ? body.question_ids : [];
    if (ids.length === 0) return "Pick at least one question.";
    if (ids.some((id) => typeof id !== "string" || !id.trim())) return "Invalid question reference.";
    if (ids.length > 200) return "A test can hold up to 200 questions.";
  }
  if (body.description !== undefined && s(body.description).length > 4000) {
    return "Description must be under 4000 characters.";
  }
  if (body.instructions !== undefined && s(body.instructions).length > 8000) {
    return "Instructions must be under 8000 characters.";
  }
  for (const k of ["free", "published"] as const) {
    if (body[k] !== undefined && typeof body[k] !== "boolean") return `${k} must be true or false.`;
  }
  return null;
}

function pick(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : v);
  for (const k of ["exam", "title", "tag", "description", "instructions"] as const) {
    if (body[k] !== undefined) out[k] = s(body[k]);
  }
  if (body.minutes !== undefined) out.minutes = Number(body.minutes);
  for (const k of ["free", "published"] as const) {
    if (body[k] !== undefined) out[k] = Boolean(body[k]);
  }
  if (body.question_ids !== undefined) out.question_ids = body.question_ids;
  return out;
}

// PUT /api/admin/tests/[id] — partial update (edits, publish toggles). Every
// change is written to the audit log.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const body = (await req.json()) as Record<string, unknown>;
    const bad = validate(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });

    const patch = pick(body);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    if (body.description !== undefined || body.instructions !== undefined) {
      const { migrated } = await fetchAllTests(svc, 1);
      if (!migrated) {
        return NextResponse.json(
          { error: "The database is missing the new test columns. Run supabase/migrations/0005_admin.sql, then retry." },
          { status: 503 }
        );
      }
    }

    const { data: before, error: bErr } = await svc
      .from("tests")
      .select("title,published,question_ids")
      .eq("id", id)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!before) return NextResponse.json({ error: "Test not found." }, { status: 404 });

    const { error } = await svc.from("tests").update(patch).eq("id", id);
    if (error) throw error;

    const prev = before as { title: string; published: boolean; question_ids: string[] };
    await logAdminAction(svc, {
      actor,
      action: "test.update",
      entity: "test",
      entityId: id,
      details: {
        title: prev.title,
        changed: Object.keys(patch),
        ...(body.published !== undefined ? { published: Boolean(body.published) } : {}),
        ...(body.question_ids !== undefined
          ? { questionsBefore: prev.question_ids.length, questionsAfter: (body.question_ids as string[]).length }
          : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const p = errorPayload(e, "Update failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// DELETE /api/admin/tests/[id] — blocked while attempts reference the title,
// so student history can never be silently destroyed.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { data: t, error: tErr } = await svc.from("tests").select("title").eq("id", id).maybeSingle();
    if (tErr) throw tErr;
    if (!t) return NextResponse.json({ error: "Test not found." }, { status: 404 });
    const title = (t as { title: string }).title;
    const { count, error: cErr } = await svc
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("test", title);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${count} recorded attempt(s) reference this mock. Unpublish instead to preserve history.` },
        { status: 409 }
      );
    }
    const { error } = await svc.from("tests").delete().eq("id", id);
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "test.delete",
      entity: "test",
      entityId: id,
      details: { title },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const p = errorPayload(e, "Delete failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
