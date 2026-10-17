import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

const MAX_TITLE = 140;
const MAX_BODY = 8000;

// GET /api/admin/announcements — every notice (published + drafts).
export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { data, error } = await svc
      .from("announcements")
      .select("id,title,body,published,created_by_email,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// POST /api/admin/announcements — create a notice (draft or published).
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const published = body.published === true;
    if (title.length < 3 || title.length > MAX_TITLE) {
      return NextResponse.json({ error: `Title must be 3–${MAX_TITLE} characters.` }, { status: 400 });
    }
    if (text.length < 3 || text.length > MAX_BODY) {
      return NextResponse.json({ error: `Body must be 3–${MAX_BODY} characters.` }, { status: 400 });
    }

    const { data, error } = await svc
      .from("announcements")
      .insert({
        title,
        body: text,
        published,
        created_by: actor.id,
        created_by_email: actor.email,
      })
      .select("id")
      .single();
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "announcement.create",
      entity: "announcement",
      entityId: (data as { id: string }).id,
      details: { title, published },
    });

    return NextResponse.json({ id: (data as { id: string }).id });
  } catch (e) {
    const p = errorPayload(e, "Create failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
