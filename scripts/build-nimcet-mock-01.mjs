#!/usr/bin/env node
// Validates the authored NIMCET Mock Test 01 question files and generates the
// two import artifacts:
//   supabase/seed/nimcet-mock-01.sql  — one-paste, idempotent Supabase seed
//   supabase/seed/nimcet-mock-01.csv  — admin-UI import fallback (same rows)
//
// Run from the repo root:  node scripts/build-nimcet-mock-01.mjs
//
// The script fails (non-zero exit) if any structural invariant is broken:
// wrong per-section counts, 4 or 5 unique options per question, answer in range,
// marking that does not match the official section scheme, duplicate stems,
// or a total that is not 120 questions / 1000 max marks.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = join(root, "supabase", "seed", "nimcet-mock-01");

// Official section scheme (source of truth for this paper).
const MARKS = new Map([
  ["Mathematics", { plus: 12, minus: -3, count: 50 }],
  ["Analytical Reasoning", { plus: 6, minus: -1.5, count: 40 }],
  ["Computer Awareness", { plus: 6, minus: -1.5, count: 20 }],
  ["General English", { plus: 4, minus: -1, count: 10 }],
]);
const DIFFS = ["Easy", "Medium", "Hard"];
const FILES = ["math.json", "reasoning.json", "computer-english.json"];

const TITLE = "NIMCET Mock Test 01 — Full Length";
const TAG = "Full-length";
const MINUTES = 120;
const SECTIONS = [
  { label: "Mathematics", minutes: 70, count: 50 },
  { label: "Analytical Ability & Logical Reasoning", minutes: 30, count: 40 },
  { label: "Computer Awareness & General English", minutes: 20, count: 30 },
];
const DESCRIPTION =
  "Full-length MCA entrance practice paper built on the official NIMCET pattern — 120 questions across Mathematics (50), Analytical Ability & Logical Reasoning (40), Computer Awareness (20) and General English (10), with section-wise marking (+12/−3, +6/−1.5, +6/−1.5, +4/−1) and sectional timing (70 + 30 + 20 minutes).";
const INSTRUCTIONS = [
  "Read all instructions carefully before you begin.",
  "",
  "• The paper has 3 timed parts: Mathematics — 50 questions, 70 minutes; Analytical Ability & Logical Reasoning — 40 questions, 30 minutes; Computer Awareness & General English — 30 questions, 20 minutes.",
  "• Each section runs on its own clock. When a section's time ends it is locked and you are moved to the next section automatically.",
  "• Marking: Mathematics +12 / −3 · Analytical Ability & Logical Reasoning +6 / −1.5 · Computer Awareness +6 / −1.5 · General English +4 / −1.",
  "• There is no penalty for unanswered questions.",
  "• Use the palette to navigate within the current section, and mark questions for review to revisit them before the section ends.",
  "• The paper is auto-submitted when the final section ends; you may also submit early from the header.",
  "• Answers are scored on the server. Correct answers and explanations appear on your scorecard only after you submit.",
].join("\n");

const problems = [];
const warnings = [];

// ---------- load ----------
const rows = [];
for (const file of FILES) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(seedDir, file), "utf8"));
  } catch (e) {
    problems.push(`${file}: cannot read/parse — ${e.message}`);
    continue;
  }
  if (!Array.isArray(parsed)) {
    problems.push(`${file}: top level must be an array`);
    continue;
  }
  parsed.forEach((q, i) => rows.push({ ...q, _file: file, _n: i + 1 }));
}

// ---------- validate ----------
const stemsSeen = new Map();
const optionSets = new Map();
const perSection = new Map();
for (const key of MARKS.keys()) perSection.set(key, { count: 0, marks: 0, answers: [0, 0, 0, 0, 0], diffs: { Easy: 0, Medium: 0, Hard: 0 } });

rows.forEach((q, idx) => {
  const where = `${q._file} #${q._n}`;
  const scheme = MARKS.get(q.section);
  if (!scheme) return problems.push(`${where}: unknown section "${q.section}"`);
  if (q.plus !== scheme.plus || q.minus !== scheme.minus) {
    problems.push(`${where}: marking +${q.plus}/${q.minus} does not match the ${q.section} scheme (+${scheme.plus}/${scheme.minus})`);
  }
  if (!DIFFS.includes(q.difficulty)) problems.push(`${where}: difficulty "${q.difficulty}" not in ${DIFFS.join("/")}`);
  const stem = String(q.stem ?? "").trim();
  if (stem.length < 5 || stem.length > 4000) problems.push(`${where}: stem length ${stem.length} out of range`);
  if (!String(q.topic ?? "").trim()) problems.push(`${where}: empty topic`);
  if (!Array.isArray(q.options) || ![4, 5].includes(q.options.length)) {
    problems.push(`${where}: needs 4 or 5 options`);
  } else {
    const opts = q.options.map((o) => String(o ?? "").trim());
    if (opts.some((o) => !o || o.length > 1000)) problems.push(`${where}: empty or overlong option`);
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) problems.push(`${where}: duplicate options inside the question`);
    const key = opts.map((o) => o.toLowerCase()).sort().join("|");
    if (optionSets.has(key)) warnings.push(`${where}: option set identical to ${optionSets.get(key)} — check it is a genuinely different question`);
    else optionSets.set(key, where);
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || !Array.isArray(q.options) || q.answer >= q.options.length) problems.push(`${where}: answer must index an available option, got ${q.answer}`);
  const exp = String(q.explanation ?? "").trim();
  if (exp.length > 4000) problems.push(`${where}: explanation length ${exp.length} out of range`);

  const norm = stem.toLowerCase().replace(/\s+/g, " ").replace(/[“”"']/g, "");
  if (stemsSeen.has(norm)) problems.push(`${where}: stem duplicated with ${stemsSeen.get(norm)}`);
  else stemsSeen.set(norm, where);

  const acc = perSection.get(q.section);
  acc.count += 1;
  acc.marks += scheme.plus;
  acc.answers[q.answer] += 1;
  acc.diffs[q.difficulty] += 1;
  void idx;
});

let totalQuestions = 0;
let totalMarks = 0;
for (const [section, scheme] of MARKS) {
  const acc = perSection.get(section);
  if (acc.count !== scheme.count) problems.push(`section ${section}: ${acc.count} questions, expected ${scheme.count}`);
  totalQuestions += acc.count;
  totalMarks += acc.marks;
}
if (totalQuestions !== 120) problems.push(`total questions ${totalQuestions}, expected 120`);
if (totalMarks !== 1000) problems.push(`total max marks ${totalMarks}, expected 1000`);

if (rows.length !== 120 && problems.length === 0) problems.push(`loaded ${rows.length} rows, expected 120`);

// ---------- report ----------
console.log(`Loaded ${rows.length} questions.`);
for (const [section, acc] of perSection) {
  console.log(
    `  ${section.padEnd(22)} ${String(acc.count).padStart(3)} Q · ${String(acc.marks).padStart(4)} marks · answers A/B/C/D ${acc.answers.join("/")} · difficulty ${JSON.stringify(acc.diffs)}`
  );
}
console.log(`  TOTAL ${totalQuestions} Q · ${totalMarks} max marks`);
warnings.forEach((w) => console.log(`  [warn] ${w}`));
if (problems.length > 0) {
  console.error(`\n${problems.length} validation problem(s):`);
  problems.forEach((p) => console.error(`  ✗ ${p}`));
  process.exit(1);
}
console.log("All structural checks passed.");

// ---------- generate ----------
const sq = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const LETTERS = ["A", "B", "C", "D", "E"];

const valueLines = rows.map((q, i) => {
  const seq = i + 1;
  const opts = `jsonb_build_array(${q.options.map((o) => sq(o)).join(", ")})`;
  return `  (${seq}, ${sq(q.section)}, ${sq(q.topic)}, ${sq(q.difficulty)}, ${sq(q.stem)}, ${opts}, ${q.answer}, ${sq(q.explanation)}, ${q.plus}, ${q.minus})`;
});

const sectionsJson = JSON.stringify(SECTIONS);
const sql = `-- ============================================================================
-- NIMCET Mock Test 01 — Full Length · generated by scripts/build-nimcet-mock-01.mjs
-- DO NOT EDIT BY HAND — edit the JSON files in supabase/seed/nimcet-mock-01/ and
-- regenerate instead.
--
-- HOW TO RUN (one paste):
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- Idempotent and non-destructive: re-running never duplicates questions (rows
-- are matched by exact stem) and never deletes anything. The test row is
-- created on first run and refreshed (same row id, attempt history intact) on
-- later runs, so the linked question_ids always match this file.
--
-- Bundles the additive column from supabase/migrations/0006_test_sections.sql
-- (tests.sections), so no separate migration run is required.
-- ============================================================================

begin;

-- 1. Additive schema: optional timed parts for sectioned mocks.
alter table public.tests
  add column if not exists sections jsonb not null default '[]'::jsonb;

-- 2. Stage the authored paper (ordered by seq).
drop table if exists pg_temp.seed_mock01;
create temporary table seed_mock01 (
  seq         int primary key,
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

insert into seed_mock01 (seq, section, topic, difficulty, stem, options, answer, explanation, plus, minus) values
${valueLines.join(",\n")};

-- 3. Insert only questions that do not exist yet (matched by exact stem).
insert into public.questions (exam, section, topic, difficulty, stem, options, answer, explanation, plus, minus)
select 'nimcet', s.section, s.topic, s.difficulty, s.stem,
       s.options, s.answer, s.explanation, s.plus, s.minus
from seed_mock01 s
where not exists (select 1 from public.questions q where q.stem = s.stem);

-- 4. Create the test if it does not exist, then refresh it on every run.
insert into public.tests (exam, title, tag, minutes, free, published, question_ids, description, instructions, sections)
select 'nimcet', ${sq(TITLE)}, ${sq(TAG)}, ${MINUTES}, true, true,
       (select array_agg(x.id order by s.seq)
          from seed_mock01 s
          join lateral (
            select q.id from public.questions q
            where q.stem = s.stem
            order by q.created_at
            limit 1
          ) x on true),
       ${sq(DESCRIPTION)},
       ${sq(INSTRUCTIONS)},
       ${sq(sectionsJson)}::jsonb
where not exists (select 1 from public.tests where title = ${sq(TITLE)});

update public.tests t set
  question_ids = (select array_agg(x.id order by s.seq)
                    from seed_mock01 s
                    join lateral (
                      select q.id from public.questions q
                      where q.stem = s.stem
                      order by q.created_at
                      limit 1
                    ) x on true),
  sections     = ${sq(sectionsJson)}::jsonb,
  description  = ${sq(DESCRIPTION)},
  instructions = ${sq(INSTRUCTIONS)}
where t.title = ${sq(TITLE)};

-- 5. Verification — the editor shows these result sets.
select s.section,
       count(*)      as questions,
       min(s.plus)   as marks_per_correct,
       min(s.minus)  as marks_per_wrong,
       sum(s.plus)   as max_marks
from seed_mock01 s
group by s.section
order by min(s.seq);

select count(*) as total_questions, sum(s.plus) as total_max_marks from seed_mock01 s;

select t.title, t.published, t.minutes, array_length(t.question_ids, 1) as linked_questions, t.sections
from public.tests t
where t.title = ${sq(TITLE)};

commit;
`;

writeFileSync(join(root, "supabase", "seed", "nimcet-mock-01.sql"), sql, "utf8");

const csvCell = (v) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvHeader = "exam,section,topic,difficulty,stem,options,answer,explanation,plus,minus";
const csvLines = rows.map((q) =>
  ["nimcet", q.section, q.topic, q.difficulty, q.stem, JSON.stringify(q.options), LETTERS[q.answer], q.explanation, q.plus, q.minus]
    .map(csvCell)
    .join(",")
);
writeFileSync(join(root, "supabase", "seed", "nimcet-mock-01.csv"), csvHeader + "\n" + csvLines.join("\n") + "\n", "utf8");

console.log("Wrote supabase/seed/nimcet-mock-01.sql and supabase/seed/nimcet-mock-01.csv");
