/** @jest-environment node */

jest.mock("@/lib/admin-server", () => ({ requireUser: jest.fn() }));

import { POST } from "@/app/api/student/attempt/start/route";
import { requireUser } from "@/lib/admin-server";
import { fakeSupabase, filterValue, type FakeQuery } from "../helpers/fake-supabase";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const TEST_ID = uuid(1);
const OPEN_ID = uuid(2);
const NEW_ID = uuid(3);
const Q1 = uuid(11);
const USER = { id: uuid(99), email: "student@example.com", emailVerified: true };

const fullTest = {
  id: TEST_ID,
  title: "NIMCET MOCK - 01",
  exam: "nimcet",
  minutes: 120,
  free: true,
  published: true,
  question_ids: [Q1],
  template: "nimcet-2026",
};

const openSession = {
  id: OPEN_ID,
  user_id: USER.id,
  test_id: TEST_ID,
  test_title: fullTest.title,
  template: fullTest.template,
  question_ids: [Q1],
  started_at: new Date().toISOString(),
  parts: [],
  completed: false,
  attempt_id: null,
};

const requireUserMock = requireUser as jest.MockedFunction<typeof requireUser>;

function setup(options?: {
  openFirst?: boolean;
  openAfterInsert?: boolean;
  test?: Record<string, unknown>;
}) {
  let sessionSelects = 0;
  const { client, queries } = fakeSupabase((q: FakeQuery) => {
    if (q.table === "tests") {
      const id = filterValue(q, "id");
      return { data: id === TEST_ID ? [options?.test ?? fullTest] : [], error: null };
    }
    if (q.table === "mock_sessions") {
      if (q.op === "select") {
        sessionSelects++;
        if (options?.openFirst) return { data: [openSession], error: null };
        if (options?.openAfterInsert && sessionSelects > 1) {
          return { data: [openSession], error: null };
        }
        return { data: [], error: null };
      }
      if (q.op === "insert") {
        if (options?.openAfterInsert) {
          return { error: { code: "23505", message: "duplicate key value" } };
        }
        return { data: { id: NEW_ID }, error: null };
      }
      if (q.op === "update") return { data: [{ id: OPEN_ID }], error: null };
    }
    return { data: [], error: null };
  });
  requireUserMock.mockResolvedValue({
    svc: client as never,
    user: USER as never,
  });
  return { client, queries };
}

function start(body: unknown) {
  return POST(
    new Request("http://localhost/api/student/attempt/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/student/attempt/start — one open session invariant", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
  });

  it("resumes the existing open session without inserting or retiring anything", async () => {
    const { queries } = setup({ openFirst: true });
    const res = await start({ testId: TEST_ID });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionId: string; resumed: boolean; remainingSec: number };
    expect(body.sessionId).toBe(OPEN_ID);
    expect(body.resumed).toBe(true);
    expect(body.remainingSec).toBeGreaterThan(0);

    const sessions = queries.filter((q) => q.table === "mock_sessions");
    expect(sessions.some((q) => q.op === "insert")).toBe(false);
    expect(sessions.some((q) => q.op === "update")).toBe(false);
  });

  it("returns the winner's session when a concurrent start hits the unique index", async () => {
    const { queries } = setup({ openAfterInsert: true });
    const res = await start({ testId: TEST_ID });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionId: string; resumed: boolean };
    expect(body.sessionId).toBe(OPEN_ID);
    expect(body.resumed).toBe(true);

    const sessions = queries.filter((q) => q.table === "mock_sessions");
    expect(sessions.filter((q) => q.op === "insert")).toHaveLength(1);
    // The losing request must never mark another open session completed.
    expect(sessions.some((q) => q.op === "update")).toBe(false);
  });

  it("opens exactly one new session when no open session exists", async () => {
    const { queries } = setup();
    const res = await start({ testId: TEST_ID });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionId: string; resumed: boolean };
    expect(body.sessionId).toBe(NEW_ID);
    expect(body.resumed).toBe(false);

    const sessions = queries.filter((q) => q.table === "mock_sessions");
    expect(sessions.filter((q) => q.op === "insert")).toHaveLength(1);
    expect(sessions.some((q) => q.op === "update")).toBe(false);
  });

  it("rejects a non-template test instead of opening a session", async () => {
    const { queries } = setup({ test: { ...fullTest, template: "" } });
    const res = await start({ testId: TEST_ID });
    expect(res.status).toBe(400);
    expect(queries.some((q) => q.table === "mock_sessions" && q.op === "insert")).toBe(false);
  });

  it("rejects an unpublished test", async () => {
    const { queries } = setup({ test: { ...fullTest, published: false } });
    const res = await start({ testId: TEST_ID });
    expect(res.status).toBe(403);
    expect(queries.some((q) => q.table === "mock_sessions" && q.op === "insert")).toBe(false);
  });
});
