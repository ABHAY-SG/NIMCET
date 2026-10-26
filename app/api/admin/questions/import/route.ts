import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { parseRow, type ParsedRow } from "@/lib/question-rows";
import { logAdminAction } from "@/lib/audit";
import { validateQuestion } from "@/lib/qa/engine";
import {
  loadBankSiblings,
  loadQuestionsByIds,
  persistQuestionResults,
  toQaQuestion,
  type QaPersistedQuestion,
} from "@/lib/qa/server";

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

    const { data, error } = await svc.from("questions").insert(parsed).select("id");
    if (error) throw error;
    const insertedIds = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);

    await logAdminAction(svc, {
      actor,
      action: "question.import",
      entity: "question",
      details: { count: parsed.length, sample: parsed.slice(0, 5).map((r) => r.stem.slice(0, 60)) },
    });

    // Run the deterministic checks once for the whole batch. Imported rows are
    // drafts; failures are reported but never silently rewritten.
    const qa = { checked: 0, pass: 0, warning: 0, review: 0, failed: 0, persisted: true };
    try {
      const rowsById = await loadQuestionsByIds(svc, insertedIds);
      const siblings = await loadBankSiblings(svc);
      const entries: QaPersistedQuestion[] = [];
      for (const id of insertedIds) {
        const row = rowsById.get(id);
        if (!row) continue;
        const result = validateQuestion(toQaQuestion(row), { siblings });
        entries.push({ question: row, result });
        qa.checked += 1;
        if (result.status === "PASS") qa.pass += 1;
        else if (result.status === "WARNING") qa.warning += 1;
        else if (result.status === "NEEDS_REVIEW") qa.review += 1;
        else qa.failed += 1;
      }
      qa.persisted = await persistQuestionResults(svc, entries);
    } catch {
      qa.persisted = false;
    }

    return NextResponse.json({ inserted: parsed.length, qa });
  } catch (e) {
    const p = errorPayload(e, "Import failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
