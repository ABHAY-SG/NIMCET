/** @jest-environment node */

import {
  activeIndexAt,
  partRemainingMs,
  partWindows,
  partsTotalMs,
  SECTION_GRACE_MS,
} from "@/lib/exam-session";
import { templateParts } from "@/lib/nimcet-full-mock";

const MIN = 60_000;

describe("server-anchored NIMCET timing", () => {
  const parts = templateParts();

  it("uses the official 70 + 30 + 20 minute windows and a 120 minute total", () => {
    expect(partsTotalMs(parts)).toBe(120 * MIN);
    expect(partWindows(parts)).toEqual([
      { startMs: 0, endMs: 70 * MIN },
      { startMs: 70 * MIN, endMs: 100 * MIN },
      { startMs: 100 * MIN, endMs: 120 * MIN },
    ]);
  });

  it("keeps the active part stable at every boundary", () => {
    expect(activeIndexAt(parts, 0)).toBe(0);
    expect(activeIndexAt(parts, 70 * MIN - 1)).toBe(0);
    expect(activeIndexAt(parts, 70 * MIN)).toBe(1);
    expect(activeIndexAt(parts, 100 * MIN - 1)).toBe(1);
    expect(activeIndexAt(parts, 100 * MIN)).toBe(2);
    expect(activeIndexAt(parts, 120 * MIN)).toBe(2);
    expect(activeIndexAt(parts, 999 * MIN)).toBe(2);
  });

  it("computes remaining time from the session start, not from a client timer", () => {
    expect(partRemainingMs(parts, 0, 0)).toBe(70 * MIN);
    expect(partRemainingMs(parts, 35 * MIN, 0)).toBe(35 * MIN);
    expect(partRemainingMs(parts, 70 * MIN, 0)).toBe(0);
    expect(partRemainingMs(parts, 70 * MIN, 1)).toBe(30 * MIN);
    expect(partRemainingMs(parts, 100 * MIN, 2)).toBe(20 * MIN);
    expect(partRemainingMs(parts, 120 * MIN, 2)).toBe(0);
  });

  it("only grants a short write grace, never a reopened window", () => {
    expect(SECTION_GRACE_MS).toBeGreaterThan(0);
    expect(SECTION_GRACE_MS).toBeLessThan(60_000);
    // The active index is still based on the real windows; grace is only used
    // by the answers route to accept a request already in flight.
    expect(activeIndexAt(parts, 70 * MIN + SECTION_GRACE_MS + 1)).toBe(1);
    expect(activeIndexAt(parts, 100 * MIN + SECTION_GRACE_MS + 1)).toBe(2);
  });
});
