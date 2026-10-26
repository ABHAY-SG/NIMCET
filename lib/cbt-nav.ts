// Shared question-palette model for every CBT surface (the NIMCET server
// runner, the practice runner, and the pre-exam navigational instructions).
//
// The five states are deliberately distinct:
//   unvisited → white / neutral
//   visited   → muted slate (seen, no answer, no review flag)
//   answered  → green
//   marked    → amber
//   both      → answered green with an amber review edge
//
// "Current" is a separate overlay: the active question always uses a strong
// indigo fill and a focus ring, while small corner markers preserve the
// answered / marked signal. That keeps the current question identifiable even
// when it is answered or marked for review.

import type { CSSProperties } from "react";

export type NavKey = "unvisited" | "visited" | "answered" | "marked" | "both";
export type NavLegendKey = NavKey;

export const NAV_LEGEND: Array<{ key: NavKey; label: string; help: string }> = [
  { key: "unvisited", label: "Not visited", help: "You have not opened this question yet." },
  { key: "visited", label: "Visited · unanswered", help: "Opened, but no option is selected." },
  { key: "answered", label: "Answered", help: "A valid option is selected." },
  { key: "marked", label: "Marked for review", help: "Flagged for a second look; no answer selected." },
  { key: "both", label: "Answered + marked", help: "Answered and also flagged for review." },
];

export const NAV_STATUS_LABEL: Record<NavKey, string> = {
  unvisited: "not visited",
  visited: "visited but unanswered",
  answered: "answered",
  marked: "marked for review",
  both: "answered and marked for review",
};

/** Marked wins over answered; a seen-but-unanswered question is "visited". */
export function navStatus(visited: boolean, answered: boolean, marked: boolean): NavKey {
  if (marked) return answered ? "both" : "marked";
  if (answered) return "answered";
  if (visited) return "visited";
  return "unvisited";
}

// Inline palette used outside the full-screen runner (instructions and the
// practice runner). The runner itself uses the .cbt-qbtn CSS states so it can
// add pseudo-element markers for the current question.
export const PALETTE: Record<NavKey, CSSProperties> = {
  unvisited: { background: "#ffffff", color: "#334155", border: "1px solid #cbd5e1" },
  visited: { background: "#e8eef6", color: "#475569", border: "1px solid #cbd5e1" },
  answered: { background: "#15803d", color: "#ffffff", border: "1px solid #166534" },
  marked: { background: "#b45309", color: "#ffffff", border: "1px solid #92400e" },
  both: {
    background: "linear-gradient(135deg, #15803d 0 68%, #b45309 68% 100%)",
    color: "#ffffff",
    border: "1px solid #b45309",
  },
};

/** Status fill plus a current-question ring that stays visible on every fill. */
export function navCellStyle(status: NavKey, current: boolean): CSSProperties {
  if (current) {
    return {
      background: "#1d4ed8",
      color: "#ffffff",
      border: "1px solid #1e40af",
      boxShadow: "0 0 0 2px #ffffff, 0 0 0 4px #1d4ed8",
    };
  }
  return { ...PALETTE[status] };
}
