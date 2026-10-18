// Shared question-row parser used by the question-bank importer AND the
// "create full-length mock from CSV" flow. Dependency-free by design so both
// server routes and the admin UI validate rows with the exact same rules —
// the server stays the source of truth, the client just pre-flights.

export const DIFFS = ["Easy", "Medium", "Hard"];

// NIMCET full-length papers are 120 questions; the from-CSV mock flow
// enforces this on both the client and the server.
export const FULL_LENGTH_QUESTIONS = 120;

export type ParsedRow = {
  exam: string;
  section: string;
  topic: string;
  difficulty: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
  plus: number;
  minus: number;
};

// Optional fallbacks: the bank importer requires `exam` per row and uses the
// generic +4/-1 marks, while the mock flow supplies the test's exam and the
// admin's marking scheme wherever a row leaves those cells blank.
export type RowDefaults = {
  exam?: string;
  plus?: number;
  minus?: number;
};

export function parseRow(
  raw: Record<string, unknown>,
  index: number,
  defaults: RowDefaults = {}
): ParsedRow | string {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const line = `Row ${index + 1}`;

  const exam = s(raw.exam) || (defaults.exam ?? "").trim();
  if (!exam || exam.length > 80) return `${line}: exam is required (max 80 chars).`;
  const stem = s(raw.stem);
  if (!stem || stem.length > 4000) return `${line}: question text is required (max 4000 chars).`;
  const section = s(raw.section).slice(0, 80);
  const topic = s(raw.topic).slice(0, 120);
  const difficulty = DIFFS.includes(s(raw.difficulty)) ? s(raw.difficulty) : "Medium";

  const options = Array.isArray(raw.options) ? raw.options.map((o) => String(o).trim()) : [];
  if ((options.length !== 4 && options.length !== 5) || options.some((o) => !o || o.length > 1000)) {
    return `${line}: 4 or 5 non-empty options (max 1000 chars each) are required.`;
  }

  let answer = -1;
  if (typeof raw.answer === "number") answer = raw.answer;
  else {
    const a = s(raw.answer).toUpperCase();
    answer = ["A", "B", "C", "D", "E"].indexOf(a);
    if (answer < 0 && /^[0-4]$/.test(a)) answer = Number(a);
  }
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return `${line}: answer must match an available option (A–E or its zero-based index).`;
  }

  const plus = raw.plus === undefined || raw.plus === "" ? (defaults.plus ?? 4) : Number(raw.plus);
  if (!Number.isFinite(plus) || plus <= 0 || plus > 1000) return `${line}: plus marks must be 1–1000.`;
  const minus = raw.minus === undefined || raw.minus === "" ? (defaults.minus ?? -1) : Number(raw.minus);
  if (!Number.isFinite(minus) || minus > 0 || minus < -1000) return `${line}: minus marks must be between -1000 and 0.`;

  return {
    exam,
    section,
    topic,
    difficulty,
    stem,
    options,
    answer,
    explanation: s(raw.explanation).slice(0, 4000),
    plus,
    minus,
  };
}
