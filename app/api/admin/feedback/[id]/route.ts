import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

const STATUSES = ["new", "read", "in_progress", "resolved"];
const MAX_NOTE = 2000;

// PUT /api/admin/feedback/[id] — update review status / internal note.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const body = (await req.json()) as Record<string, unknown>;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let status: string | null = null;
    if (body.status !== undefined) {
      const s = String(body.status);
      if (!STATUSES.includes(s)) {
        return NextResponse.json({ error: "Status must be new, read, in_progress or resolved." }, { status: 400 });
      }
      patch.status = s;
      status = s;
    }
    if (body.admin_note !== undefined) {
      const note = String(body.admin_note);
      if (note.length > MAX_NOTE) {
        return NextResponse.json({ error: `Note must be under ${MAX_NOTE} characters.` }, { status: 400 });
      }
      patch.admin_note = note;
    }
    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { error } = await svc.from("feedback").update(patch).eq("id", id);
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "feedback.update",
      entity: "feedback",
      entityId: id,
      details: { ...(status ? { status } : {}), ...(body.admin_note !== undefined ? { noteUpdated: true } : {}) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const p = errorPayload(e, "Update failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
