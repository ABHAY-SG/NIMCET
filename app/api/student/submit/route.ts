import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";

type AnswerIn = { id: string; answer: number | null };
type BankRow = {
  id: string;
  answer: number;
  plus: number;
  minus: number;
  stem: string;
  options: unknown;
  explanation: unknown;
};

// POST /api/student/submit — scores a finished mock SERVER-SIDE from the
// answer key and records the attempt. The browser never sees correct answers
// before submitting, and clients can no longer forge scores via direct
// inserts (see migration 0002).
export async function POST(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const body = (await req.json()) as { test?: unknown; answers?: unknown };
    const test = typeof body.test === "string" ? body.test.trim().slice(0, 120) : "";
    const answers = Array.isArray(body.answers) ? (body.answers as AnswerIn[]) : [];
    if (!test) return NextResponse.json({ error: "Missing test name." }, { status: 400 });
    if (answers.length === 0 || answers.length > 200) {
      return NextResponse.json({ error: "Submit 1–200 answers." }, { status: 400 });
    }
    for (const a of answers) {
      if (!a || typeof a.id !== "string" || !a.id.trim()) {
        return NextResponse.json({ error: "Invalid answer reference." }, { status: 400 });
      }
      if (a.answer !== null && (!Number.isInteger(a.answer) || a.answer < 0 || a.answer > 9)) {
        return NextResponse.json({ error: "Invalid answer option." }, { status: 400 });
      }
    }
    const ids = [...new Set(answers.map((a) => a.id))];
    const { data, error } = await svc
      .from("questions")
      .select("id,answer,plus,minus,stem,options,explanation")
      .in("id", ids);
    if (error) throw error;
    const byId = new Map<string, BankRow>();
    for (const q of (data ?? []) as BankRow[]) byId.set(q.id, q);

    let score = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const details = answers.map((a) => {
      const q = byId.get(a.id);
      if (!q) return null;
      const plus = Number(q.plus) || 0;
      const minus = Number(q.minus) || 0;
      const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
      const exp = typeof q.explanation === "string" ? q.explanation : "";
      if (a.answer === null) {
        skipped++;
        return { stem: q.stem, opts, picked: null, correct: q.answer, exp: q.explanation ?? "" };
      }
      if (a.answer === q.answer) {
        correct++;
        score += plus;
        return { stem: q.stem, opts, picked: a.answer, correct: q.answer, exp, ok: true };
      }
      wrong++;
      score += minus;
      return { stem: q.stem, opts, picked: a.answer, correct: q.answer, exp, ok: false };
    });
    if (details.some((d) => d === null)) {
      return NextResponse.json({ error: "Unknown question in submission." }, { status: 400 });
    }

    score = Math.round(score * 10) / 10;
    const { error: insErr } = await svc.from("attempts").insert({
      user_id: user.id,
      test,
      score,
      correct,
      wrong,
      skipped,
    });
    if (insErr) throw insErr;

    return NextResponse.json({ score, correct, wrong, skipped, details });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submit failed." },
      { status: 500 }
    );
  }
}
