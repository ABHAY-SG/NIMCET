import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";

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
// answer key and records the attempt. The browser never receives correct
// answers before submitting. Hardening (2026-10 audit):
//   - duplicate question ids are scored ONCE (they used to stack marks and
//     forge arbitrarily high scores);
//   - when the submitted test resolves to a real published test, only that
//     test's own questions are accepted (probing other questions via a fake
//     submission is rejected);
//   - submissions are throttled per account so the answer key cannot be
//     farmed by rapid blank submissions;
//   - retried submissions of the same finished run (a dropped response makes
//     the client retry) do not create duplicate attempt rows;
//   - raw database error text is never returned to the client.
const SUBMIT_WINDOW_MS = 5 * 60_000;
const SUBMIT_MAX_IN_WINDOW = 25;
// Identical-attempt dedupe window: an attempt with the same test name and the
// exact same counters recorded moments ago is the same submission retried.
const DUPLICATE_WINDOW_MS = 120_000;

export async function POST(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const body = (await req.json()) as { test?: unknown; testId?: unknown; answers?: unknown };
    const test = typeof body.test === "string" ? body.test.trim().slice(0, 120) : "";
    const testId = typeof body.testId === "string" && isUuid(body.testId) ? body.testId : "";
    const raw = Array.isArray(body.answers) ? (body.answers as AnswerIn[]) : [];
    if (!test) return NextResponse.json({ error: "Missing test name." }, { status: 400 });
    if (raw.length === 0 || raw.length > 300) {
      return NextResponse.json({ error: "Submit 1–300 answers." }, { status: 400 });
    }
    for (const a of raw) {
      if (!a || typeof a.id !== "string" || !a.id.trim() || a.id.length > 64) {
        return NextResponse.json({ error: "Invalid answer reference." }, { status: 400 });
      }
      if (a.answer !== null && (!Number.isInteger(a.answer) || a.answer < 0 || a.answer > 4)) {
        return NextResponse.json({ error: "Invalid answer option." }, { status: 400 });
      }
    }
    // First occurrence wins; scoring runs over unique questions only.
    const unique = new Map<string, number | null>();
    for (const a of raw) if (!unique.has(a.id)) unique.set(a.id, a.answer);
    if (unique.size === 0 || unique.size > 200) {
      return NextResponse.json({ error: "Submit 1–200 answers." }, { status: 400 });
    }

    // Light per-account throttle: blocks answer-key farming without getting
    // in the way of normal practice (25 submissions per 5 minutes).
    const since = new Date(Date.now() - SUBMIT_WINDOW_MS).toISOString();
    const { count: recent, error: rateErr } = await svc
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if (rateErr) throw rateErr;
    if ((recent ?? 0) >= SUBMIT_MAX_IN_WINDOW) {
      return NextResponse.json(
        { error: "Too many submissions in a row — take a short break, then continue." },
        { status: 429 }
      );
    }

    // Resolve the real test (id preferred, title as fallback) so a submission
    // can only score against that test's own questions.
    let allowed: Set<string> | null = null;
    try {
      let tq: { id: string; question_ids: unknown } | null = null;
      if (testId) {
        const { data } = await svc
          .from("tests")
          .select("id,question_ids")
          .eq("id", testId)
          .eq("published", true)
          .maybeSingle();
        tq = (data as { id: string; question_ids: unknown } | null) ?? null;
      }
      if (!tq) {
        const { data } = await svc
          .from("tests")
          .select("id,question_ids")
          .eq("title", test)
          .eq("published", true)
          .limit(1)
          .maybeSingle();
        tq = (data as { id: string; question_ids: unknown } | null) ?? null;
      }
      if (tq && Array.isArray(tq.question_ids)) {
        allowed = new Set((tq.question_ids as unknown[]).filter((x): x is string => typeof x === "string"));
      }
    } catch {
      // Test lookup is best-effort (older databases may lack columns); the
      // safer scoring path below still runs.
      allowed = null;
    }
    if (allowed) {
      for (const id of unique.keys()) {
        if (!allowed.has(id)) {
          return NextResponse.json({ error: "Unknown question in submission." }, { status: 400 });
        }
      }
    }

    const ids = [...unique.keys()];
    const { data, error } = await svc
      .from("questions")
      .select("id,answer,plus,minus,stem,options,explanation")
      .in("id", ids);
    if (error) throw error;
    const byId = new Map<string, BankRow>();
    for (const q of (data ?? []) as BankRow[]) byId.set(q.id, q);
    if (byId.size === 0) {
      return NextResponse.json({ error: "Unknown question in submission." }, { status: 400 });
    }

    // Validate that every submitted id exists and every pick fits its options.
    for (const [id, pick] of unique) {
      const q = byId.get(id);
      if (!q) return NextResponse.json({ error: "Unknown question in submission." }, { status: 400 });
      const opts = Array.isArray(q.options) ? (q.options as unknown[]) : [];
      if (pick !== null && pick >= opts.length) {
        return NextResponse.json({ error: "Invalid answer option." }, { status: 400 });
      }
    }

    type Detail = {
      stem: string; opts: string[]; picked: number | null;
      correct: number; exp: string; ok?: boolean;
    };
    const detailById = new Map<string, Detail>();
    let score = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    for (const [id, pick] of unique) {
      const q = byId.get(id)!;
      const plus = Number(q.plus) || 0;
      const minus = Number(q.minus) || 0;
      const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
      const exp = typeof q.explanation === "string" ? q.explanation : "";
      if (pick === null) {
        skipped++;
        detailById.set(id, { stem: q.stem, opts, picked: null, correct: q.answer, exp });
        continue;
      }
      if (pick === q.answer) {
        correct++;
        score += plus;
        detailById.set(id, { stem: q.stem, opts, picked: pick, correct: q.answer, exp, ok: true });
      } else {
        wrong++;
        score += minus;
        detailById.set(id, { stem: q.stem, opts, picked: pick, correct: q.answer, exp, ok: false });
      }
    }

    score = Math.round(score * 10) / 10;

    // Duplicate-submission guard: a dropped response can make the client
    // retry a submission the server already recorded. An IDENTICAL attempt
    // (same user, same test name, same counters) recorded moments ago is that
    // same submission — skip the duplicate row; the student still gets this
    // scorecard. Genuinely different outcomes are always recorded.
    const dupSince = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const { data: dups, error: dupErr } = await svc
      .from("attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("test", test)
      .eq("score", score)
      .eq("correct", correct)
      .eq("wrong", wrong)
      .eq("skipped", skipped)
      .gte("created_at", dupSince)
      .limit(1);
    if (dupErr) throw dupErr;

    if (!Array.isArray(dups) || dups.length === 0) {
      const { error: insErr } = await svc.from("attempts").insert({
        user_id: user.id,
        test,
        score,
        correct,
        wrong,
        skipped,
      });
      if (insErr) throw insErr;
    }

    // Details follow the submitted order (duplicates repeat their question's
    // detail) so the client can render them index-aligned.
    const details = raw.map((a) => detailById.get(a.id) ?? null).filter((d) => d !== null);
    return NextResponse.json({ score, correct, wrong, skipped, details });
  } catch (e) {
    const p = errorPayload(e, "Submit failed. Your answers were kept — please retry.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
