// Deterministic arithmetic / equation / explanation checks.
//
// This is intentionally a small, auditable calculator rather than `eval` or a
// remote service. It supports the arithmetic and one-variable polynomial forms
// that appear in aptitude questions; anything outside that subset returns null
// and the engine records that independent verification was not possible.

import { finding, type QaFinding } from "./types";
import { mathSpans, normalizeText, sentenceChunks, stripMathDelimiters } from "./text";

type Poly = number[]; // coefficient of x^0, x^1, ...

const EPS = 1e-7;

function cleanPoly(p: Poly): Poly {
  const out = [...p];
  while (out.length > 1 && Math.abs(out[out.length - 1]) < 1e-12) out.pop();
  return out;
}

function polyConst(n: number): Poly {
  return [n];
}

function polyAdd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return cleanPoly(out);
}

function polySub(a: Poly, b: Poly): Poly {
  return polyAdd(a, b.map((v) => -v));
}

function polyMul(a: Poly, b: Poly): Poly {
  if (a.length * b.length > 30) return [Number.NaN];
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return cleanPoly(out);
}

function polyScale(a: Poly, n: number): Poly {
  return cleanPoly(a.map((v) => v * n));
}

function polyPow(a: Poly, n: number): Poly | null {
  if (!Number.isInteger(n) || n < 0 || n > 8) return null;
  let out: Poly = [1];
  for (let i = 0; i < n; i++) out = polyMul(out, a);
  return out;
}

function isConst(a: Poly): boolean {
  return a.length <= 1 || a.slice(1).every((v) => Math.abs(v) < 1e-12);
}

function constValue(a: Poly): number {
  return a[0] ?? 0;
}

function evalPoly(a: Poly, x: number): number {
  let out = 0;
  for (let i = a.length - 1; i >= 0; i--) out = out * x + a[i];
  return out;
}

function factorial(n: number): number | null {
  if (!Number.isInteger(n) || n < 0 || n > 12) return null;
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  cot: (x) => 1 / Math.tan(x),
  sec: (x) => 1 / Math.cos(x),
  cosec: (x) => 1 / Math.sin(x),
  log: (x) => Math.log10(x),
  ln: (x) => Math.log(x),
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  fact: (x) => factorial(x) ?? Number.NaN,
};

/** Normalise the LaTeX subset used in the bank into a plain expression. */
export function prepareMathExpression(input: string): string {
  let s = String(input ?? "").trim();
  s = s.replace(/^\$\$?|\$\$?$/g, "").trim();
  s = s.replace(/^\\\(|\\\)$/g, "").replace(/^\\\[|\\\]$/g, "").trim();

  // Recursively unwrap \frac{...}{...} and \sqrt{...}.
  for (let guard = 0; guard < 12; guard++) {
    const before = s;
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
    s = s.replace(/\\dfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
    s = s.replace(/\\tfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
    s = s.replace(/\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]*)\}/g, "cbrt($2)");
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
    // Simple one-token arguments: \frac12 / \sqrt3.
    s = s.replace(/\\frac\s*(\d)\s*(\d)/g, "(($1)/($2))");
    s = s.replace(/\\sqrt\s*(\d+)/g, "sqrt($1)");
    if (s === before) break;
  }

  s = s
    .replace(/\\text\s*\{[^{}]*\}/g, " ")
    .replace(/\\mathrm\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\operatorname\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(sin|cos|tan|cot|sec|csc|cosec|log|ln|exp|abs|sqrt|cbrt|min|max)\b/g, "$1")
    .replace(/\\left|\\right/g, "")
    .replace(/\\[!,;: ]|\\quad|\\qquad/g, " ")
    .replace(/\\times|\\cdot/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\infty/g, "Infinity")
    .replace(/\\%/g, "/100")
    .replace(/\\[,;!]/g, "")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[\u00d7\u00b7]/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/\u221a/g, "sqrt")
    .replace(/\u03c0/g, "pi")
    .replace(/\^\{([^{}]*)\}/g, "^($1)")
    .replace(/_\{([^{}]*)\}/g, "_$1")
    .replace(/\^\s*\{/g, "^(")
    .replace(/\}\s*(?=[+\-*/^)])/g, ")")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

type Token =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" }
  | { type: "fact" };

function tokenize(input: string): Token[] | null {
  const s = prepareMathExpression(input);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) return null;
      out.push({ type: "number", value: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      const m = /^[a-zA-Z][a-zA-Z0-9_]*/.exec(s.slice(i));
      if (!m) return null;
      out.push({ type: "ident", value: m[0] });
      i += m[0].length;
      continue;
    }
    if ("+-*/^".includes(c)) {
      out.push({ type: "op", value: c });
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ type: "rparen" });
      i++;
      continue;
    }
    if (c === ",") {
      out.push({ type: "comma" });
      i++;
      continue;
    }
    if (c === "!") {
      out.push({ type: "fact" });
      i++;
      continue;
    }
    // Percentages are common in options ("25%").
    if (c === "%") {
      out.push({ type: "op", value: "/" });
      out.push({ type: "number", value: 100 });
      i++;
      continue;
    }
    return null;
  }
  return out;
}

type VarMap = Record<string, number>;

class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly variable: string | null = null,
    private readonly vars: VarMap = {}
  ) {}

  parse(): Poly | null {
    const value = this.expr();
    if (!value || this.pos !== this.tokens.length) return null;
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expr(): Poly | null {
    let left = this.term();
    if (!left) return null;
    while (this.peek()?.type === "op" && ((this.peek() as { value: string }).value === "+" || (this.peek() as { value: string }).value === "-")) {
      const op = (this.tokens[this.pos++] as { value: string }).value;
      const right = this.term();
      if (!right) return null;
      left = op === "+" ? polyAdd(left, right) : polySub(left, right);
    }
    return left;
  }

  private startsAtom(t: Token | undefined): boolean {
    return !!t && (t.type === "number" || t.type === "ident" || t.type === "lparen");
  }

  private term(): Poly | null {
    let left = this.unary();
    if (!left) return null;
    for (;;) {
      const t = this.peek();
      if (t?.type === "op" && ((t as { value: string }).value === "*" || (t as { value: string }).value === "/")) {
        const op = (this.tokens[this.pos++] as { value: string }).value;
        const right = this.unary();
        if (!right) return null;
        if (op === "*") {
          left = polyMul(left, right);
        } else {
          if (!isConst(right)) return null;
          const d = constValue(right);
          if (Math.abs(d) < EPS) return null;
          left = polyScale(left, 1 / d);
        }
        continue;
      }
      // Implicit multiplication: 2x, 2(x+1), (x+1)(x-1).
      if (this.startsAtom(t)) {
        const right = this.unary();
        if (!right) return null;
        left = polyMul(left, right);
        continue;
      }
      break;
    }
    return cleanPoly(left);
  }

  private unary(): Poly | null {
    const t = this.peek();
    if (t?.type === "op" && ((t as { value: string }).value === "+" || (t as { value: string }).value === "-")) {
      this.pos++;
      const v = this.unary();
      if (!v) return null;
      return (t as { value: string }).value === "-" ? polyScale(v, -1) : v;
    }
    return this.power();
  }

  private power(): Poly | null {
    let base = this.atom();
    if (!base) return null;
    // Factorial postfix.
    while (this.peek()?.type === "fact") {
      this.pos++;
      if (!isConst(base)) return null;
      const f = factorial(constValue(base));
      if (f === null) return null;
      base = polyConst(f);
    }
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "^") {
      this.pos++;
      const exp = this.unary();
      if (!exp || !isConst(exp)) return null;
      const n = constValue(exp);
      if (!Number.isInteger(n)) return null;
      if (!isConst(base) && (n < 0 || n > 8)) return null;
      if (isConst(base)) {
        const v = Math.pow(constValue(base), n);
        return Number.isFinite(v) ? polyConst(v) : null;
      }
      return polyPow(base, n);
    }
    return base;
  }

  private atom(): Poly | null {
    const t = this.peek();
    if (!t) return null;
    if (t.type === "number") {
      this.pos++;
      return polyConst(t.value);
    }
    if (t.type === "lparen") {
      this.pos++;
      const value = this.expr();
      if (!value || this.peek()?.type !== "rparen") return null;
      this.pos++;
      return value;
    }
    if (t.type === "ident") {
      this.pos++;
      const name = t.value;
      const next = this.peek();
      if (next?.type === "lparen") {
        const fn = FUNCTIONS[name.toLowerCase()];
        if (!fn) return null;
        this.pos++;
        const arg = this.expr();
        if (!arg || this.peek()?.type !== "rparen") return null;
        this.pos++;
        if (!isConst(arg)) return null;
        const v = fn(constValue(arg));
        return Number.isFinite(v) ? polyConst(v) : null;
      }
      const key = name.toLowerCase();
      if (this.variable && name === this.variable) return [0, 1];
      if (name in this.vars) return polyConst(this.vars[name]);
      if (key === "pi") return polyConst(Math.PI);
      if (key === "e") return polyConst(Math.E);
      return null;
    }
    return null;
  }
}

export function parsePolynomial(input: string, variable: string | null = null, vars: VarMap = {}): Poly | null {
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;
  const parsed = new Parser(tokens, variable, vars).parse();
  if (!parsed || parsed.some((v) => !Number.isFinite(v))) return null;
  return parsed;
}

/** Evaluate a pure numeric expression. Returns null when it is not numeric. */
export function evaluateExpression(input: string): number | null {
  const p = parsePolynomial(input);
  if (!p || !isConst(p)) return null;
  const value = constValue(p);
  return Number.isFinite(value) ? value : null;
}

export function valuesClose(a: number, b: number, tolerance = 1e-6): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const diff = Math.abs(a - b);
  return diff <= tolerance || diff <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Parse an option as a number/expression. Handles LaTeX fractions, percentages,
 * comma thousands separators and a leading currency/unit. Returns null for
 * statement/code/text options.
 */
export function parseNumericOption(input: string): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/,(\d{3}\b)/g, "$1")
    .replace(/^[\s₹$€£]+/, "")
    .replace(/\s*(?:cm|mm|m|km|kg|g|mg|litre|liter|ml|sec|second|seconds|min|minute|minutes|hour|hours|%|rupees?|rs\.?)\s*$/i, (m) => (/^%$/.test(m.trim()) ? "/100" : ""))
    .trim();
  const direct = evaluateExpression(cleaned);
  if (direct !== null) return direct;
  // A trailing percentage that was stripped above.
  if (/%\s*$/.test(raw)) {
    const v = evaluateExpression(raw.replace(/%/g, ""));
    if (v !== null) return v / 100;
  }
  return null;
}

export function numericOptionIndices(options: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < options.length; i++) if (parseNumericOption(options[i]) !== null) out.push(i);
  return out;
}

export function matchingOptionIndices(value: number, options: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < options.length; i++) {
    const n = parseNumericOption(options[i]);
    if (n !== null && valuesClose(value, n)) out.push(i);
  }
  return out;
}

export type EquationSolution = {
  variable: string;
  roots: number[];
  degree: number;
  /** True when the equation is an identity (infinitely many solutions). */
  identity: boolean;
  /** True when there is genuinely no solution. */
  none: boolean;
};

export function solveEquation(input: string): EquationSolution | null {
  const s = prepareMathExpression(input);
  const parts = s.split("=");
  if (parts.length !== 2) return null;
  const ids = new Set<string>();
  for (const m of s.matchAll(/[a-zA-Z]+/g)) {
    const name = m[0].toLowerCase();
    if (!["pi", "e", "sqrt", "cbrt", "abs", "sin", "cos", "tan", "cot", "sec", "cosec", "log", "ln", "exp", "floor", "ceil", "round", "fact"].includes(name)) ids.add(m[0]);
  }
  const variables = [...ids];
  if (variables.length !== 1) return null;
  const variable = variables[0];
  const left = parsePolynomial(parts[0], variable);
  const right = parsePolynomial(parts[1], variable);
  if (!left || !right) return null;
  const diff = polySub(left, right);
  const degree = diff.length - 1;
  if (degree < 0 || degree > 2) return null;
  if (diff.every((v) => Math.abs(v) < EPS)) return { variable, roots: [], degree: 0, identity: true, none: false };
  if (degree === 0) return { variable, roots: [], degree: 0, identity: false, none: true };
  if (degree === 1) {
    const root = -diff[0] / diff[1];
    return { variable, roots: [root], degree: 1, identity: false, none: false };
  }
  const a = diff[2];
  const b = diff[1];
  const c = diff[0];
  const disc = b * b - 4 * a * c;
  if (disc < -EPS) return { variable, roots: [], degree: 2, identity: false, none: true };
  if (Math.abs(disc) <= EPS) return { variable, roots: [-b / (2 * a)], degree: 2, identity: false, none: false };
  const r = Math.sqrt(disc);
  return { variable, roots: [(-b - r) / (2 * a), (-b + r) / (2 * a)], degree: 2, identity: false, none: false };
}

// ---------------------------------------------------------------------------
// Explanation arithmetic

type EqualityCheck = {
  left: string;
  right: string;
  ok: boolean | null;
  leftValue: number | null;
  rightValue: number | null;
  variable: string | null;
  /** True when the equation still contains a symbol (x, r, ...) after known constants are removed. */
  symbolic: boolean;
};

function hasSymbolicLetter(expr: string): boolean {
  const stripped = expr
    .replace(/\b(?:pi|e|sqrt|cbrt|abs|sin|cos|tan|cot|sec|csc|cosec|log|ln|exp|floor|ceil|round|fact)\b/gi, " ")
    .replace(/[^a-zA-Z]/g, "");
  return stripped.length > 0;
}

function cleanSide(side: string): string {
  let s = side
    .replace(/^[\s,;:]+|[\s,;:.]+$/g, "")
    .replace(/^(?:thus|therefore|hence|so|then|and|or|we get|we have|we obtain|gives|is|are|now|next|finally)\s*,?\s*/i, "")
    .replace(/^(?:step\s*\d+[.):]?|eq(?:uation)?\s*\d+[.):]?)\s*/i, "")
    .replace(/^(?:\(?[ivx]+\)?|\d+[.)])\s+/i, "")
    .trim();
  // "Thus, x" -> "x"; "The answer is x" -> "x".
  const lastWord = s.match(/(?:^|\s)([a-zA-Z][a-zA-Z0-9_]*)\s*$/);
  if (lastWord && /^(?:answer|value|result|solution)$/i.test(s.slice(0, lastWord.index).trim())) {
    s = lastWord[1];
  }
  return s;
}

function extractEqualityChunks(text: string): string[] {
  const chunks: string[] = [];
  for (const span of mathSpans(text)) {
    for (const part of span.split(/\\implies|\\Rightarrow|\\rightarrow|=>|\\therefore|\\because/)) {
      if (part.trim()) chunks.push(part.trim());
    }
  }
  for (const chunk of sentenceChunks(stripMathDelimiters(text))) {
    if (chunk.includes("=")) {
      for (const part of chunk.split(/\\implies|\\Rightarrow|\\rightarrow|=>|\\therefore|\\because/)) {
        if (part.trim()) chunks.push(part.trim());
      }
    }
  }
  return chunks;
}

function checkEquality(text: string, vars: VarMap): EqualityCheck | null {
  const s = text.replace(/\\le|\\ge|\\ne|\\approx|\\sim|≤|≥|≠|≈/g, " ");
  if (!s.includes("=") || s.includes("==")) return null;
  const pieces = s.split("=");
  if (pieces.length < 2 || pieces.length > 4) return null;
  const left = cleanSide(pieces[0]);
  const right = cleanSide(pieces[1]);
  if (!left || !right) return null;
  // A variable assignment like x = 2 is recorded for later checks.
  const leftSingle = /^([a-zA-Z][a-zA-Z0-9_]*)$/.exec(left)?.[1] ?? null;
  const rightSingle = /^([a-zA-Z][a-zA-Z0-9_]*)$/.exec(right)?.[1] ?? null;
  const leftValue = evaluateWithVars(left, vars);
  const rightValue = evaluateWithVars(right, vars);
  const symbolic = hasSymbolicLetter(left) || hasSymbolicLetter(right);
  let ok: boolean | null = null;
  let variable: string | null = null;
  // An explicit `x = 2` line is an assignment, even if x had a value from an
  // earlier case split (parabola/tangent explanations commonly do this).
  if (leftSingle && rightValue !== null) {
    vars[leftSingle] = rightValue;
    variable = leftSingle;
    ok = null;
  } else if (rightSingle && leftValue !== null) {
    vars[rightSingle] = leftValue;
    variable = rightSingle;
    ok = null;
  } else if (leftValue !== null && rightValue !== null) {
    ok = valuesClose(leftValue, rightValue, 0.02);
  }
  return { left, right, ok, leftValue, rightValue, variable, symbolic };
}

function evaluateWithVars(expr: string, vars: VarMap): number | null {
  const p = parsePolynomial(expr, null, vars);
  if (!p || !isConst(p)) return null;
  return constValue(p);
}

export type ExplanationArithmetic = {
  checks: EqualityCheck[];
  errors: Array<{ left: string; right: string; leftValue: number; rightValue: number }>;
  /** Final numeric value found in an explicit result line, if any. */
  finalValue: number | null;
  /** Option letter explicitly claimed correct, if any. */
  claimedOption: number | null;
};

export function inspectExplanationArithmetic(explanation: string): ExplanationArithmetic {
  const vars: VarMap = {};
  const checks: EqualityCheck[] = [];
  const errors: ExplanationArithmetic["errors"] = [];
  const chunks = extractEqualityChunks(explanation);
  let finalValue: number | null = null;
  for (const chunk of chunks) {
    // Check every adjacent "=" pair on a chain (a = b = c).
    const pieces = chunk.split("=");
    for (let i = 0; i + 1 < pieces.length; i++) {
      const pair = `${pieces[i]}=${pieces[i + 1]}`;
      const check = checkEquality(pair, vars);
      if (!check) continue;
      checks.push(check);
      // Substituted variables are common in case splits (x_0 is 11/5 in one case
      // and 1 in the next). Do not call those contradictions critical; only
      // pure numeric calculations are unambiguous.
      if (!check.symbolic && check.ok === false && check.leftValue !== null && check.rightValue !== null) {
        errors.push({
          left: check.left,
          right: check.right,
          leftValue: check.leftValue,
          rightValue: check.rightValue,
        });
      }
    }
  }
  const lastCheck = checks.at(-1);
  if (lastCheck && !lastCheck.symbolic && !lastCheck.variable && lastCheck.rightValue !== null) {
    finalValue = lastCheck.rightValue;
  }

  let claimedOption: number | null = null;
  const claimPatterns = [
    /option\s+([A-E])\s+is\s+(?:the\s+)?(?:correct|right|answer)/gi,
    /(?:correct|right)\s+(?:answer|option|choice)\s*(?:is|:)?\s*(?:option\s+)?([A-E])\b/gi,
    /(?:answer|choice)\s+is\s+(?:option\s+)?([A-E])\b/gi,
    /(?:thus|therefore|hence|so)[,:\s]+(?:the\s+)?(?:answer|option|choice)\s*(?:is|:)?\s*(?:option\s+)?([A-E])\b/gi,
  ];
  for (const re of claimPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(explanation)) !== null) claimedOption = m[1].toUpperCase().charCodeAt(0) - 65;
  }

  return { checks, errors, finalValue, claimedOption };
}

// ---------------------------------------------------------------------------
// Question-level verification

export type MathCheck = {
  computedAnswer: number | null;
  deterministicVerified: boolean;
  findings: QaFinding[];
};

function addMismatch(findings: QaFinding[], computed: number, stored: number, options: string[], source: string): void {
  findings.push(
    finding({
      code: "MATH_ANSWER_MISMATCH",
      category: "answer",
      severity: "critical",
      field: "answer",
      message: `Independent ${source} gives option ${String.fromCharCode(65 + computed)}, but the stored key is option ${String.fromCharCode(65 + stored)}.`,
      suggestion: `Review the calculation. The deterministic result is "${options[computed] ?? ""}".`,
      evidence: `computed=${options[computed] ?? computed}, stored=${options[stored] ?? stored}`,
      validator: "math",
    })
  );
}

function directArithmetic(stem: string): number | null {
  const raw = stripMathDelimiters(stem).replace(/\s+/g, " ").trim();
  const candidates: string[] = [];
  const asks = /(?:what\s+is|evaluate|simplify|calculate|compute|find\s+the\s+value\s+of|value\s+of)\s*[:]?\s*([0-9().+\-*/^%√×÷\s,]+?)(?:\?|\.|$)/i.exec(raw);
  if (asks) candidates.push(asks[1]);
  // A stem that is essentially one expression, optionally ending in "= ?".
  const bare = raw.replace(/[?=]\s*$/, "").trim();
  if (/^[0-9().+\-*/^%√×÷\s,]+$/.test(bare) && /[+\-*/^×÷]/.test(bare)) candidates.push(bare);
  for (const c of candidates) {
    const cleaned = c.replace(/,(\d{3}\b)/g, "$1").trim();
    if (!/[+\-*/^×÷]/.test(cleaned)) continue;
    const value = evaluateExpression(cleaned);
    if (value !== null) return value;
  }
  return null;
}

function equationFromStem(stem: string, targetVariable: string | null): EquationSolution | null {
  const candidates: string[] = [];
  for (const span of mathSpans(stem)) if (span.includes("=")) candidates.push(span);
  for (const chunk of sentenceChunks(stripMathDelimiters(stem))) if (chunk.includes("=")) candidates.push(chunk);
  for (const candidate of candidates) {
    const solution = solveEquation(candidate);
    if (!solution) continue;
    if (targetVariable && solution.variable.toLowerCase() !== targetVariable.toLowerCase()) continue;
    return solution;
  }
  return null;
}

function targetVariable(stem: string): string | null {
  const text = stripMathDelimiters(stem).replace(/\s+/g, " ");
  const patterns = [
    /(?:find|solve\s+for)\s+(?:the\s+value\s+of\s+)?([a-zA-Z])\b/i,
    /value\s+of\s+([a-zA-Z])\b(?!\s*[+\-*/^])/i,
    /what\s+is\s+([a-zA-Z])\s*[?.]/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[1];
  }
  return null;
}

export function verifyMathQuestion(
  stem: string,
  options: string[],
  storedAnswer: number,
  explanation: string
): MathCheck {
  const findings: QaFinding[] = [];
  let computedAnswer: number | null = null;
  let verified = false;

  // 1. Direct arithmetic ("What is 12 × 15?").
  const direct = directArithmetic(stem);
  if (direct !== null) {
    const matches = matchingOptionIndices(direct, options);
    if (matches.length === 1) {
      computedAnswer = matches[0];
      verified = true;
      if (matches[0] !== storedAnswer) addMismatch(findings, matches[0], storedAnswer, options, "arithmetic evaluation");
    } else if (matches.length > 1) {
      findings.push(
        finding({
          code: "MATH_MULTIPLE_NUMERIC_OPTIONS",
          category: "options",
          severity: "critical",
          field: "options",
          message: "Multiple options are numerically equal to the computed answer.",
          suggestion: "Remove or correct the duplicate-valued options so exactly one answer is correct.",
          evidence: `computed=${direct}; matching options=${matches.map((i) => String.fromCharCode(65 + i)).join(", ")}`,
          validator: "math",
        })
      );
    } else if (matches.length === 0) {
      findings.push(
        finding({
          code: "MATH_ANSWER_NOT_IN_OPTIONS",
          category: "answer",
          severity: "critical",
          field: "options",
          message: `The computed value ${direct} does not match any numeric option.`,
          suggestion: "Recheck the options or the calculation.",
          evidence: `computed=${direct}`,
          validator: "math",
        })
      );
    }
  }

  // 2. One-variable equation with an explicitly requested variable.
  const requested = targetVariable(stem);
  if (!verified && requested) {
    const solution = equationFromStem(stem, requested);
    if (solution && !solution.identity && !solution.none) {
      const matching = [...new Set(solution.roots.flatMap((r) => matchingOptionIndices(r, options)))];
      if (matching.length === 1) {
        computedAnswer = matching[0];
        verified = true;
        if (matching[0] !== storedAnswer) addMismatch(findings, matching[0], storedAnswer, options, "equation solution");
      } else if (matching.length > 1) {
        findings.push(
          finding({
            code: "MATH_MULTIPLE_ROOTS_IN_OPTIONS",
            category: "answer",
            severity: "critical",
            field: "options",
            message: `The equation has multiple roots that all appear as options (${matching.map((i) => String.fromCharCode(65 + i)).join(", ")}), so the question is ambiguous unless it asks for all roots.`,
            suggestion: "Ask for a specific root, restrict the domain, or make the options distinguish the requested result.",
            validator: "math",
          })
        );
      } else if (solution.roots.length > 0 && numericOptionIndices(options).length >= 2) {
        findings.push(
          finding({
            code: "MATH_ROOT_NOT_IN_OPTIONS",
            category: "answer",
            severity: "critical",
            field: "options",
            message: `The equation solution (${solution.roots.map((r) => Number(r.toFixed(6))).join(", ")}) does not match any numeric option.`,
            suggestion: "Recheck the equation and the options.",
            validator: "math",
          })
        );
      }
    }
  }

  // 3. Explanation arithmetic and final-value consistency.
  const arithmetic = inspectExplanationArithmetic(explanation);
  for (const err of arithmetic.errors.slice(0, 8)) {
    findings.push(
      finding({
        code: "MATH_EXPLANATION_ARITHMETIC",
        category: "explanation",
        severity: "critical",
        field: "explanation",
        message: `The explanation contains an arithmetic contradiction: ${err.left} = ${err.right} (${err.leftValue} vs ${err.rightValue}).`,
        suggestion: "Correct the calculation in the explanation or the preceding step.",
        evidence: `${err.left} = ${err.right}`,
        validator: "math",
      })
    );
  }

  if (arithmetic.claimedOption !== null && arithmetic.claimedOption !== storedAnswer) {
    findings.push(
      finding({
        code: "MATH_EXPLANATION_ANSWER_MISMATCH",
        category: "explanation",
        severity: "critical",
        field: "explanation",
        message: `The explanation explicitly claims option ${String.fromCharCode(65 + arithmetic.claimedOption)}, but the stored key is option ${String.fromCharCode(65 + storedAnswer)}.`,
        suggestion: "Make the key and the final explanation sentence agree, then re-verify the calculation.",
        validator: "math",
      })
    );
  }

  const numeric = numericOptionIndices(options);
  if (numeric.length >= 2 && arithmetic.finalValue !== null) {
    const matches = matchingOptionIndices(arithmetic.finalValue, options);
    if (matches.length === 1 && matches[0] !== storedAnswer) {
      findings.push(
        finding({
          code: "MATH_EXPLANATION_FINAL_VALUE",
          category: "explanation",
          severity: "critical",
          field: "explanation",
          message: `The explanation's final computed value (${arithmetic.finalValue}) corresponds to option ${String.fromCharCode(65 + matches[0])}, not the stored option ${String.fromCharCode(65 + storedAnswer)}.`,
          suggestion: "Check the final line of the explanation and the answer key.",
          evidence: `final=${arithmetic.finalValue}`,
          validator: "math",
        })
      );
    } else if (matches.length === 0 && arithmetic.finalValue === 0 && numeric.length >= 2) {
      // Zero is a common intermediate value ("0 = ..." from a subtraction);
      // do not flag it as a final answer.
    }
  }

  // 4. Stored answer should be numeric in a numeric-options question.
  if (numeric.length >= 2) {
    const storedNumeric = parseNumericOption(options[storedAnswer] ?? "");
    if (storedNumeric === null) {
      findings.push(
        finding({
          code: "MATH_STORED_ANSWER_NOT_NUMERIC",
          category: "answer",
          severity: "warning",
          field: "answer",
          message: "Most options are numeric, but the stored correct option is not.",
          suggestion: "Confirm the key points to the intended numeric option.",
          validator: "math",
        })
      );
    }
  }

  // 5. Mixed units are a common source of ambiguity.
  const stemUnits = new Set((stem.match(/\b(?:cm|mm|km|m|kg|g|mg|litre|liter|ml|seconds?|minutes?|hours?)\b/gi) ?? []).map((s) => s.toLowerCase()));
  if (stemUnits.size > 1 && options.some((o) => /\b(?:cm|mm|km|m|kg|g|mg|litre|liter|ml)\b/i.test(o))) {
    findings.push(
      finding({
        code: "MATH_MIXED_UNITS",
        category: "mathematics",
        severity: "warning",
        field: "options",
        message: "The stem contains more than one unit and the options also carry units; check that every option is in the requested unit.",
        suggestion: "State the requested unit explicitly and keep all options in that unit.",
        validator: "math",
        confidence: "medium",
        deterministic: false,
      })
    );
  }

  if (!verified) {
    if (!explanation.trim()) {
      findings.push(
        finding({
          code: "MATH_UNVERIFIED_NO_EXPLANATION",
          category: "mathematics",
          severity: "review",
          field: "answer",
          message: "No deterministic solver could independently verify this mathematical answer, and there is no explanation to check.",
          suggestion: "Add a calculation/explanation, or review the answer manually.",
          validator: "math",
          confidence: "low",
          deterministic: false,
        })
      );
    } else {
      findings.push(
        finding({
          code: "MATH_UNVERIFIED",
          category: "mathematics",
          severity: "warning",
          field: "answer",
          message: "The answer key was not independently verified by a deterministic solver (the question form is outside the supported arithmetic/one-variable subset).",
          suggestion: "A manual review is recommended; only calculations present in the explanation were checked automatically.",
          validator: "math",
          confidence: "low",
          deterministic: false,
        })
      );
    }
  }

  return { computedAnswer, deterministicVerified: verified, findings };
}
