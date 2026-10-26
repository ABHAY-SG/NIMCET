/** @jest-environment node */
import { validateTestResults } from "@/lib/qa/engine";
import { qaQuestionAllowed, qaTestAccess, type QaAccessState } from "@/lib/qa/server";
import {
  EMPTY_COUNTS,
  QA_ENGINE_VERSION,
  QA_POLICY_VERSION,
  type QuestionQaResult,
  type QaStatus,
  type QaTestRow,
} from "@/lib/qa/types";

function result(status: QaStatus): QuestionQaResult {
  return {
    status,
    counts:
      status === "FAILED"
        ? { ...EMPTY_COUNTS, critical: 1, total: 1 }
        : status === "NEEDS_REVIEW"
          ? { ...EMPTY_COUNTS, review: 1, total: 1 }
          : status === "WARNING"
            ? { ...EMPTY_COUNTS, warning: 1, total: 1 }
            : { ...EMPTY_COUNTS },
    findings: [],
    kind: "mathematics",
    computedAnswer: null,
    deterministicVerified: status === "PASS",
    engineVersion: QA_ENGINE_VERSION,
    policyVersion: QA_POLICY_VERSION,
    checkedAt: new Date().toISOString(),
    summary: status,
  };
}

const test: QaTestRow = {
  id: "test-1",
  title: "Arithmetic practice",
  exam: "nimcet",
  template: "",
  minutes: 30,
  published: false,
  question_ids: ["a", "b"],
};

describe("Question QA publish policy", () => {
  it("publishes PASS and WARNING tests", () => {
    const pass = validateTestResults(test, [
      { id: "a", result: result("PASS") },
      { id: "b", result: result("PASS") },
    ]);
    expect(pass.status).toBe("PASS");
    expect(pass.eligible).toBe(true);

    const warning = validateTestResults(test, [
      { id: "a", result: result("PASS") },
      { id: "b", result: result("WARNING") },
    ]);
    expect(warning.status).toBe("WARNING");
    expect(warning.eligible).toBe(true);
  });

  it("always blocks critical failures, even with an override reason", () => {
    const r = validateTestResults(
      test,
      [
        { id: "a", result: result("PASS") },
        { id: "b", result: result("FAILED") },
      ],
      { overrideReason: "Reviewed by an admin and accepted." }
    );
    expect(r.status).toBe("FAILED");
    expect(r.eligible).toBe(false);
    expect(r.findings.some((f) => f.code === "TEST_QUESTION_FAILED")).toBe(true);
  });

  it("blocks review-level results until an explicit reason is supplied", () => {
    const blocked = validateTestResults(test, [
      { id: "a", result: result("PASS") },
      { id: "b", result: result("NEEDS_REVIEW") },
    ]);
    expect(blocked.status).toBe("NEEDS_REVIEW");
    expect(blocked.eligible).toBe(false);
    expect(blocked.findings.some((f) => f.code === "TEST_QUESTION_REVIEW")).toBe(true);

    const allowed = validateTestResults(
      test,
      [
        { id: "a", result: result("PASS") },
        { id: "b", result: result("NEEDS_REVIEW") },
      ],
      { overrideReason: "Manual review completed; the ambiguity is acceptable." }
    );
    expect(allowed.status).toBe("NEEDS_REVIEW");
    expect(allowed.eligible).toBe(true);
    expect(allowed.overrideReason).toContain("Manual review");
  });

  it("blocks empty, missing and duplicate papers", () => {
    const empty = validateTestResults({ ...test, question_ids: [] }, []);
    expect(empty.status).toBe("FAILED");
    expect(empty.eligible).toBe(false);
    expect(empty.findings.some((f) => f.code === "TEST_EMPTY")).toBe(true);

    const missing = validateTestResults(test, [{ id: "a", result: result("PASS") }]);
    expect(missing.status).toBe("FAILED");
    expect(missing.findings.some((f) => f.code === "TEST_MISSING_QUESTION")).toBe(true);

    const duplicate = validateTestResults(
      { ...test, question_ids: ["a", "a"] },
      [{ id: "a", result: result("PASS") }]
    );
    expect(duplicate.status).toBe("FAILED");
    expect(duplicate.findings.some((f) => f.code === "TEST_DUPLICATE_QUESTION")).toBe(true);
  });
});

describe("student QA access helpers", () => {
  const base: QaAccessState = {
    available: true,
    questions: new Map(),
    tests: new Map(),
  };

  it("treats an unaudited legacy row as readable", () => {
    expect(qaQuestionAllowed(base, "q1", false)).toBe(true);
    expect(qaTestAccess(base, "t1").allowed).toBe(true);
  });

  it("fails closed for stale and FAILED questions", () => {
    const qa: QaAccessState = {
      ...base,
      questions: new Map([
        ["failed", { status: "FAILED" as QaStatus, stale: false }],
        ["stale", { status: "WARNING" as QaStatus, stale: true }],
        ["pass", { status: "PASS" as QaStatus, stale: false }],
      ]),
    };
    expect(qaQuestionAllowed(qa, "failed", true)).toBe(false);
    expect(qaQuestionAllowed(qa, "stale", true)).toBe(false);
    expect(qaQuestionAllowed(qa, "pass", false)).toBe(true);
    expect(qaQuestionAllowed(qa, "unknown", false)).toBe(true);
  });

  it("allows review questions only when the test carries an override", () => {
    const qa: QaAccessState = {
      ...base,
      questions: new Map([["review", { status: "NEEDS_REVIEW" as QaStatus, stale: false }]]),
      tests: new Map([
        ["blocked", { status: "NEEDS_REVIEW" as QaStatus, eligible: false, overrideReason: null }],
        ["overridden", { status: "NEEDS_REVIEW" as QaStatus, eligible: true, overrideReason: "checked" }],
      ]),
    };
    expect(qaQuestionAllowed(qa, "review", false)).toBe(false);
    expect(qaQuestionAllowed(qa, "review", true)).toBe(true);
    expect(qaTestAccess(qa, "blocked")).toMatchObject({ allowed: false, override: false });
    expect(qaTestAccess(qa, "overridden")).toMatchObject({ allowed: true, override: true });
  });
});
