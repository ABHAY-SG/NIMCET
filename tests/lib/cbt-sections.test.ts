import { sectionLockReason, sectionPhase } from "@/lib/cbt-sections";
import { templateSections } from "@/lib/nimcet-full-mock";

describe("CBT section access model", () => {
  it("marks earlier parts completed, the active part active and future parts locked", () => {
    expect(sectionPhase(0, 0)).toBe("active");
    expect(sectionPhase(1, 0)).toBe("locked");
    expect(sectionPhase(2, 0)).toBe("locked");

    expect(sectionPhase(0, 1)).toBe("completed");
    expect(sectionPhase(1, 1)).toBe("active");
    expect(sectionPhase(2, 1)).toBe("locked");

    expect(sectionPhase(0, 2)).toBe("completed");
    expect(sectionPhase(1, 2)).toBe("completed");
    expect(sectionPhase(2, 2)).toBe("active");
  });

  it("gives a lock reason only for parts that are not open", () => {
    expect(sectionLockReason("active")).toBe("");
    expect(sectionLockReason("locked")).toMatch(/unlocks/i);
    expect(sectionLockReason("completed")).toMatch(/cannot be reopened/i);
  });

  it("keeps both Part III subjects open together while locking Mathematics and Reasoning", () => {
    const phases = templateSections().map((s) => sectionPhase(s.part, 2));
    expect(phases).toEqual(["completed", "completed", "active", "active"]);
  });

  it("opens only Mathematics in Part I and only Reasoning in Part II", () => {
    expect(templateSections().map((s) => sectionPhase(s.part, 0))).toEqual([
      "active",
      "locked",
      "locked",
      "locked",
    ]);
    expect(templateSections().map((s) => sectionPhase(s.part, 1))).toEqual([
      "completed",
      "active",
      "locked",
      "locked",
    ]);
  });
});
