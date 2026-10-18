// Client-side pre-flight for the "create full-length mock from CSV" flow.
// Turns a CSV file into either a clear, complete list of errors (all bad rows
// at once) or 120 parsed rows ready for POST /api/admin/tests/from-csv. The
// server re-validates every row with the same parser (lib/question-rows), so
// nothing here is the source of truth — it only makes failures readable
// before anything is uploaded.
//
// Template mode ("nimcet-2026") additionally enforces the official paper:
// section → subject mapping, 50/40/20/10 counts, per-subject marks and
// exactly 4 options per question — the same verdict the server will return.

import { parseCsv } from "./csv";
import { FULL_LENGTH_QUESTIONS, parseRow, type ParsedRow } from "./question-rows";
import { subjectForSection, SUBJECTS, type SubjectKey } from "./nimcet-full-mock";

export type SectionSummary = {
  label: string;
  count: number;
  plus: number;
  minus: number;
  marks: number;
};

export type SubjectSummary = {
  key: SubjectKey;
  label: string;
  required: number;
  found: number;
  plus: number;
  minus: number;
};

export type MockCsvOutcome = {
  errors: string[];
  rows: ParsedRow[] | null;
  sections: SectionSummary[];
  maxMarks: number;
  /** Template mode only — required vs found per subject ([] for custom files). */
  subjects: SubjectSummary[];
};

export type MockSchemeDefaults = {
  exam: string;
  plus: number;
  minus: number;
};

export type MockTemplate = "" | "nimcet-2026";

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

export function parseMockCsv(
  text: string,
  defaults: MockSchemeDefaults,
  template: MockTemplate = ""
): MockCsvOutcome {
  const fail = (message: string): MockCsvOutcome => ({ errors: [message], rows: null, sections: [], maxMarks: 0, subjects: [] });

  const raw = parseCsv(text);
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
  const found = new Map<SubjectKey, number>();
  cells.forEach((r, i) => {
    const optE = cell(r, "optione").trim();
    const plusRaw = cell(r, "plus").trim();
    const minusRaw = cell(r, "minus").trim();
    const section = cell(r, "section");
    const subject = template ? subjectForSection(section) : null;
    if (template && !subject) {
      errors.push(
        `Row ${i + 1}: section “${section.trim() || "—"}” doesn't map to a NIMCET subject (${SUBJECTS.map((s) => s.label).join(" / ")}).`
      );
      return;
    }
    const out = parseRow(
      {
        exam: cell(r, "exam").trim(),
        section,
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
      subject ? { exam: defaults.exam, plus: subject.plus, minus: subject.minus } : defaults
    );
    if (typeof out === "string") {
      errors.push(out);
      return;
    }
    if (subject && out.options.length !== 4) {
      errors.push(`Row ${i + 1}: exactly 4 options are required for a NIMCET full mock.`);
      return;
    }
    if (subject && (Math.abs(out.plus - subject.plus) > 1e-9 || Math.abs(out.minus - subject.minus) > 1e-9)) {
      errors.push(
        `Row ${i + 1} (${subject.short}): marks must be +${subject.plus} / ${subject.minus} per the NIMCET 2026 rules — found +${out.plus} / ${out.minus}.`
      );
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
    if (subject) found.set(subject.key, (found.get(subject.key) ?? 0) + 1);
  });

  if (errors.length > 0) return { errors, rows: null, sections: [], maxMarks: 0, subjects: [] };

  // Template mode: the official composition check + subject counters.
  if (template) {
    for (const s of SUBJECTS) {
      const n = found.get(s.key) ?? 0;
      if (n !== s.count) {
        errors.push(`${s.label}: ${n} question(s) found — exactly ${s.count} required.`);
      }
    }
    if (errors.length > 0) return { errors, rows: null, sections: [], maxMarks: 0, subjects: [] };
    const subjects: SubjectSummary[] = SUBJECTS.map((s) => ({
      key: s.key,
      label: s.label,
      required: s.count,
      found: found.get(s.key) ?? 0,
      plus: s.plus,
      minus: s.minus,
    }));
    const sections: SectionSummary[] = subjects.map((s) => ({
      label: s.label,
      count: s.found,
      plus: s.plus,
      minus: s.minus,
      marks: s.found * s.plus,
    }));
    const maxMarks = sections.reduce((sum, s) => sum + s.marks, 0);
    return { errors: [], rows, sections, maxMarks, subjects };
  }

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
  return { errors: [], rows, sections, maxMarks, subjects: [] };
}
