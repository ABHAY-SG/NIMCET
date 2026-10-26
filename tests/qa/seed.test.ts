/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateQuestion } from "@/lib/qa/engine";
import type { QaStatus, QaQuestion, QuestionSibling } from "@/lib/qa/types";

type SeedRow = {
  seq: number;
  section: string;
  topic: string;
  stem: string;
  options?: string[];
  answer: number;
  explanation?: string;
  plus?: number;
  minus?: number;
  imageUrl?: string;
};

const rows = JSON.parse(
  readFileSync(join(process.cwd(), "supabase/seed/nimcet-2026-paper/questions.json"), "utf8")
) as SeedRow[];

const siblings: QuestionSibling[] = rows.map((r) => ({
  id: `seed-${r.seq}`,
  stem: r.stem,
  section: r.section,
}));

function validate(row: SeedRow) {
  const input: QaQuestion = {
    id: `seed-${row.seq}`,
    exam: "nimcet",
    section: row.section,
    topic: row.topic,
    difficulty: "Medium",
    stem: row.stem,
    options: row.options ?? [],
    answer: row.answer,
    explanation: row.explanation ?? "",
    plus: row.plus ?? 12,
    minus: row.minus ?? -3,
    image_url: row.imageUrl ?? "",
  };
  return validateQuestion(input, { siblings });
}

describe("NIMCET 2026 seed audit", () => {
  it("keeps the reviewed status distribution", () => {
    const counts: Record<QaStatus, number> = { PASS: 0, WARNING: 0, FAILED: 0, NEEDS_REVIEW: 0 };
    for (const row of rows) counts[validate(row).status] += 1;
    expect(rows).toHaveLength(120);
    expect(counts).toEqual({ PASS: 32, WARNING: 63, NEEDS_REVIEW: 22, FAILED: 3 });
  });

  it("keeps the three genuine failures identified by manual review", () => {
    const failed = rows.filter((r) => validate(r).status === "FAILED").map((r) => r.seq);
    expect(failed.sort((a, b) => a - b)).toEqual([62, 69, 74]);
    expect(validate(rows.find((r) => r.seq === 62)!).findings.some((f) => f.code === "LOGIC_SYLLOGISM_NO_CORRECT")).toBe(true);
    expect(validate(rows.find((r) => r.seq === 69)!).findings.some((f) => f.code === "STEM_TOO_SHORT")).toBe(true);
    expect(validate(rows.find((r) => r.seq === 74)!).findings.some((f) => f.code === "STEM_TOO_SHORT")).toBe(true);
  });

  it("keeps the reviewed coding example defect visible", () => {
    const row = rows.find((r) => r.seq === 60)!;
    const r = validate(row);
    expect(r.status).not.toBe("PASS");
    expect(r.findings.some((f) => f.code === "LOGIC_CODING_EXAMPLE_MISMATCH")).toBe(true);
  });

  it("does not report false arithmetic contradictions on reviewed maths questions", () => {
    for (const seq of [11, 25, 27, 29, 37, 40, 50, 77, 90]) {
      const r = validate(rows.find((row) => row.seq === seq)!);
      expect(r.findings.some((f) => f.code === "MATH_EXPLANATION_ARITHMETIC")).toBe(false);
    }
  });
});
