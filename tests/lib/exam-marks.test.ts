/** @jest-environment jsdom */

import {
  clearExamMarks,
  examMarksKey,
  marksForQuestions,
  readExamMarks,
  writeExamMarks,
} from "@/lib/exam-marks";

describe("exam mark persistence", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips marks for one session", () => {
    writeExamMarks("s1", { q1: true, q2: true });
    expect(readExamMarks("s1")).toEqual({ q1: true, q2: true });
  });

  it("isolates sessions so one attempt never sees another's marks", () => {
    writeExamMarks("s1", { q1: true });
    writeExamMarks("s2", { q2: true });
    expect(readExamMarks("s1")).toEqual({ q1: true });
    expect(readExamMarks("s2")).toEqual({ q2: true });
    clearExamMarks("s1");
    expect(readExamMarks("s1")).toEqual({});
    expect(readExamMarks("s2")).toEqual({ q2: true });
  });

  it("removes the key when the last mark is cleared", () => {
    writeExamMarks("s1", { q1: true });
    expect(window.sessionStorage.getItem(examMarksKey("s1"))).not.toBeNull();
    writeExamMarks("s1", {});
    expect(window.sessionStorage.getItem(examMarksKey("s1"))).toBeNull();
  });

  it("ignores malformed or non-true stored values", () => {
    window.sessionStorage.setItem(examMarksKey("s1"), "{not json");
    expect(readExamMarks("s1")).toEqual({});
    window.sessionStorage.setItem(
      examMarksKey("s2"),
      JSON.stringify({ q1: true, q2: false, q3: "yes", q4: 1 })
    );
    expect(readExamMarks("s2")).toEqual({ q1: true });
  });

  it("returns only marks belonging to the questions on screen", () => {
    writeExamMarks("s1", { q1: true, q2: true, q3: true });
    expect(marksForQuestions("s1", ["q2", "q3", "q4"])).toEqual({ q2: true, q3: true });
  });

  it("never throws when storage is unavailable", () => {
    const original = window.sessionStorage;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(() => writeExamMarks("s1", { q1: true })).not.toThrow();
      expect(readExamMarks("s1")).toEqual({});
      expect(() => clearExamMarks("s1")).not.toThrow();
    } finally {
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        value: original,
      });
    }
  });
});
