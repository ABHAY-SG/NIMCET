#!/usr/bin/env node
// Turns an authored mock CSV into a one-paste, idempotent Supabase SQL file —
// the same delivery pattern as scripts/build-nimcet-mock-01.mjs, but for CSVs
// exported in the flat option-column format:
//
//   exam,section,topic,difficulty,stem,optionA..optionE,answer,explanation,plus,minus
//
// Usage (run from the repo root):
//   node scripts/import-mock-csv.mjs "<path to csv>" --test "<exact test title>" [options]
//
// Options:
//   --test   "<title>"   required — the tests row whose question_ids is replaced
//   --out    <file>      output SQL path (default: supabase/seed/<csv-name>.sql)
//   --exam   <exam>      fallback exam when the CSV exam cell is empty (default: nimcet)
//   --sections "<spec>"  optional timed parts, e.g. "Mathematics:70:50,Analytical Ability & Logical Reasoning:30:40,Computer Awareness & General English:20:30"
//                        counts must add up to the number of imported questions
//
// The generated file is non-destructive: questions are inserted only when no
// row with the same stem exists, and the target test's question_ids is rebuilt
// in CSV order. Nothing is ever deleted; run it again any time.

import { readFileSync, writeFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const csvPath = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const testTitle = flag("test");
const examFallback = flag("exam", "nimcet");
const sectionsSpec = flag("sections");

if (!csvPath || !testTitle) {
  console.error('Usage: node scripts/import-mock-csv.mjs "<csv path>" --test "<exact test title>" [--out file] [--sections "Label:minutes:count,..."]');
  process.exit(1);
}

const slug = basename(csvPath).replace(/\.csv$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const outPath = flag("out", join("supabase", "seed", `${slug}.sql`));

// ---------- parse csv (RFC4180: quotes, embedded newlines, "" escapes) ----------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const raw = parseCsv(readFileSync(csvPath, "utf8"));
if (raw.length < 2) {
  console.error("CSV has no data rows.");
  process.exit(1);
}
const header = raw[0].map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
for (const required of ["exam", "section", "topic", "difficulty", "stem", "answer", "explanation", "plus", "minus"]) {
  if (col(required) < 0) {
    console.error(`CSV is missing the "${required}" column. Found: ${header.join(", ")}`);
    process.exit(1);
  }
}
const optionCols = ["optiona", "optionb", "optionc", "optiond", "optione"].map(col).filter((i) => i >= 0);
if (optionCols.length < 4) {
  console.error("CSV needs at least optionA..optionD columns.");
  process.exit(1);
}

// ---------- validate ----------
const DIFFS = ["Easy", "Medium", "Hard"];
const LETTERS = ["A", "B", "C", "D", "E"];
const problems = [];
const warnings = [];
const rows = [];
const stemsSeen = new Map();
const perSection = new Map();

raw.slice(1).forEach((cells, idx) => {
  const n = idx + 2; // 1-based line number in the original mental model (header = 1)
  const where = `row #${n}`;
  const cell = (name) => {
    const i = col(name);
    return i >= 0 ? String(cells[i] ?? "").trim() : "";
  };
  const exam = cell("exam") || examFallback;
  const section = cell("section");
  const topic = cell("topic");
  const difficultyRaw = cell("difficulty");
  const difficulty = DIFFS.find((d) => d.toLowerCase() === difficultyRaw.toLowerCase()) ?? difficultyRaw;
  const stem = cell("stem");
  const options = optionCols.map((i) => String(cells[i] ?? "").trim()).filter((o) => o !== "");
  const answerLetter = cell("answer").toUpperCase();
  const answer = LETTERS.indexOf(answerLetter);
  const explanation = cell("explanation");
  const plus = Number(cell("plus"));
  const minus = Number(cell("minus"));

  if (!exam) problems.push(`${where}: empty exam`);
  if (!section) problems.push(`${where}: empty section`);
  if (!topic) problems.push(`${where}: empty topic`);
  if (!DIFFS.includes(difficulty)) problems.push(`${where}: difficulty "${difficultyRaw}" not in ${DIFFS.join("/")}`);
  if (stem.length < 5 || stem.length > 4000) problems.push(`${where}: stem length ${stem.length} out of range (5–4000)`);
  if (options.length < 4 || options.length > 5) problems.push(`${where}: ${options.length} options — need 4 or 5`);
  if (options.some((o) => o.length > 1000)) problems.push(`${where}: an option is over 1000 characters`);
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) problems.push(`${where}: duplicate options inside the question`);
  const optionCount = optionCols.length;
  if (answer < 0 || answer >= optionCount || answer >= options.length) {
    problems.push(`${where}: answer "${answerLetter}" does not point at a filled option`);
  }
  if (explanation.length > 4000) problems.push(`${where}: explanation length ${explanation.length} out of range (max 4000)`);
  if (!Number.isFinite(plus) || plus <= 0) problems.push(`${where}: plus "${cell("plus")}" must be a positive number`);
  if (!Number.isFinite(minus) || minus > 0) problems.push(`${where}: minus "${cell("minus")}" must be zero or negative`);

  const norm = stem.toLowerCase().replace(/\s+/g, " ").replace(/[“”"']/g, "");
  if (stemsSeen.has(norm)) problems.push(`${where}: stem duplicates row #${stemsSeen.get(norm)}`);
  else stemsSeen.set(norm, n);

  if (!perSection.has(section)) perSection.set(section, { count: 0, marks: new Map(), answers: [0, 0, 0, 0, 0], diffs: { Easy: 0, Medium: 0, Hard: 0 } });
  const acc = perSection.get(section);
  acc.count += 1;
  const markKey = `${plus}/${minus}`;
  acc.marks.set(markKey, (acc.marks.get(markKey) ?? 0) + 1);
  if (answer >= 0) acc.answers[answer] += 1;
  if (DIFFS.includes(difficulty)) acc.diffs[difficulty] += 1;

  rows.push({ exam, section, topic, difficulty, stem, options, answer, explanation, plus, minus });
});

// Contiguous blocks, as the paper will be read top to bottom.
const blocks = [];
rows.forEach((r, i) => {
  const last = blocks[blocks.length - 1];
  if (last && last.section === r.section) last.to = i + 1;
  else blocks.push({ section: r.section, from: i + 1, to: i + 1 });
});
const sectionBlockCount = new Map();
blocks.forEach((b) => sectionBlockCount.set(b.section, (sectionBlockCount.get(b.section) ?? 0) + 1));
for (const [section, n] of sectionBlockCount) {
  if (n > 1) warnings.push(`section "${section}" appears in ${n} separate blocks — fine for a flat paper, but timed parts need contiguous blocks`);
}

// ---------- report ----------
let totalMarks = 0;
console.log(`Loaded ${rows.length} questions from ${csvPath}`);
for (const [section, acc] of perSection) {
  const markKeys = [...acc.marks.keys()];
  if (markKeys.length > 1) warnings.push(`section "${section}" mixes marking schemes: ${markKeys.join(", ")}`);
  const scheme = markKeys.length === 1 ? markKeys[0].split("/") : null;
  totalMarks += scheme ? rows.filter((r) => r.section === section).reduce((a, r) => a + r.plus, 0) : 0;
  console.log(
    `  ${section.padEnd(28)} ${String(acc.count).padStart(3)} Q · marks ${scheme ? `${scheme[0]}/${scheme[1]}` : "mixed"} · answers A-E ${acc.answers.join("/")} · ${JSON.stringify(acc.diffs)}`
  );
}
console.log(`  Paper order: ${blocks.map((b) => `${b.section} #${b.from}-${b.to}`).join(" → ")}`);
console.log(`  TOTAL ${rows.length} Q · ${totalMarks} max marks (plus only)`);
warnings.forEach((w) => console.log(`  [warn] ${w}`));
if (problems.length > 0) {
  console.error(`\n${problems.length} validation problem(s):`);
  problems.forEach((p) => console.error(`  ✗ ${p}`));
  process.exit(1);
}
console.log("All checks passed.");

// ---------- optional timed parts ----------
let sectionsJson = null;
if (sectionsSpec) {
  const parts = sectionsSpec.split(",").map((p) => {
    const m = /^(.*):(\d+):(\d+)$/.exec(p.trim());
    if (!m) {
      console.error(`Bad --sections entry "${p}" — expected "Label:minutes:count".`);
      process.exit(1);
    }
    return { label: m[1].trim(), minutes: Number(m[2]), count: Number(m[3]) };
  });
  const sum = parts.reduce((a, p) => a + p.count, 0);
  if (sum !== rows.length) {
    console.error(`--sections counts add up to ${sum} but the CSV has ${rows.length} questions.`);
    process.exit(1);
  }
  sectionsJson = JSON.stringify(parts);
  console.log(`Timed parts: ${parts.map((p) => `${p.label} (${p.count} Q / ${p.minutes} min)`).join(" + ")}`);
}

// ---------- generate sql ----------
const sq = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const valueLines = rows.map((q, i) => {
  const seq = i + 1;
  const opts = `jsonb_build_array(${q.options.map((o) => sq(o)).join(", ")})`;
  return `  (${seq}, ${sq(q.exam)}, ${sq(q.section)}, ${sq(q.topic)}, ${sq(q.difficulty)}, ${sq(q.stem)}, ${opts}, ${q.answer}, ${sq(q.explanation)}, ${q.plus}, ${q.minus})`;
});

const sql = `-- ============================================================================
-- ${testTitle} · generated from ${basename(csvPath)} by scripts/import-mock-csv.mjs
-- DO NOT EDIT BY HAND — fix the CSV and regenerate instead.
--
-- HOW TO RUN (one paste):
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- Idempotent and non-destructive: re-running never duplicates questions (rows
-- are matched by exact stem), never deletes anything, and simply rebuilds the
-- target test's question list in CSV order. Run the verification selects at
-- the end to see the imported totals.
--
-- Untouched on purpose: the test's minutes, sections, description and
-- published/free flags — only question_ids is rewritten.
-- ============================================================================

begin;

-- 1. Schema safety: tests.sections is additive (see supabase/migrations/0006_test_sections.sql).
alter table public.tests
  add column if not exists sections jsonb not null default '[]'::jsonb;

-- 2. Stage the CSV rows (ordered by seq = CSV order).
drop table if exists pg_temp.seed_import;
create temporary table seed_import (
  seq         int primary key,
  exam        text not null,
  section     text not null,
  topic       text not null,
  difficulty  text not null,
  stem        text not null,
  options     jsonb not null,
  answer      int  not null,
  explanation text not null,
  plus        numeric not null,
  minus       numeric not null
) on commit drop;

insert into seed_import (seq, exam, section, topic, difficulty, stem, options, answer, explanation, plus, minus) values
${valueLines.join(",\n")};

-- 3. Fail loudly when the target test is missing (aborts everything — nothing is written).
do $$
begin
  if not exists (select 1 from public.tests where title = ${sq(testTitle)}) then
    raise exception 'No test titled "%" found. Copy the exact title from Table Editor → tests and regenerate this file with that title — nothing was written.', ${sq(testTitle)};
  end if;
end $$;

-- 4. Insert only questions that do not exist yet (matched by exact stem).
insert into public.questions (exam, section, topic, difficulty, stem, options, answer, explanation, plus, minus)
select s.exam, s.section, s.topic, s.difficulty, s.stem, s.options, s.answer, s.explanation, s.plus, s.minus
from seed_import s
where not exists (select 1 from public.questions q where q.stem = s.stem);

-- 5. Rebuild the target test's question list in CSV order (same row id, so
--    attempt history stays intact).${sectionsJson ? "\n--    Also sets the timed parts." : ""}
update public.tests t set
  question_ids = (select array_agg(x.id order by s.seq)
                    from seed_import s
                    join lateral (
                      select q.id from public.questions q
                      where q.stem = s.stem
                      order by q.created_at
                      limit 1
                    ) x on true)${sectionsJson ? `,\n  sections = ${sq(sectionsJson)}::jsonb` : ""}
where t.title = ${sq(testTitle)};

-- 6. Verification — these result sets show what the run did.
select s.section,
       count(*)      as questions,
       min(s.plus)   as marks_per_correct,
       min(s.minus)  as marks_per_wrong,
       sum(s.plus)   as max_marks
from seed_import s
group by s.section
order by min(s.seq);

select count(*) as staged_questions, sum(s.plus) as staged_max_marks from seed_import s;

select t.id, t.title, t.published, t.minutes,
       array_length(t.question_ids, 1) as linked_questions,
       t.sections
from public.tests t
where t.title = ${sq(testTitle)};

commit;
`;

writeFileSync(join(root, outPath), sql, "utf8");
console.log(`Wrote ${outPath}`);
