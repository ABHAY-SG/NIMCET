/** @jest-environment node */

import {
  SUBJECTS,
  sectionByKey,
  sectionsForPart,
  templateParts,
  templateSections,
} from "@/lib/nimcet-full-mock";

describe("NIMCET 2026 official section model", () => {
  it("keeps the four subject sections in official order and counts", () => {
    const sections = templateSections();
    expect(sections.map((s) => s.key)).toEqual(["maths", "reasoning", "computer", "english"]);
    expect(sections.map((s) => s.count)).toEqual([50, 40, 20, 10]);
    expect(sections.reduce((sum, s) => sum + s.count, 0)).toBe(120);
    expect(SUBJECTS.map((s) => s.count)).toEqual([50, 40, 20, 10]);
  });

  it("maps the four subjects onto the three official timed parts", () => {
    const parts = templateParts();
    const sections = templateSections();

    expect(parts.map((p) => p.minutes)).toEqual([70, 30, 20]);
    expect(parts.reduce((sum, p) => sum + p.count, 0)).toBe(120);
    expect(sections.map((s) => s.part)).toEqual([0, 1, 2, 2]);
    expect(sections.map((s) => s.minutes)).toEqual([70, 30, 20, 20]);
    expect(sections.map((s) => s.shared)).toEqual([false, false, true, true]);
  });

  it("uses contiguous paper-wide ranges that restart numbering inside each section", () => {
    const sections = templateSections();
    expect(sections.map((s) => [s.start, s.end])).toEqual([
      [0, 50],
      [50, 90],
      [90, 110],
      [110, 120],
    ]);

    for (let i = 1; i < sections.length; i += 1) {
      expect(sections[i].start).toBe(sections[i - 1].end);
    }
  });

  it("exposes both Part III subjects inside the shared 20-minute window", () => {
    expect(sectionsForPart(2).map((s) => s.key)).toEqual(["computer", "english"]);
    expect(sectionsForPart(0).map((s) => s.key)).toEqual(["maths"]);
    expect(sectionsForPart(1).map((s) => s.key)).toEqual(["reasoning"]);
  });

  it("looks sections up by stable key, case-insensitively", () => {
    expect(sectionByKey("maths")?.label).toBe("Mathematics");
    expect(sectionByKey("ENGLISH")?.key).toBe("english");
    expect(sectionByKey("computer")?.part).toBe(2);
    expect(sectionByKey("nope")).toBeNull();
    expect(sectionByKey(null)).toBeNull();
  });
});
