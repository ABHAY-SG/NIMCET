// SERVER ONLY — persistence, publish gates and bank audits for Question QA.
//
// Nothing in this module may be imported from a client component: it uses the
// service-role Supabase client and Node's crypto module. The pure validation
// engine lives in ./engine.ts and never needs a database.

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateQuestion, validateTestResults } from "./engine";
import {
  QA_ENGINE_VERSION,
  QA_POLICY_VERSION,
  finding,
  type QaCounts,
  type QaFinding,
  type QaQuestion,
  type QaStatus,
  type QaTestRow,
  type QuestionQaResult,
  type QuestionSibling,
  type TestQaResult,
} from "./types";

// ---------------------------------------------------------------------------
// Database row shapes (kept loose on purpose: migrations are additive and the
// application must keep working before/after 0011 is applied).

export type QaQuestionRecord = {
  id: string;
  exam?: string | null;
  section?: string | null;
  topic?: string | null;
  difficulty?: string | null;
  stem?: string | null;
  options?: unknown;
  answer?: number | null;
  explanation?: string | null;
  plus?: number | null;
  minus?: number | null;
  image_url?: string | null;
  imageUrl?: string | null;
  qa_model?: unknown;
  created_at?: string | null;
};

export type QaTestRecord = {
  id: string;
  title?: string | null;
  exam?: string | null;
  minutes?: number | null;
  published?: boolean | null;
  question_ids?: unknown;
  template?: string | null;
  sections?: unknown;
  created_at?: string | null;
};

export type QaPersistedQuestion = {
  question: QaQuestionRecord;
  result: QuestionQaResult;
};

export type QaPersistedTest = {
  test: QaTestRecord;
  result: TestQaResult;
  questions: QaPersistedQuestion[];
};

export type QaAccessState = {
  available: boolean;
  questions: Map<string, { status: QaStatus; stale: boolean }>;
  tests: Map<string, { status: QaStatus; eligible: boolean; overrideReason: string | null }>;
};

export type QaQuestionListRow = {
  question_id: string;
  status: QaStatus;
  counts: QaCounts;
  findings: QaFinding[];
  checked_at: string;
  stale: boolean;
  kind?: string | null;
  computed_answer?: number | null;
  deterministic_verified?: boolean | null;
  stem: string;
  section: string;
  topic: string;
};

export type QaTestListRow = {
  test_id: string;
  status: QaStatus;
  counts: QaCounts;
  findings: QaFinding[];
  question_statuses: Record<QaStatus, number>;
  eligible: boolean;
  override_reason: string | null;
  checked_at: string;
  title: string;
  published: boolean;
};

const QA_TABLES = ["question_qa_state", "qa_test_state", "qa_reviews"] as const;
const ID_CHUNK = 150;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
    .join(",")}}`;
}

function md5(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

export function questionFingerprint(row: QaQuestionRecord): string {
  return md5(
    [
      row.id,
      row.exam ?? "",
      row.section ?? "",
      row.topic ?? "",
      row.difficulty ?? "",
      row.stem ?? "",
      stableJson(Array.isArray(row.options) ? row.options : []),
      String(row.answer ?? ""),
      row.explanation ?? "",
      String(row.plus ?? ""),
      String(row.minus ?? ""),
      row.image_url ?? row.imageUrl ?? "",
      row.qa_model === undefined || row.qa_model === null ? "" : stableJson(row.qa_model),
    ].join("\u001f")
  );
}

export function testFingerprint(row: QaTestRecord): string {
  const ids = Array.isArray(row.question_ids) ? row.question_ids.map(String) : [];
  return md5(
    [
      row.id,
      row.title ?? "",
      row.exam ?? "",
      String(row.minutes ?? ""),
      ids.join(","),
      row.template ?? "",
    ].join("\u001f")
  );
}

export function toQaQuestion(row: QaQuestionRecord): QaQuestion {
  return {
    id: row.id,
    exam: String(row.exam ?? "").trim(),
    section: String(row.section ?? "").trim(),
    topic: String(row.topic ?? "").trim(),
    difficulty: String(row.difficulty ?? "").trim(),
    stem: String(row.stem ?? ""),
    options: Array.isArray(row.options) ? row.options.map((o) => String(o ?? "")) : [],
    answer: Number(row.answer ?? 0),
    explanation: String(row.explanation ?? ""),
    plus: Number.isFinite(Number(row.plus)) ? Number(row.plus) : 12,
    minus: Number.isFinite(Number(row.minus)) ? Number(row.minus) : -3,
    image_url: String(row.image_url ?? row.imageUrl ?? ""),
    ...(row.qa_model !== undefined ? { qa_model: row.qa_model } : {}),
  };
}

export function toQaTest(row: QaTestRecord): QaTestRow {
  return {
    id: row.id,
    title: String(row.title ?? ""),
    exam: String(row.exam ?? "nimcet"),
    template: String(row.template ?? ""),
    minutes: Number(row.minutes ?? 0),
    published: row.published === true,
    question_ids: Array.isArray(row.question_ids) ? row.question_ids.map(String) : [],
    sections: row.sections,
  };
}

export function isMissingQaTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = String((error as { message?: unknown }).message ?? "");
  if (code === "PGRST205" || code === "42P01") return true;
  return new RegExp(`(?:${QA_TABLES.join("|")})`, "i").test(message) && /does not exist|could not find/i.test(message);
}

function chunks<T>(items: T[], size = ID_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Reads

export async function loadBankSiblings(
  svc: SupabaseClient,
  options: { excludeId?: string; cap?: number } = {}
): Promise<QuestionSibling[]> {
  const cap = Math.max(1, Math.min(options.cap ?? 5000, 20_000));
  const out: QuestionSibling[] = [];
  const step = 1000;
  for (let from = 0; from < cap; from += step) {
    const { data, error } = await svc
      .from("questions")
      .select("id,stem,section")
      .order("id", { ascending: true })
      .range(from, Math.min(from + step, cap) - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ id: string; stem: string; section?: string | null }>;
    for (const row of rows) {
      if (options.excludeId && row.id === options.excludeId) continue;
      out.push({ id: row.id, stem: String(row.stem ?? ""), section: String(row.section ?? "") });
    }
    if (rows.length < step) break;
  }
  return out;
}

export async function loadQuestionRecord(svc: SupabaseClient, id: string): Promise<QaQuestionRecord | null> {
  const { data, error } = await svc.from("questions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as QaQuestionRecord | null) ?? null;
}

export async function loadQuestionsByIds(
  svc: SupabaseClient,
  ids: string[]
): Promise<Map<string, QaQuestionRecord>> {
  const out = new Map<string, QaQuestionRecord>();
  const unique = [...new Set(ids)];
  for (const part of chunks(unique)) {
    const { data, error } = await svc.from("questions").select("*").in("id", part);
    if (error) throw error;
    for (const row of (data ?? []) as QaQuestionRecord[]) out.set(row.id, row);
  }
  return out;
}

export async function loadTestRecord(svc: SupabaseClient, id: string): Promise<QaTestRecord | null> {
  let res = await svc
    .from("tests")
    .select("id,title,exam,minutes,published,question_ids,template,sections,created_at")
    .eq("id", id)
    .maybeSingle();
  if (res.error) {
    // Pre-0007 database: template/sections do not exist yet.
    res = await svc
      .from("tests")
      .select("id,title,exam,minutes,published,question_ids,created_at")
      .eq("id", id)
      .maybeSingle();
  }
  if (res.error) throw res.error;
  return (res.data as QaTestRecord | null) ?? null;
}

export async function loadAllTestRecords(svc: SupabaseClient, cap = 1000): Promise<QaTestRecord[]> {
  const out: QaTestRecord[] = [];
  const step = 500;
  for (let from = 0; out.length < cap; from += step) {
    const { data, error } = await svc
      .from("tests")
      .select("id,title,exam,minutes,published,question_ids,template,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + step - 1);
    if (error) throw error;
    const rows = (data ?? []) as QaTestRecord[];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out.slice(0, cap);
}

// ---------------------------------------------------------------------------
// Persistence

export async function persistQuestionResults(
  svc: SupabaseClient,
  entries: QaPersistedQuestion[]
): Promise<boolean> {
  if (entries.length === 0) return true;
  const seen = new Set<string>();
  const rows = entries
    .filter(({ question }) => {
      if (!question.id || seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    })
    .map(({ question, result }) => ({
      question_id: question.id,
      status: result.status,
      counts: result.counts,
      findings: result.findings,
      kind: result.kind,
      computed_answer: result.computedAnswer,
      deterministic_verified: result.deterministicVerified,
      engine_version: result.engineVersion,
      policy_version: result.policyVersion,
      question_fingerprint: questionFingerprint(question),
      stale: false,
      checked_at: result.checkedAt,
      updated_at: new Date().toISOString(),
    }));
  const { error } = await svc.from("question_qa_state").upsert(rows, { onConflict: "question_id" });
  if (error) {
    if (isMissingQaTable(error)) return false;
    throw error;
  }
  return true;
}

export async function persistTestResult(
  svc: SupabaseClient,
  test: QaTestRecord,
  result: TestQaResult
): Promise<boolean> {
  const row = {
    test_id: test.id,
    status: result.status,
    counts: result.counts,
    findings: result.findings,
    question_statuses: result.questionStatuses,
    eligible: result.eligible,
    override_reason: result.overrideReason ?? null,
    test_fingerprint: testFingerprint(test),
    engine_version: result.engineVersion,
    policy_version: result.policyVersion,
    checked_at: result.checkedAt,
    updated_at: new Date().toISOString(),
  };
  const { error } = await svc.from("qa_test_state").upsert(row, { onConflict: "test_id" });
  if (error) {
    if (isMissingQaTable(error)) return false;
    throw error;
  }
  return true;
}

export async function recordQaReview(
  svc: SupabaseClient,
  input: {
    actorId?: string | null;
    questionId?: string | null;
    testId?: string | null;
    action: "validate" | "audit" | "override" | "publish_blocked";
    reason?: string | null;
    findings?: QaFinding[];
  }
): Promise<boolean> {
  const { error } = await svc.from("qa_reviews").insert({
    actor_id: input.actorId ?? null,
    question_id: input.questionId ?? null,
    test_id: input.testId ?? null,
    action: input.action,
    reason: input.reason ?? null,
    findings: input.findings ?? [],
  });
  if (error) {
    if (isMissingQaTable(error)) return false;
    throw error;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Question validation

export async function validateAndPersistQuestion(
  svc: SupabaseClient,
  id: string
): Promise<QaPersistedQuestion | null> {
  const question = await loadQuestionRecord(svc, id);
  if (!question) return null;
  const siblings = await loadBankSiblings(svc, { excludeId: id });
  const result = validateQuestion(toQaQuestion(question), { siblings });
  await persistQuestionResults(svc, [{ question, result }]);
  return { question, result };
}

// ---------------------------------------------------------------------------
// Test validation and publish gate

export async function validateTestRecord(
  svc: SupabaseClient,
  test: QaTestRecord,
  options: {
    siblings?: QuestionSibling[];
    extraFindings?: QaFinding[];
    overrideReason?: string;
  } = {}
): Promise<QaPersistedTest> {
  const ids = Array.isArray(test.question_ids) ? test.question_ids.map(String) : [];
  const rows = await loadQuestionsByIds(svc, ids);
  const siblings = options.siblings ?? (await loadBankSiblings(svc));
  const questionResults = ids.map((id) => {
    const row = rows.get(id);
    if (!row) return { id, result: null };
    return { id, result: validateQuestion(toQaQuestion(row), { siblings }) };
  });

  const result = validateTestResults(toQaTest(test), questionResults, {
    extraFindings: options.extraFindings,
    overrideReason: options.overrideReason,
  });

  const entries: QaPersistedQuestion[] = [];
  for (const item of questionResults) {
    const row = rows.get(item.id);
    if (row && item.result) entries.push({ question: row, result: item.result });
  }
  await persistQuestionResults(svc, entries);
  await persistTestResult(svc, test, result);
  return {
    test,
    result,
    questions: entries,
  };
}

export async function validateTestById(
  svc: SupabaseClient,
  id: string,
  options: { extraFindings?: QaFinding[]; overrideReason?: string } = {}
): Promise<QaPersistedTest | null> {
  const test = await loadTestRecord(svc, id);
  if (!test) return null;
  return validateTestRecord(svc, test, options);
}

export function compositionFindings(issues: string[]): QaFinding[] {
  return issues.map((message) =>
    finding({
      code: "TEST_COMPOSITION",
      category: "test",
      severity: "critical",
      field: "question_ids",
      message,
      suggestion: "Fix the paper composition before publishing.",
      validator: "test-composition",
    })
  );
}

/** Short, admin-facing reason embedded in API errors (the full result is also returned). */
export function qaBlockedMessage(result: TestQaResult | null | undefined): string {
  if (!result) return "QA did not produce a result for this test.";
  const critical = result.findings.filter((f) => f.severity === "critical");
  const review = result.findings.filter((f) => f.severity === "review");
  const top = [...critical, ...review].slice(0, 3);
  const detail = top.length
    ? ` ${top.map((f) => `${f.field}: ${f.message}`).join(" | ")}`
    : "";
  if (result.counts.critical > 0) {
    return `QA found ${result.counts.critical} critical issue(s).${detail}`;
  }
  if (result.status === "NEEDS_REVIEW") {
    return `QA needs an admin acknowledgement before publishing.${detail}`;
  }
  return `QA did not approve this test.${detail}`;
}

/**
 * Publish gate used by every admin route. It always records the latest result;
 * `result.eligible` is the only value the API may use to decide a transition.
 */
export async function evaluateTestForPublish(
  svc: SupabaseClient,
  id: string,
  options: { extraFindings?: QaFinding[]; overrideReason?: string } = {}
): Promise<QaPersistedTest | null> {
  return validateTestById(svc, id, options);
}

// ---------------------------------------------------------------------------
// Batch audits

export type AuditSummary = {
  checked: number;
  pass: number;
  warning: number;
  review: number;
  failed: number;
  persisted: boolean;
};

function emptyAuditSummary(): AuditSummary {
  return { checked: 0, pass: 0, warning: 0, review: 0, failed: 0, persisted: true };
}

function addStatus(summary: AuditSummary, status: QaStatus) {
  summary.checked += 1;
  if (status === "PASS") summary.pass += 1;
  else if (status === "WARNING") summary.warning += 1;
  else if (status === "NEEDS_REVIEW") summary.review += 1;
  else summary.failed += 1;
}

export async function auditQuestionBank(
  svc: SupabaseClient,
  options: { limit?: number; offset?: number; persist?: boolean } = {}
): Promise<AuditSummary> {
  const summary = emptyAuditSummary();
  const limit = Math.max(1, Math.min(options.limit ?? 200, 2000));
  const offset = Math.max(0, options.offset ?? 0);
  const siblings = await loadBankSiblings(svc);
  const { data, error } = await svc
    .from("questions")
    .select("*")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = (data ?? []) as QaQuestionRecord[];
  const entries: QaPersistedQuestion[] = [];
  for (const row of rows) {
    const result = validateQuestion(toQaQuestion(row), { siblings });
    addStatus(summary, result.status);
    entries.push({ question: row, result });
  }
  if (options.persist !== false) {
    const persisted = await persistQuestionResults(svc, entries);
    summary.persisted = persisted;
  }
  return summary;
}

export async function auditTests(
  svc: SupabaseClient,
  options: { limit?: number; persist?: boolean } = {}
): Promise<AuditSummary> {
  const summary = emptyAuditSummary();
  const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
  const siblings = await loadBankSiblings(svc);
  const tests = await loadAllTestRecords(svc, limit);
  for (const test of tests) {
    const out = await validateTestRecord(svc, test, { siblings });
    addStatus(summary, out.result.status);
  }
  summary.persisted = true;
  return summary;
}

// ---------------------------------------------------------------------------
// Dashboard reads

export async function loadQaAccess(svc: SupabaseClient): Promise<QaAccessState> {
  const state: QaAccessState = { available: true, questions: new Map(), tests: new Map() };
  const q = await svc.from("question_qa_state").select("question_id,status,stale");
  if (q.error) {
    if (isMissingQaTable(q.error)) return { available: false, questions: new Map(), tests: new Map() };
    throw q.error;
  }
  for (const row of (q.data ?? []) as Array<{ question_id: string; status: QaStatus; stale: boolean }>) {
    state.questions.set(row.question_id, { status: row.status, stale: row.stale === true });
  }
  const t = await svc.from("qa_test_state").select("test_id,status,eligible,override_reason");
  if (t.error) {
    if (isMissingQaTable(t.error)) return { available: false, questions: new Map(), tests: new Map() };
    throw t.error;
  }
  for (const row of (t.data ?? []) as Array<{
    test_id: string;
    status: QaStatus;
    eligible: boolean;
    override_reason: string | null;
  }>) {
    state.tests.set(row.test_id, {
      status: row.status,
      eligible: row.eligible === true,
      overrideReason: row.override_reason ?? null,
    });
  }
  return state;
}

export function qaQuestionAllowed(qa: QaAccessState, id: string, testOverride: boolean): boolean {
  if (!qa.available) return true; // legacy database: no QA state to enforce yet
  const state = qa.questions.get(id);
  if (!state) return true; // legacy question, not audited yet
  if (state.stale || state.status === "FAILED") return false;
  if (state.status === "NEEDS_REVIEW" && !testOverride) return false;
  return true;
}

export function qaTestAccess(
  qa: QaAccessState,
  id: string
): { allowed: boolean; override: boolean; reason: string | null } {
  if (!qa.available) return { allowed: true, override: false, reason: null };
  const state = qa.tests.get(id);
  if (!state) return { allowed: true, override: false, reason: null }; // legacy published test
  return {
    allowed: state.eligible && state.status !== "FAILED",
    override: state.overrideReason !== null,
    reason: state.overrideReason,
  };
}

export async function listQaQuestions(
  svc: SupabaseClient,
  options: { status?: QaStatus | "stale"; limit?: number; offset?: number } = {}
): Promise<QaQuestionListRow[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const offset = Math.max(0, options.offset ?? 0);
  let query = svc
    .from("question_qa_state")
    .select("question_id,status,counts,findings,checked_at,stale,kind,computed_answer,deterministic_verified")
    .order("checked_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (options.status === "stale") query = query.eq("stale", true);
  else if (options.status) query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) {
    if (isMissingQaTable(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as Array<Omit<QaQuestionListRow, "stem" | "section" | "topic">>;
  const questions = await loadQuestionsByIds(svc, rows.map((r) => r.question_id));
  return rows.map((r) => {
    const q = questions.get(r.question_id);
    return {
      ...r,
      stem: String(q?.stem ?? "(question deleted)"),
      section: String(q?.section ?? ""),
      topic: String(q?.topic ?? ""),
    };
  });
}

export async function listQaTests(
  svc: SupabaseClient,
  options: { status?: QaStatus; limit?: number; offset?: number } = {}
): Promise<QaTestListRow[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const offset = Math.max(0, options.offset ?? 0);
  let query = svc
    .from("qa_test_state")
    .select("test_id,status,counts,findings,question_statuses,eligible,override_reason,checked_at")
    .order("checked_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (options.status) query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) {
    if (isMissingQaTable(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as Array<Omit<QaTestListRow, "title" | "published">>;
  const meta = new Map<string, { title: string; published: boolean }>();
  for (const part of chunks(rows.map((r) => r.test_id))) {
    const { data: tests, error: tErr } = await svc.from("tests").select("id,title,published").in("id", part);
    if (tErr) throw tErr;
    for (const t of (tests ?? []) as Array<{ id: string; title: string; published: boolean }>) {
      meta.set(t.id, { title: t.title, published: t.published === true });
    }
  }
  return rows.map((r) => ({
    ...r,
    title: meta.get(r.test_id)?.title ?? "(test deleted)",
    published: meta.get(r.test_id)?.published ?? false,
  }));
}

export type QaSummary = {
  available: boolean;
  questions: { total: number; pass: number; warning: number; review: number; failed: number; stale: number };
  tests: { total: number; eligible: number; blocked: number };
  recentQuestions: QaQuestionListRow[];
  recentTests: QaTestListRow[];
  engineVersion: string;
  policyVersion: string;
};

export async function loadQaSummary(svc: SupabaseClient): Promise<QaSummary> {
  const empty = (): QaSummary => ({
    available: false,
    questions: { total: 0, pass: 0, warning: 0, review: 0, failed: 0, stale: 0 },
    tests: { total: 0, eligible: 0, blocked: 0 },
    recentQuestions: [],
    recentTests: [],
    engineVersion: QA_ENGINE_VERSION,
    policyVersion: QA_POLICY_VERSION,
  });

  // Exact counts rather than a capped row scan: a large bank must not report
  // truncated totals, and the dashboard must stay accurate as it grows.
  const countQuestions = (status?: QaStatus, stale?: boolean) => {
    let q = svc.from("question_qa_state").select("*", { count: "exact", head: true });
    if (status) q = q.eq("status", status);
    if (stale !== undefined) q = q.eq("stale", stale);
    return q;
  };
  const [qTotal, qPass, qWarning, qReview, qFailed, qStale] = await Promise.all([
    countQuestions(),
    countQuestions("PASS"),
    countQuestions("WARNING"),
    countQuestions("NEEDS_REVIEW"),
    countQuestions("FAILED"),
    countQuestions(undefined, true),
  ]);
  const qError = [qTotal, qPass, qWarning, qReview, qFailed, qStale].find((r) => r.error)?.error;
  if (qError) {
    if (isMissingQaTable(qError)) return empty();
    throw qError;
  }
  const questions = {
    total: qTotal.count ?? 0,
    pass: qPass.count ?? 0,
    warning: qWarning.count ?? 0,
    review: qReview.count ?? 0,
    failed: qFailed.count ?? 0,
    stale: qStale.count ?? 0,
  };

  const countTests = (eligible?: boolean) => {
    let q = svc.from("qa_test_state").select("*", { count: "exact", head: true });
    if (eligible !== undefined) q = q.eq("eligible", eligible);
    return q;
  };
  const [tTotal, tEligible, tBlocked] = await Promise.all([
    countTests(),
    countTests(true),
    countTests(false),
  ]);
  const tError = [tTotal, tEligible, tBlocked].find((r) => r.error)?.error;
  if (tError) {
    if (isMissingQaTable(tError)) return empty();
    throw tError;
  }
  const tests = {
    total: tTotal.count ?? 0,
    eligible: tEligible.count ?? 0,
    blocked: tBlocked.count ?? 0,
  };

  const [recentQuestions, recentTests] = await Promise.all([
    listQaQuestions(svc, { limit: 8 }),
    listQaTests(svc, { limit: 8 }),
  ]);
  return {
    available: true,
    questions,
    tests,
    recentQuestions,
    recentTests,
    engineVersion: QA_ENGINE_VERSION,
    policyVersion: QA_POLICY_VERSION,
  };
}
