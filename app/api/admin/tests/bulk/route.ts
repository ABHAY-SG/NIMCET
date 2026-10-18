import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/tests/bulk — publish / unpublish / free / paid / delete for a
// set of tests. Delete refuses any test that has recorded attempts unless the
// caller passes force: true (the admin UI asks for a second, title-typed
// confirmation first); a plain delete can never destroy student history.
const ACTIONS = ["publish", "unpublish", "free", "paid", "delete"] as const;
type BulkAction = (typeof ACTIONS)[number];

export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as { ids?: unknown; action?: unknown; force?: unknown };
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(rawIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()))];
    const action = String(body.action ?? "") as BulkAction;
    const force = body.force === true;

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
      // Dedupe by title (two selected tests can share a title) before counting
      // or deleting, so attempts are never double-removed or double-counted.
      const countsByTitle = new Map<string, number>();
      for (const c of counts) if (c.count > 0) countsByTitle.set(c.title, c.count);

      if (countsByTitle.size > 0 && !force) {
        const blocked = [...countsByTitle.entries()].map(([title, count]) => ({ title, count }));
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

      // Force path: the admin explicitly confirmed (typed the test title) that
      // recorded attempts may go too. Every removed attempt is accounted for
      // in the audit log below.
      let attemptsDeleted = 0;
      if (force) {
        for (const [title, count] of countsByTitle) {
          const { error } = await svc.from("attempts").delete().eq("test", title);
          if (error) throw error;
          attemptsDeleted += count;
        }
      }

      const { error } = await svc.from("tests").delete().in("id", foundIds);
      if (error) throw error;

      await logAdminAction(svc, {
        actor,
        action: attemptsDeleted > 0 ? "test.bulk_force_delete" : "test.bulk_delete",
        entity: "test",
        details: {
          count: foundIds.length,
          titles: found.slice(0, 20).map((t) => t.title),
          ...(attemptsDeleted > 0 ? { attemptsDeleted } : {}),
        },
      });
      return NextResponse.json({ ok: true, affected: foundIds.length, attemptsDeleted });
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
