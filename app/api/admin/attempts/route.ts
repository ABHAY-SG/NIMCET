import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/attempts?limit= — newest first. Only IDs are exposed;
// emails live in Supabase Auth, never in this payload.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const limit = toNum(searchParams.get("limit"), 100, 1, 500);
    const { data, error } = await svc
      .from("attempts")
      .select("id,user_id,test,score,correct,wrong,skipped,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Load failed." },
      { status: 500 }
    );
  }
}
