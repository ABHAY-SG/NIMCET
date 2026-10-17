// Assertion checks for lib/exam-parts.ts — run: node scripts/check-exam-parts.mjs
// (.mjs so `tsc --noEmit` ignores this dev-only script; Node imports the .ts
// module directly via type stripping.)
import {
  activePartAt,
  parseParts,
  partDeadline,
  partRanges,
  totalMs,
} from "../lib/exam-parts.ts";

let checks = 0;
function eq(actual, expected, label) {
  checks += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`✗ ${label}\n   expected ${e}\n   actual   ${a}`);
    process.exit(1);
  }
}

const VALID = [
  { label: "Mathematics", minutes: 70, count: 50 },
  { label: "Analytical Ability & Logical Reasoning", minutes: 30, count: 40 },
  { label: "Computer Awareness & General English", minutes: 20, count: 30 },
];
const M = 60_000;

// parseParts — happy path
eq(parseParts(VALID, 120), VALID, "valid spec parses");
eq(
  parseParts([{ label: "A", minutes: 10, count: 3 }, { label: "B", minutes: 5, count: 2 }], 5),
  [{ label: "A", minutes: 10, count: 3 }, { label: "B", minutes: 5, count: 2 }],
  "two parts parse"
);

// parseParts — every malformed shape must degrade to null (continuous timer)
eq(parseParts(undefined, 120), null, "undefined → null");
eq(parseParts(null, 120), null, "null → null");
eq(parseParts([], 120), null, "empty array → null");
eq(parseParts([VALID[0]], 50), null, "single part → null");
eq(parseParts(VALID, 119), null, "count mismatch → null");
eq(parseParts([{ label: "A", minutes: 70, count: 49 }, { label: "B", minutes: 30, count: 40 }], 90), null, "count sum ≠ total → null");
eq(parseParts([{ label: "A", minutes: 70, count: 49 }, { label: "B", minutes: 30, count: 40 }], 89), [{ label: "A", minutes: 70, count: 49 }, { label: "B", minutes: 30, count: 40 }], "count sum = total → parses");
eq(parseParts([{ label: "", minutes: 10, count: 1 }, { label: "B", minutes: 5, count: 1 }], 2), null, "empty label → null");
eq(parseParts([{ label: "A", minutes: -5, count: 1 }, { label: "B", minutes: 5, count: 1 }], 2), null, "negative minutes → null");
eq(parseParts([{ label: "A", minutes: "x", count: 1 }, { label: "B", minutes: 5, count: 1 }], 2), null, "NaN minutes → null");
eq(parseParts([{ label: "A", minutes: 5, count: 1.5 }, { label: "B", minutes: 5, count: 0.5 }], 2), null, "fractional count → null");
eq(parseParts([{ label: "A", minutes: 700, count: 1 }, { label: "B", minutes: 5, count: 1 }], 2), null, "absurd minutes → null");

// ranges
eq(partRanges(VALID), [{ start: 0, end: 50 }, { start: 50, end: 90 }, { start: 90, end: 120 }], "ranges");

// total
eq(totalMs(VALID), 120 * M, "total ms");

// active part over time
eq(activePartAt(VALID, 0), 0, "t=0 → part 0");
eq(activePartAt(VALID, 69 * M + 59_000), 0, "69:59 → part 0");
eq(activePartAt(VALID, 70 * M), 1, "70:00 → part 1 (section 0 expired)");
eq(activePartAt(VALID, 99 * M + 59_000), 1, "99:59 → part 1");
eq(activePartAt(VALID, 100 * M), 2, "100:00 → part 2");
eq(activePartAt(VALID, 999 * M), 2, "past the end clamps to last part");

// deadlines
const start = 1_700_000_000_000;
eq(partDeadline(VALID, start, 0), start + 70 * M, "part 0 deadline");
eq(partDeadline(VALID, start, 1), start + 100 * M, "part 1 deadline");
eq(partDeadline(VALID, start, 2), start + 120 * M, "part 2 deadline");

// a realistic walk: remaining time of the active part is never negative mid-run
for (const t of [0, 35 * M, 70 * M, 85 * M, 100 * M, 110 * M, 119 * M]) {
  const ap = activePartAt(VALID, t);
  const remaining = partDeadline(VALID, start, ap) - (start + t);
  if (remaining < 0) {
    console.error(`✗ negative remaining at t=${t}`);
    process.exit(1);
  }
  checks += 1;
}

console.log(`check-exam-parts: all ${checks} assertions passed.`);
