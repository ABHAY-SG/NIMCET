import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

function validate(body: Record<string, unknown>): string | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (body.title !== undefined && !s(body.title).trim()) return "Title is required.";
  if (body.minutes !== undefined) {
    const m = Number(body.minutes);
    if (!Number.isFinite(m) || m < 5 || m > 180) return "Duration must be 5–180 minutes.";
  }
  if (body.question_ids !== undefined) {
    const ids = Array.isArray(body.question_ids) ? body.question_ids : [];
    if (ids.length === 0) return "Pick at least one question.";
    if (ids.some((id) => typeof id !== "string" || !id.trim())) return "Invalid question reference.";
  }
  for (const k of ["free", "published"] as const) {
    if (body[k] !== undefined && typeof body[k] !== "boolean") return `${k} must be true or false.`;
  }
  return null;
}

function pick(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : v);
  for (const k of ["exam", "title", "tag"] as const) {
    if (body[k] !== undefined) out[k] = s(body[k]);
  }
  if (body.minutes !== undefined) out.minutes = Number(body.minutes);
  for (const k of ["free", "published"] as const) {
    if (body[k] !== undefined) out[k] = Boolean(body[k]);
  }
  if (body.question_ids !== undefined) out.question_ids = body.question_ids;
  return out;
}

// PUT /api/admin/tests/[id] — partial update (publish toggles, edits).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
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
    const { error } = await svc.from("tests").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/tests/[id] — blocked while attempts reference the title,
// so student history can never be silently destroyed.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { data: t, error: tErr } = await svc.from("tests").select("title").eq("id", id).maybeSingle();
    if (tErr) throw tErr;
    if (!t) return NextResponse.json({ error: "Test not found." }, { status: 404 });
    const { count, error: cErr } = await svc
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("test", (t as { title: string }).title);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${count} recorded attempt(s) reference this mock. Unpublish instead to preserve history.` },
        { status: 409 }
      );
    }
    const { error } = await svc.from("tests").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed." },
      { status: 500 }
    );
  }
}
