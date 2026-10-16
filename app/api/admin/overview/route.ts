import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/overview — counts + capped lists for the admin dashboard.
export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const [qHead, aHead, tRows, aRows] = await Promise.all([
      svc.from("questions").select("id", { count: "exact", head: true }),
      svc.from("attempts").select("id", { count: "exact", head: true }),
      svc.from("tests").select("id,title,published,created_at,question_ids").order("created_at", { ascending: false }).limit(100),
      svc.from("attempts").select("user_id,test,score,created_at").order("created_at", { ascending: false }).limit(1000),
    ]);
    const firstErr = [qHead.error, aHead.error, tRows.error, aRows.error].find(Boolean);
    if (firstErr) throw firstErr;
    return NextResponse.json({
      counts: { questions: qHead.count ?? 0, attempts: aHead.count ?? 0 },
      tests: tRows.data ?? [],
      attempts: aRows.data ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Load failed." },
      { status: 500 }
    );
  }
}
