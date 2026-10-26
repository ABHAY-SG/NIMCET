// Pure section-access model shared by the CBT runner and its tests. The server
// remains authoritative (the attempt APIs reject future/finished parts); this
// helper only describes that same rule for the interface so the lock icon and
// disabled state can never drift from the enforced sequence.

export type SectionPhase = "completed" | "active" | "locked";

export function sectionPhase(sectionPart: number, activePart: number): SectionPhase {
  if (sectionPart < activePart) return "completed";
  if (sectionPart > activePart) return "locked";
  return "active";
}

export function sectionLockReason(phase: SectionPhase): string {
  if (phase === "completed") return "This part is closed and cannot be reopened.";
  if (phase === "locked") return "This part unlocks when the previous timed part ends.";
  return "";
}
