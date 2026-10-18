import type { SupabaseClient } from "@supabase/supabase-js";
import { checkFullMockComposition, subjectRank } from "./nimcet-full-mock";

// SERVER ONLY — shared read helpers for the admin API routes.
// Everything here runs behind requireAdmin()/requireUser() with the service
// client; nothing in this file may ever be imported by client code.

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e ?? "");
}

function errCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "";
}

// Route-handler segment ids are always UUIDs in this schema. Rejecting
// malformed ids up front turns a Postgres 22P02 (which used to surface as a
// 500 with raw error text) into a clean 400.
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Map raw Postgres/PostgREST errors to an actionable setup message when the
// root cause is an un-applied migration, instead of a cryptic failure.
export function migrationHint(e: unknown): string | null {
  const m = errText(e);
  if (/PGRST205|42P01|could not find the table|relation .* does not exist/i.test(m)) {
    return "The database is missing a table. Run the pending migrations (supabase/migrations/0005_admin.sql and 0007_full_mock.sql) in the Supabase SQL Editor, then retry.";
  }
  if (/PGRST204|42703|could not find the .* column|column .* does not exist/i.test(m)) {
    return "The database is missing a column. Run the pending migrations (supabase/migrations/0005_admin.sql and 0007_full_mock.sql) in the Supabase SQL Editor, then retry.";
  }
  return null;
}

// Error response policy (security): raw PostgREST/database messages never
// reach the client. Database error codes are mapped to short, safe messages;
// anything unexpected becomes the route's generic fallback and is logged
// server-side only. Errors deliberately thrown by our own code (and SDK
// errors such as GoTrue's user-facing messages) keep their text.
export function errorPayload(e: unknown, fallback: string): { error: string; status: number } {
  const hint = migrationHint(e);
  if (hint) return { error: hint, status: 503 };
  if (e instanceof Error) return { error: e.message || fallback, status: 500 };
  const code = errCode(e);
  if (code === "22P02" || code === "22003" || code === "22007") {
    return { error: "Invalid value in the request.", status: 400 };
  }
  if (code === "23505") return { error: "That record already exists.", status: 409 };
  if (code === "23503") return { error: "A referenced record could not be found.", status: 400 };
  if (code === "23514") return { error: "A value was rejected by a database rule.", status: 400 };
  if (code === "PGRST116") return { error: "Record not found.", status: 404 };
  console.error("[api]", errText(e) || fallback);
  return { error: fallback, status: 500 };
}

// ============ users (Supabase Auth) ============

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  disabled: boolean;
};

function isDisabled(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const t = Date.parse(bannedUntil);
  return Number.isFinite(t) && t > Date.now();
}

// Paged listUsers walk. Only the fields the admin UI needs leave this
// function — never tokens, identities or encrypted auth material.
export async function fetchAllUsers(svc: SupabaseClient, cap = 5000): Promise<SafeUser[]> {
  const out: SafeUser[] = [];
  const perPage = 1000;
  for (let page = 1; out.length < cap; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const first = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
      const last = typeof meta.last_name === "string" ? meta.last_name.trim() : "";
      out.push({
        id: u.id,
        email: u.email ?? "",
        name: [first, last].filter(Boolean).join(" "),
        created_at: u.created_at ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        disabled: isDisabled(u.banned_until),
      });
    }
    if (users.length < perPage) break;
  }
  return out.slice(0, cap);
}

export function userById(users: SafeUser[], id: string): SafeUser | undefined {
  return users.find((u) => u.id === id);
}

// ============ attempts / questions / tests ============

export type AttemptLite = {
  id: string;
  user_id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};

export async function fetchAllAttempts(svc: SupabaseClient, cap = 20000): Promise<AttemptLite[]> {
  const out: AttemptLite[] = [];
  const step = 1000;
  for (let from = 0; out.length < cap; from += step) {
    const { data, error } = await svc
      .from("attempts")
      .select("id,user_id,test,score,correct,wrong,skipped,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + step - 1);
    if (error) throw error;
    const rows = (data ?? []) as AttemptLite[];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out.slice(0, cap);
}

export type QuestionLite = {
  id: string;
  exam: string;
  section: string;
  topic: string;
  difficulty: string;
  plus: number;
  minus: number;
};

export async function fetchAllQuestionsLite(svc: SupabaseClient, cap = 5000): Promise<QuestionLite[]> {
  const out: QuestionLite[] = [];
  const step = 1000;
  for (let from = 0; out.length < cap; from += step) {
    const { data, error } = await svc
      .from("questions")
      .select("id,exam,section,topic,difficulty,plus,minus")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + step - 1);
    if (error) throw error;
    const rows = (data ?? []) as QuestionLite[];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out.slice(0, cap);
}

export type CompositionQuestion = {
  id: string;
  section: string;
  options: unknown;
  answer: unknown;
  plus: unknown;
  minus: unknown;
};

// Full-mock publish validation needs the questions' own options/answer/marks.
// Paged so a 120-id paper never hits PostgREST query limits.
export async function fetchQuestionsByIds(
  svc: SupabaseClient,
  ids: string[]
): Promise<CompositionQuestion[]> {
  const out: CompositionQuestion[] = [];
  const step = 200;
  for (let i = 0; i < ids.length; i += step) {
    const chunk = ids.slice(i, i + step);
    const { data, error } = await svc
      .from("questions")
      .select("id,section,options,answer,plus,minus")
      .in("id", chunk);
    if (error) throw error;
    out.push(...((data ?? []) as CompositionQuestion[]));
  }
  return out;
}

// Every reason a full-mock question list is not publishable yet, in the same
// verdict the admin UI shows. Empty array = publishable.
export async function fullMockIssues(svc: SupabaseClient, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  const issues: string[] = [];
  if (unique.length !== ids.length) issues.push("The paper contains duplicate question references.");
  const rows = await fetchQuestionsByIds(svc, unique);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = unique.filter((id) => !byId.has(id));
  if (missing.length > 0) issues.push(`${missing.length} selected question(s) no longer exist in the bank.`);
  const outcome = checkFullMockComposition(unique.filter((id) => byId.has(id)).map((id) => byId.get(id)!));
  return [...issues, ...outcome.issues];
}

export function fullMockIssueText(issues: string[]): string {
  const head = issues.slice(0, 3);
  const more = issues.length > head.length ? ` (+${issues.length - head.length} more)` : "";
  return `This full mock is not publishable yet: ${head.join(" ")}${more}`;
}

// Canonicalises a full-mock question list into the official subject order
// (stable, so the administrator's relative order inside a subject survives).
// Called on every content save of a template test so the runner's fixed slices
// always line up with the paper structure.
export async function normalizeFullMockIds(svc: SupabaseClient, ids: string[]): Promise<string[]> {
  const rows = await fetchQuestionsByIds(svc, [...new Set(ids)]);
  const sectionById = new Map(rows.map((r) => [r.id, r.section]));
  return [...ids].sort((a, b) => subjectRank(sectionById.get(a)) - subjectRank(sectionById.get(b)));
}

export type TestLite = {
  id: string;
  exam: string;
  title: string;
  tag: string;
  minutes: number;
  free: boolean;
  published: boolean;
  question_ids: string[];
  description: string;
  instructions: string;
  /** "" for custom/practice tests; "nimcet-2026" for the full-mock template. */
  template: string;
  created_at: string;
};

// description/instructions only exist after migration 0005 and template after
// 0007. Read compatibly in stages and report what was found, so routes can
// degrade gracefully instead of 500ing before the migrations run.
export async function fetchAllTests(
  svc: SupabaseClient,
  cap = 1000
): Promise<{ tests: TestLite[]; migrated: boolean; templated: boolean }> {
  const withTemplate =
    "id,exam,title,tag,minutes,free,published,question_ids,description,instructions,template,created_at";
  const full = "id,exam,title,tag,minutes,free,published,question_ids,description,instructions,created_at";
  const legacy = "id,exam,title,tag,minutes,free,published,question_ids,created_at";
  const run = (cols: string) =>
    svc.from("tests").select(cols).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(cap);

  let res = await run(withTemplate);
  let migrated = true;
  let templated = true;
  if (res.error) {
    res = await run(full);
    templated = false;
  }
  if (res.error) {
    res = await run(legacy);
    migrated = false;
    templated = false;
  }
  if (res.error) throw res.error;
  const raw = (res.data ?? []) as unknown as Array<Record<string, unknown>>;
  const tests: TestLite[] = raw.map((t) => ({
    id: String(t.id),
    exam: String(t.exam ?? ""),
    title: String(t.title ?? ""),
    tag: String(t.tag ?? ""),
    minutes: Number(t.minutes ?? 0),
    free: Boolean(t.free),
    published: Boolean(t.published),
    question_ids: Array.isArray(t.question_ids) ? (t.question_ids as string[]) : [],
    description: String(t.description ?? ""),
    instructions: String(t.instructions ?? ""),
    template: typeof t.template === "string" ? t.template : "",
    created_at: String(t.created_at ?? ""),
  }));
  return { tests, migrated, templated };
}

// Generic newest-first paged walk for tables with created_at. Respects the
// PostgREST 1000-row default by paging until exhausted or `cap` is reached.
export async function fetchAllRows<T>(
  svc: SupabaseClient,
  table: string,
  columns: string,
  cap = 5000
): Promise<T[]> {
  const out: T[] = [];
  const step = 1000;
  for (let from = 0; out.length < cap; from += step) {
    const { data, error } = await svc
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + step - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out.slice(0, cap);
}

// ============ marks / percentages ============

export function normTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export type TestMarkStats = { max: number; min: number; count: number };

// Attempts reference tests by TITLE (text), so marks are keyed by a
// normalized title. Missing question references are skipped, never guessed.
export function buildMarksByTitle(
  tests: TestLite[],
  questions: QuestionLite[]
): Map<string, TestMarkStats> {
  const qById = new Map(questions.map((q) => [q.id, q]));
  const map = new Map<string, TestMarkStats>();
  for (const t of tests) {
    let max = 0;
    let min = 0;
    let count = 0;
    for (const id of t.question_ids) {
      const q = qById.get(id);
      if (!q) continue;
      max += Number(q.plus) || 0;
      min += Number(q.minus) || 0;
      count++;
    }
    map.set(normTitle(t.title), { max: round1(max), min: round1(min), count });
  }
  return map;
}

export function pctOf(score: number, stats: TestMarkStats | undefined): number | null {
  if (!stats || stats.max <= 0) return null;
  return Math.max(0, Math.min(100, round1((score / stats.max) * 100)));
}

// ============ dates (all bucketing is UTC) ============

export function dayKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

export function lastNDayKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function isWithinDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= Date.now() - days * 86400000;
}

export function countByDay(dates: Array<string | null | undefined>, dayKeys: string[]): number[] {
  const idx = new Map(dayKeys.map((k, i) => [k, i]));
  const out: number[] = new Array(dayKeys.length).fill(0);
  for (const d of dates) {
    if (!d) continue;
    const i = idx.get(dayKey(d));
    if (i !== undefined) out[i]++;
  }
  return out;
}

// Sums adjacent points so long ranges (up to 365 days) stay readable.
export function groupSeries(
  labels: string[],
  values: number[],
  maxPoints: number
): { labels: string[]; values: number[] } {
  if (labels.length <= maxPoints) return { labels, values };
  const step = Math.ceil(labels.length / maxPoints);
  const outL: string[] = [];
  const outV: number[] = [];
  for (let i = 0; i < labels.length; i += step) {
    outL.push(labels[i]);
    outV.push(values.slice(i, i + step).reduce((a, b) => a + b, 0));
  }
  return { labels: outL, values: outV };
}

// Same bucketing, but averages (sum ÷ count) instead of sums — for series
// like "average score per day" where summing would be meaningless.
export function groupMean(
  labels: string[],
  sums: number[],
  counts: number[],
  maxPoints: number
): { labels: string[]; values: number[] } {
  const mean = (s: number, c: number) => (c ? round1(s / c) : 0);
  if (labels.length <= maxPoints) {
    return { labels, values: labels.map((_, i) => mean(sums[i] ?? 0, counts[i] ?? 0)) };
  }
  const step = Math.ceil(labels.length / maxPoints);
  const outL: string[] = [];
  const outV: number[] = [];
  for (let i = 0; i < labels.length; i += step) {
    outL.push(labels[i]);
    const s = sums.slice(i, i + step).reduce((a, b) => a + b, 0);
    const c = counts.slice(i, i + step).reduce((a, b) => a + b, 0);
    outV.push(mean(s, c));
  }
  return { labels: outL, values: outV };
}

export type ScoreSlice = { label: string; value: number };

// CSV serialization with correct quoting (RFC 4180-ish, CRLF endings).
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}

// Percentage bands computed from real marks (sum of plus per test). Attempts
// whose test can no longer be matched are counted as `unmapped`, shown
// explicitly in the UI — never silently dropped or invented.
export function scorePctBuckets(
  attempts: Array<{ score: number; test: string }>,
  marks: Map<string, TestMarkStats>
): { slices: ScoreSlice[]; mapped: number; unmapped: number } {
  const defs: Array<{ label: string; test: (p: number) => boolean }> = [
    { label: "0–40%", test: (p) => p < 40 },
    { label: "40–60%", test: (p) => p >= 40 && p < 60 },
    { label: "60–75%", test: (p) => p >= 60 && p < 75 },
    { label: "75–90%", test: (p) => p >= 75 && p < 90 },
    { label: "90–100%", test: (p) => p >= 90 },
  ];
  const counts = defs.map(() => 0);
  let mapped = 0;
  let unmapped = 0;
  for (const a of attempts) {
    const pct = pctOf(Number(a.score), marks.get(normTitle(a.test)));
    if (pct === null) {
      unmapped++;
      continue;
    }
    mapped++;
    const i = defs.findIndex((d) => d.test(pct));
    counts[i < 0 ? counts.length - 1 : i]++;
  }
  return { slices: defs.map((d, i) => ({ label: d.label, value: counts[i] })), mapped, unmapped };
}
