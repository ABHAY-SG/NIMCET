#!/usr/bin/env node
// Imports the extracted "NIMCET 2026 PAPER" export into the NimCuet schema and
// generates a one-paste, idempotent Supabase seed.
//
// Source: the raw exam export (a JSON object with Success.detail.sections[]).
// Output:
//   supabase/seed/nimcet-2026-paper/questions.json — normalised, reviewable rows
//   supabase/seed/nimcet-2026-paper.sql            — production seed (SQL Editor)
//
// Usage (from the repo root):
//   node scripts/import-nimcet-2026-paper.mjs "<path to NIMCET 2026 PAPER.txt>"
//
// Re-running with no argument rebuilds the SQL from the committed JSON, so the
// seed can be regenerated without the original export:
//   node scripts/import-nimcet-2026-paper.mjs
//
// Nothing is deleted. Questions are matched by exact stem; the target test row
// is matched by its exact title, so "NIMCET MOCK - 01" and every existing
// attempt are untouched.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "supabase", "seed", "nimcet-2026-paper");
const jsonPath = join(outDir, "questions.json");
const sqlPath = join(root, "supabase", "seed", "nimcet-2026-paper.sql");

const TITLE = "NIMCET 2026 PAPER";
const TAG = "NIMCET PYQ · 2026";
const MINUTES = 120;
const FREE = true;
const EXAM = "nimcet";
const TEMPLATE = "nimcet-2026";

// Source subject -> database section. The source's own subject names are kept
// exactly (the "section" column is what students and the admin bank see).
const MARKS = new Map([
  ["Mathematics", { section: "Mathematics", plus: 12, minus: -3, count: 50 }],
  ["Logical Reasoning", { section: "Logical Reasoning", plus: 6, minus: -1.5, count: 40 }],
  ["Computer Awareness", { section: "Computer Awareness", plus: 6, minus: -1.5, count: 20 }],
  ["English", { section: "English", plus: 4, minus: -1, count: 10 }],
]);

// Paper order: the source runs Mathematics -> Reasoning -> Computer & English.
const PARTS = [
  { label: "Mathematics", minutes: 70, count: 50 },
  { label: "Analytical Ability & Logical Reasoning", minutes: 30, count: 40 },
  { label: "Computer Awareness & General English", minutes: 20, count: 30 },
];

// The three image-based reasoning questions. Images are stored locally so the
// paper keeps working if the original Firebase token ever expires. The q066
// screenshot also carried the source's green check / red crosses; those were
// removed from the asset so the answer key is not shown before submission.
const IMAGES = new Map([
  ["6a37aff640aa12da921febf3", "/pyq/nimcet-2026-paper/q066.png"],
  ["6a37b0f340aa12da921febf6", "/pyq/nimcet-2026-paper/q069.png"],
  ["6a37b20540aa12da921febf8", "/pyq/nimcet-2026-paper/q074.png"],
]);

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFFS = ["Easy", "Medium", "Hard"];
const problems = [];
const warnings = [];

function fail(message) {
  problems.push(message);
}

function readSource(argv) {
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    if (!existsSync(jsonPath)) {
      console.error(`No source file given and ${jsonPath} does not exist.`);
      console.error('Usage: node scripts/import-nimcet-2026-paper.mjs "<NIMCET 2026 PAPER.txt>"');
      process.exit(1);
    }
    return { rows: JSON.parse(readFileSync(jsonPath, "utf8")), raw: false, file: jsonPath };
  }

  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const detail = parsed?.Success?.detail ?? parsed?.detail ?? null;
  if (!detail || !Array.isArray(detail.sections)) {
    console.error(`${file}: expected an export with Success.detail.sections[].`);
    process.exit(1);
  }
  return { detail, rows: [], raw: true, file };
}

const source = readSource(process.argv.slice(2));

let rows;
if (source.raw) {
  const detail = source.detail;
  rows = [];
  let seq = 0;
  for (const section of detail.sections) {
    for (const q of section.questions ?? []) {
      seq += 1;
      const subject = String(q.subject ?? "").trim();
      const scheme = MARKS.get(subject);
      const solution = String(q.solution ?? "").trim();
      const answer = LETTERS.indexOf(solution.replace(/^op_/i, "").toUpperCase());
      const sourceId = String(q._id ?? "");
      const imageUrl = IMAGES.get(sourceId) ?? "";

      rows.push({
        seq,
        sourceId,
        sourceSection: String(section.name ?? "").trim(),
        subject,
        section: scheme?.section ?? subject,
        topic: String(q.topic ?? "").trim(),
        difficulty: String(q.difficulty ?? "").trim(),
        stem: String(q.ps ?? "").trim(),
        options: ["op_A", "op_B", "op_C", "op_D"].map((k) => String(q[k] ?? "").trim()),
        answer,
        answerKey: solution,
        explanation: String(q.explanation ?? "").trim(),
        plus: Number(q.marks),
        minus: -Math.abs(Number(q.negative)),
        imageUrl,
        sourceImage: String(q.questionImage ?? "").trim(),
      });
    }
  }
} else {
  rows = source.rows;
}

// ---------- validate ----------
if (rows.length !== 120) fail(`loaded ${rows.length} questions, expected 120`);

const stems = new Map();
const perSubject = new Map();
for (const [subject, scheme] of MARKS) perSubject.set(subject, { count: 0, marks: 0 });

for (const q of rows) {
  const where = `#${q.seq} (${q.sourceId || "no id"})`;
  const scheme = MARKS.get(q.subject);
  if (!scheme) fail(`${where}: unknown subject "${q.subject}"`);
  if (!q.section) fail(`${where}: empty section`);
  if (!q.topic) fail(`${where}: empty topic`);
  if (!DIFFS.includes(q.difficulty)) fail(`${where}: difficulty "${q.difficulty}" not in ${DIFFS.join("/")}`);
  if (q.stem.length < 1 || q.stem.length > 4000) fail(`${where}: stem length ${q.stem.length} out of range (1-4000)`);
  if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${where}: needs exactly 4 options`);
  if (q.options?.some((o) => !o || o.length > 1000)) fail(`${where}: empty or overlong option`);
  if (new Set((q.options ?? []).map((o) => o.toLowerCase())).size !== 4) fail(`${where}: duplicate options inside the question`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= 4) fail(`${where}: answer key "${q.answerKey}" does not map to A-D`);
  if (!LETTERS.slice(0, 4).includes(String(q.answerKey ?? "").replace(/^op_/i, "").toUpperCase())) {
    fail(`${where}: solution "${q.answerKey}" is not op_A..op_D`);
  }
  if (q.explanation.length > 20000) fail(`${where}: explanation length ${q.explanation.length} out of range (max 20000)`);
  if (scheme) {
    if (q.plus !== scheme.plus) fail(`${where}: plus ${q.plus} does not match the ${q.subject} scheme (+${scheme.plus})`);
    if (q.minus !== scheme.minus) fail(`${where}: minus ${q.minus} does not match the ${q.subject} scheme (${scheme.minus})`);
  }
  if (q.imageUrl && !existsSync(join(root, "public", q.imageUrl.replace(/^\//, "")))) {
    fail(`${where}: image asset ${q.imageUrl} is missing from public/`);
  }
  if (q.sourceImage && !q.imageUrl) fail(`${where}: source has a question image but no local asset was mapped`);

  const norm = q.stem.toLowerCase().replace(/\s+/g, " ");
  if (stems.has(norm)) fail(`${where}: stem duplicates #${stems.get(norm)}`);
  else stems.set(norm, q.seq);

  if (scheme) {
    const acc = perSubject.get(q.subject);
    acc.count += 1;
    acc.marks += scheme.plus;
  }
}

// KaTeX parity with components/math-text.tsx: every `\(...\)`, `\[...\]`,
// `$$...$$` and `$...$` span must parse. A bad span would render as an error
// box for students, so it fails the import instead.
const MATH_RE = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
let mathSpans = 0;
for (const q of rows) {
  for (const field of ["stem", "options", "explanation"]) {
    const values = field === "options" ? q.options : [q[field]];
    for (const value of values) {
      const text = String(value ?? "");
      MATH_RE.lastIndex = 0;
      let match;
      while ((match = MATH_RE.exec(text)) !== null) {
        mathSpans += 1;
        const content = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
        try {
          katex.renderToString(content, { throwOnError: true, displayMode: false, strict: "ignore" });
        } catch (e) {
          fail(`#${q.seq}: KaTeX error in ${field}: ${String(e.message).slice(0, 140)}`);
        }
      }
    }
  }
}

let totalQuestions = 0;
let totalMarks = 0;
for (const [subject, scheme] of MARKS) {
  const acc = perSubject.get(subject);
  if (acc.count !== scheme.count) fail(`${subject}: ${acc.count} questions, expected ${scheme.count}`);
  totalQuestions += acc.count;
  totalMarks += acc.marks;
}
if (totalMarks !== 1000) fail(`total max marks ${totalMarks}, expected 1000`);
if (rows.length !== totalQuestions) fail(`per-subject counts add up to ${totalQuestions}, loaded ${rows.length}`);
if (PARTS.reduce((a, p) => a + p.count, 0) !== rows.length) fail("timed parts do not add up to the question count");

// Answer distribution is a sanity check, not a rule; a wildly skewed key is a
// sign of a mapping mistake.
const answerCounts = [0, 0, 0, 0];
for (const q of rows) if (Number.isInteger(q.answer) && q.answer < 4) answerCounts[q.answer] += 1;
if (answerCounts.some((n) => n === 0)) warnings.push(`answer distribution A-D: ${answerCounts.join("/")}`);

// ---------- report ----------
console.log(`Loaded ${rows.length} questions from ${source.file}`);
for (const [subject, scheme] of MARKS) {
  const acc = perSubject.get(subject);
  console.log(
    `  ${subject.padEnd(20)} ${String(acc.count).padStart(3)} Q · +${scheme.plus}/${scheme.minus} · ${String(acc.marks).padStart(4)} marks`
  );
}
console.log(`  Answers A/B/C/D: ${answerCounts.join("/")}`);
console.log(`  Mathematics spans: ${mathSpans} (all parsed by KaTeX)`);
console.log(`  TOTAL ${totalQuestions} Q · ${totalMarks} max marks · ${MINUTES} minutes`);
warnings.forEach((w) => console.log(`  [warn] ${w}`));
if (problems.length > 0) {
  console.error(`\n${problems.length} validation problem(s):`);
  problems.forEach((p) => console.error(`  x ${p}`));
  process.exit(1);
}
console.log("All structural checks passed.");

// ---------- write normalised JSON ----------
mkdirSync(outDir, { recursive: true });
writeFileSync(jsonPath, JSON.stringify(rows, null, 2) + "\n", "utf8");

// ---------- generate SQL ----------
const sq = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const sectionsJson = JSON.stringify(PARTS);
const description =
  "NIMCET 2026 previous-year question paper (PYQ) — 120 questions, 1000 marks, 120 minutes. " +
  "Official NIMCET 2026 pattern: Mathematics (50), Logical Reasoning (40), Computer Awareness (20) and English (10).";
const instructions = [
  "Read all instructions carefully before you begin.",
  "",
  "• This paper follows the official NIMCET 2026 pattern: four subject sections in three timed parts.",
  "• Part I — Mathematics: 50 questions, 70 minutes.",
  "• Part II — Analytical Ability & Logical Reasoning: 40 questions, 30 minutes.",
  "• Part III — Computer Awareness (20 questions) and General English (10 questions): 30 questions, 20 minutes shared by both subjects.",
  "• Each timed part runs on its own clock. A part locks when its time ends and the next part opens automatically; you cannot return to a finished part. Within Part III, both subjects remain available until the shared 20-minute clock ends.",
  "• Marking: Mathematics +12 / −3 · Analytical Ability & Logical Reasoning +6 / −1.5 · Computer Awareness +6 / −1.5 · English +4 / −1.",
  "• There is no penalty for unanswered questions.",
  "• Use the palette to navigate within the current subject section, and mark questions for review to revisit them before the part ends.",
  "• The paper is auto-submitted when Part III ends.",
  "• Correct answers and full explanations appear on your scorecard after the paper is submitted.",
].join("\n");

const valueLines = rows.map((q) => {
  const opts = `jsonb_build_array(${q.options.map((o) => sq(o)).join(", ")})`;
  return `  (${q.seq}, ${sq(q.section)}, ${sq(q.topic)}, ${sq(q.difficulty)}, ${sq(q.stem)}, ${opts}, ${q.answer}, ${sq(q.explanation)}, ${q.plus}, ${q.minus}, ${sq(q.imageUrl)})`;
});

const sql = `-- ============================================================================
-- ${TITLE} — generated by scripts/import-nimcet-2026-paper.mjs
-- DO NOT EDIT BY HAND — edit the source export / questions.json and regenerate.
--
-- HOW TO RUN (one paste):
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- Idempotent and non-destructive:
--   • questions are matched by exact stem, so re-running never duplicates them;
--   • the test row is matched by the exact title "${TITLE}";
--   • "NIMCET MOCK - 01" and every existing attempt/score are untouched.
--
-- Bundles the additive image column from
-- supabase/migrations/0009_question_images.sql, so no separate migration run is
-- required for this paper.
-- ============================================================================

begin;

-- 1. Additive schema: optional question figure (0009) and the test metadata
--    columns this seed writes (0005/0006/0007). Safe if they already exist.
alter table public.questions
  add column if not exists image_url text not null default '';
alter table public.tests
  add column if not exists description text not null default '';
alter table public.tests
  add column if not exists instructions text not null default '';
alter table public.tests
  add column if not exists sections jsonb not null default '[]'::jsonb;
alter table public.tests
  add column if not exists template text not null default '';

-- 2. Stage the paper (ordered by seq).
drop table if exists pg_temp.seed_nimcet_2026;
create temporary table seed_nimcet_2026 (
  seq         int primary key,
  section     text not null,
  topic       text not null,
  difficulty  text not null,
  stem        text not null,
  options     jsonb not null,
  answer      int  not null,
  explanation text not null,
  plus        numeric not null,
  minus       numeric not null,
  image_url   text not null default ''
) on commit drop;

insert into seed_nimcet_2026 (seq, section, topic, difficulty, stem, options, answer, explanation, plus, minus, image_url) values
${valueLines.join(",\n")};

-- 3. Insert only questions that do not exist yet (matched by exact stem).
insert into public.questions (exam, section, topic, difficulty, stem, options, answer, explanation, plus, minus, image_url)
select ${sq(EXAM)}, s.section, s.topic, s.difficulty, s.stem,
       s.options, s.answer, s.explanation, s.plus, s.minus, s.image_url
from seed_nimcet_2026 s
where not exists (select 1 from public.questions q where q.stem = s.stem);

-- 4. Backfill the figure on a pre-existing row only when it has none; never
--    overwrite an image an admin set deliberately.
update public.questions q
   set image_url = s.image_url
  from seed_nimcet_2026 s
 where q.stem = s.stem
   and s.image_url <> ''
   and coalesce(q.image_url, '') = '';

-- 5. Create the test if it does not exist, then refresh it on every run.
--    The NIMCET 2026 PYQ uses the server-owned full-mock template so the
--    official three timed parts are enforced by the server, not the browser.
insert into public.tests (exam, title, tag, minutes, free, published, question_ids, description, instructions, sections, template)
select ${sq(EXAM)}, ${sq(TITLE)}, ${sq(TAG)}, ${MINUTES}, ${FREE}, true,
       (select array_agg(x.id order by s.seq)
          from seed_nimcet_2026 s
          join lateral (
            select q.id from public.questions q
            where q.stem = s.stem
            order by q.created_at
            limit 1
          ) x on true),
       ${sq(description)},
       ${sq(instructions)},
       ${sq(sectionsJson)}::jsonb,
       ${sq(TEMPLATE)}
where not exists (select 1 from public.tests where title = ${sq(TITLE)});

update public.tests t set
  exam         = ${sq(EXAM)},
  tag          = ${sq(TAG)},
  minutes      = ${MINUTES},
  free         = ${FREE},
  published    = true,
  question_ids = (select array_agg(x.id order by s.seq)
                    from seed_nimcet_2026 s
                    join lateral (
                      select q.id from public.questions q
                      where q.stem = s.stem
                      order by q.created_at
                      limit 1
                    ) x on true),
  description  = ${sq(description)},
  instructions = ${sq(instructions)},
  sections     = ${sq(sectionsJson)}::jsonb,
  template     = ${sq(TEMPLATE)}
where t.title = ${sq(TITLE)};

-- 6. Verification — these result sets show what the run did.
select s.section,
       count(*)    as questions,
       min(s.plus) as marks_per_correct,
       min(s.minus) as marks_per_wrong,
       sum(s.plus) as max_marks,
       count(*) filter (where s.image_url <> '') as with_image
from seed_nimcet_2026 s
group by s.section
order by min(s.seq);

select count(*) as total_questions,
       count(*) filter (where s.image_url <> '') as questions_with_images,
       sum(s.plus) as total_max_marks
from seed_nimcet_2026 s;

select t.id, t.title, t.exam, t.tag, t.published, t.minutes, t.template,
       array_length(t.question_ids, 1) as linked_questions,
       jsonb_array_length(t.sections) as timed_parts,
       (select sum(p->>'count')::int from jsonb_array_elements(t.sections) p) as section_question_sum
from public.tests t
where t.title = ${sq(TITLE)};

commit;
`;

writeFileSync(sqlPath, sql, "utf8");
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${sqlPath}`);
