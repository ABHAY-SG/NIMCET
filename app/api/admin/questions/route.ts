import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

const DIFFS = ["Easy", "Medium", "Hard"];

// GET /api/admin/questions?exam=&difficulty=&limit= — full rows incl. answers.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const limit = toNum(searchParams.get("limit"), 200, 1, 500);
    let q = svc.from("questions").select("*").order("created_at", { ascending: false }).limit(limit);
    const exam = (searchParams.get("exam") || "").trim();
    const difficulty = (searchParams.get("difficulty") || "").trim();
    if (exam && exam !== "all") q = q.eq("exam", exam);
    if (difficulty && difficulty !== "all" && DIFFS.includes(difficulty)) q = q.eq("difficulty", difficulty);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Load failed." },
      { status: 500 }
    );
  }
}

function validate(body: Record<string, unknown>): string | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (!s(body.exam).trim()) return "Exam is required.";
  if (!s(body.stem).trim()) return "Question text is required.";
  if (!s(body.topic).trim()) return "Topic is required.";
  const opts = Array.isArray(body.options) ? body.options : [];
  if (opts.length !== 4 || opts.some((o) => typeof o !== "string" || !o.trim())) {
    return "All 4 options are required.";
  }
  const ans = Number(body.answer);
  if (!Number.isInteger(ans) || ans < 0 || ans > 3) return "Answer must be option A–D.";
  if (body.difficulty !== undefined && !DIFFS.includes(String(body.difficulty))) {
    return "Difficulty must be Easy, Medium or Hard.";
  }
  const plus = Number(body.plus);
  const minus = Number(body.minus);
  if (body.plus !== undefined && (!Number.isFinite(plus) || plus <= 0 || plus > 1000)) {
    return "Marks must be a positive number.";
  }
  if (body.minus !== undefined && (!Number.isFinite(minus) || minus > 0 || minus < -1000)) {
    return "Negative marks must be zero or a negative number.";
  }
  return null;
}

// POST /api/admin/questions — create (always a usable draft row).
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const bad = validate(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const s = (v: unknown, d = "") => (typeof v === "string" ? v : d);
    const { data, error } = await svc
      .from("questions")
      .insert({
        exam: s(body.exam).trim(),
        section: s(body.section).trim(),
        topic: s(body.topic).trim(),
        difficulty: s(body.difficulty, "Medium"),
        stem: s(body.stem).trim(),
        options: (body.options as string[]).map((o) => o.trim()),
        answer: Number(body.answer),
        explanation: s(body.explanation).trim(),
        plus: body.plus === undefined ? 4 : Number(body.plus),
        minus: body.minus === undefined ? -1 : Number(body.minus),
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: (data as { id: string }).id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed." },
      { status: 500 }
    );
  }
}
