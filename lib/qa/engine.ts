// Question QA orchestration. Deterministic validators run first; an
// unsupported/borderline question becomes NEEDS_REVIEW, never a false PASS.

import { verifyLogicQuestion, looksFormalReasoning } from "./logic";
import { verifyMathQuestion } from "./math";
import { inferQuestionKind, validateStructure } from "./structural";
import {
  QA_ENGINE_VERSION,
  QA_POLICY_VERSION,
  countFindings,
  finding,
  statusForFindings,
  summarizeStatus,
  worstStatus,
  type QaCounts,
  type QaFinding,
  type QaQuestion,
  type QaStatus,
  type QaTestRow,
  type QuestionQaResult,
  type QuestionSibling,
  type TestQaResult,
} from "./types";

export type { QaQuestion, QuestionQaResult } from "./types";

function withTiming<T>(fn: () => T, fallback: T, timeoutMs: number): T {
  // The deterministic solvers are synchronous and bounded internally. This is
  // a defensive guard for pathological regexes rather than a worker timeout.
  const started = Date.now();
  const value = fn();
  if (Date.now() - started > timeoutMs) {
    return fallback;
  }
  return value;
}

export function validateQuestion(
  input: QaQuestion,
  options: { siblings?: QuestionSibling[]; timeoutMs?: number; logicLimit?: number } = {}
): QuestionQaResult {
  const checkedAt = new Date().toISOString();
  const siblings = (options.siblings ?? []).filter((s) => !input.id || s.id !== input.id);
  const kind = inferQuestionKind(input);
  const findings: QaFinding[] = [];

  const structural = withTiming(() => validateStructure(input, kind, siblings), [], options.timeoutMs ?? 1500);
  findings.push(...structural);

  let computedAnswer: number | null = null;
  let deterministicVerified = false;

  const numericOptions = input.options.filter((o) => /\d/.test(String(o))).length;
  const topicText = `${input.section ?? ""} ${input.topic ?? ""}`.toLowerCase();
  const mathTopic = /ratio|percentage|average|age|mixture|alligation|profit|loss|interest|speed|distance|time|work|number|proportion|data|clock|calendar|mensuration|geometry|probability|permutation|combination|series|sequence|simplif|approximation|algebra|equation|arithmetic|venn/.test(topicText);
  const hasMathDelimiter = /\\\(|\\\[|\$/.test(String(input.stem ?? ""));
  const hasMath =
    kind === "mathematics" ||
    (kind === "logical-reasoning" &&
      ((mathTopic && (numericOptions >= 2 || hasMathDelimiter)) ||
        (!looksFormalReasoning(String(input.topic ?? ""), String(input.stem ?? "")) && numericOptions >= 2)));
  if (hasMath) {
    const math = withTiming(
      () => verifyMathQuestion(String(input.stem ?? ""), input.options, input.answer, String(input.explanation ?? "")),
      { computedAnswer: null, deterministicVerified: false, findings: [] },
      options.timeoutMs ?? 1500
    );
    findings.push(...math.findings);
    computedAnswer = math.computedAnswer;
    deterministicVerified = math.deterministicVerified;
  }

  if (kind === "logical-reasoning") {
    const logic = withTiming(
      () => verifyLogicQuestion(String(input.stem ?? ""), input.options, input.answer, String(input.topic ?? ""), input.qa_model),
      { computedAnswer: null, deterministicVerified: false, findings: [], model: null },
      options.timeoutMs ?? 1500
    );
    findings.push(...logic.findings);
    if (logic.computedAnswer !== null) {
      if (computedAnswer !== null && computedAnswer !== logic.computedAnswer) {
        findings.push(
          finding({
            code: "QA_SOLVER_DISAGREEMENT",
            category: "logic",
            severity: "critical",
            field: "answer",
            message: `The arithmetic solver chose option ${String.fromCharCode(65 + computedAnswer)}, while the reasoning solver chose option ${String.fromCharCode(65 + logic.computedAnswer)}.`,
            suggestion: "Review the question form; it must not mix two independently solvable interpretations.",
            validator: "engine",
          })
        );
      } else {
        computedAnswer = logic.computedAnswer;
        deterministicVerified = deterministicVerified || logic.deterministicVerified;
      }
    } else if (logic.deterministicVerified) {
      deterministicVerified = true;
    }
    if (!logic.deterministicVerified && !looksFormalReasoning(String(input.topic ?? ""), String(input.stem ?? ""))) {
      // A reasoning question that is mostly arithmetic is already covered by
      // the math validator. Do not pile on an extra review finding.
    }
  }

  // If a solver produced a result but no mismatch finding was added (for
  // example a future validator), enforce the key here as a final backstop.
  if (computedAnswer !== null && computedAnswer !== input.answer) {
    const exists = findings.some((f) => f.code.includes("ANSWER_MISMATCH") || f.code === "MATH_EXPLANATION_FINAL_VALUE" || f.code === "MATH_EXPLANATION_ANSWER_MISMATCH");
    if (!exists) {
      findings.push(
        finding({
          code: "QA_COMPUTED_ANSWER_MISMATCH",
          category: "answer",
          severity: "critical",
          field: "answer",
          message: `A deterministic solver computed option ${String.fromCharCode(65 + computedAnswer)}, but the key is option ${String.fromCharCode(65 + input.answer)}.`,
          suggestion: "Check the answer key and the solution.",
          validator: "engine",
        })
      );
    }
  }

  const counts = countFindings(findings);
  const status = statusForFindings(findings);
  return {
    questionId: input.id,
    status,
    counts,
    findings,
    kind,
    computedAnswer,
    deterministicVerified,
    engineVersion: QA_ENGINE_VERSION,
    policyVersion: QA_POLICY_VERSION,
    checkedAt,
    summary: summarizeStatus(status, counts),
  };
}

export type TestQuestionResult = {
  id: string;
  result: QuestionQaResult | null;
};

export type TestValidationOptions = {
  extraFindings?: QaFinding[];
  /** Set by the server after an explicit admin acknowledgement. */
  overrideReason?: string;
};

export function validateTestResults(
  test: QaTestRow,
  questions: TestQuestionResult[],
  options: TestValidationOptions = {}
): TestQaResult {
  const checkedAt = new Date().toISOString();
  const findings: QaFinding[] = [...(options.extraFindings ?? [])];
  const ids = Array.isArray(test.question_ids) ? test.question_ids : [];
  const counts: QaCounts = { critical: 0, review: 0, warning: 0, info: 0, total: 0 };

  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      findings.push(
        finding({
          code: "TEST_DUPLICATE_QUESTION",
          category: "test",
          severity: "critical",
          field: "question_ids",
          message: `Question ${id.slice(0, 8)}… appears more than once in the test.`,
          suggestion: "Remove the duplicate reference.",
          validator: "test",
        })
      );
    }
    seen.add(id);
  }
  if (ids.length === 0) {
    findings.push(
      finding({
        code: "TEST_EMPTY",
        category: "test",
        severity: "critical",
        field: "question_ids",
        message: "The test contains no questions.",
        suggestion: "Add questions before publishing.",
        validator: "test",
      })
    );
  }
  if (!String(test.title ?? "").trim()) {
    findings.push(
      finding({ code: "TEST_TITLE", category: "test", severity: "critical", field: "title", message: "Test title is empty.", suggestion: "Give the mock a title.", validator: "test" })
    );
  }
  if (!Number.isFinite(Number(test.minutes)) || Number(test.minutes) <= 0) {
    findings.push(
      finding({ code: "TEST_MINUTES", category: "test", severity: "critical", field: "minutes", message: "Test duration must be a positive number of minutes.", suggestion: "Set the paper duration.", validator: "test" })
    );
  }
  if (!String(test.exam ?? "").trim()) {
    findings.push(
      finding({ code: "TEST_EXAM", category: "test", severity: "critical", field: "exam", message: "Test exam is empty.", suggestion: "Set the exam key.", validator: "test" })
    );
  }

  const questionStatuses: Record<QaStatus, number> = { PASS: 0, WARNING: 0, FAILED: 0, NEEDS_REVIEW: 0 };
  const statuses: QaStatus[] = [];
  for (const id of ids) {
    const entry = questions.find((q) => q.id === id);
    if (!entry || !entry.result) {
      findings.push(
        finding({
          code: "TEST_MISSING_QUESTION",
          category: "test",
          severity: "critical",
          field: "question_ids",
          message: `Question ${id.slice(0, 8)}… is missing from the bank.`,
          suggestion: "Remove the stale reference or restore the question.",
          validator: "test",
        })
      );
      continue;
    }
    const result = entry.result;
    questionStatuses[result.status] += 1;
    statuses.push(result.status);
    counts.critical += result.counts.critical;
    counts.review += result.counts.review;
    counts.warning += result.counts.warning;
    counts.info += result.counts.info;
    counts.total += result.counts.total;
    if (result.status === "FAILED") {
      findings.push(
        finding({
          code: "TEST_QUESTION_FAILED",
          category: "test",
          severity: "critical",
          field: "question_ids",
          message: `Question ${id.slice(0, 8)}… failed QA: ${result.summary}`,
          suggestion: "Open the question in the Question Bank and fix the critical findings.",
          validator: "test",
          evidence: result.findings.filter((f) => f.severity === "critical").slice(0, 2).map((f) => f.code).join(", "),
        })
      );
    } else if (result.status === "NEEDS_REVIEW") {
      findings.push(
        finding({
          code: "TEST_QUESTION_REVIEW",
          category: "test",
          severity: "review",
          field: "question_ids",
          message: `Question ${id.slice(0, 8)}… needs review: ${result.summary}`,
          suggestion: "Review the question manually or acknowledge the review before publishing.",
          validator: "test",
        })
      );
    }
  }

  const combined = countFindings(findings);
  // The per-question counts are part of the report; the test-level findings are
  // added on top. Keep both for the dashboard.
  const totalCounts: QaCounts = {
    critical: counts.critical + combined.critical,
    review: counts.review + combined.review,
    warning: counts.warning + combined.warning,
    info: counts.info + combined.info,
    total: counts.total + combined.total,
  };
  const status = worstStatus([...statuses, statusForFindings(findings)]);
  const overridden = Boolean(options.overrideReason && status === "NEEDS_REVIEW" && totalCounts.critical === 0);
  const eligible = status === "PASS" || status === "WARNING" || overridden;
  const result: TestQaResult = {
    testId: test.id,
    status,
    counts: totalCounts,
    findings,
    questionCount: ids.length,
    questionStatuses,
    eligible,
    ...(options.overrideReason ? { overrideReason: options.overrideReason } : {}),
    engineVersion: QA_ENGINE_VERSION,
    policyVersion: QA_POLICY_VERSION,
    checkedAt,
    summary: summarizeStatus(status, totalCounts),
  };
  return result;
}

export { QA_ENGINE_VERSION, QA_POLICY_VERSION, validateStructure };
