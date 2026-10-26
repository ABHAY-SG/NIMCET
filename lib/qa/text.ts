// Text, rich-content and duplicate helpers shared by the QA validators.

export type MathToken = { kind: "text" | "math"; content: string; display: boolean };

/** Same delimiter set as components/math-text.tsx. Longer forms win. */
export const MATH_DELIMITER = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;

export function tokenizeMath(text: string): MathToken[] {
  const tokens: MathToken[] = [];
  let lastIndex = 0;
  const regex = new RegExp(MATH_DELIMITER.source, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(String(text ?? ""))) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", content: String(text).slice(lastIndex, match.index), display: false });
    }
    let content = "";
    let display = false;
    if (match[1] !== undefined) {
      content = match[1];
    } else if (match[2] !== undefined) {
      content = match[2];
      display = true;
    } else if (match[3] !== undefined) {
      content = match[3];
      display = true;
    } else if (match[4] !== undefined) {
      content = match[4];
    }
    tokens.push({ kind: "math", content, display });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < String(text ?? "").length) {
    tokens.push({ kind: "text", content: String(text).slice(lastIndex), display: false });
  }
  return tokens;
}

export function mathSpans(text: string): string[] {
  return tokenizeMath(text)
    .filter((t) => t.kind === "math")
    .map((t) => t.content);
}

export function stripMathDelimiters(text: string): string {
  return tokenizeMath(text)
    .map((t) => (t.kind === "math" ? ` ${t.content} ` : t.content))
    .join("");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  times: "×",
  divide: "÷",
  minus: "−",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  le: "≤",
  ge: "≥",
  ne: "≠",
  plusmn: "±",
  sqrt: "√",
  pi: "π",
  deg: "°",
};

export function decodeEntities(text: string): string {
  return String(text ?? "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1]?.toLowerCase() === "x";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[body.toLowerCase()] ?? all;
  });
}

/** Turn literal \\n sequences from imported JSON into real newlines. */
export function normalizeLineBreaks(text: string): string {
  return String(text ?? "").replace(/\\r\\n|\\n|\\r/g, (m, offset: number, full: string) => {
    const next = full[offset + m.length];
    // Leave a real LaTeX command such as \\nabla alone; a newline is normally
    // followed by uppercase prose, another slash, whitespace or the end.
    if (next && /[a-z]/.test(next)) return m;
    return "\n";
  });
}

export function stripHtml(text: string): string {
  return decodeEntities(
    normalizeLineBreaks(String(text ?? ""))
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Text used for duplicate detection and prose comparisons. */
export function normalizeText(text: string): string {
  return stripHtml(normalizeLineBreaks(stripMathDelimiters(text)))
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOption(text: string): string {
  const stripped = stripMathDelimiters(text)
    .toLowerCase()
    .replace(/\\left|\\right|\\,|\\!|\\;|\\quad|\\qquad/g, "")
    .replace(/[\s{}()[\]]+/g, "")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\u00d7/g, "*")
    .replace(/\u00f7/g, "/")
    .trim();
  return stripped;
}

export function optionLetter(index: number): string {
  return ["A", "B", "C", "D", "E", "F", "G", "H"][index] ?? "?";
}

export function letterIndex(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const s = String(value ?? "").trim();
  if (/^[A-H]$/i.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
  if (/^[0-9]$/.test(s)) return Number(s);
  return -1;
}

// ---------------------------------------------------------------------------
// HTML safety / balance. The stored fields are rendered as HTML only in a few
// places, but malformed tags can still break the surrounding UI. This is a
// deliberately small allowlist, not a browser-grade parser.

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr", "col"]);
const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table",
  "tbody", "td", "th", "thead", "tr", "u", "ul",
]);

export type HtmlIssue = { severity: "critical" | "warning"; message: string; evidence?: string };

export function inspectHtml(text: string): HtmlIssue[] {
  const issues: HtmlIssue[] = [];
  const src = String(text ?? "");
  const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(src)) !== null) {
    if (match[0].startsWith("<!--")) continue;
    const name = match[1].toLowerCase();
    const raw = match[0];
    const attrs = match[2] ?? "";
    const closing = /^<\//.test(raw);
    if (!ALLOWED_TAGS.has(name)) {
      issues.push({
        severity: name === "script" || name === "style" || name === "iframe" || name === "object" || name === "embed" || name === "form" ? "critical" : "warning",
        message: `Unsupported HTML tag <${name}>.`,
        evidence: raw.slice(0, 90),
      });
    }
    if (/\son[a-z]+\s*=/i.test(attrs)) {
      issues.push({ severity: "critical", message: "Inline event handler attribute found.", evidence: raw.slice(0, 90) });
    }
    if (/(?:href|src)\s*=\s*["']?\s*javascript:/i.test(attrs)) {
      issues.push({ severity: "critical", message: "javascript: URL found in an attribute.", evidence: raw.slice(0, 90) });
    }
    if (closing) {
      if (VOID_TAGS.has(name)) {
        issues.push({ severity: "warning", message: `Closing tag </${name}> used for a void element.`, evidence: raw });
        continue;
      }
      const at = stack.lastIndexOf(name);
      if (at < 0) {
        issues.push({ severity: "warning", message: `Closing tag </${name}> has no matching opening tag.`, evidence: raw });
      } else {
        const unclosed = stack.splice(at).slice(1);
        if (unclosed.length) {
          issues.push({
            severity: "warning",
            message: `Nested HTML tag${unclosed.length === 1 ? "" : "s"} not closed before </${name}>: ${unclosed.join(", ")}.`,
            evidence: raw,
          });
        }
      }
    } else if (!VOID_TAGS.has(name) && !/\/\s*>$/.test(raw)) {
      stack.push(name);
    }
  }
  if (stack.length) {
    issues.push({
      severity: "warning",
      message: `Unclosed HTML tag${stack.length === 1 ? "" : "s"}: ${stack.slice(-5).join(", ")}.`,
      evidence: stack.slice(-5).join(", "),
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Math-delimiter diagnostics.

export function delimiterIssues(text: string): HtmlIssue[] {
  const out: HtmlIssue[] = [];
  const s = String(text ?? "");
  const count = (needle: string) => s.split(needle).length - 1;
  for (const [open, close, label] of [
    ["\\(", "\\)", "\\(...\\)"],
    ["\\[", "\\]", "\\[...\\]"],
  ] as const) {
    const a = count(open);
    const b = count(close);
    if (a !== b) out.push({ severity: "critical", message: `Unbalanced ${label} delimiters (${a} opening, ${b} closing).` });
  }
  const singleDollar = (s.match(/(^|[^$])\$(?!\$)/g) ?? []).length;
  const doubleDollar = (s.match(/\$\$/g) ?? []).length;
  if (singleDollar % 2 !== 0 && doubleDollar % 2 === 0) {
    out.push({ severity: "warning", message: "An odd number of single-$ math delimiters was found." });
  }
  for (const token of tokenizeMath(s)) {
    if (token.kind === "math" && !token.content.trim()) {
      out.push({ severity: "warning", message: "Empty math span would render as an empty box." });
    }
    if (token.kind === "math" && /\\\[|\\\]/.test(token.content)) {
      out.push({ severity: "warning", message: "A display-math delimiter appears inside another math span." });
    }
  }
  return out;
}

export type PlainMathIssue = { severity: "critical" | "warning"; message: string; evidence: string };

const PLAIN_MATH_RULES: Array<{ re: RegExp; severity: "critical" | "warning"; message: string }> = [
  { re: /\uFFFD/g, severity: "critical", message: "Encoding corruption (�) from a PDF/import; the original symbol is lost." },
  { re: /\\[a-zA-Z]{2,}/g, severity: "critical", message: "LaTeX command outside math delimiters (renders as raw source)." },
  { re: /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g, severity: "critical", message: "Unicode superscript/subscript pasted from a PDF (use ^{} / _{} in math)." },
  { re: /[√∛∜]/g, severity: "critical", message: "Unicode radical pasted as plain text (use \\sqrt{})." },
  { re: /\)\s*[Tt]\b/g, severity: "warning", message: "Transpose written as )T; consider ^{T} in math." },
  { re: /\b(?:sin|cos|tan|sec|cosec|cot|log|ln)\s*-\s*\d/g, severity: "critical", message: "A function exponent is written with a hyphen instead of ^{...}." },
  { re: /\be\s*-\s*[a-zA-Z]\b/g, severity: "warning", message: "An exponent on e may have been written with a hyphen." },
  { re: /[A-Za-z]\d+/g, severity: "warning", message: "A letter immediately followed by digits may be missing an exponent/subscript." },
  { re: /\)\s*\d+\b/g, severity: "warning", message: "A digit immediately after ')' may be a missing exponent." },
  { re: /\b(?:lim|sin|cos|tan|sec|cot|cosec|log|ln)\b/g, severity: "warning", message: "A math function is written as plain text; wrap it in math delimiters." },
];

export function plainMathIssues(text: string): PlainMathIssue[] {
  const out: PlainMathIssue[] = [];
  for (const token of tokenizeMath(normalizeLineBreaks(text))) {
    if (token.kind !== "text") continue;
    for (const rule of PLAIN_MATH_RULES) {
      const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`);
      let m: RegExpExecArray | null;
      while ((m = re.exec(token.content)) !== null) {
        // Ignore ordinary identifiers such as "COVID19", "MP3", "Q1" and
        // "H2O": they are common in computer/English questions.
        if (/^[A-Z]{2,}\d+$/.test(m[0]) || /^(?:Q|No|Ex|Fig|Step|Unit|Class|Grade)\d+$/i.test(m[0])) continue;
        out.push({ severity: rule.severity, message: rule.message, evidence: m[0] });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Duplicate similarity.

function normalizeForSimilarity(text: string): string {
  return stripHtml(normalizeLineBreaks(stripMathDelimiters(text)))
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9+*/^=<>\u2264\u2265\u2260.\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(text: string): Set<string> {
  const s = ` ${normalizeForSimilarity(text)} `;
  const out = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
}

/** Jaccard similarity of character trigrams, 0..1. */
export function similarity(a: string, b: string): number {
  const na = normalizeForSimilarity(a);
  const nb = normalizeForSimilarity(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function snippet(text: string, max = 120): string {
  const s = stripHtml(text).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function sentenceChunks(text: string): string[] {
  return normalizeLineBreaks(String(text ?? ""))
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
