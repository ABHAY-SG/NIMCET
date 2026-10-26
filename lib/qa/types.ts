// Shared, dependency-free types for the Question QA engine.
//
// This module is safe to import from server code, scripts and tests. The engine
// itself is deterministic: AI review is intentionally not part of this layer,
// and an unsupported question is never reported as PASS.

export const QA_ENGINE_VERSION = "1.0.0";
export const QA_POLICY_VERSION = "2026-10-qa-1";

export type QaStatus = "PASS" | "WARNING" | "FAILED" | "NEEDS_REVIEW";

export type QaSeverity = "critical" | "review" | "warning" | "info";

export type QaCategory =
  | "structure"
  | "metadata"
  | "options"
  | "answer"
  | "explanation"
  | "rendering"
  | "mathematics"
  | "logic"
  | "duplicates"
  | "marks"
  | "test"
  | "policy";

export type QaField =
  | "exam"
  | "section"
  | "topic"
  | "difficulty"
  | "stem"
  | "options"
  | "answer"
  | "explanation"
  | "plus"
  | "minus"
  | "image_url"
  | "qa_model"
  | "question"
  | "test"
  | "title"
  | "minutes"
  | "sections"
  | "template"
  | "question_ids";

export type QaFinding = {
  /** Stable machine-readable rule id, e.g. MATH_ANSWER_MISMATCH. */
  code: string;
  category: QaCategory;
  severity: QaSeverity;
  field: QaField;
  message: string;
  /** Concrete, admin-readable correction. Never applied automatically. */
  suggestion?: string;
  /** Short evidence (never the whole question / no secrets). */
  evidence?: string;
  validator: string;
  confidence: "high" | "medium" | "low";
  deterministic: boolean;
};

export type QaCounts = {
  critical: number;
  review: number;
  warning: number;
  info: number;
  total: number;
};

export type QuestionKind =
  | "mathematics"
  | "logical-reasoning"
  | "computer-science"
  | "english"
  | "general";

export type QaQuestion = {
  id?: string;
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
  image_url?: string;
  qa_model?: unknown;
};

export type QuestionSibling = {
  id?: string;
  stem: string;
  section?: string;
};

export type QuestionQaResult = {
  questionId?: string;
  status: QaStatus;
  counts: QaCounts;
  findings: QaFinding[];
  kind: QuestionKind;
  /** Index of the answer independently computed by a deterministic solver. */
  computedAnswer: number | null;
  /** True only when a solver actually verified the stored key. */
  deterministicVerified: boolean;
  engineVersion: string;
  policyVersion: string;
  checkedAt: string;
  summary: string;
};

export type TestQaResult = {
  testId?: string;
  status: QaStatus;
  counts: QaCounts;
  findings: QaFinding[];
  questionCount: number;
  questionStatuses: Record<QaStatus, number>;
  /** Warnings/passes are publishable; FAILED and NEEDS_REVIEW are not. */
  eligible: boolean;
  /** Present when an admin explicitly accepted a review-level result. */
  overrideReason?: string;
  engineVersion: string;
  policyVersion: string;
  checkedAt: string;
  summary: string;
};

export type QaTestRow = {
  id?: string;
  title: string;
  exam: string;
  template: string;
  minutes: number;
  published: boolean;
  question_ids: string[];
  sections?: unknown;
};

export type QaEngineOptions = {
  /** All known stems, used for duplicate/near-duplicate detection. */
  siblings?: QuestionSibling[];
  /** Per-question budget for deterministic solvers (default 1500 ms). */
  timeoutMs?: number;
  /** Cap for enumerated logical models (default 200000). */
  logicLimit?: number;
};

export const EMPTY_COUNTS: QaCounts = {
  critical: 0,
  review: 0,
  warning: 0,
  info: 0,
  total: 0,
};

export function countFindings(findings: QaFinding[]): QaCounts {
  const out: QaCounts = { ...EMPTY_COUNTS };
  for (const f of findings) {
    out[f.severity] += 1;
    out.total += 1;
  }
  return out;
}

export function statusForFindings(findings: QaFinding[]): QaStatus {
  if (findings.some((f) => f.severity === "critical")) return "FAILED";
  if (findings.some((f) => f.severity === "review")) return "NEEDS_REVIEW";
  if (findings.some((f) => f.severity === "warning")) return "WARNING";
  return "PASS";
}

export function statusRank(status: QaStatus): number {
  return status === "FAILED" ? 3 : status === "NEEDS_REVIEW" ? 2 : status === "WARNING" ? 1 : 0;
}

export function worstStatus(statuses: QaStatus[]): QaStatus {
  let out: QaStatus = "PASS";
  for (const status of statuses) if (statusRank(status) > statusRank(out)) out = status;
  return out;
}

export function summarizeStatus(status: QaStatus, counts: QaCounts): string {
  if (status === "PASS") return "All deterministic checks passed.";
  const parts: string[] = [];
  if (counts.critical) parts.push(`${counts.critical} critical`);
  if (counts.review) parts.push(`${counts.review} requiring review`);
  if (counts.warning) parts.push(`${counts.warning} warning${counts.warning === 1 ? "" : "s"}`);
  return parts.length ? `${status}: ${parts.join(", ")}.` : status;
}

export function finding(
  input: Omit<QaFinding, "validator" | "confidence" | "deterministic"> &
    Partial<Pick<QaFinding, "validator" | "confidence" | "deterministic">>
): QaFinding {
  return {
    validator: input.validator ?? "qa",
    confidence: input.confidence ?? "high",
    deterministic: input.deterministic ?? true,
    ...input,
  };
}
