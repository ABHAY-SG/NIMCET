// SERVER ONLY — the single authorization rule for which questions a student
// may fetch or submit outside the timed mock_sessions workflow.
//
// Authentication alone is NOT question-bank access. A question is available to
// students only when it is part of a PUBLISHED, non-template test. Questions
// that belong to a timed template exam (published or not) are excluded from
// practice access entirely: those are served exclusively by the session routes
// (attempt/part), which enforce the clock and ownership.
//
// The same rule is used by:
//   - GET  /api/student/questions          (bank + ?ids= reads)
//   - POST /api/student/submit             (custom/practice submissions)
// so exposure cannot drift between the two routes.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessTestRow = {
  id?: string;
  title?: string;
  question_ids?: unknown;
  published?: unknown;
  template?: unknown;
};

export type TestAccess = {
  /** Every test row, with template column present when the DB supports it. */
  rows: AccessTestRow[];
  hasTemplateColumn: boolean;
};

export type QuestionAccess = {
  /** Questions students may read/practise (published non-template tests). */
  practice: Set<string>;
  /** Questions reserved for the timed session workflow (any template test). */
  timed: Set<string>;
};

export function stringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) if (typeof v === "string" && v) out.push(v);
  return out;
}

export function hasTemplate(row: AccessTestRow, hasTemplateColumn: boolean): boolean {
  return hasTemplateColumn && String(row.template ?? "").trim() !== "";
}

function isMissingTable(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { code?: unknown }).code;
  const message = (e as { message?: unknown }).message;
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    (typeof message === "string" && /could not find the table|relation .* does not exist/i.test(message))
  );
}

/**
 * True ONLY for the pre-0007 schema where tests.template does not exist.
 * Any other database error must fail closed: treating a transient error as
 * "column missing" would turn timed-paper questions into practice questions.
 */
export function isMissingTemplateColumn(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const message = (e as { message?: unknown }).message;
  if (typeof message !== "string" || !/template/i.test(message)) return false;
  return /does not exist|could not find|undefined column/i.test(message);
}

/**
 * True only when the optional questions.image_url column (migration 0009) is
 * absent. Callers can then fall back to the pre-0009 SELECT list instead of
 * failing every question read on a database that has not run the migration yet.
 */
export function isMissingImageColumn(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const message = (e as { message?: unknown }).message;
  if (typeof message !== "string" || !/image_url/i.test(message)) return false;
  return /does not exist|could not find|undefined column/i.test(message);
}

/**
 * Loads the tests table once, tolerating databases that predate the template
 * column (migration 0007). Any other database error is re-thrown so callers
 * fail closed instead of silently granting access.
 */
export async function loadTestAccess(svc: SupabaseClient): Promise<TestAccess> {
  let res = await svc.from("tests").select("id,title,question_ids,published,template");
  const hasTemplateColumn = !res.error;
  if (res.error) {
    // Only a genuinely missing template column may use the pre-0007 query.
    // A timeout/permission error must not silently make timed questions
    // practice-readable.
    if (!isMissingTemplateColumn(res.error)) throw res.error;
    res = await svc.from("tests").select("id,title,question_ids,published");
  }
  if (res.error) throw res.error;
  return { rows: (res.data ?? []) as AccessTestRow[], hasTemplateColumn };
}

export function accessFromTests(access: TestAccess): QuestionAccess {
  const practice = new Set<string>();
  const timed = new Set<string>();
  for (const row of access.rows) {
    const ids = stringIds(row.question_ids);
    if (hasTemplate(row, access.hasTemplateColumn)) {
      for (const id of ids) timed.add(id);
      continue;
    }
    if (row.published === true) {
      for (const id of ids) practice.add(id);
    }
  }
  // A question reused in a timed paper must never become practice-readable,
  // even if an admin also listed it in a published practice test.
  for (const id of timed) practice.delete(id);
  return { practice, timed };
}

export async function loadQuestionAccess(svc: SupabaseClient): Promise<QuestionAccess> {
  return accessFromTests(await loadTestAccess(svc));
}

/**
 * Question ids from this user's own mock sessions, so a finished (or open)
 * session can still be reviewed after its test is unpublished or retemplated.
 * A missing mock_sessions table simply means the feature is not installed yet.
 */
export async function loadSessionQuestionIds(
  svc: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await svc
    .from("mock_sessions")
    .select("question_ids")
    .eq("user_id", userId);
  if (error) {
    if (isMissingTable(error)) return new Set();
    throw error;
  }
  const out = new Set<string>();
  for (const row of (data ?? []) as Array<{ question_ids?: unknown }>) {
    for (const id of stringIds(row.question_ids)) out.add(id);
  }
  return out;
}
