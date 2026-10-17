import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";

// GET /api/admin/notifications — real unread indicators only (feedback with
// status "new"). No hardcoded counts anywhere in the admin UI.
export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const [unread, latest] = await Promise.all([
      svc.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new"),
      svc
        .from("feedback")
        .select("id,subject,email,category,created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    if (unread.error) throw unread.error;
    if (latest.error) throw latest.error;
    return NextResponse.json({
      unreadFeedback: unread.count ?? 0,
      latest: latest.data ?? [],
    });
  } catch (e) {
    const p = errorPayload(e, "Notifications unavailable.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
