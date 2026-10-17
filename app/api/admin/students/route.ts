import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fetchAllAttempts, fetchAllUsers } from "@/lib/admin-queries";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/students — real registered users (Supabase Auth) with their
// attempt aggregates. Admin-only; safe fields only, never tokens/identities.
// Search, status filter, sorting and pagination run server-side.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const status = searchParams.get("status") || "all";
    const sort = searchParams.get("sort") || "new";
    const page = toNum(searchParams.get("page"), 1, 1, 100000);
    const per = toNum(searchParams.get("per"), 20, 5, 100);

    const [users, attempts] = await Promise.all([fetchAllUsers(svc), fetchAllAttempts(svc)]);

    const agg = new Map<string, { count: number; sum: number; best: number; last: string }>();
    for (const a of attempts) {
      const score = Number(a.score) || 0;
      const cur = agg.get(a.user_id);
      if (!cur) {
        agg.set(a.user_id, { count: 1, sum: score, best: score, last: a.created_at });
      } else {
        cur.count++;
        cur.sum += score;
        if (score > cur.best) cur.best = score;
        if (a.created_at > cur.last) cur.last = a.created_at;
      }
    }

    let rows = users.map((u) => {
      const s = agg.get(u.id);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        disabled: u.disabled,
        attempts: s?.count ?? 0,
        avg: s ? Math.round((s.sum / s.count) * 10) / 10 : 0,
        best: s?.best ?? 0,
        last_attempt_at: s?.last ?? null,
      };
    });

    if (q) {
      rows = rows.filter(
        (r) =>
          r.email.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().startsWith(q)
      );
    }
    if (status === "active") rows = rows.filter((r) => !r.disabled);
    if (status === "disabled") rows = rows.filter((r) => r.disabled);

    switch (sort) {
      case "old":
        rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "name":
        rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        break;
      case "attempts":
        rows.sort((a, b) => b.attempts - a.attempts);
        break;
      case "avg":
        rows.sort((a, b) => b.avg - a.avg);
        break;
      case "best":
        rows.sort((a, b) => b.best - a.best);
        break;
      default:
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
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
      rows: rows.slice(start, start + per),
      summary: {
        users: users.length,
        disabled: users.filter((u) => u.disabled).length,
        withAttempts: agg.size,
      },
    });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
