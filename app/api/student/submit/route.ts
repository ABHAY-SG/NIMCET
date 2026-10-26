import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { marksUsed } from "@/lib/exam-session";
import {
  isMissingImageColumn,
  isMissingTemplateColumn,
  loadQuestionAccess,
  stringIds,
} from "@/lib/student-question-access";

type AnswerIn = { id: string; answer: number | null };
type BankRow = {
  id: string;
  answer: number;
  plus: number;
  minus: number;
  stem: string;
  options: unknown;
  explanation: unknown;
  image_url?: string | null;
  section?: string | null;
};
type TestRow = {
  id: string;
  title: string;
  question_ids: unknown;
  template?: unknown;
};

// POST /api/student/submit — scores a finished PRACTICE mock SERVER-SIDE from
// the answer key and records the attempt. The browser never receives correct
// answers before submitting. Hardening (2026-10 audit):
//   - duplicate question ids are scored ONCE (they used to stack marks and
//     forge arbitrarily high scores);
//   - a submission MUST resolve to a published test (by id or exact title)
//     unless it explicitly declares itself a custom practice run;
//   - every submitted question must belong to that test, or (for custom runs)
//     to the published, non-template practice pool;
//   - timed template exams are refused here entirely: they finalize through
//     the server-owned mock_sessions workflow, which owns the clock;
//   - questions reserved for a timed paper can never be read through the
//     practice path, so their answer key cannot be farmed with a fake name;
//   - submissions are throttled per account;
//   - retried submissions of the same finished run do not create duplicate
//     attempt rows;
//   - raw database error text is never returned to the client.

const SUBMIT_WINDOW_MS = 5 * 60_000;
const SUBMIT_MAX_IN_WINDOW = 25;
// Identical-attempt dedupe window: an attempt with the same test name and the
// exact same counters recorded moments ago is the same submission retried.
const DUPLICATE_WINDOW_MS = 120_000;

async function readPublishedTest(
  svc: Parameters<typeof loadQuestionAccess>[0],
  kind: "id" | "title",
  value: string
): Promise<TestRow | null> {
  // `template` only exists after migration 0007 — read it compatibly so older
  // databases keep working, but fail closed on any other database error.
  let res = await svc
    .from("tests")
    .select("id,title,question_ids,template")
    .eq(kind, value)
    .eq("published", true)
    .maybeSingle<TestRow>();
  if (res.error) {
    // Only fall back for the pre-0007 schema. A transient/permission error
    // must fail closed, otherwise a timed test could be submitted directly
    // because its template marker was silently lost.
    if (!isMissingTemplateColumn(res.error)) throw res.error;
    res = await svc
      .from("tests")
      .select("id,title,question_ids")
      .eq(kind, value)
      .eq("published", true)
      .maybeSingle<TestRow>();
  }
  if (res.error) throw res.error;
  return res.data ?? null;
}

export async function POST(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const body = (await req.json()) as {
      test?: unknown;
      testId?: unknown;
      custom?: unknown;
      answers?: unknown;
    };
    const test = typeof body.test === "string" ? body.test.trim().slice(0, 120) : "";
    const rawTestId = typeof body.testId === "string" ? body.testId.trim() : "";
    const custom = body.custom === true;
    const raw = Array.isArray(body.answers) ? (body.answers as AnswerIn[]) : [];

    if (!test) return NextResponse.json({ error: "Missing test name." }, { status: 400 });
    if (rawTestId && !isUuid(rawTestId)) {
      return NextResponse.json({ error: "Invalid test id." }, { status: 400 });
    }
    if (custom && rawTestId) {
      return NextResponse.json({ error: "A custom practice run cannot carry a test id." }, { status: 400 });
    }
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

    // Resolve the authorization scope BEFORE reading any question row.
    // Test-specific submissions must name a real published test. Custom
    // practice runs are allowed only against the published, non-template pool.
    let allowed: Set<string>;
    let attemptName = test;

    if (custom) {
      const access = await loadQuestionAccess(svc);
      allowed = access.practice;
      if (allowed.size === 0) {
        return NextResponse.json(
          { error: "No practice questions are available yet." },
          { status: 400 }
        );
      }
    } else {
      const tq = rawTestId
        ? await readPublishedTest(svc, "id", rawTestId)
        : await readPublishedTest(svc, "title", test);
      if (!tq) {
        return NextResponse.json(
          { error: "Unknown test. Reload the mock list and try again." },
          { status: 400 }
        );
      }
      // Any template exam is clock/session-owned. Direct submissions would
      // bypass section timing, so they are refused even when the question ids
      // look correct.
      if (String(tq.template ?? "").trim() !== "") {
        return NextResponse.json(
          { error: "This is a timed template exam — it submits itself from the test screen." },
          { status: 409 }
        );
      }
      const testIds = stringIds(tq.question_ids);
      if (testIds.length === 0) {
        return NextResponse.json(
          { error: "This test has no questions available." },
          { status: 400 }
        );
      }
      // Reuse the same QA-filtered practice scope as the question read route.
      // A test whose paper failed/stale QA must not be scored from the bank.
      const access = await loadQuestionAccess(svc);
      if (testIds.some((id) => !access.practice.has(id))) {
        return NextResponse.json(
          { error: "This test is temporarily unavailable while its questions are being checked. Please try again later." },
          { status: 403 }
        );
      }
      allowed = access.practice;
      attemptName = (tq.title || test).trim().slice(0, 120) || test;
    }

    for (const id of unique.keys()) {
      if (!allowed.has(id)) {
        return NextResponse.json({ error: "Unknown question in submission." }, { status: 400 });
      }
    }

    const ids = [...unique.keys()];
    const selectQuestions = (columns: string) =>
      svc.from("questions").select(columns).in("id", ids);
    const full = await selectQuestions(
      "id,answer,plus,minus,stem,options,explanation,image_url,section"
    );
    let data = full.data as unknown as BankRow[] | null;
    let error = full.error;
    if (error && isMissingImageColumn(error)) {
      // Pre-0009 database: score normally, just without the optional figure.
      const legacy = await selectQuestions(
        "id,answer,plus,minus,stem,options,explanation,section"
      );
      data = legacy.data as unknown as BankRow[] | null;
      error = legacy.error;
    }
    if (error) throw error;
    const byId = new Map<string, BankRow>();
    for (const q of data ?? []) byId.set(q.id, q);
    if (byId.size !== ids.length) {
      return NextResponse.json({ error: "Unknown question in submission." }, { status: 400 });
    }

    // Validate every pick fits its options.
    for (const [id, pick] of unique) {
      const q = byId.get(id)!;
      const opts = Array.isArray(q.options) ? (q.options as unknown[]) : [];
      if (pick !== null && pick >= opts.length) {
        return NextResponse.json({ error: "Invalid answer option." }, { status: 400 });
      }
    }

    type Detail = {
      stem: string; opts: string[]; picked: number | null;
      correct: number; exp: string; image?: string; ok?: boolean;
    };
    const detailById = new Map<string, Detail>();
    let score = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    for (const [id, pick] of unique) {
      const q = byId.get(id)!;
      const marks = marksUsed(
        { section: q.section ?? "", plus: Number(q.plus) || 0, minus: Number(q.minus) || 0 },
        "" // only the full-mock template changes marking, and those are refused above
      );
      const plus = marks.plus;
      const minus = marks.minus;
      const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
      const exp = typeof q.explanation === "string" ? q.explanation : "";
      const image = typeof q.image_url === "string" && q.image_url.trim() ? q.image_url.trim() : undefined;
      if (pick === null) {
        skipped++;
        detailById.set(id, { stem: q.stem, opts, picked: null, correct: q.answer, exp, image });
        continue;
      }
      if (pick === q.answer) {
        correct++;
        score += plus;
        detailById.set(id, { stem: q.stem, opts, picked: pick, correct: q.answer, exp, image, ok: true });
      } else {
        wrong++;
        score += minus;
        detailById.set(id, { stem: q.stem, opts, picked: pick, correct: q.answer, exp, image, ok: false });
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
      .eq("test", attemptName)
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
        test: attemptName,
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
