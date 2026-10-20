/** @jest-environment node */

jest.mock("@/lib/admin-server", () => ({ requireUser: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/student/questions/route";
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
const Q1 = uuid(11);
const Q2 = uuid(12);
const Q3 = uuid(13);
const Q_DRAFT = uuid(14);
const USER = { id: uuid(99), email: "student@example.com", emailVerified: true };

const tests = [
  { id: TEST_ID, title: "Practice 01", question_ids: [Q1, Q2], published: true, template: "" },
  { id: FULL_ID, title: "NIMCET MOCK - 01", question_ids: [Q3], published: true, template: "nimcet-2026" },
  { id: uuid(3), title: "Draft", question_ids: [Q_DRAFT], published: false, template: "" },
];

const bank = [Q1, Q2, Q3, Q_DRAFT].map((id, i) => ({
  id,
  exam: "nimcet",
  section: "maths",
  topic: "algebra",
  difficulty: i % 2 === 0 ? "Easy" : "Medium",
  stem: `stem ${i}`,
  options: ["a", "b", "c", "d"],
  plus: 4,
  minus: -1,
  created_at: `2026-01-0${i + 1}T00:00:00.000Z`,
  answer: 0,
  explanation: "secret",
}));

const requireUserMock = requireUser as jest.MockedFunction<typeof requireUser>;

function setup(options?: { sessionQuestionIds?: string[] }) {
  const { client, queries } = fakeSupabase((q: FakeQuery) => {
    if (q.table === "tests") return { data: tests, error: null };
    if (q.table === "mock_sessions") {
      return {
        data: [{ question_ids: options?.sessionQuestionIds ?? [] }],
        error: null,
      };
    }
    if (q.table === "questions") {
      const ids = inValues(q, "id");
      let rows = bank.filter((r) => ids.includes(r.id));
      const exam = filterValue(q, "exam");
      if (exam !== undefined) rows = rows.filter((r) => r.exam === exam);
      const difficulty = filterValue(q, "difficulty");
      if (difficulty !== undefined) rows = rows.filter((r) => r.difficulty === difficulty);
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  });
  requireUserMock.mockResolvedValue({
    svc: client as never,
    user: USER as never,
  });
  return { client, queries };
}

function get(query: string) {
  return GET(new Request(`http://localhost/api/student/questions${query}`));
}

describe("GET /api/student/questions — scoped question access", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
  });

  it("returns only published, non-template practice questions", async () => {
    const { queries } = setup();
    const res = await get("?limit=300");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<{ id: string; answer?: unknown; explanation?: unknown }> };
    expect(body.rows.map((r) => r.id).sort()).toEqual([Q1, Q2].sort());
    expect(body.rows.every((r) => r.answer === undefined && r.explanation === undefined)).toBe(true);
    const ids = queries
      .filter((q) => q.table === "questions")
      .flatMap((q) => inValues(q, "id"));
    expect(ids).not.toContain(Q3);
    expect(ids).not.toContain(Q_DRAFT);
  });

  it("allows explicit ids that belong to a published practice test", async () => {
    setup();
    const res = await get(`?ids=${Q1},${Q2}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<{ id: string }> };
    expect(body.rows.map((r) => r.id).sort()).toEqual([Q1, Q2].sort());
  });

  it("rejects explicit ids for an unpublished/draft question", async () => {
    setup();
    const res = await get(`?ids=${Q_DRAFT}`);
    expect(res.status).toBe(403);
  });

  it("rejects explicit ids for a timed full-mock question with no session", async () => {
    setup();
    const res = await get(`?ids=${Q3}`);
    expect(res.status).toBe(403);
  });

  it("allows a timed question only through the user's own session", async () => {
    setup({ sessionQuestionIds: [Q3] });
    const res = await get(`?ids=${Q3}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<{ id: string }> };
    expect(body.rows.map((r) => r.id)).toEqual([Q3]);
  });

  it("applies exam and difficulty filters after scoping", async () => {
    setup();
    const res = await get("?limit=300&exam=nimcet&difficulty=Medium");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<{ id: string; difficulty: string }> };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].id).toBe(Q2);
    expect(body.rows[0].difficulty).toBe("Medium");
  });

  it("returns 401 when the route's auth helper rejects the request", async () => {
    requireUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    } as never);
    const res = await get("?limit=10");
    expect(res.status).toBe(401);
  });
});
