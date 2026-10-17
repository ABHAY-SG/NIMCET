import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fetchAllRows } from "@/lib/admin-queries";

export type FeedbackRow = {
  id: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/feedback?status=&q=&page=&per= — the real inbox.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const page = toNum(searchParams.get("page"), 1, 1, 100000);
    const per = toNum(searchParams.get("per"), 15, 5, 100);

    const all = await fetchAllRows<FeedbackRow>(svc, "feedback", "*", 5000);

    const counts = { new: 0, read: 0, in_progress: 0, resolved: 0, total: all.length };
    for (const r of all) {
      if (r.status === "new") counts.new++;
      else if (r.status === "read") counts.read++;
      else if (r.status === "in_progress") counts.in_progress++;
      else if (r.status === "resolved") counts.resolved++;
    }

    let rows = all;
    if (status !== "all") rows = rows.filter((r) => r.status === status);
    if (q) {
      rows = rows.filter((r) =>
        `${r.subject} ${r.email} ${r.message}`.toLowerCase().includes(q)
      );
    }

    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * per;

    return NextResponse.json({
      total,
      page: safePage,
      per,
      pages,
      counts,
      rows: rows.slice(start, start + per),
    });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
