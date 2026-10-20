/** @jest-environment node */

import { finalizeSession, type MockSessionRow } from "@/lib/exam-finalize";
import {
  fakeSupabase,
  inValues,
  type FakeQuery,
} from "../helpers/fake-supabase";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const SESSION_ID = uuid(1);
const ATTEMPT_ID = uuid(2);
const Q1 = uuid(3);
const USER_ID = uuid(4);
const TEST_ID = uuid(5);

const session: MockSessionRow = {
  id: SESSION_ID,
  user_id: USER_ID,
  test_id: TEST_ID,
  test_title: "NIMCET MOCK - 01",
  template: "nimcet-2026",
  question_ids: [Q1],
  started_at: new Date().toISOString(),
  parts: [{ answers: [{ id: Q1, answer: 0 }], lockedAt: null }],
  completed: false,
  attempt_id: null,
};

const question = {
  id: Q1,
  section: "maths",
  stem: "stem",
  options: ["a", "b", "c", "d"],
  answer: 0,
  explanation: "because",
  plus: 12,
  minus: -3,
};

function setup(options: {
  claim?: "won" | "lost";
  existingAttemptId?: string | null;
  linkResults?: Array<"ok" | "error" | "empty">;
}) {
  let linkCall = 0;
  const { client, queries } = fakeSupabase((q: FakeQuery) => {
    if (q.table === "questions") {
      const ids = inValues(q, "id");
      return { data: ids.includes(Q1) ? [question] : [], error: null };
    }
    if (q.table === "attempts") {
      if (q.op === "insert") return { data: { id: ATTEMPT_ID }, error: null };
      if (q.op === "delete") return { data: [{ id: ATTEMPT_ID }], error: null };
      return { data: [], error: null };
    }
    if (q.table === "mock_sessions") {
      if (q.op === "select") {
        return {
          data: { attempt_id: options.existingAttemptId ?? null },
          error: null,
        };
      }
      if (q.op === "update") {
        const values = (q.values ?? {}) as Record<string, unknown>;
        if (values.completed === true) {
          return {
            data: options.claim === "lost" ? [] : [{ id: SESSION_ID }],
            error: null,
          };
        }
        if (typeof values.attempt_id === "string") {
          const mode = options.linkResults?.[linkCall] ?? "ok";
          linkCall++;
          if (mode === "error") return { error: { message: "transient link error" } };
          if (mode === "empty") return { data: [], error: null };
          return { data: [{ id: SESSION_ID }], error: null };
        }
      }
    }
    return { data: [], error: null };
  });
  return { client, queries };
}

describe("finalizeSession — attempt linking", () => {
  it("retries a transient link failure and records the attempt once", async () => {
    const { client, queries } = setup({
      claim: "won",
      linkResults: ["error", "ok"],
    });
    const out = await finalizeSession(client as never, session);

    expect(out.recorded).toBe(true);
    expect(out.result.correct).toBe(1);
    const inserts = queries.filter((q) => q.table === "attempts" && q.op === "insert");
    expect(inserts).toHaveLength(1);
    const linkUpdates = queries.filter(
      (q) =>
        q.table === "mock_sessions" &&
        q.op === "update" &&
        typeof (q.values as Record<string, unknown> | undefined)?.attempt_id === "string"
    );
    expect(linkUpdates).toHaveLength(2);
    expect(queries.some((q) => q.table === "attempts" && q.op === "delete")).toBe(false);
  });

  it("compensates when the attempt can never be linked", async () => {
    const { client, queries } = setup({
      claim: "won",
      linkResults: ["empty", "empty", "empty"],
    });

    await expect(finalizeSession(client as never, session)).rejects.toBeTruthy();

    const deletes = queries.filter((q) => q.table === "attempts" && q.op === "delete");
    expect(deletes).toHaveLength(1);
    expect((deletes[0].filters[0] as { value: string }).value).toBe(ATTEMPT_ID);

    const release = queries.filter(
      (q) =>
        q.table === "mock_sessions" &&
        q.op === "update" &&
        (q.values as Record<string, unknown>).completed === false
    );
    expect(release).toHaveLength(1);
    expect((release[0].values as Record<string, unknown>).attempt_id).toBeNull();
  });

  it("reports recorded when a concurrent finalizer already linked the attempt", async () => {
    const { client, queries } = setup({
      claim: "lost",
      existingAttemptId: ATTEMPT_ID,
    });
    const out = await finalizeSession(client as never, session);
    expect(out.recorded).toBe(true);
    expect(queries.some((q) => q.table === "attempts" && q.op === "insert")).toBe(false);
  });

  it("reports not recorded when a concurrent finalizer has not linked yet", async () => {
    const { client } = setup({ claim: "lost", existingAttemptId: null });
    const out = await finalizeSession(client as never, session);
    expect(out.recorded).toBe(false);
  });

  it("closes a zero-answer session without inserting an attempt", async () => {
    const { client, queries } = setup({ claim: "won" });
    const emptySession: MockSessionRow = {
      ...session,
      parts: [{ answers: [], lockedAt: null }],
    };
    const out = await finalizeSession(client as never, emptySession);
    expect(out.recorded).toBe(false);
    expect(queries.some((q) => q.table === "attempts" && q.op === "insert")).toBe(false);
  });
});
