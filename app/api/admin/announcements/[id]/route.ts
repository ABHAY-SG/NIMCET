import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

const MAX_TITLE = 140;
const MAX_BODY = 8000;

// PUT /api/admin/announcements/[id] — partial update (edit, publish toggle).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    const body = (await req.json()) as Record<string, unknown>;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const changed: string[] = [];
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (t.length < 3 || t.length > MAX_TITLE) {
        return NextResponse.json({ error: `Title must be 3–${MAX_TITLE} characters.` }, { status: 400 });
      }
      patch.title = t;
      changed.push("title");
    }
    if (body.body !== undefined) {
      const b = String(body.body).trim();
      if (b.length < 3 || b.length > MAX_BODY) {
        return NextResponse.json({ error: `Body must be 3–${MAX_BODY} characters.` }, { status: 400 });
      }
      patch.body = b;
      changed.push("body");
    }
    if (body.published !== undefined) {
      if (typeof body.published !== "boolean") {
        return NextResponse.json({ error: "published must be true or false." }, { status: 400 });
      }
      patch.published = body.published;
      changed.push("published");
    }
    if (changed.length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { data: updated, error } = await svc
      .from("announcements")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    await logAdminAction(svc, {
      actor,
      action: "announcement.update",
      entity: "announcement",
      entityId: id,
      details: {
        changed,
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
        ...(body.published !== undefined ? { published: Boolean(body.published) } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const p = errorPayload(e, "Update failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// DELETE /api/admin/announcements/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    const { data: row, error: fErr } = await svc
      .from("announcements")
      .select("title")
      .eq("id", id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!row) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });

    const { error } = await svc.from("announcements").delete().eq("id", id);
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "announcement.delete",
      entity: "announcement",
      entityId: id,
      details: { title: (row as { title: string }).title },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const p = errorPayload(e, "Delete failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
