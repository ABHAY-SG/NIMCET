// scripts/audit-question-bank.mjs
//
// Read-only audit of a question-bank dump (see scripts/bank-task.mjs "dump").
//
//   node scripts/audit-question-bank.mjs bank-dump.json [repo-seed.csv]
//
// Checks every stored stem, option and explanation for:
//   * KaTeX parse errors inside \(..\), \[..\], $..$, $$..$$ spans
//   * mathematical notation left as plain text (x2, e2x, A2, y1, sec2, ∛, ², ...)
//   * unbalanced LaTeX delimiters
//   * structural problems (answer index, duplicate options, empty fields)
// and, when a seed CSV is supplied, lists every row where the database and the
// repository disagree.

import { readFileSync, writeFileSync } from "node:fs";
import katex from "katex";

const MATH_DELIMITER = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;

function tokenize(text) {
  const tokens = [];
  let lastIndex = 0;
  const regex = new RegExp(MATH_DELIMITER.source, "g");
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push({ kind: "text", content: text.slice(lastIndex, match.index) });
    const content = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    tokens.push({ kind: "math", content, display: match[1] === undefined });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ kind: "text", content: text.slice(lastIndex) });
  return tokens;
}

// High-confidence defects: these never appear in correct stored content.
const DEFINITE_PATTERNS = [
  { re: /\\[a-zA-Z]{2,}/g, why: "LaTeX command outside math delimiters (renders as raw source)" },
  { re: /\\\(|\\\)|\\\[|\\\]/g, why: "LaTeX delimiter inside a text span (unbalanced)" },
  { re: /\[2[23][0-9][0-9]\](?![0-9])/g, why: "stray construct" },
  { re: /[²³¹⁰⁴-⁹₀-₉]/g, why: "unicode super/subscript from a PDF paste" },
  { re: /[∛√]/g, why: "unicode radical (prefer KaTeX \\sqrt)" },
  { re: /(?<![A-Za-z])(cos|sin|tan|sec|cosec|cot|log|ln)-[0-9]/g, why: "function with a hyphen instead of a ^{} exponent" },
  { re: /\be\s*-\s*[a-z]\b/g, why: "e to a negative power written with a hyphen" },
  { re: /\|\s*[A-Za-z]\s*-\s*1\s*\|/g, why: "determinant/inverse written with a hyphen" },
  { re: /\)\s*[0-9]\b/g, why: "digit right after a closing parenthesis (missing exponent)" },
  { re: /\)\s*[Tt]\b/g, why: "transpose written as )T instead of ^{T}" },
  { re: /\\\[\s*\\\]/g, why: "empty display-math block" },
];

// Lower-confidence smells worth a human eye (legitimate in prose, e.g. "Step 1").
const REVIEW_PATTERNS = [
  { re: /[A-Za-z]\d+/g, why: "letter immediately followed by digits (missing ^ or _?)" },
  { re: /\b(ln|log|sin|cos|tan|sec|cot|cosec|lim)\b/g, why: "function name left as plain text" },
  { re: /[∈∉∪∩⊂⊆∀∃≤≥≠∞⇒⇔∑∫∂]/g, why: "unicode math symbol (prefer KaTeX)" },
  { re: /\boption\s*\(?[1-5]\)?/gi, why: "reference to an option number rather than its letter" },
];

function auditText(text, where, out) {
  const tokens = tokenize(text);
  let mathChars = 0;
  for (const t of tokens) {
    if (t.kind === "math") {
      mathChars += t.content.length;
      try {
        katex.renderToString(t.content, { throwOnError: true, strict: "warn", displayMode: t.display });
      } catch (err) {
        out.katex.push({ where, expr: t.content, message: String(err.message ?? err).slice(0, 200) });
      }
      if (!/^[\s\S]*$/.test(t.content) || /\\\[|\s\\\]/.test(t.content)) {
        out.structural.push({ where, issue: "stray delimiter inside a math span" });
      }
      continue;
    }
    for (const p of DEFINITE_PATTERNS) {
      const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
      let m;
      while ((m = re.exec(t.content)) !== null) {
        out.plain.push({ level: "definite", where, match: m[0], why: p.why, context: t.content.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, " ") });
      }
    }
    for (const p of REVIEW_PATTERNS) {
      const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
      let m;
      while ((m = re.exec(t.content)) !== null) {
        out.review.push({ level: "review", where, match: m[0], why: p.why, context: t.content.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, " ") });
      }
    }
  }
  const open = (text.match(/\\\(/g) ?? []).length;
  const close = (text.match(/\\\)/g) ?? []).length;
  if (open !== close) out.delims.push({ where, reason: `unbalanced \\( (${open}) vs \\) (${close})` });
  const dopen = (text.match(/\\\[/g) ?? []).length;
  const dclose = (text.match(/\\\]/g) ?? []).length;
  if (dopen !== dclose) out.delims.push({ where, reason: `unbalanced \\[ (${dopen}) vs \\] (${dclose})` });
  return mathChars;
}

const dumpPath = process.argv[2] ?? "bank-dump.json";
const csvPath = process.argv[3];
const dump = JSON.parse(readFileSync(dumpPath, "utf8"));

const out = { katex: [], plain: [], review: [], delims: [], structural: [], stats: {} };

let mathSpans = 0;
let mathChars = 0;
for (const q of dump.questions) {
  const fields = [
    ["stem", q.stem],
    ...(q.options ?? []).map((o, i) => [`option ${"ABCD"[i]}`, o]),
    ["explanation", q.explanation],
  ];
  for (const [name, value] of fields) {
    if (typeof value !== "string") {
      out.structural.push({ id: q.id, issue: `${name} is not a string` });
      continue;
    }
    if (!value.trim() && name !== "explanation") out.structural.push({ id: q.id, issue: `${name} is empty` });
    mathChars += auditText(value, `${q.section}/${q.topic} :: ${name}`, out);
  }
  mathSpans += (q.stem.match(MATH_DELIMITER) ?? []).length;
  const opts = q.options ?? [];
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) {
    out.structural.push({ id: q.id, issue: `answer index ${q.answer} out of range (0..${opts.length - 1})` });
  }
  const dups = opts.filter((o, i) => opts.indexOf(o) !== i);
  if (dups.length) out.structural.push({ id: q.id, issue: `duplicate options: ${JSON.stringify(dups.slice(0, 2))}` });
  if (!q.explanation || !q.explanation.trim()) out.structural.push({ id: q.id, issue: "explanation is empty" });
  if (q.minus > 0) out.structural.push({ id: q.id, issue: `minus is positive (${q.minus})` });
}

out.stats = { questions: dump.questions.length, tests: dump.tests.length, mathSpans, mathChars };

// ---- compare with the repository seed -------------------------------------
let differs = [];
if (csvPath) {
  const csv = parseCsv(readFileSync(csvPath, "utf8"));
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const byStem = new Map();
  for (const q of dump.questions) byStem.set(norm(q.stem), q);
  for (const row of csv.rows) {
    const q = byStem.get(norm(row.stem));
    if (!q) {
      differs.push({ stem: norm(row.stem).slice(0, 60), issue: "not found in database" });
      continue;
    }
    const fields = [];
    if (norm(q.stem) !== norm(row.stem)) fields.push("stem");
    const a = (q.options ?? []).map(norm).join("|");
    const b = [row.optionA, row.optionB, row.optionC, row.optionD, row.optionE]
      .filter((o) => String(o ?? "").trim() !== "")
      .map(norm)
      .join("|");
    if (a !== b) fields.push("options");
    if (norm(q.explanation) !== norm(row.explanation)) fields.push("explanation");
    const letter = String(row.answer ?? "").trim().toUpperCase();
    const repoAnswer = "ABCDE".includes(letter) ? "ABCDE".indexOf(letter) : Number(row.answer);
    if (Number(q.answer) !== Number(repoAnswer)) fields.push("answer");
    if (fields.length) differs.push({ stem: norm(row.stem).slice(0, 60), issue: `db != repo (${fields.join(", ")})`, db: q, row });
  }
  out.stats.csvRows = csv.rows.length;
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  let headers = null;
  const push = () => {
    row.push(field.replace(/\r/g, ""));
    field = "";
  };
  const endRow = () => {
    push();
    if (!headers) headers = row;
    else if (row.some((c) => c !== "")) rows.push(Object.fromEntries(headers.map((h, i) => [h.trim(), row[i] ?? ""])));
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") push();
    else if (c === "\n") endRow();
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) endRow();
  return { rows };
}

// ---- report ---------------------------------------------------------------
console.log(JSON.stringify(out.stats, null, 1));
console.log(`\nKaTeX parse errors: ${out.katex.length}`);
for (const e of out.katex.slice(0, 40)) console.log(`  - ${e.where}\n      ${e.expr.slice(0, 120)}\n      ${e.message.replace(/\n/g, " ")}`);
console.log(`\nHigh-confidence notation defects: ${out.plain.length}`);
for (const p of out.plain) console.log(`  - ${p.where}\n      ${JSON.stringify(p.match)} :: ${p.why}\n      ...${p.context}...`);
console.log(`\nLow-confidence review hits: ${out.review.length}`);
const grouped = new Map();
for (const p of out.review) {
  const k = `${p.why} ~~ ${p.match}`;
  grouped.set(k, (grouped.get(k) ?? []).concat(p));
}
for (const [k, arr] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(arr.length).padStart(3)}x  ${JSON.stringify(k.split(" ~~ ")[1])}   [${k.split(" ~~ ")[0]}]`);
  for (const p of arr.slice(0, 2)) console.log(`         ${p.where}`);
}
console.log(`\nDelimiter problems: ${out.delims.length}`);
for (const d of out.delims) console.log(`  - ${d.where}: ${d.reason}`);
console.log(`\nStructural problems: ${out.structural.length}`);
for (const s of out.structural) console.log(`  - ${s.id}: ${s.issue}`);
if (csvPath) {
  console.log(`\nDB vs repo seed (${csvPath}): ${differs.length} of ${out.stats.csvRows} rows differ`);
  for (const d of differs) console.log(`  - [${d.issue}] ${d.stem}`);
}
writeFileSync("bank-audit.json", JSON.stringify({ ...out, differs }, null, 2));
console.log("\nfull report -> bank-audit.json");
