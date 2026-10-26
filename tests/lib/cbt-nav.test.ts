import {
  NAV_LEGEND,
  NAV_STATUS_LABEL,
  PALETTE,
  navCellStyle,
  navStatus,
  type NavKey,
} from "@/lib/cbt-nav";

const KEYS: NavKey[] = ["unvisited", "visited", "answered", "marked", "both"];

describe("CBT navigator states", () => {
  it("exposes all five states with human-readable labels and help text", () => {
    expect(NAV_LEGEND.map((item) => item.key)).toEqual(KEYS);
    expect(NAV_LEGEND.map((item) => item.label)).toEqual([
      "Not visited",
      "Visited · unanswered",
      "Answered",
      "Marked for review",
      "Answered + marked",
    ]);
    for (const item of NAV_LEGEND) {
      expect(item.help.trim().length).toBeGreaterThan(0);
      expect(NAV_STATUS_LABEL[item.key].trim().length).toBeGreaterThan(0);
    }
  });

  it("classifies visited-unanswered separately from not visited", () => {
    expect(navStatus(false, false, false)).toBe("unvisited");
    expect(navStatus(true, false, false)).toBe("visited");
  });

  it("gives marked-for-review precedence, then answered, then visited", () => {
    expect(navStatus(false, true, false)).toBe("answered");
    expect(navStatus(false, false, true)).toBe("marked");
    expect(navStatus(false, true, true)).toBe("both");
    expect(navStatus(true, true, true)).toBe("both");
  });

  it("has a fixed fill for every state and a current ring that survives any state", () => {
    for (const key of KEYS) {
      expect(PALETTE[key].background).toBeTruthy();
      expect(PALETTE[key].color).toBeTruthy();
      expect(PALETTE[key].border).toBeTruthy();
    }

    const current = navCellStyle("answered", true);
    expect(current.background).toBe("#1d4ed8");
    expect(String(current.boxShadow)).toContain("#1d4ed8");
    expect(String(current.boxShadow)).toContain("#ffffff");

    const notCurrent = navCellStyle("answered", false);
    expect(notCurrent.background).toBe("#15803d");
  });

  it("keeps the answered+marked state visually distinct from either alone", () => {
    expect(PALETTE.both.background).not.toBe(PALETTE.answered.background);
    expect(PALETTE.both.background).not.toBe(PALETTE.marked.background);
  });
});
