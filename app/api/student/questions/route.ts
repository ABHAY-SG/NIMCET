import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";
import {
  loadQuestionAccess,
  loadSessionQuestionIds,
} from "@/lib/student-question-access";

// Columns safe for students: no answer key, no explanations, no PII.
const SAFE = "id,exam,section,topic,difficulty,stem,options,plus,minus,created_at";
const DIFFS = ["Easy", "Medium", "Hard"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_CHUNK = 150;

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// GET /api/student/questions?limit=&exam=&difficulty= | ?ids=<csv>
//
// Authenticated students do NOT get the whole question bank. They get exactly
// the questions that belong to a PUBLISHED, non-template test (the practice
// pool), plus questions from their own mock sessions for review. Timed paper
// questions, drafts and unreleased tests never leave this route, and the
// SELECT list above can never expose an answer or explanation.
export async function GET(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const sp = new URL(req.url).searchParams;
    const ids = (sp.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => UUID.test(s))
      .slice(0, 200);

    const access = await loadQuestionAccess(svc);

    if (ids.length > 0) {
      const sessionIds = await loadSessionQuestionIds(svc, user.id);
      const allowed = new Set<string>(access.practice);
      for (const id of sessionIds) allowed.add(id);
      if (ids.some((id) => !allowed.has(id))) {
        return NextResponse.json({ error: "Question not available." }, { status: 403 });
      }
      const { data, error } = await svc.from("questions").select(SAFE).in("id", ids);
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [] });
    }

    if (access.practice.size === 0) return NextResponse.json({ rows: [] });

    const limit = toNum(sp.get("limit"), 300, 1, 300);
    const exam = (sp.get("exam") || "").trim().slice(0, 60);
    const difficulty = (sp.get("difficulty") || "").trim();

    const rows: Array<Record<string, unknown>> = [];
    // Chunked `.in(...)` keeps the PostgREST URL bounded even when a large
    // catalogue has thousands of published practice questions.
    for (const chunk of chunks([...access.practice], ID_CHUNK)) {
      let q = svc
        .from("questions")
        .select(SAFE)
        .in("id", chunk)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (exam) q = q.eq("exam", exam);
      if (DIFFS.includes(difficulty)) q = q.eq("difficulty", difficulty);
      const { data, error } = await q;
      if (error) throw error;
      for (const row of (data ?? []) as Array<Record<string, unknown>>) rows.push(row);
    }

    // Newest first across chunks, then the caller's limit (no unbounded read).
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return NextResponse.json({ rows: rows.slice(0, limit) });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
