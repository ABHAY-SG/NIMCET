/** @jest-environment node */
import { validateQuestion } from "@/lib/qa/engine";
import type { QaQuestion } from "@/lib/qa/types";

const base: QaQuestion = {
  id: "q-test",
  exam: "nimcet",
  section: "Mathematics",
  topic: "Arithmetic",
  difficulty: "Easy",
  stem: "What is the value of 12 + 8?",
  options: ["20", "19", "21", "18"],
  answer: 0,
  explanation: "12 + 8 = 20.",
  plus: 12,
  minus: -3,
};

function q(overrides: Partial<QaQuestion>): QaQuestion {
  return { ...base, ...overrides };
}

describe("Question QA engine — deterministic checks", () => {
  it("passes a clean arithmetic question with no findings", () => {
    const r = validateQuestion(base);
    expect(r.status).toBe("PASS");
    expect(r.counts.critical).toBe(0);
    expect(r.counts.review).toBe(0);
    expect(r.findings).toEqual([]);
    expect(r.deterministicVerified).toBe(true);
    expect(r.computedAnswer).toBe(0);
  });

  it("fails a wrong answer key", () => {
    const r = validateQuestion(q({ options: ["19", "20", "21", "18"], answer: 0 }));
    expect(r.status).toBe("FAILED");
    expect(r.findings.some((f) => f.code === "MATH_ANSWER_MISMATCH")).toBe(true);
    expect(r.findings.find((f) => f.code === "MATH_ANSWER_MISMATCH")?.field).toBe("answer");
  });

  it("fails a pure-numeric explanation contradiction", () => {
    const r = validateQuestion(q({ explanation: "12 + 8 = 21." }));
    expect(r.status).toBe("FAILED");
    expect(r.findings.some((f) => f.code === "MATH_EXPLANATION_ARITHMETIC")).toBe(true);
    expect(r.findings.find((f) => f.code === "MATH_EXPLANATION_ARITHMETIC")?.field).toBe("explanation");
  });

  it("does not treat a case-split variable substitution as an arithmetic contradiction", () => {
    const r = validateQuestion(
      q({
        stem: "If a point is equidistant from the axes and lies on 8x - 3y = 11, which quadrant contains it?",
        options: ["I", "II", "III", "IV"],
        answer: 3,
        explanation:
          "Case 1: y = x, so 5x = 11 and x = 11/5, which is not an integer. Case 2: y = -x, so 11x = 11 and x = 1, hence y = -1, so the point lies in the fourth quadrant.",
      })
    );
    expect(r.findings.some((f) => f.code === "MATH_EXPLANATION_ARITHMETIC")).toBe(false);
    expect(r.status).not.toBe("FAILED");
  });

  it("fails empty stems, duplicate options, broken HTML and broken LaTeX", () => {
    const empty = validateQuestion(q({ stem: "" }));
    expect(empty.status).toBe("FAILED");
    expect(empty.findings.some((f) => f.code === "STEM_EMPTY")).toBe(true);

    const duplicate = validateQuestion(q({ options: ["20", "20", "21", "18"] }));
    expect(duplicate.status).toBe("FAILED");
    expect(duplicate.findings.some((f) => f.code === "OPTION_DUPLICATE")).toBe(true);

    const html = validateQuestion(q({ explanation: '<span onclick="alert(1)">unclosed' }));
    expect(html.findings.some((f) => f.code.startsWith("RENDER_HTML"))).toBe(true);
    expect(html.status).toBe("FAILED");

    const latex = validateQuestion(q({ stem: "Solve \\(x + 1" }));
    expect(latex.findings.some((f) => f.code === "RENDER_DELIMITER")).toBe(true);
    expect(latex.status).toBe("FAILED");
  });

  it("fails invalid marks and missing metadata", () => {
    const marks = validateQuestion(q({ plus: 0, minus: 3 }));
    expect(marks.status).toBe("FAILED");
    expect(marks.findings.some((f) => f.code === "MARKS_PLUS")).toBe(true);
    expect(marks.findings.some((f) => f.code === "MARKS_MINUS")).toBe(true);

    const meta = validateQuestion(q({ exam: "", section: "" }));
    expect(meta.status).toBe("FAILED");
    expect(meta.findings.some((f) => f.code === "META_EXAM_MISSING")).toBe(true);
    expect(meta.findings.some((f) => f.code === "META_SECTION_MISSING")).toBe(true);
  });

  it("flags a duplicate question in the same bank", () => {
    const r = validateQuestion(base, {
      siblings: [{ id: "other", stem: "What is the value of 12 + 8?", section: "Mathematics" }],
    });
    expect(r.status).toBe("FAILED");
    expect(r.findings.some((f) => f.code === "DUPLICATE_STEM")).toBe(true);
  });

  it("marks unsupported mathematics as review, never a false pass", () => {
    const r = validateQuestion(
      q({
        stem: "Evaluate the contour integral of an arbitrary holomorphic function over a closed curve.",
        options: ["0", "1", "2", "Depends"],
        answer: 0,
        explanation: "By a standard theorem this is zero.",
      })
    );
    expect(r.status === "NEEDS_REVIEW" || r.status === "WARNING").toBe(true);
    expect(r.status).not.toBe("PASS");
  });
});
