import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/admin/tests?limit= — newest first.
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);
    const limit = toNum(searchParams.get("limit"), 50, 1, 200);
    const { data, error } = await svc
      .from("tests")
      .select("*")
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

function validate(body: Record<string, unknown>): string | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (body.title !== undefined && !s(body.title).trim()) return "Title is required.";
  if (body.minutes !== undefined) {
    const m = Number(body.minutes);
    if (!Number.isFinite(m) || m < 5 || m > 180) return "Duration must be 5–180 minutes.";
  }
  if (body.question_ids !== undefined) {
    const ids = Array.isArray(body.question_ids) ? body.question_ids : [];
    if (ids.length === 0) return "Pick at least one question.";
    if (ids.some((id) => typeof id !== "string" || !id.trim())) return "Invalid question reference.";
  }
  for (const k of ["free", "published"] as const) {
    if (body[k] !== undefined && typeof body[k] !== "boolean") return `${k} must be true or false.`;
  }
  return null;
}

// POST /api/admin/tests — create. Always starts usable; publish flag explicit.
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title || !(body.title as string).toString().trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    const bad = validate(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const s = (v: unknown, d = "") => (typeof v === "string" ? v.trim() : d);
    const { data, error } = await svc
      .from("tests")
      .insert({
        exam: s(body.exam, "nimcet"),
        title: s(body.title),
        tag: s(body.tag),
        minutes: body.minutes === undefined ? 30 : Number(body.minutes),
        free: body.free === undefined ? true : Boolean(body.free),
        published: body.published === undefined ? false : Boolean(body.published),
        question_ids: body.question_ids as string[],
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
