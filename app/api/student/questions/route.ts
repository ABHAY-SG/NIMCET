import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";

// Columns safe for students: no answer key, no explanations, no PII.
const SAFE = "id,exam,section,topic,difficulty,stem,options,plus,minus";
const DIFFS = ["Easy", "Medium", "Hard"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// GET /api/student/questions?limit=&exam=&difficulty= | ?ids=<csv>
// Any authenticated session may call it; the SELECT list above is the
// entire exposure — answers and explanations can never leave this route.
export async function GET(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const sp = new URL(req.url).searchParams;
    const ids = (sp.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => UUID.test(s))
      .slice(0, 200);
    if (ids.length > 0) {
      const { data, error } = await svc.from("questions").select(SAFE).in("id", ids);
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [] });
    }
    const limit = toNum(sp.get("limit"), 300, 1, 300);
    let q = svc.from("questions").select(SAFE).order("created_at", { ascending: false }).limit(limit);
    const exam = (sp.get("exam") || "").trim();
    const difficulty = (sp.get("difficulty") || "").trim();
    if (exam) q = q.eq("exam", exam);
    if (DIFFS.includes(difficulty)) q = q.eq("difficulty", difficulty);
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
