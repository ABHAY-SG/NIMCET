import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fetchAllRows, fetchAllTests, normTitle } from "@/lib/admin-queries";
import { FULL_LENGTH_QUESTIONS, parseRow, type ParsedRow } from "@/lib/question-rows";
import { logAdminAction } from "@/lib/audit";

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// POST /api/admin/tests/from-csv — create one full-length mock test from
// exactly 120 validated rows, in the existing schema:
//   1. rows are validated with the SAME parser the bank importer uses;
//   2. row exam / plus / minus fall back to the request's exam + marking
//      scheme when those cells are blank;
//   3. identical questions already in the bank (same normalized stem) are
//      REUSED, never duplicated — retrying an import is safe;
//   4. the new test links the resolved question ids in CSV order;
//   5. if the test insert fails, freshly inserted questions are removed so a
//      failed attempt never strands bank rows.
// created_at ordering / published flag stay compatible with the student hub.
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  let newIds: string[] = [];
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const title = s(body.title);
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (title.length > 160) {
      return NextResponse.json({ error: "Title must be under 160 characters." }, { status: 400 });
    }
    const exam = s(body.exam) || "nimcet";
    if (exam.length > 80) return NextResponse.json({ error: "Exam must be under 80 characters." }, { status: 400 });
    const tag = s(body.tag).slice(0, 80);

    const minutes = body.minutes === undefined ? 120 : Number(body.minutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 180) {
      return NextResponse.json({ error: "Duration must be 5–180 minutes." }, { status: 400 });
    }

    const description = s(body.description);
    if (description.length > 4000) {
      return NextResponse.json({ error: "Description must be under 4000 characters." }, { status: 400 });
    }
    const instructions = s(body.instructions);
    if (instructions.length > 8000) {
      return NextResponse.json({ error: "Instructions must be under 8000 characters." }, { status: 400 });
    }

    const scheme = (body.scheme ?? {}) as Record<string, unknown>;
    const schemePlus = scheme.plus === undefined ? 12 : Number(scheme.plus);
    if (!Number.isFinite(schemePlus) || schemePlus <= 0 || schemePlus > 1000) {
      return NextResponse.json({ error: "Default plus marks must be 1–1000." }, { status: 400 });
    }
    const schemeMinus = scheme.minus === undefined ? -3 : Number(scheme.minus);
    if (!Number.isFinite(schemeMinus) || schemeMinus > 0 || schemeMinus < -1000) {
      return NextResponse.json({ error: "Default minus marks must be between -1000 and 0." }, { status: 400 });
    }

    const rows = Array.isArray(body.rows) ? (body.rows as Array<Record<string, unknown>>) : [];
    if (rows.length !== FULL_LENGTH_QUESTIONS) {
      return NextResponse.json(
        { error: `A full-length mock needs exactly ${FULL_LENGTH_QUESTIONS} questions — this file has ${rows.length}.` },
        { status: 400 }
      );
    }

    const parsed: ParsedRow[] = [];
    const seen = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || typeof r !== "object") return NextResponse.json({ error: `Row ${i + 1}: invalid row.` }, { status: 400 });
      const out = parseRow(r, i, { exam, plus: schemePlus, minus: schemeMinus });
      if (typeof out === "string") return NextResponse.json({ error: out }, { status: 400 });
      const key = normTitle(out.stem);
      const first = seen.get(key);
      if (first !== undefined) {
        return NextResponse.json(
          { error: `Rows ${first + 1} and ${i + 1}: duplicate question text — every question in a mock must be unique.` },
          { status: 400 }
        );
      }
      seen.set(key, i);
      parsed.push(out);
    }

    // description/instructions only exist after migration 0005 — check BEFORE
    // inserting questions so a legacy database cannot strand bank rows.
    let migrated = true;
    if (description || instructions) {
      migrated = (await fetchAllTests(svc, 1)).migrated;
      if (!migrated) {
        return NextResponse.json(
          { error: "The database is missing the new test columns. Run supabase/migrations/0005_admin.sql, then retry." },
          { status: 503 }
        );
      }
    }

    // Reuse identical bank questions instead of inserting duplicates.
    const bank = await fetchAllRows<{ id: string; stem: string }>(svc, "questions", "id,stem", 5000);
    const byStem = new Map<string, string>();
    for (const q of bank) {
      const key = normTitle(String(q.stem ?? ""));
      if (key) byStem.set(key, String(q.id));
    }

    const fresh = parsed.filter((r) => !byStem.has(normTitle(r.stem)));
    let inserted = 0;
    if (fresh.length > 0) {
      const { data, error } = await svc.from("questions").insert(fresh).select("id,stem");
      if (error) throw error;
      for (const q of (data ?? []) as Array<{ id: string; stem: string }>) {
        byStem.set(normTitle(String(q.stem)), String(q.id));
        newIds.push(String(q.id));
      }
      inserted = fresh.length;
    }

    const questionIds = parsed.map((r) => byStem.get(normTitle(r.stem)));
    if (questionIds.some((id) => !id)) throw new Error("Question ids could not be resolved after insert.");

    const insert: Record<string, unknown> = {
      exam,
      title,
      tag,
      minutes: Math.floor(minutes),
      free: body.free === undefined ? true : Boolean(body.free),
      published: body.published === undefined ? false : Boolean(body.published),
      question_ids: questionIds as string[],
    };
    if (migrated) {
      insert.description = description;
      insert.instructions = instructions;
    }

    const { data: t, error: tErr } = await svc.from("tests").insert(insert).select("id").single();
    if (tErr) throw tErr;
    newIds = []; // the questions now belong to a real test — never clean them up

    await logAdminAction(svc, {
      actor,
      action: "test.create_from_csv",
      entity: "test",
      entityId: (t as { id: string }).id,
      details: {
        title,
        questions: parsed.length,
        inserted,
        reused: parsed.length - inserted,
        published: insert.published as boolean,
      },
    });

    return NextResponse.json({
      id: (t as { id: string }).id,
      title,
      questions: parsed.length,
      inserted,
      reused: parsed.length - inserted,
      published: insert.published as boolean,
    });
  } catch (e) {
    // A failed test insert must not strand the questions it just inserted —
    // retrying would reuse them, but leaving orphans behind is worse.
    if (newIds.length > 0) {
      try {
        await svc.from("questions").delete().in("id", newIds);
      } catch {}
    }
    const p = errorPayload(e, "Create failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
