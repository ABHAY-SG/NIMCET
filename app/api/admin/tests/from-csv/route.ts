import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload, fetchAllRows, fetchAllTests, normTitle } from "@/lib/admin-queries";
import { FULL_LENGTH_QUESTIONS, parseRow, type ParsedRow } from "@/lib/question-rows";
import {
  FULL_MOCK_MINUTES,
  FULL_MOCK_TEMPLATE,
  isFullMockTemplate,
  orderBySubject,
  subjectForSection,
  SUBJECTS,
  templateParts,
} from "@/lib/nimcet-full-mock";
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
//
// template: "nimcet-2026" switches on the official full-mock rules — subject
// counts (50/40/20/10), per-subject marks, 4–5 options per question, 120
// minutes, and the three timed parts stored on the test. Blank marks cells
// pick up the subject's official marks; contradicting values are rejected.
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  let newIds: string[] = [];
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const template = isFullMockTemplate(body.template) ? FULL_MOCK_TEMPLATE : "";

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
    if (template && minutes !== FULL_MOCK_MINUTES) {
      return NextResponse.json(
        { error: `A NIMCET full mock is always ${FULL_MOCK_MINUTES} minutes (70 + 30 + 20).` },
        { status: 400 }
      );
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
      if (template) {
        const subject = subjectForSection(r.section);
        if (!subject) {
          return NextResponse.json(
            {
              error: `Row ${i + 1}: section “${s(r.section) || "—"}” doesn't map to a NIMCET subject (${SUBJECTS.map((x) => x.label).join(" / ")}).`,
            },
            { status: 400 }
          );
        }
        const out = parseRow(r, i, { exam, plus: subject.plus, minus: subject.minus });
        if (typeof out === "string") return NextResponse.json({ error: out }, { status: 400 });
        if (Math.abs(out.plus - subject.plus) > 1e-9 || Math.abs(out.minus - subject.minus) > 1e-9) {
          return NextResponse.json(
            {
              error: `Row ${i + 1} (${subject.label}): marks must be +${subject.plus} / ${subject.minus} per the NIMCET 2026 rules — found +${out.plus} / ${out.minus}.`,
            },
            { status: 400 }
          );
        }
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
        continue;
      }
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

    // Template mode: exact subject composition, then reorder the paper into
    // the official section order so question numbering always runs
    // Maths → Reasoning → Computer → English.
    let ordered: ParsedRow[] = parsed;
    if (template) {
      const counts = new Map<string, number>();
      for (const rowParsed of parsed) {
        const subject = subjectForSection(rowParsed.section);
        if (subject) counts.set(subject.key, (counts.get(subject.key) ?? 0) + 1);
      }
      for (const subject of SUBJECTS) {
        const found = counts.get(subject.key) ?? 0;
        if (found !== subject.count) {
          return NextResponse.json(
            { error: `${subject.label}: ${found} question(s) found — exactly ${subject.count} required.` },
            { status: 400 }
          );
        }
      }
      ordered = orderBySubject(parsed);
    }

    // description/instructions only exist after migration 0005 and template
    // after 0007 — check BEFORE inserting questions so a legacy database
    // cannot strand bank rows.
    let migrated = true;
    let templated = true;
    if (description || instructions || template) {
      const info = await fetchAllTests(svc, 1);
      migrated = info.migrated;
      templated = info.templated;
      if (!migrated) {
        return NextResponse.json(
          { error: "The database is missing the new test columns. Run supabase/migrations/0005_admin.sql, then retry." },
          { status: 503 }
        );
      }
      if (template && !templated) {
        return NextResponse.json(
          { error: "The database is missing the template column. Run supabase/migrations/0007_full_mock.sql, then retry." },
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

    const fresh = ordered.filter((r) => !byStem.has(normTitle(r.stem)));
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

    const questionIds = ordered.map((r) => byStem.get(normTitle(r.stem)));
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
    if (template) {
      insert.template = template;
      insert.minutes = FULL_MOCK_MINUTES;
      insert.sections = templateParts();
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
        questions: ordered.length,
        inserted,
        reused: ordered.length - inserted,
        published: insert.published as boolean,
        ...(template ? { template } : {}),
      },
    });

    return NextResponse.json({
      id: (t as { id: string }).id,
      title,
      questions: ordered.length,
      inserted,
      reused: ordered.length - inserted,
      published: insert.published as boolean,
      ...(template ? { template } : {}),
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
