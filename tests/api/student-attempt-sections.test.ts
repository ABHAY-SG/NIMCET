/** @jest-environment node */

jest.mock("@/lib/admin-server", () => ({ requireUser: jest.fn() }));

import { POST as partPOST } from "@/app/api/student/attempt/part/route";
import { POST as answersPOST } from "@/app/api/student/attempt/answers/route";
import { requireUser } from "@/lib/admin-server";
import { fakeSupabase, inValues, type FakeQuery } from "../helpers/fake-supabase";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const NOW = Date.parse("2026-06-08T10:00:00.000Z");
const USER = { id: uuid(999), email: "student@example.com", emailVerified: true };
const SESSION_ID = uuid(1000);
const QUESTION_IDS = Array.from({ length: 120 }, (_, i) => uuid(i + 1));

const SUBJECTS = [
  ...Array.from({ length: 50 }, (_, i) => ({ id: QUESTION_IDS[i], section: "Mathematics", plus: 12, minus: -3 })),
  ...Array.from({ length: 40 }, (_, i) => ({ id: QUESTION_IDS[50 + i], section: "Logical Reasoning", plus: 6, minus: -1.5 })),
  ...Array.from({ length: 20 }, (_, i) => ({ id: QUESTION_IDS[90 + i], section: "Computer Awareness", plus: 6, minus: -1.5 })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: QUESTION_IDS[110 + i], section: "English", plus: 4, minus: -1 })),
];

const questions = SUBJECTS.map((q, i) => ({
  id: q.id,
  section: q.section,
  stem: `Question ${i + 1}`,
  options: ["a", "b", "c", "d"],
  plus: q.plus,
  minus: q.minus,
}));

type Session = {
  id: string;
  user_id: string;
  test_id: string;
  test_title: string;
  template: string;
  question_ids: string[];
  started_at: string;
  parts: Array<{ answers: Array<{ id: string; answer: number | null }>; lockedAt: string | null }>;
  completed: boolean;
  attempt_id: string | null;
};

const requireUserMock = requireUser as jest.MockedFunction<typeof requireUser>;

function setup(elapsedMs: number) {
  const session: Session = {
    id: SESSION_ID,
    user_id: USER.id,
    test_id: uuid(2000),
    test_title: "NIMCET 2026 PAPER",
    template: "nimcet-2026",
    question_ids: QUESTION_IDS,
    started_at: new Date(NOW - elapsedMs).toISOString(),
    parts: [
      { answers: [], lockedAt: null },
      { answers: [], lockedAt: null },
      { answers: [], lockedAt: null },
    ],
    completed: false,
    attempt_id: null,
  };
  let lastParts = session.parts;

  const { client, queries } = fakeSupabase((q: FakeQuery) => {
    if (q.table === "mock_sessions") {
      if (q.op === "select") return { data: session, error: null };
      if (q.op === "update") {
        const values = (q.values ?? {}) as { parts?: Session["parts"] };
        if (values.parts) {
          lastParts = values.parts;
          session.parts = values.parts;
        }
        return { data: [{ id: SESSION_ID }], error: null };
      }
    }
    if (q.table === "questions") {
      const ids = new Set(inValues(q, "id"));
      return { data: questions.filter((row) => ids.has(row.id)), error: null };
    }
    return { data: [], error: null };
  });

  requireUserMock.mockResolvedValue({ svc: client as never, user: USER as never });
  return { queries, session, getParts: () => lastParts };
}

function postPart(body: unknown) {
  return partPOST(
    new Request("http://localhost/api/student/attempt/part", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function postAnswers(body: unknown) {
  return answersPOST(
    new Request("http://localhost/api/student/attempt/answers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("server-enforced NIMCET subject sections", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("serves only Mathematics during Part I and restarts numbering at 1", async () => {
    setup(10 * 60_000);
    const res = await postPart({ sessionId: SESSION_ID, index: 0, section: "maths" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      section: string;
      questions: Array<{ id: string }>;
      sections: Array<{ key: string }>;
      remainingSec: number;
    };
    expect(body.section).toBe("maths");
    expect(body.questions).toHaveLength(50);
    expect(body.questions[0].id).toBe(QUESTION_IDS[0]);
    expect(body.questions[49].id).toBe(QUESTION_IDS[49]);
    expect(body.sections.map((s) => s.key)).toEqual(["maths", "reasoning", "computer", "english"]);
    expect(body.remainingSec).toBeGreaterThan(3500);
    expect(body.remainingSec).toBeLessThanOrEqual(3600);
  });

  it("refuses a subject that belongs to another timed part", async () => {
    setup(10 * 60_000);
    const res = await postPart({ sessionId: SESSION_ID, index: 0, section: "reasoning" });
    expect(res.status).toBe(400);
  });

  it("refuses a future part before its window opens", async () => {
    setup(10 * 60_000);
    const res = await postPart({ sessionId: SESSION_ID, index: 1, section: "reasoning" });
    expect(res.status).toBe(409);
  });

  it("refuses a finished part after its window closes", async () => {
    setup(100 * 60_000);
    const res = await postPart({ sessionId: SESSION_ID, index: 0, section: "maths" });
    expect(res.status).toBe(409);
  });

  it("serves both Part III subjects inside the shared 20-minute window", async () => {
    setup(100 * 60_000);
    const computer = await postPart({ sessionId: SESSION_ID, index: 2, section: "computer" });
    expect(computer.status).toBe(200);
    const cBody = (await computer.json()) as { questions: Array<{ id: string }>; section: string };
    expect(cBody.section).toBe("computer");
    expect(cBody.questions).toHaveLength(20);
    expect(cBody.questions[0].id).toBe(QUESTION_IDS[90]);
    expect(cBody.questions[19].id).toBe(QUESTION_IDS[109]);

    const english = await postPart({ sessionId: SESSION_ID, index: 2, section: "english" });
    expect(english.status).toBe(200);
    const eBody = (await english.json()) as { questions: Array<{ id: string }>; section: string };
    expect(eBody.section).toBe("english");
    expect(eBody.questions).toHaveLength(10);
    expect(eBody.questions[0].id).toBe(QUESTION_IDS[110]);
    expect(eBody.questions[9].id).toBe(QUESTION_IDS[119]);
  });

  it("rejects a subject answer from a different section", async () => {
    setup(100 * 60_000);
    const res = await postAnswers({
      sessionId: SESSION_ID,
      index: 2,
      section: "computer",
      answers: [{ id: QUESTION_IDS[0], answer: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it("preserves Computer answers when English is saved in the same Part III", async () => {
    const { getParts } = setup(100 * 60_000);

    const computer = await postAnswers({
      sessionId: SESSION_ID,
      index: 2,
      section: "computer",
      answers: [
        { id: QUESTION_IDS[90], answer: 1 },
        { id: QUESTION_IDS[91], answer: 2 },
      ],
    });
    expect(computer.status).toBe(200);
    expect(getParts()[2].answers).toHaveLength(2);

    const english = await postAnswers({
      sessionId: SESSION_ID,
      index: 2,
      section: "english",
      answers: [{ id: QUESTION_IDS[110], answer: 3 }],
    });
    expect(english.status).toBe(200);
    expect(getParts()[2].answers).toHaveLength(3);
    expect(getParts()[2].answers.map((p) => p.id).sort()).toEqual(
      [QUESTION_IDS[90], QUESTION_IDS[91], QUESTION_IDS[110]].sort()
    );
  });

  it("rejects answer saves for a finished part", async () => {
    setup(100 * 60_000);
    const res = await postAnswers({
      sessionId: SESSION_ID,
      index: 0,
      section: "maths",
      answers: [{ id: QUESTION_IDS[0], answer: 0 }],
    });
    expect(res.status).toBe(409);
  });

  it("does not serve Part II one second before its 70-minute window", async () => {
    setup(70 * 60_000 - 1000);
    const res = await postPart({ sessionId: SESSION_ID, index: 1, section: "reasoning" });
    expect(res.status).toBe(409);
  });

  it("opens Part II at 70 minutes and accepts Reasoning answers", async () => {
    const { getParts } = setup(70 * 60_000);
    const part = await postPart({ sessionId: SESSION_ID, index: 1, section: "reasoning" });
    expect(part.status).toBe(200);
    const body = (await part.json()) as { questions: Array<{ id: string }>; remainingSec: number };
    expect(body.questions[0].id).toBe(QUESTION_IDS[50]);
    expect(body.questions).toHaveLength(40);
    expect(body.remainingSec).toBeLessThanOrEqual(30 * 60);

    const saved = await postAnswers({
      sessionId: SESSION_ID,
      index: 1,
      section: "reasoning",
      answers: [{ id: QUESTION_IDS[50], answer: 2 }],
    });
    expect(saved.status).toBe(200);
    expect(getParts()[1].answers).toEqual([{ id: QUESTION_IDS[50], answer: 2 }]);
  });

  it("does not serve Part III one second before its 100-minute window", async () => {
    setup(100 * 60_000 - 1000);
    const res = await postPart({ sessionId: SESSION_ID, index: 2, section: "computer" });
    expect(res.status).toBe(409);
  });

  it("rejects answers for a future part and for a finished part at the same boundary", async () => {
    setup(100 * 60_000 - 1000);
    const future = await postAnswers({
      sessionId: SESSION_ID,
      index: 2,
      section: "computer",
      answers: [{ id: QUESTION_IDS[90], answer: 1 }],
    });
    expect(future.status).toBe(409);

    setup(100 * 60_000);
    const finished = await postAnswers({
      sessionId: SESSION_ID,
      index: 1,
      section: "reasoning",
      answers: [{ id: QUESTION_IDS[50], answer: 1 }],
    });
    expect(finished.status).toBe(409);
  });
});
