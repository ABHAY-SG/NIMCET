// Client-side view of the student question bank, shared by the mock hub
// (published tests) and the Test Builder (custom mocks). Both flows read rows
// from /api/student/questions and turn them into playable questions, so the
// row shape and the conversions live here once instead of drifting apart.

export type BankRow = {
  id: string;
  exam: string;
  section: string;
  difficulty: string;
  stem: string;
  options: string[];
  /** Optional figure bundled with the question (empty when text-only). */
  image_url?: string;
  plus: number;
  minus: number;
};

export type SectionGroup = { label: string; count: number; marks: number; plus: number; minus: number };

// Structurally matches MockQuestion in components/mockdemo; kept structural so
// this module never needs to import from the components layer.
export type MockQuestionRow = {
  qid: string;
  tag: string;
  stem: string;
  opts: string[];
  image?: string;
  plus: number;
  minus: number;
  section: string;
};

export function toMock(q: BankRow): MockQuestionRow {
  return {
    qid: q.id,
    tag: `${q.section.toUpperCase()} • +${q.plus} / ${q.minus}`,
    stem: q.stem,
    opts: q.options,
    image: q.image_url?.trim() || undefined,
    plus: q.plus,
    minus: q.minus,
    section: q.section,
  };
}

// Groups a test's questions into ordered section buckets. Returns null while
// any referenced question is unresolved, so partial data is never shown as a
// complete breakdown.
export function groupRows(ids: string[], byId: Map<string, BankRow>): SectionGroup[] | null {
  const groups: SectionGroup[] = [];
  const index = new Map<string, number>();
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) return null;
    const label = (q.section || "General").trim();
    const at = index.get(label);
    let g = at === undefined ? undefined : groups[at];
    if (!g) {
      g = { label, count: 0, marks: 0, plus: Number(q.plus) || 0, minus: Number(q.minus) || 0 };
      index.set(label, groups.length);
      groups.push(g);
    }
    g.count += 1;
    g.marks += Number(q.plus) || 0;
  }
  return groups;
}
