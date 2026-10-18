// Client-side pre-flight for the "create full-length mock from CSV" flow.
// Turns a CSV file into either a clear, complete list of errors (all bad rows
// at once) or 120 parsed rows ready for POST /api/admin/tests/from-csv. The
// server re-validates every row with the same parser (lib/question-rows), so
// nothing here is the source of truth — it only makes failures readable
// before anything is uploaded.

import { parseCsv } from "./csv";
import { FULL_LENGTH_QUESTIONS, parseRow, type ParsedRow } from "./question-rows";

export type SectionSummary = {
  label: string;
  count: number;
  plus: number;
  minus: number;
  marks: number;
};

export type MockCsvOutcome = {
  errors: string[];
  rows: ParsedRow[] | null;
  sections: SectionSummary[];
  maxMarks: number;
};

export type MockSchemeDefaults = {
  exam: string;
  plus: number;
  minus: number;
};

function normStem(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// "NIMCET_Mock_05_Questions.csv" -> "NIMCET Mock 05 Questions" (the admin can
// edit it per file before creating).
export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]*$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

const REQUIRED = ["stem", "optiona", "optionb", "optionc", "optiond", "answer"];

export function parseMockCsv(text: string, defaults: MockSchemeDefaults): MockCsvOutcome {
  const raw = parseCsv(text);
  const fail = (message: string): MockCsvOutcome => ({ errors: [message], rows: null, sections: [], maxMarks: 0 });
  if (raw.length < 2) return fail("The file has no data rows.");

  const header = raw[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const missing = REQUIRED.filter((c) => idx(c) < 0);
  if (missing.length > 0) {
    return fail(
      `Missing column${missing.length > 1 ? "s" : ""}: ${missing.map((c) => `“${c}”`).join(", ")}. ` +
        "Export a CSV from the Question Bank to see the exact format."
    );
  }

  const cells = raw.slice(1);
  if (cells.length !== FULL_LENGTH_QUESTIONS) {
    return fail(
      `A full-length mock needs exactly ${FULL_LENGTH_QUESTIONS} questions — this file has ${cells.length}.`
    );
  }

  const cell = (r: string[], name: string) => {
    const i = idx(name);
    return i < 0 ? "" : (r[i] ?? "");
  };

  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  const seen = new Map<string, number>();
  cells.forEach((r, i) => {
    const optE = cell(r, "optione").trim();
    const plusRaw = cell(r, "plus").trim();
    const minusRaw = cell(r, "minus").trim();
    const out = parseRow(
      {
        exam: cell(r, "exam").trim(),
        section: cell(r, "section"),
        topic: cell(r, "topic"),
        difficulty: cell(r, "difficulty"),
        stem: cell(r, "stem"),
        options: [
          cell(r, "optiona"),
          cell(r, "optionb"),
          cell(r, "optionc"),
          cell(r, "optiond"),
          ...(optE ? [optE] : []),
        ],
        answer: cell(r, "answer").trim(),
        explanation: cell(r, "explanation"),
        plus: plusRaw === "" ? undefined : plusRaw,
        minus: minusRaw === "" ? undefined : minusRaw,
      },
      i,
      defaults
    );
    if (typeof out === "string") {
      errors.push(out);
      return;
    }
    const key = normStem(out.stem);
    const prev = seen.get(key);
    if (prev !== undefined) {
      errors.push(`Row ${i + 1}: duplicate question text (same as row ${prev + 1}) — every question must be unique.`);
      return;
    }
    seen.set(key, i);
    rows.push(out);
  });

  if (errors.length > 0) return { errors, rows: null, sections: [], maxMarks: 0 };

  // Section + marks breakdown in order of first appearance — the same shape
  // the student instructions screen shows before the test starts.
  const sections: SectionSummary[] = [];
  const at = new Map<string, number>();
  let maxMarks = 0;
  for (const r of rows) {
    maxMarks += r.plus;
    const label = (r.section || "General").trim();
    const i = at.get(label);
    if (i === undefined) {
      at.set(label, sections.length);
      sections.push({ label, count: 1, plus: r.plus, minus: r.minus, marks: r.plus });
    } else {
      const g = sections[i];
      g.count += 1;
      g.marks += r.plus;
    }
  }
  return { errors: [], rows, sections, maxMarks };
}
