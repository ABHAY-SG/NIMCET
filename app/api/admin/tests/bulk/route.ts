import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/tests/bulk — publish / unpublish / free / paid / delete for a
// set of tests. Delete refuses any test that has recorded attempts, exactly
// like the single-test endpoint, so student history is never destroyed.
const ACTIONS = ["publish", "unpublish", "free", "paid", "delete"] as const;
type BulkAction = (typeof ACTIONS)[number];

export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as { ids?: unknown; action?: unknown };
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(rawIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()))];
    const action = String(body.action ?? "") as BulkAction;

    if (ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ error: "Select 1–100 tests." }, { status: 400 });
    }
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Unknown bulk action." }, { status: 400 });
    }

    const { data: rows, error: fErr } = await svc.from("tests").select("id,title").in("id", ids);
    if (fErr) throw fErr;
    const found = (rows ?? []) as Array<{ id: string; title: string }>;
    if (found.length === 0) {
      return NextResponse.json({ error: "No matching tests found." }, { status: 404 });
    }
    const foundIds = found.map((t) => t.id);

    if (action === "delete") {
      const counts = await Promise.all(
        found.map(async (t) => {
          const { count, error } = await svc
            .from("attempts")
            .select("id", { count: "exact", head: true })
            .eq("test", t.title);
          if (error) throw error;
          return { title: t.title, count: count ?? 0 };
        })
      );
      const blocked = counts.filter((c) => c.count > 0);
      if (blocked.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot delete ${blocked.length} test(s) with recorded attempts: ${blocked
              .map((b) => `“${b.title}” (${b.count})`)
              .slice(0, 5)
              .join(", ")}. Unpublish them instead to preserve history.`,
          },
          { status: 409 }
        );
      }
      const { error } = await svc.from("tests").delete().in("id", foundIds);
      if (error) throw error;

      await logAdminAction(svc, {
        actor,
        action: "test.bulk_delete",
        entity: "test",
        details: { count: foundIds.length, titles: found.slice(0, 20).map((t) => t.title) },
      });
      return NextResponse.json({ ok: true, affected: foundIds.length });
    }

    const patch =
      action === "publish"
        ? { published: true }
        : action === "unpublish"
          ? { published: false }
          : action === "free"
            ? { free: true }
            : { free: false };
    const { error } = await svc.from("tests").update(patch).in("id", foundIds);
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: `test.bulk_${action}`,
      entity: "test",
      details: { count: foundIds.length, titles: found.slice(0, 20).map((t) => t.title) },
    });
    return NextResponse.json({ ok: true, affected: foundIds.length });
  } catch (e) {
    const p = errorPayload(e, "Bulk action failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
