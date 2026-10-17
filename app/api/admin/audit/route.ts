import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fetchAllRows } from "@/lib/admin-queries";

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/audit?entity=&action=&q=&from=&to=&page=&per=
// Read-only view of the append-only audit log. Filters run server-side.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const entity = (searchParams.get("entity") || "").trim();
    const action = (searchParams.get("action") || "").trim().toLowerCase();
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();
    const page = toNum(searchParams.get("page"), 1, 1, 100000);
    const per = toNum(searchParams.get("per"), 20, 5, 100);

    let rows = await fetchAllRows<AuditRow>(svc, "admin_audit_log", "*", 10000);

    if (entity && entity !== "all") rows = rows.filter((r) => r.entity === entity);
    if (action) rows = rows.filter((r) => r.action.toLowerCase().includes(action));
    if (q) {
      rows = rows.filter((r) =>
        `${r.actor_email} ${r.entity_id} ${JSON.stringify(r.details ?? {})}`.toLowerCase().includes(q)
      );
    }
    const fromTs = from ? Date.parse(`${from}T00:00:00Z`) : NaN;
    const toTs = to ? Date.parse(`${to}T23:59:59Z`) : NaN;
    if (Number.isFinite(fromTs)) rows = rows.filter((r) => Date.parse(r.created_at) >= fromTs);
    if (Number.isFinite(toTs)) rows = rows.filter((r) => Date.parse(r.created_at) <= toTs);

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
    });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
