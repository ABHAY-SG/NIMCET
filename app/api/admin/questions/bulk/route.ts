import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/questions/bulk — bulk delete. Refuses any question still
// referenced by a test, exactly like the single-question endpoint.
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as { ids?: unknown; action?: unknown };
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(rawIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()))];
    const action = String(body.action ?? "");

    if (ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ error: "Select 1–100 questions." }, { status: 400 });
    }
    if (action !== "delete") {
      return NextResponse.json({ error: "Unknown bulk action." }, { status: 400 });
    }

    const { data: referencing, error: refErr } = await svc
      .from("tests")
      .select("id,title")
      .overlaps("question_ids", ids);
    if (refErr) throw refErr;
    const refs = (referencing ?? []) as Array<{ id: string; title: string }>;
    if (refs.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete — ${refs.length} test(s) still reference the selected questions: ${refs
            .map((r) => `“${r.title}”`)
            .slice(0, 5)
            .join(", ")}. Remove them from those tests first.`,
        },
        { status: 409 }
      );
    }

    const { data: stems, error: sErr } = await svc.from("questions").select("id,stem").in("id", ids);
    if (sErr) throw sErr;
    const del = (stems ?? []) as Array<{ id: string; stem: string }>;
    if (del.length === 0) return NextResponse.json({ error: "No matching questions found." }, { status: 404 });

    const { error } = await svc.from("questions").delete().in("id", del.map((q) => q.id));
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "question.bulk_delete",
      entity: "question",
      details: { count: del.length, stems: del.slice(0, 10).map((q) => q.stem.slice(0, 60)) },
    });
    return NextResponse.json({ ok: true, affected: del.length });
  } catch (e) {
    const p = errorPayload(e, "Bulk delete failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
