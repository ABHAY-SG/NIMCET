import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fetchAllQuestionsLite, toCsv } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

function toNum(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

const DIFFS = ["Easy", "Medium", "Hard"];

function validate(body: Record<string, unknown>): string | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (body.exam !== undefined && !s(body.exam).trim()) return "Exam is required.";
  if (body.stem !== undefined && !s(body.stem).trim()) return "Question text is required.";
  if (body.topic !== undefined && !s(body.topic).trim()) return "Topic is required.";
  if (body.options !== undefined) {
    const opts = Array.isArray(body.options) ? body.options : [];
    if ((opts.length !== 4 && opts.length !== 5) || opts.some((o) => typeof o !== "string" || !o.trim())) {
      return "Provide 4 or 5 non-empty options.";
    }
  }
  if (body.answer !== undefined) {
    const ans = Number(body.answer);
    if (!Number.isInteger(ans) || ans < 0 || ans > 4) return "Answer must be option A–E.";
  }
  if (body.difficulty !== undefined && !DIFFS.includes(String(body.difficulty))) {
    return "Difficulty must be Easy, Medium or Hard.";
  }
  if (body.plus !== undefined) {
    const plus = Number(body.plus);
    if (!Number.isFinite(plus) || plus <= 0 || plus > 1000) return "Marks must be a positive number.";
  }
  if (body.minus !== undefined) {
    const minus = Number(body.minus);
    if (!Number.isFinite(minus) || minus > 0 || minus < -1000) {
      return "Negative marks must be zero or a negative number.";
    }
  }
  return null;
}

type QFull = {
  id: string;
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
  created_at: string;
};

// GET /api/admin/questions — full rows incl. answers (admin only).
//   ?exam=&section=&topic=&difficulty=&q=&sort=newest|oldest&limit=
//   ?ids=a,b,c        — fetch exact questions (test preview beyond bank caps)
//   ?facets=1         — distinct exam/section/topic values with real counts
//   ?format=csv       — export (answer keys included; admin-only download)
export async function GET(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("facets")) {
      const lite = await fetchAllQuestionsLite(svc);
      const count = (key: "exam" | "section" | "topic") => {
        const m = new Map<string, number>();
        for (const q of lite) {
          const v = (q[key] || "").trim() || "—";
          m.set(v, (m.get(v) ?? 0) + 1);
        }
        return [...m.entries()].map(([value, n]) => ({ value, count: n })).sort((a, b) => b.count - a.count);
      };
      return NextResponse.json({
        exams: count("exam"),
        sections: count("section"),
        topics: count("topic"),
        difficulties: DIFFS.map((d) => ({ value: d, count: lite.filter((q) => q.difficulty === d).length })),
        total: lite.length,
      });
    }

    const limit = toNum(searchParams.get("limit"), 500, 1, 1000);
    const sort = searchParams.get("sort") || "newest";
    const format = searchParams.get("format") || "";
    const idsParam = (searchParams.get("ids") || "").trim();

    let query = svc
      .from("questions")
      .select("*")
      .order("created_at", { ascending: sort === "oldest" })
      .order("id", { ascending: sort === "oldest" })
      .limit(limit);

    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
      if (ids.length === 0) return NextResponse.json({ rows: [] });
      query = query.in("id", ids);
    } else {
      const exam = (searchParams.get("exam") || "").trim();
      const section = (searchParams.get("section") || "").trim();
      const topic = (searchParams.get("topic") || "").trim();
      const difficulty = (searchParams.get("difficulty") || "").trim();
      const q = (searchParams.get("q") || "").trim();
      if (exam && exam !== "all") query = query.eq("exam", exam);
      if (section) query = query.eq("section", section);
      if (topic) query = query.eq("topic", topic);
      if (difficulty && DIFFS.includes(difficulty)) query = query.eq("difficulty", difficulty);
      if (q) query = query.ilike("stem", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as QFull[];

    if (format === "csv") {
      const letters = ["A", "B", "C", "D"];
      const csv = toCsv(
        ["id", "exam", "section", "topic", "difficulty", "stem", "optionA", "optionB", "optionC", "optionD", "answer", "explanation", "plus", "minus", "created_at"],
        rows.map((r) => [
          r.id,
          r.exam,
          r.section,
          r.topic,
          r.difficulty,
          r.stem,
          r.options?.[0] ?? "",
          r.options?.[1] ?? "",
          r.options?.[2] ?? "",
          r.options?.[3] ?? "",
          letters[r.answer] ?? "",
          r.explanation,
          r.plus,
          r.minus,
          r.created_at,
        ])
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="questions-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ rows });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}

// POST /api/admin/questions — create (always a usable draft row).
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const bad = validate(body);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    // POST creates a complete row; the partial-update rules above are not
    // enough on their own (omitted options used to crash into a 500).
    const missing = (["exam", "stem", "options", "answer"] as const).filter((k) => body[k] === undefined);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Exam, question text, all 4 options and the correct answer are required." },
        { status: 400 }
      );
    }
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

    await logAdminAction(svc, {
      actor,
      action: "question.create",
      entity: "question",
      entityId: (data as { id: string }).id,
      details: {
        exam: s(body.exam).trim(),
        section: s(body.section).trim(),
        topic: s(body.topic).trim(),
        difficulty: s(body.difficulty, "Medium"),
        stem: s(body.stem).trim().slice(0, 80),
      },
    });

    return NextResponse.json({ id: (data as { id: string }).id });
  } catch (e) {
    const p = errorPayload(e, "Create failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
