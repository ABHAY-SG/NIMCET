// SERVER ONLY — shared scoring/finalization for template exam sessions
// (mock_sessions). Used by the attempt start/complete routes so a session is
// scored exactly once, from answers the server itself accepted.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mergePicks,
  round1,
  scoreQuestions,
  subjectResults,
  type DetailRow,
  type ScoreOutcome,
  type SessionQuestion,
  type SubjectResult,
} from "./exam-session";

export type MockSessionRow = {
  id: string;
  user_id: string;
  test_id: string;
  test_title: string;
  template: string;
  question_ids: string[];
  started_at: string;
  parts: unknown;
  completed: boolean;
  attempt_id: string | null;
};

export type ExamResult = ScoreOutcome & {
  details: DetailRow[];
  sections: SubjectResult[];
  maxMarks: number;
  testName: string;
};

export type SessionPart = { answers: Array<{ id: string; answer: number | null }>; lockedAt: string | null };

export const SESSION_COLS =
  "id,user_id,test_id,test_title,template,question_ids,started_at,parts,completed,attempt_id";

export async function loadSession(svc: SupabaseClient, id: string): Promise<MockSessionRow | null> {
  const { data, error } = await svc.from("mock_sessions").select(SESSION_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as MockSessionRow | null) ?? null;
}

export function blankParts(count: number): SessionPart[] {
  return Array.from({ length: count }, () => ({ answers: [], lockedAt: null }));
}

export function asParts(raw: unknown): SessionPart[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      answers: Array.isArray(o.answers) ? (o.answers as SessionPart["answers"]) : [],
      lockedAt: typeof o.lockedAt === "string" ? o.lockedAt : null,
    };
  });
}

const FULL_COLS = "id,section,stem,options,answer,explanation,plus,minus";
const SAFE_COLS = "id,section,stem,options,plus,minus";

type RawQuestion = {
  id: string;
  section: string | null;
  stem: string;
  options: string[] | null;
  answer?: number | null;
  explanation?: string | null;
  plus: number | null;
  minus: number | null;
};

function toSessionQuestion(r: RawQuestion): SessionQuestion {
  return {
    id: String(r.id),
    section: String(r.section ?? ""),
    stem: String(r.stem ?? ""),
    options: Array.isArray(r.options) ? r.options.map(String) : [],
    answer: Number(r.answer ?? -1),
    explanation: String(r.explanation ?? ""),
    plus: Number(r.plus ?? 0),
    minus: Number(r.minus ?? 0),
  };
}

/** Answer-free rows for a part slice, in the order of `ids`. */
export async function fetchSafeQuestions(
  svc: SupabaseClient,
  ids: string[]
): Promise<Array<Omit<SessionQuestion, "answer" | "explanation">>> {
  if (ids.length === 0) return [];
  const { data, error } = await svc.from("questions").select(SAFE_COLS).in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [String((r as RawQuestion).id), r as RawQuestion]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is RawQuestion => !!r)
    .map((r) => {
      const q = toSessionQuestion(r);
      return { id: q.id, section: q.section, stem: q.stem, options: q.options, plus: q.plus, minus: q.minus };
    });
}

/** Full rows (with answer key) for scoring, in the order of `ids`. */
export async function fetchFullQuestions(svc: SupabaseClient, ids: string[]): Promise<SessionQuestion[]> {
  if (ids.length === 0) return [];
  const out = new Map<string, RawQuestion>();
  const step = 200;
  for (let i = 0; i < ids.length; i += step) {
    const chunk = ids.slice(i, i + step);
    const { data, error } = await svc.from("questions").select(FULL_COLS).in("id", chunk);
    if (error) throw error;
    for (const r of data ?? []) out.set(String((r as RawQuestion).id), r as RawQuestion);
  }
  return ids
    .map((id) => out.get(id))
    .filter((r): r is RawQuestion => !!r)
    .map(toSessionQuestion);
}

/** Scores a session's stored answers exactly as the server received them. */
export async function buildResult(svc: SupabaseClient, session: MockSessionRow): Promise<ExamResult> {
  const picks = mergePicks(asParts(session.parts));
  const questions = await fetchFullQuestions(svc, session.question_ids);
  const outcome = scoreQuestions(questions, picks, session.template);
  const sections = subjectResults(outcome.details);
  const maxMarks = round1(outcome.details.reduce((s, d) => s + d.plus, 0));
  return { ...outcome, sections, maxMarks, testName: session.test_title };
}

/**
 * Marks a session complete and records the attempt row — at most once, even
 * when two calls race (the UPDATE ... WHERE completed = false claim decides).
 * Attempts with zero answered questions are closed silently: an abandoned
 * exam that never got a single answer is not history worth recording.
 */
export async function finalizeSession(
  svc: SupabaseClient,
  session: MockSessionRow
): Promise<{ result: ExamResult; recorded: boolean }> {
  const result = await buildResult(svc, session);

  const { data: claimed, error: claimErr } = await svc
    .from("mock_sessions")
    .update({ completed: true, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("completed", false)
    .select("id");
  if (claimErr) throw claimErr;
  if (!Array.isArray(claimed) || claimed.length === 0) {
    // Another call already finalized this session.
    return { result, recorded: session.attempt_id !== null };
  }

  const answered = result.correct + result.wrong;
  if (answered === 0) return { result, recorded: false };

  const { data: attempt, error: aErr } = await svc
    .from("attempts")
    .insert({
      user_id: session.user_id,
      test: session.test_title,
      score: result.score,
      correct: result.correct,
      wrong: result.wrong,
      skipped: result.skipped,
    })
    .select("id")
    .single();
  if (aErr) {
    // Release the claim so a retry can record the attempt instead of losing it.
    await svc.from("mock_sessions").update({ completed: false }).eq("id", session.id);
    throw aErr;
  }

  await svc
    .from("mock_sessions")
    .update({ attempt_id: (attempt as { id: string }).id })
    .eq("id", session.id);

  return { result, recorded: true };
}
