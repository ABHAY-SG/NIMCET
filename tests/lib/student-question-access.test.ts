/** @jest-environment node */

import {
  isMissingTemplateColumn,
  loadQuestionAccess,
} from "@/lib/student-question-access";
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
