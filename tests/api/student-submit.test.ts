/** @jest-environment node */

jest.mock("@/lib/admin-server", () => ({ requireUser: jest.fn() }));

import { POST } from "@/app/api/student/submit/route";
import { requireUser } from "@/lib/admin-server";
import {
  fakeSupabase,
  filterValue,
  inValues,
  type FakeQuery,
} from "../helpers/fake-supabase";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const TEST_ID = uuid(1);
const FULL_ID = uuid(2);
const DRAFT_ID = uuid(3);
const Q1 = uuid(11);
const Q2 = uuid(12);
const Q3 = uuid(13);
const Q_DRAFT = uuid(14);
const USER = { id: uuid(99), email: "student@example.com", emailVerified: true };

const practiceTest = {
  id: TEST_ID,
  title: "Practice 01",
  question_ids: [Q1, Q2],
  published: true,
  template: "",
};
const fullMockTest = {
  id: FULL_ID,
  title: "NIMCET MOCK - 01",
  question_ids: [Q3],
  published: true,
  template: "nimcet-2026",
};
const draftTest = {
  id: DRAFT_ID,
  title: "Draft paper",
  question_ids: [Q_DRAFT],
  published: false,
  template: "",
};

const bank = [
  {
    id: Q1,
    answer: 1,
    plus: 4,
    minus: -1,
    stem: "Q1 stem",
    options: ["a", "b", "c", "d"],
    explanation: "Q1 explanation",
    section: "maths",
  },
  {
    id: Q2,
    answer: 2,
    plus: 4,
    minus: -1,
    stem: "Q2 stem",
    options: ["a", "b", "c", "d"],
    explanation: "Q2 explanation",
    section: "maths",
  },
  {
    id: Q3,
    answer: 0,
    plus: 12,
    minus: -3,
    stem: "Full mock stem",
    options: ["a", "b", "c", "d"],
    explanation: "Full mock explanation",
    section: "maths",
  },
  {
    id: Q_DRAFT,
    answer: 0,
    plus: 4,
    minus: -1,
    stem: "Draft stem",
    options: ["a", "b", "c", "d"],
    explanation: "Draft explanation",
    section: "maths",
  },
];

const requireUserMock = requireUser as jest.MockedFunction<typeof requireUser>;

function setup(options?: {
  tests?: unknown[];
  questions?: unknown[];
  attemptCount?: number;
  duplicate?: boolean;
  testsError?: unknown;
}) {
  const inserts: unknown[] = [];
  const { client, queries } = fakeSupabase((q: FakeQuery) => {
    if (q.table === "tests") {
      if (options?.testsError && q.select?.includes("template")) {
        return { error: options.testsError };
      }
      let rows = (options?.tests ?? [practiceTest, fullMockTest, draftTest]) as Array<
        Record<string, unknown>
      >;
      const published = filterValue(q, "published");
      if (published !== undefined) rows = rows.filter((r) => r.published === published);
      const id = filterValue(q, "id");
      if (id !== undefined) rows = rows.filter((r) => r.id === id);
      const title = filterValue(q, "title");
      if (title !== undefined) rows = rows.filter((r) => r.title === title);
      return { data: rows, error: null };
    }
    if (q.table === "questions") {
      const ids = inValues(q, "id");
      const rows = (options?.questions ?? bank) as Array<Record<string, unknown>>;
      return { data: rows.filter((r) => ids.includes(String(r.id))), error: null };
    }
    if (q.table === "attempts") {
      if (q.op === "select" && q.count) {
        return { count: options?.attemptCount ?? 0, error: null };
      }
      if (q.op === "select") {
        return { data: options?.duplicate ? [{ id: uuid(500) }] : [], error: null };
      }
      if (q.op === "insert") {
        inserts.push(q.values);
        return { error: null };
      }
    }
    return { data: [], error: null };
  });
  requireUserMock.mockResolvedValue({
    svc: client as never,
    user: USER as never,
  });
  return { client, queries, inserts };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/student/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function questionQueries(queries: FakeQuery[]) {
  return queries.filter((q) => q.table === "questions");
}

describe("POST /api/student/submit — answer-key authorization", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
  });

  it("rejects a fake test name with no test id before touching questions", async () => {
    const { queries, inserts } = setup();
    const res = await post({ test: "Completely fake paper", answers: [{ id: Q1, answer: 1 }] });
    expect(res.status).toBe(400);
    expect(questionQueries(queries)).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("rejects an omitted test id when the title is not a published test", async () => {
    const { queries } = setup();
    const res = await post({ test: "", answers: [{ id: Q1, answer: 1 }] });
    expect(res.status).toBe(400);
    expect(questionQueries(queries)).toHaveLength(0);
  });

  it("rejects an unknown but well-formed test id", async () => {
    const { queries } = setup();
    const res = await post({ test: "x", testId: uuid(404), answers: [{ id: Q1, answer: 1 }] });
    expect(res.status).toBe(400);
    expect(questionQueries(queries)).toHaveLength(0);
  });

  it("fails closed when the template-column query has a transient error", async () => {
    const { queries } = setup({ testsError: { message: "connection reset by peer" } });
    const res = await post({
      test: "Practice 01",
      testId: TEST_ID,
      answers: [{ id: Q1, answer: 1 }],
    });
    expect(res.status).toBe(500);
    expect(questionQueries(queries)).toHaveLength(0);
  });

  it("rejects a draft question submitted through the custom practice path", async () => {
    const { queries } = setup();
    const res = await post({
      test: "Custom practice",
      custom: true,
      answers: [{ id: Q_DRAFT, answer: 0 }],
    });
    expect(res.status).toBe(400);
    expect(questionQueries(queries)).toHaveLength(0);
  });

  it("rejects a question that belongs to a different test", async () => {
    const { queries } = setup();
    const res = await post({
      test: practiceTest.title,
      testId: TEST_ID,
      answers: [{ id: Q3, answer: 0 }],
    });
    expect(res.status).toBe(400);
    expect(questionQueries(queries)).toHaveLength(0);
  });

  it("refuses direct submissions for a timed template exam (id path)", async () => {
    const { queries, inserts } = setup();
    const res = await post({
      test: fullMockTest.title,
      testId: FULL_ID,
      answers: [{ id: Q3, answer: 0 }],
    });
    expect(res.status).toBe(409);
    expect(questionQueries(queries)).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("refuses direct submissions for a timed template exam (title fallback)", async () => {
    const { queries } = setup();
    const res = await post({
      test: fullMockTest.title,
      answers: [{ id: Q3, answer: 0 }],
    });
    expect(res.status).toBe(409);
    expect(questionQueries(queries)).toHaveLength(0);
  });

  it("refuses to score a full-mock question through a custom run", async () => {
    const { queries } = setup();
    const res = await post({
      test: "Custom practice",
      custom: true,
      answers: [{ id: Q3, answer: 0 }],
    });
    expect(res.status).toBe(400);
    expect(questionQueries(queries)).toHaveLength(0);
  });

  it("scores a valid published-test submission and returns its review details", async () => {
    const { inserts } = setup();
    const res = await post({
      test: practiceTest.title,
      testId: TEST_ID,
      answers: [
        { id: Q1, answer: 1 },
        { id: Q2, answer: null },
      ],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      score: number;
      correct: number;
      wrong: number;
      skipped: number;
      details: Array<{ correct: number; exp: string }>;
    };
    expect(body).toMatchObject({ score: 4, correct: 1, wrong: 0, skipped: 1 });
    expect(body.details).toHaveLength(2);
    expect(body.details[0]).toMatchObject({ correct: 1, exp: "Q1 explanation" });
    expect(inserts).toEqual([
      {
        user_id: USER.id,
        test: practiceTest.title,
        score: 4,
        correct: 1,
        wrong: 0,
        skipped: 1,
      },
    ]);
  });

  it("scores a valid title-only submission with the database title", async () => {
    const { inserts } = setup();
    const res = await post({
      test: practiceTest.title,
      answers: [{ id: Q1, answer: 0 }],
    });
    expect(res.status).toBe(200);
    expect((inserts[0] as { test: string }).test).toBe(practiceTest.title);
  });

  it("scores a custom practice run from the published non-template pool", async () => {
    const { inserts } = setup();
    const res = await post({
      test: "My custom set",
      custom: true,
      answers: [
        { id: Q1, answer: 1 },
        { id: Q2, answer: 2 },
      ],
    });
    expect(res.status).toBe(200);
    expect((inserts[0] as { test: string }).test).toBe("My custom set");
  });

  it("rejects a custom run that also carries a test id", async () => {
    setup();
    const res = await post({
      test: "My custom set",
      custom: true,
      testId: TEST_ID,
      answers: [{ id: Q1, answer: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it("throttles rapid submissions", async () => {
    setup({ attemptCount: 25 });
    const res = await post({
      test: practiceTest.title,
      testId: TEST_ID,
      answers: [{ id: Q1, answer: 1 }],
    });
    expect(res.status).toBe(429);
  });
});
