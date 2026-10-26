/** @jest-environment node */

import {
  accessFromTests,
  isMissingTemplateColumn,
  loadQuestionAccess,
} from "@/lib/student-question-access";
import type { QaAccessState } from "@/lib/qa/server";
import { fakeSupabase, type FakeQuery } from "../helpers/fake-supabase";

const rows = [
  { id: "t1", title: "Practice", question_ids: ["q1"], published: true, template: "" },
  { id: "t2", title: "Timed", question_ids: ["q2"], published: true, template: "nimcet-2026" },
];

describe("question-access template compatibility", () => {
  it("falls back only when the template column is actually missing", async () => {
    const { client } = fakeSupabase((q: FakeQuery) => {
      if (q.table === "tests" && q.select?.includes("template")) {
        return { error: { message: "column tests.template does not exist" } };
      }
      if (q.table === "tests") {
        return { data: rows, error: null };
      }
      return { data: [], error: null };
    });

    const access = await loadQuestionAccess(client as never);
    expect(access.practice.has("q1")).toBe(true);
  });

  it("fails closed on a transient error instead of exposing timed questions", async () => {
    const { client } = fakeSupabase((q: FakeQuery) => {
      if (q.table === "tests") {
        return { error: { message: "connection reset by peer" } };
      }
      return { data: [], error: null };
    });

    await expect(loadQuestionAccess(client as never)).rejects.toMatchObject({
      message: "connection reset by peer",
    });
  });

  it("recognizes only template-column schema errors", () => {
    expect(
      isMissingTemplateColumn({ message: "column tests.template does not exist" })
    ).toBe(true);
    expect(isMissingTemplateColumn({ message: "connection reset by peer" })).toBe(false);
    expect(isMissingTemplateColumn(null)).toBe(false);
  });
});

describe("question-access QA filtering", () => {
  const access = {
    hasTemplateColumn: true,
    rows: [
      { id: "t1", title: "Practice", question_ids: ["q1", "q2"], published: true, template: "" },
      { id: "t2", title: "Timed", question_ids: ["q3"], published: true, template: "nimcet-2026" },
      { id: "t3", title: "Blocked practice", question_ids: ["q4"], published: true, template: "" },
    ],
  };

  it("excludes failed/stale questions and blocked tests", () => {
    const qa: QaAccessState = {
      available: true,
      questions: new Map([
        ["q1", { status: "PASS", stale: false }],
        ["q2", { status: "FAILED", stale: false }],
        ["q3", { status: "WARNING", stale: true }],
        ["q4", { status: "PASS", stale: false }],
      ]),
      tests: new Map([
        ["t3", { status: "FAILED", eligible: false, overrideReason: null }],
      ]),
    };

    const out = accessFromTests(access, qa);
    expect(out.practice.has("q1")).toBe(true);
    expect(out.practice.has("q2")).toBe(false);
    expect(out.practice.has("q4")).toBe(false);
    expect(out.timed.has("q3")).toBe(false);
  });

  it("keeps legacy rows readable when QA has no state for them", () => {
    const out = accessFromTests(access, { available: true, questions: new Map(), tests: new Map() });
    expect(out.practice.has("q1")).toBe(true);
    expect(out.practice.has("q2")).toBe(true);
    expect(out.timed.has("q3")).toBe(true);
  });
});
