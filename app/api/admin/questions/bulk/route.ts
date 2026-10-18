import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/questions/bulk — bulk delete. By default it refuses any
// question a test still references (a dangling id would silently shrink that
// test's paper). With force: true the admin can override: the questions are
// dropped from every referencing test's question_ids first, then deleted —
// explicit, ordered, and audited as question.bulk_force_delete.
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as { ids?: unknown; action?: unknown; force?: unknown };
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(rawIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()))];
    const action = String(body.action ?? "");
    const force = body.force === true;

    if (ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ error: "Select 1–100 questions." }, { status: 400 });
    }
    if (action !== "delete") {
      return NextResponse.json({ error: "Unknown bulk action." }, { status: 400 });
    }

    const { data: referencing, error: refErr } = await svc
      .from("tests")
      .select("id,title,question_ids")
      .overlaps("question_ids", ids);
    if (refErr) throw refErr;
    const refs = (referencing ?? []) as Array<{ id: string; title: string; question_ids: string[] }>;

    if (refs.length > 0 && !force) {
      return NextResponse.json(
        {
          error: `Cannot delete — ${refs.length} test(s) still reference the selected questions: ${refs
            .map((r) => `“${r.title}”`)
            .slice(0, 5)
            .join(", ")}. Use force delete to remove them from those tests too.`,
        },
        { status: 409 }
      );
    }

    // Force path: unlink from the referencing tests BEFORE deleting, so no test
    // can ever be left pointing at an id that no longer resolves.
    if (force && refs.length > 0) {
      const drop = new Set(ids);
      for (const t of refs) {
        const kept = (t.question_ids ?? []).filter((qid) => !drop.has(qid));
        if (kept.length === t.question_ids.length) continue;
        const { error: upErr } = await svc.from("tests").update({ question_ids: kept }).eq("id", t.id);
        if (upErr) throw upErr;
      }
    }

    const { data: stems, error: sErr } = await svc.from("questions").select("id,stem").in("id", ids);
    if (sErr) throw sErr;
    const del = (stems ?? []) as Array<{ id: string; stem: string }>;
    if (del.length === 0) return NextResponse.json({ error: "No matching questions found." }, { status: 404 });

    const { error } = await svc.from("questions").delete().in("id", del.map((q) => q.id));
    if (error) throw error;

    const forced = force && refs.length > 0;
    await logAdminAction(svc, {
      actor,
      action: forced ? "question.bulk_force_delete" : "question.bulk_delete",
      entity: "question",
      details: {
        count: del.length,
        stems: del.slice(0, 10).map((q) => q.stem.slice(0, 60)),
        ...(forced ? { unlinkedFromTests: refs.length, tests: refs.map((r) => r.title).slice(0, 5) } : {}),
      },
    });
    return NextResponse.json({ ok: true, affected: del.length, ...(forced ? { unlinkedFromTests: refs.length } : {}) });
  } catch (e) {
    const p = errorPayload(e, "Bulk delete failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
