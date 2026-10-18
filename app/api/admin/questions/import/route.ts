import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { parseRow, type ParsedRow } from "@/lib/question-rows";
import { logAdminAction } from "@/lib/audit";

const MAX_ROWS = 200;

// POST /api/admin/questions/import — validated batch insert (max 200 rows per
// call). Rows are validated individually; one bad row rejects the whole batch
// with its line number so the admin can fix the CSV and retry. Row rules are
// shared with the full-mock CSV flow (lib/question-rows.ts).
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as { rows?: unknown };
    const rows = Array.isArray(body.rows) ? (body.rows as Array<Record<string, unknown>>) : [];
    if (rows.length === 0) return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Import at most ${MAX_ROWS} rows per batch.` }, { status: 400 });
    }

    const parsed: ParsedRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || typeof r !== "object") return NextResponse.json({ error: `Row ${i + 1}: invalid row.` }, { status: 400 });
      const out = parseRow(r, i);
      if (typeof out === "string") return NextResponse.json({ error: out }, { status: 400 });
      parsed.push(out);
    }

    const { error } = await svc.from("questions").insert(parsed);
    if (error) throw error;

    await logAdminAction(svc, {
      actor,
      action: "question.import",
      entity: "question",
      details: { count: parsed.length, sample: parsed.slice(0, 5).map((r) => r.stem.slice(0, 60)) },
    });

    return NextResponse.json({ inserted: parsed.length });
  } catch (e) {
    const p = errorPayload(e, "Import failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
