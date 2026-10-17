import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

const DIFFS = ["Easy", "Medium", "Hard"];
const MAX_ROWS = 200;

type ParsedRow = {
  exam: string;
  section: string;
  topic: string;
  difficulty: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
  plus: number;
  minus: number;
};

function parseRow(raw: Record<string, unknown>, index: number): ParsedRow | string {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const line = `Row ${index + 1}`;

  const exam = s(raw.exam);
  if (!exam || exam.length > 80) return `${line}: exam is required (max 80 chars).`;
  const stem = s(raw.stem);
  if (!stem || stem.length > 4000) return `${line}: question text is required (max 4000 chars).`;
  const section = s(raw.section).slice(0, 80);
  const topic = s(raw.topic).slice(0, 120);
  const difficulty = DIFFS.includes(s(raw.difficulty)) ? s(raw.difficulty) : "Medium";

  const options = Array.isArray(raw.options) ? raw.options.map((o) => String(o).trim()) : [];
  if ((options.length !== 4 && options.length !== 5) || options.some((o) => !o || o.length > 1000)) {
    return `${line}: 4 or 5 non-empty options (max 1000 chars each) are required.`;
  }

  let answer = -1;
  if (typeof raw.answer === "number") answer = raw.answer;
  else {
    const a = s(raw.answer).toUpperCase();
    answer = ["A", "B", "C", "D", "E"].indexOf(a);
    if (answer < 0 && /^[0-4]$/.test(a)) answer = Number(a);
  }
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return `${line}: answer must match an available option (A–E or its zero-based index).`;
  }

  const plus = raw.plus === undefined || raw.plus === "" ? 4 : Number(raw.plus);
  if (!Number.isFinite(plus) || plus <= 0 || plus > 1000) return `${line}: plus marks must be 1–1000.`;
  const minus = raw.minus === undefined || raw.minus === "" ? -1 : Number(raw.minus);
  if (!Number.isFinite(minus) || minus > 0 || minus < -1000) return `${line}: minus marks must be between -1000 and 0.`;

  return {
    exam,
    section,
    topic,
    difficulty,
    stem,
    options,
    answer,
    explanation: s(raw.explanation).slice(0, 4000),
    plus,
    minus,
  };
}

// POST /api/admin/questions/import — validated batch insert (max 200 rows per
// call). Rows are validated individually; one bad row rejects the whole batch
// with its line number so the admin can fix the CSV and retry.
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
