// NIMCET 2026 full-mock template — the single source of truth for the official
// paper structure, used by the admin validation APIs, the CSV import flow and
// the server-enforced exam session routes.
//
// Official structure (NIMCET 2026):
//   Part I   Mathematics                     50 Q · 70 min · +12 / −3
//   Part II  Analytical Ability & Reasoning  40 Q · 30 min · +6  / −1.5
//   Part III Computer Awareness & English    30 Q · 20 min · +6  / −1.5 (20 Q)
//                                                         · +4  / −1  (10 Q)
//   Total    120 Q · 120 min · 1000 marks.
//
// Sections in the question bank are free text (the seed uses lowercase keys
// like "maths"), so every lookup goes through subjectForSection(), which is
// deliberately strict: an unknown section is a validation error, never a guess.

import type { ExamPart } from "./exam-parts";

export const FULL_MOCK_TEMPLATE = "nimcet-2026";
export const FULL_MOCK_TITLE = "NIMCET 2026 Full Mock";
export const FULL_MOCK_QUESTIONS = 120;
export const FULL_MOCK_MINUTES = 120;
export const FULL_MOCK_MAX_MARKS = 1000; // 50×12 + 40×6 + 20×6 + 10×4

export type SubjectKey = "maths" | "reasoning" | "computer" | "english";

export type SubjectRule = {
  key: SubjectKey;
  /** Full display label ("Mathematics"). */
  label: string;
  /** Compact label for chips and counters ("Maths"). */
  short: string;
  /** Required question count in a full mock. */
  count: number;
  /** Marks added per correct answer (official rules). */
  plus: number;
  /** Marks added (negative) per wrong answer (official rules). */
  minus: number;
  /** Index into FULL_MOCK_PARTS — which timed part this subject sits in. */
  part: number;
};

export const SUBJECTS: SubjectRule[] = [
  { key: "maths", label: "Mathematics", short: "Maths", count: 50, plus: 12, minus: -3, part: 0 },
  { key: "reasoning", label: "Analytical Ability & Logical Reasoning", short: "Reasoning", count: 40, plus: 6, minus: -1.5, part: 1 },
  { key: "computer", label: "Computer Awareness", short: "Computer", count: 20, plus: 6, minus: -1.5, part: 2 },
  { key: "english", label: "General English", short: "English", count: 10, plus: 4, minus: -1, part: 2 },
];

/** The three official timed parts of the paper, in exam order. */
export function templateParts(): ExamPart[] {
  return [
    { label: "Part I — Mathematics", minutes: 70, count: 50 },
    { label: "Part II — Analytical Ability & Logical Reasoning", minutes: 30, count: 40 },
    { label: "Part III — Computer Awareness & General English", minutes: 20, count: 30 },
  ];
}

/** Short marking note shown for a part when it holds mixed subjects (Part III). */
export function partNote(index: number): string {
  if (index !== 2) return "";
  return "Computer +6 / −1.5 · English +4 / −1";
}

export function subjectByKey(key: SubjectKey): SubjectRule {
  return SUBJECTS.find((s) => s.key === key) as SubjectRule;
}

export function isFullMockTemplate(v: unknown): boolean {
  return typeof v === "string" && v.trim() === FULL_MOCK_TEMPLATE;
}

export function isFullMockTest(t: { template?: unknown } | null | undefined): boolean {
  return !!t && isFullMockTemplate(t.template);
}

// ---------------------------------------------------------------------------
// Section → subject matching

const ALIASES: Record<SubjectKey, string[]> = {
  maths: ["maths", "math", "mathematics", "quant", "quantitative", "quantitative aptitude", "algebra", "calculus", "trigonometry"],
  reasoning: [
    "reasoning",
    "logical reasoning",
    "analytical ability",
    "analytical reasoning",
    "analytical",
    "logic",
    "general reasoning",
    "reasoning ability",
  ],
  computer: ["computer", "computers", "computer awareness", "computer science", "computer knowledge", "it awareness", "cs"],
  english: ["english", "general english", "verbal", "verbal ability", "english language", "eng"],
};

/** Lowercase, punctuation-free, whitespace-collapsed form of a section name. */
export function normSection(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Exact alias hit, or the alias as a leading/trailing word group
// ("maths part i" matches "maths"; "grammar" never matches "ar").
function matchesAlias(norm: string, alias: string): boolean {
  if (norm === alias) return true;
  return norm.startsWith(`${alias} `) || norm.endsWith(` ${alias}`) || norm.includes(` ${alias} `);
}

export function subjectForSection(section: unknown): SubjectRule | null {
  const n = normSection(section);
  if (!n) return null;
  for (const s of SUBJECTS) {
    for (const alias of ALIASES[s.key]) {
      if (matchesAlias(n, alias)) return s;
    }
  }
  return null;
}

/** Canonical position of a question's subject in the paper (unmapped last). */
export function subjectRank(section: unknown): number {
  const s = subjectForSection(section);
  return s ? SUBJECTS.indexOf(s) : SUBJECTS.length;
}

/** Stable-partitions rows into the official subject order (Maths → English). */
export function orderBySubject<T extends { section: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => subjectRank(a.section) - subjectRank(b.section));
}

// ---------------------------------------------------------------------------
// Composition validation (admin publish gate + CSV import pre-flight)

export type CompositionRow = {
  id: string;
  section: unknown;
  options: unknown;
  answer: unknown;
  plus: unknown;
  minus: unknown;
};

export type CompositionOutcome = {
  ok: boolean;
  counts: Record<SubjectKey, number>;
  total: number;
  /** Human-readable problems, most structural first. */
  issues: string[];
  /** Ids of questions with per-question problems (marks/options/answer/section). */
  badIds: string[];
};

function marksEqual(a: unknown, b: number): boolean {
  const n = Number(a);
  return Number.isFinite(n) && Math.abs(n - b) < 1e-9;
}

// Every NIMCET full mock must pass this. It is enforced on the server for
// every publish (including bulk publish) and mirrored in the admin UI so the
// administrator sees the exact same verdict before saving.
export function checkFullMockComposition(rows: CompositionRow[]): CompositionOutcome {
  const counts: Record<SubjectKey, number> = { maths: 0, reasoning: 0, computer: 0, english: 0 };
  const issues: string[] = [];
  const badIds: string[] = [];

  if (rows.length !== FULL_MOCK_QUESTIONS) {
    issues.push(`The paper needs exactly ${FULL_MOCK_QUESTIONS} questions — ${rows.length} selected.`);
  }

  for (const r of rows) {
    const subject = subjectForSection(r.section);
    const where = r.id ? r.id.slice(0, 8) : "?";
    if (!subject) {
      issues.push(`Question ${where}: section “${String(r.section ?? "").trim() || "—"}” is not one of the four NIMCET subjects.`);
      badIds.push(r.id);
      continue;
    }
    counts[subject.key] += 1;

    let bad = false;
    const options = Array.isArray(r.options) ? r.options : [];
    if (
      (options.length !== 4 && options.length !== 5) ||
      options.some((o) => typeof o !== "string" || !String(o).trim())
    ) {
      issues.push(`Question ${where} (${subject.short}): needs 4 or 5 non-empty options.`);
      bad = true;
    }
    const answer = Number(r.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      issues.push(`Question ${where} (${subject.short}): the correct answer is missing or invalid.`);
      bad = true;
    }
    if (!marksEqual(r.plus, subject.plus) || !marksEqual(r.minus, subject.minus)) {
      issues.push(
        `Question ${where} (${subject.short}): marks must be +${subject.plus} / ${subject.minus}, found +${String(r.plus)} / ${String(r.minus)}.`
      );
      bad = true;
    }
    if (bad) badIds.push(r.id);
  }

  for (const s of SUBJECTS) {
    if (counts[s.key] !== s.count) {
      issues.push(`${s.label}: ${counts[s.key]} selected — exactly ${s.count} required.`);
    }
  }

  // The exam runner serves Part I = the first 50 questions, Part II = the next
  // 40 and Part III = the last 30 (computer 20 + english 10), so the paper
  // must keep each subject in one contiguous block, in the official order.
  let lastRank = 0;
  let orderOk = true;
  for (const r of rows) {
    const rank = subjectRank(r.section);
    if (rank < lastRank) {
      orderOk = false;
      break;
    }
    lastRank = rank;
  }
  if (!orderOk) {
    issues.unshift(
      "Questions must be grouped by subject in the official order — Mathematics → Analytical Ability & Logical Reasoning → Computer Awareness → English."
    );
  }

  return { ok: issues.length === 0, counts, total: rows.length, issues, badIds };
}
