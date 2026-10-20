/** @jest-environment node */

jest.mock("@/lib/admin-server", () => ({ requireUser: jest.fn() }));

import { NextResponse } from "next/server";
import { GET } from "@/app/api/student/stats/route";
import { requireUser } from "@/lib/admin-server";
import { fakeSupabase, type FakeQuery } from "../helpers/fake-supabase";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const USER = { id: uuid(99), email: "student@example.com", emailVerified: true };

const requireUserMock = requireUser as jest.MockedFunction<typeof requireUser>;

function attempts(count: number) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(1000 + i),
    test: "NIMCET MOCK - 01",
    // Newest first: the oldest row has the highest score, outside a 20-row read.
    score: i === count - 1 ? 100 : 10,
    correct: 2,
    wrong: 1,
    skipped: 1,
    created_at: new Date(now - i * 60_000).toISOString(),
  }));
}

function setup(options?: { rows?: unknown[]; error?: unknown }) {
  const { client, queries } = fakeSupabase((q: FakeQuery) => {
    if (q.table === "attempts") {
      if (options?.error) return { error: options.error };
      const rows = (options?.rows ?? []) as Array<Record<string, unknown>>;
      if (q.range) {
        return { data: rows.slice(q.range.from, q.range.to + 1), error: null };
      }
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

function get(query = "") {
  return GET(new Request(`http://localhost/api/student/stats${query}`));
}

describe("GET /api/student/stats — exact aggregates", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
  });

  it("aggregates the full history, not just the latest 20", async () => {
    setup({ rows: attempts(25) });
    const res = await get(`?tzOffset=0`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      attempts: Array<{ id: string }>;
      stats: {
        total: number;
        best: number;
        avg: number;
        correct: number;
        wrong: number;
        skipped: number;
        questions: number;
        accuracy: number;
        byTest: Record<string, { count: number; best: number }>;
      };
      truncated: boolean;
    };
    expect(body.stats.total).toBe(25);
    expect(body.stats.best).toBe(100);
    expect(body.stats.avg).toBe(13.6);
    expect(body.stats.correct).toBe(50);
    expect(body.stats.wrong).toBe(25);
    expect(body.stats.skipped).toBe(25);
    expect(body.stats.questions).toBe(100);
    expect(body.stats.accuracy).toBe(67);
    expect(body.stats.byTest["NIMCET MOCK - 01"]).toEqual({ count: 25, best: 100 });
    // Only the recent slice is rendered.
    expect(body.attempts).toHaveLength(20);
    expect(body.truncated).toBe(false);
  });

  it("reports a missing attempts table distinctly from a network failure", async () => {
    setup({
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.attempts' in the schema cache",
      },
    });
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { missingTable: boolean; stats: unknown };
    expect(body.missingTable).toBe(true);
    expect(body.stats).toBeNull();
  });

  it("returns 401 when the auth helper rejects the request", async () => {
    requireUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    } as never);
    const res = await get();
    expect(res.status).toBe(401);
  });
});
