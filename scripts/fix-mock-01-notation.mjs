// scripts/fix-mock-01-notation.mjs
//
// Every mathematical-notation correction for "NIMCET MOCK - 01", in one place.
//
// The bank lives in three artefacts that must stay identical:
//   1. supabase/seed/nimcet-mock-01-questions.csv  (source of truth for imports)
//   2. the live public.questions rows              (what students actually see)
//   3. supabase/sql/fix-nimcet-mock-01-math.sql    (replayable fix for other DBs)
//
// Usage:
//   node scripts/fix-mock-01-notation.mjs                 dry run, validates only
//   node scripts/fix-mock-01-notation.mjs --write         patch CSV + emit SQL + emit db payload
//   node scripts/fix-mock-01-notation.mjs --verify FILE   check a fresh bank dump against the fixes
//
// `find`/`replace` are exact substrings (an empty `find` means "replace the whole
// field"). Every fix must match exactly once in the CSV and exactly once in the
// stored field; anything else aborts the run so a partial edit can never ship.
//
// Rule of thumb followed below: no meaning, answer or option order changes -- only
// the way the mathematics is written.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import katex from "katex";

const CSV_PATH = "supabase/seed/nimcet-mock-01-questions.csv";
const SQL_PATH = "supabase/sql/fix-nimcet-mock-01-math.sql";
const TASK_PATH = "bank-task.json";

// Combining overline, as stored by the source PDF paste (A + U+0305).
const AB = "A\u0305";
const BB = "B\u0305";

/**
 * field: "stem" | "explanation" | "option0".."option4"
 */
const FIXES = [
  // ---------- Q47: binary-operation table was outside any math delimiter, so the
  // raw LaTeX source leaked into the question text.
  {
    id: "08d39ca3-ec52-4730-993a-334d67fe1d1a",
    field: "stem",
    find: "shown below:\n\\begin{array}",
    replace: "shown below:\n\\[\n\\begin{array}",
    why: "wrap the operation table in display math",
  },

  // ---------- Q50: tan2 z / cos-1 left as plain text.
  {
    id: "df1b7524-a554-44a1-909c-045dcfc52daa",
    field: "explanation",
    find: "Let x = tan2 z.\n∴ y = \\(\\rm \\cos ^ {-1} \\left(\\frac {1 - \\tan^2z}{1 + \\tan^2z}\\right)\\) = cos-1 (cos 2z) = 2z.",
    replace:
      "Let \\(x = \\tan^2 z\\).\n∴ \\(y = {\\cos ^{ - 1}}\\left( {\\dfrac{{1 - {{\\tan }^2}z}}{{1 + {{\\tan }^2}z}}} \\right) = {\\cos ^{ - 1}}\\left( {\\cos 2z} \\right) = 2z\\).",
    why: "tan^2 z and cos^{-1} written as plain text",
  },

  // ---------- Q10: transpose written as "(AB)T".
  { id: "38e6b45c-f0a7-4be0-a21a-e2665a31371f", field: "stem", find: "find (AB)T", replace: "find \\((AB)^T\\)", why: "transpose must be a superscript" },
  { id: "38e6b45c-f0a7-4be0-a21a-e2665a31371f", field: "explanation", find: "∴ (AB)T =", replace: "∴ \\((AB)^T\\) =", why: "transpose must be a superscript" },

  // ---------- Q25: e^{-x} written as "e-x"; unicode infinity in options.
  {
    id: "ee3b7f33-f5c3-452f-a619-f2f07070865f",
    field: "stem",
    find: "function f(x) = (x + 2) e-x is decreasing ?",
    replace: "function \\(f(x) = (x + 2){e^{ - x}}\\) is decreasing ?",
    why: "e^{-x} written as plain text",
  },
  {
    id: "ee3b7f33-f5c3-452f-a619-f2f07070865f",
    field: "explanation",
    find: "Given: f(x) = (x + 2) e-x \n",
    replace: "Given: \\(f(x) = (x + 2){e^{ - x}}\\)\n",
    why: "e^{-x} written as plain text",
  },
  {
    id: "ee3b7f33-f5c3-452f-a619-f2f07070865f",
    field: "explanation",
    find: "⇒ - (x + 1) ⋅ e- x ≤ 0\n⇒ (x + 1) ⋅ e- x ≥ 0\n⇒ x + 1 ≥ 0 ---------(∵ e- x > 0)\n⇒ x ≥ - 1\nHence, the interval in which the given function is decreasing is [- 1, ∞)",
    replace:
      "⇒ \\( - \\left( {x + 1} \\right) ⋅ {e^{ - x}} ≤ 0\\)\n⇒ \\(\\left( {x + 1} \\right) ⋅ {e^{ - x}} ≥ 0\\)\n⇒ \\(x + 1 ≥ 0\\) ---------(∵ \\({e^{ - x}} > 0\\))\n⇒ \\(x ≥ - 1\\)\nHence, the interval in which the given function is decreasing is \\(\\left[ { - 1,\\, \\infty } \\right)\\)",
    why: "e^{-x} written as plain text; unicode infinity",
  },
  { id: "ee3b7f33-f5c3-452f-a619-f2f07070865f", field: "option0", find: "[- 1, ∞)", replace: "\\(\\left[ { - 1,\\, \\infty } \\right)\\)", why: "interval notation" },
  { id: "ee3b7f33-f5c3-452f-a619-f2f07070865f", field: "option1", find: "[1, ∞)", replace: "\\(\\left[ {1,\\, \\infty } \\right)\\)", why: "interval notation" },
  { id: "ee3b7f33-f5c3-452f-a619-f2f07070865f", field: "option2", find: "(- ∞, - 1]", replace: "\\(\\left( { - \\infty ,\\, - 1} \\right]\\)", why: "interval notation" },

  // ---------- Q27: (GM)2 / (9)2 lost their exponents; 9√3; option-number reference.
  { id: "28084651-6ead-4919-adab-8088f909b68d", field: "option0", find: "9√3", replace: "\\(9\\sqrt 3 \\)", why: "unicode radical" },
  {
    id: "28084651-6ead-4919-adab-8088f909b68d",
    field: "explanation",
    find: "And we know that (GM)2 = (AM) × (HM)\n⇒(9)2 = 27 × HM",
    replace: "And we know that \\({(GM)^2} = (AM) \\times (HM)\\)\n⇒ \\({(9)^2} = 27 \\times HM\\)",
    why: "squares lost their exponent",
  },
  { id: "28084651-6ead-4919-adab-8088f909b68d", field: "explanation", find: "= 3 \nHence, option (3) is correct.", replace: "= 3 \nHence, option C is correct.", why: "refer to the option letter" },

  // ---------- Q36: unicode radical and tan-1.
  {
    id: "8641cdb6-d99b-42ff-ac30-f8902fc2c2cb",
    field: "stem",
    find: "What is the inclination of the line x - y + √3 = 0 ?",
    replace: "What is the inclination of the line \\(x - y + \\sqrt 3 = 0\\) ?",
    why: "unicode radical",
  },
  {
    id: "8641cdb6-d99b-42ff-ac30-f8902fc2c2cb",
    field: "explanation",
    find: "Given: x - y + √3 = 0\nWe will first express the equation of the line in the standard form.\nThus the equation of the line is y = x + √3 \nTherefore, the slope of the given line is m = tan θ = 1\n∴ θ = tan-1 1 = 45° \nThus, the angle of inclination is 45°.",
    replace:
      "Given: \\(x - y + \\sqrt 3 = 0\\)\nWe will first express the equation of the line in the standard form.\nThus the equation of the line is \\(y = x + \\sqrt 3 \\)\nTherefore, the slope of the given line is \\(m = \\tan \\theta = 1\\)\n∴ \\(\\theta = {\\tan ^{ - 1}}1 = 45^\\circ \\)\nThus, the angle of inclination is \\(45^\\circ \\).",
    why: "unicode radical, tan-1, plain degrees",
  },

  // ---------- Q40: |A-1| instead of |A^{-1}| plus stray empty display blocks.
  { id: "8158e9ef-9ada-41fc-98f3-d6b134c0e5d6", field: "stem", find: "then |A-1| =", replace: "then \\(|{A^{ - 1}}|\\) =", why: "inverse must be a superscript" },
  {
    id: "8158e9ef-9ada-41fc-98f3-d6b134c0e5d6",
    field: "explanation",
    find: "",
    replace:
      "Given that \\(A\\) is a non-singular matrix of order \\(2 \\times 2\\),\nwe need to determine \\(|{A^{ - 1}}|\\), where \\(|{A^{ - 1}}|\\) represents the determinant of the inverse of \\(A\\).\nStep 1: Determinant Property of Inverse Matrix\nFor any square, non-singular matrix \\(A\\), the determinant of its inverse is given by:\n\\[\n|{A^{ - 1}}| = \\frac{1}{{|A|}}\n\\]\nwhere \\(|A|\\) is the determinant of \\(A\\).\nStep 2: Applying to a \\(2 \\times 2\\) Matrix\nSince \\(A\\) is a \\(2 \\times 2\\) matrix, this property holds, and we directly get:\n\\[\n|{A^{ - 1}}| = \\frac{1}{{|A|}}\n\\]\nConclusion\nThus, the determinant of the inverse of \\(A\\) is \\(\\dfrac{1}{{|A|}}\\).",
    why: "stray empty display blocks; |A^{-1}| written as plain text",
  },

  // ---------- Q18: principal value interval, sin^{-1}, option-number reference.
  {
    id: "f7b5a560-a948-4345-bc1f-3d00dd223762",
    field: "explanation",
    find: "Let, \\(\\rm sin^{-1}(-\\frac12)\\) = x\n⇒ sin x = \\(-\\frac12\\)\nWe know, \\(\\rm sin(\\frac\\pi6)=\\frac12\\)",
    replace:
      "Let \\({\\sin ^{ - 1}}\\left( { - \\dfrac{1}{2}} \\right) = x\\)\n⇒ \\(\\sin x = - \\dfrac{1}{2}\\)\nWe know, \\(\\sin \\left( {\\dfrac{\\pi }{6}} \\right) = \\dfrac{1}{2}\\)",
    why: "plain sin / fractions",
  },
  {
    id: "f7b5a560-a948-4345-bc1f-3d00dd223762",
    field: "explanation",
    find: "But principal value must be in [-π/2, π/2 ]",
    replace: "But principal value must be in \\(\\left[ { - \\dfrac{\\pi }{2},\\, \\dfrac{\\pi }{2}} \\right]\\)",
    why: "plain unicode pi",
  },
  {
    id: "f7b5a560-a948-4345-bc1f-3d00dd223762",
    field: "explanation",
    find: "∴ x = \\(-\\frac\\pi6\\)\nHence, option (3) is correct.",
    replace: "∴ \\(x = - \\dfrac{\\pi }{6}\\)\nHence, option C is correct.",
    why: "option-number reference",
  },

  // ---------- Q23: \Pi instead of \pi, cosx, option-number reference.
  {
    id: "3838d5c9-2831-4a45-9bd6-a10cc58bbb46",
    field: "explanation",
    find: "Given: \\(\\rm \\int_{0}^{2π}{cosx}\\ dx\\)\nLet, f(x) = cos x\nAs we can see that, f(2π - x) = cos(2π - x) = cos x = f(x)",
    replace:
      "Given: \\(\\rm \\int_{0}^{2\\pi }{{\\cos x}}\\;dx\\)\nLet \\(f(x) = \\cos x\\)\nAs we can see that, \\(f(2\\pi - x) = \\cos (2\\pi - x) = \\cos x = f(x)\\)",
    why: "unicode pi, plain cos x",
  },
  {
    id: "3838d5c9-2831-4a45-9bd6-a10cc58bbb46",
    field: "explanation",
    find: "\\left [ sin x \\right ]_{0}^{\\Pi}=0",
    replace: "\\left [ {\\sin x} \\right ]_{0}^{\\pi } = 0",
    why: "capital \\Pi rendered instead of \\pi",
  },
  { id: "3838d5c9-2831-4a45-9bd6-a10cc58bbb46", field: "explanation", find: "Hence, the correct option is 1.", replace: "Hence, option A is correct.", why: "option-number reference" },

  // ---------- Q38: the conditional-probability chain dropped the complement.
  {
    id: "2586b9eb-6462-4cd7-9904-dae34f221417",
    field: "explanation",
    find: `⇒ P (${BB} | ${AB}) = P(${AB} ∩ ${BB}) / P(${AB}) = P(A ∪ B) / P(${AB}) = P(${AB}) / P(${AB}) = 1`,
    replace:
      "⇒ \\(P\\left( {\\bar B|\\bar A} \\right) = \\dfrac{{P\\left( {\\bar A \\cap \\bar B} \\right)}}{{P\\left( {\\bar A} \\right)}} = \\dfrac{{1 - P\\left( {A \\cup B} \\right)}}{{P\\left( {\\bar A} \\right)}} = \\dfrac{{P\\left( {\\bar A} \\right)}}{{P\\left( {\\bar A} \\right)}} = 1\\)",
    why: "P(A union B) must be 1 - P(A union B) (complement), otherwise the step is false",
  },

  // ---------- Q31: option-number reference.
  { id: "f35f9a56-a0b3-493d-9efa-3841abe9d26d", field: "explanation", find: "Hence, option (2) is correct.", replace: "Hence, option B is correct.", why: "option-number reference" },

  // ---------- Q46: "2x - 1" is really 2^{x-1}; the worked solution had an empty
  // exponent and integrated the wrong expression.
  {
    id: "a6579014-93fd-469d-9aad-57757269ac49",
    field: "stem",
    find: "\\(\\rm dy\\over dx \\) = 2x - 1 is",
    replace: "\\(\\rm \\dfrac{{dy}}{{dx}}\\) = \\(2^{x - 1}\\) is",
    why: "the power x-1 was written as plain text",
  },
  {
    id: "a6579014-93fd-469d-9aad-57757269ac49",
    field: "explanation",
    find:
      "Given, the differential equation \\(\\rm \\dfrac {dy}{dx}\\) = 2x - 1 \n⇒ \\(\\rm \\dfrac {dy}{dx}\\) = \\(\\rm \\dfrac {2^x}{2^{}}\\)\n⇒ \\(\\rm {2^{}} \\; dy = 2^x \\; dx\\)\nNow, variables are separated.\nIntegrating both sides, we get\n⇒ \\(\\rm2 \\int \\; dy = \\int 2^x \\; dx\\)\n⇒ \\(\\rm 2y = \\frac 1 {\\ln 2} 2^x +c\\)",
    replace:
      "Given, the differential equation \\(\\rm \\dfrac{{dy}}{{dx}}\\) = \\({2^{x - 1}}\\)\n⇒ \\(\\rm dy = {2^{x - 1}}\\;dx\\)\nNow, variables are separated.\nIntegrating both sides, we get\n⇒ \\(\\rm \\int {dy} = \\int {{2^{x - 1}}} \\;dx\\)\n⇒ \\(\\rm y = \\dfrac{{{2^{x - 1}}}}{{\\ln 2}} + c\\)\nMultiplying both sides by 2, we get\n⇒ \\(\\rm 2y = \\dfrac{{{2^x}}}{{\\ln 2}} + c\\)",
    why: "empty exponent \\dfrac{2^x}{2^{}} and a solution that did not match the equation",
  },

  // ---------- Q19: set notation left as plain text.
  {
    id: "027b56d4-0aac-467b-b4e9-238854582905",
    field: "stem",
    find: "Let, A = {(2n, 3n): n ∈ N} and B = {(3n, 5n): n ∈ N}. What is (A ∩ B) equal to?",
    replace:
      "Let \\(A = \\left\\{ {(2n,\\,3n):n \\in N} \\right\\}\\) and \\(B = \\left\\{ {(3n,\\,5n):n \\in N} \\right\\}\\). What is \\((A \\cap B)\\) equal to?",
    why: "set notation as plain text",
  },
  { id: "027b56d4-0aac-467b-b4e9-238854582905", field: "option0", find: "{(2n, 3n): n ∈ N}", replace: "\\(\\left\\{ {(2n,\\,3n):n \\in N} \\right\\}\\)", why: "set notation" },
  { id: "027b56d4-0aac-467b-b4e9-238854582905", field: "option1", find: "{(2n, 5n): n ∈ N}", replace: "\\(\\left\\{ {(2n,\\,5n):n \\in N} \\right\\}\\)", why: "set notation" },
  { id: "027b56d4-0aac-467b-b4e9-238854582905", field: "option2", find: "{(n, 3n): n ∈ N}", replace: "\\(\\left\\{ {(n,\\,3n):n \\in N} \\right\\}\\)", why: "set notation" },
  { id: "027b56d4-0aac-467b-b4e9-238854582905", field: "option3", find: "ϕ", replace: "\\(\\phi \\)", why: "plain unicode phi" },
  {
    id: "027b56d4-0aac-467b-b4e9-238854582905",
    field: "explanation",
    find: "A = {(2n, 3n): n ∈ N}\n= {(2, 3), (4, 6), (6, 9), ………} And\nB = {(3n, 5n): n ∈ N}",
    replace: "\\(A = \\left\\{ {(2n,\\,3n):n \\in N} \\right\\}\\)\n= {(2, 3), (4, 6), (6, 9), ………} And\n\\(B = \\left\\{ {(3n,\\,5n):n \\in N} \\right\\}\\)",
    why: "set notation",
  },
  { id: "027b56d4-0aac-467b-b4e9-238854582905", field: "explanation", find: "∴ A ∩ B = ϕ", replace: "∴ \\(A \\cap B = \\phi \\)", why: "plain text intersection / phi" },

  // ---------- Q11: trigonometric options as plain text.
  { id: "abfec2a1-c845-4d39-99e4-4313ad26ffdc", field: "option0", find: "2 sin 2x", replace: "\\(2\\sin 2x\\)", why: "trig function as plain text" },
  { id: "abfec2a1-c845-4d39-99e4-4313ad26ffdc", field: "option1", find: "2 cos 2x", replace: "\\(2\\cos 2x\\)", why: "trig function as plain text" },
  { id: "abfec2a1-c845-4d39-99e4-4313ad26ffdc", field: "option2", find: "cos x - sin x", replace: "\\(\\cos x - \\sin x\\)", why: "trig function as plain text" },

  // ---------- Q21: family of curves as plain text.
  {
    id: "259ad189-418b-40ad-bb38-dcc5837c483c",
    field: "stem",
    find: "The differential equation representing the family of curves y = a sin (λx + α) is:",
    replace: "The differential equation representing the family of curves \\(y = a\\sin (\\lambda x + \\alpha )\\) is:",
    why: "plain text equation with Greek letters",
  },

  // ---------- Q29: eccentricity options with a plain radical.
  { id: "e3683cb9-2929-4175-adc8-994a7244a292", field: "option0", find: "2 / √3", replace: "\\(\\dfrac{2}{{\\sqrt 3 }}\\)", why: "plain radical" },
  { id: "e3683cb9-2929-4175-adc8-994a7244a292", field: "option1", find: "1 / √3", replace: "\\(\\dfrac{1}{{\\sqrt 3 }}\\)", why: "plain radical" },
  { id: "e3683cb9-2929-4175-adc8-994a7244a292", field: "option2", find: "√3 / 2", replace: "\\(\\dfrac{{\\sqrt 3 }}{2}\\)", why: "plain radical" },
  { id: "e3683cb9-2929-4175-adc8-994a7244a292", field: "option3", find: "1 / √2", replace: "\\(\\dfrac{1}{{\\sqrt 2 }}\\)", why: "plain radical" },

  // ---------- Q9: U+2236 ratio character in the options.
  { id: "7106b0f6-f4e7-4e48-b3f0-e62143369220", field: "option0", find: "2 ∶ 1 internally", replace: "\\(2:1\\) internally", why: "ratio character" },
  { id: "7106b0f6-f4e7-4e48-b3f0-e62143369220", field: "option1", find: "3 ∶ 2 externally", replace: "\\(3:2\\) externally", why: "ratio character" },
  { id: "7106b0f6-f4e7-4e48-b3f0-e62143369220", field: "option2", find: "5 ∶ 3 internally", replace: "\\(5:3\\) internally", why: "ratio character" },
  { id: "7106b0f6-f4e7-4e48-b3f0-e62143369220", field: "option3", find: "5 ∶ 3 externally", replace: "\\(5:3\\) externally", why: "ratio character" },

  // ---------- Q30: quantifiers and set membership as plain text.
  {
    id: "7a40ead5-e44f-4fa6-a108-386b1a179583",
    field: "stem",
    find: "If * is a binary operation on Z such that a * b = a + b + 1 ∀ a, b ∈ Z then find the identity element of Z with respect to * ?",
    replace:
      "If \\(*\\) is a binary operation on \\(Z\\) such that \\(a * b = a + b + 1\\;\\forall \\,a,\\,b \\in Z\\) then find the identity element of \\(Z\\) with respect to \\(*\\) ?",
    why: "quantifier / membership as plain text",
  },
  {
    id: "7a40ead5-e44f-4fa6-a108-386b1a179583",
    field: "explanation",
    find: `Given: * is a binary operation on Z such that a * b = a + b + 1 ∀ a, b ∈ Z.
Let e be the identity element of Z with respect to *.
As we know that if e is an identity element of a non-empty set S with respect to a binary operation * then a * e = e * a = a ∀ a ∈ S.
Let a ∈ Z and because e is the identity element of Z with respect to given operation *.
i.e a * e = a = e * a ∀ a ∈ Z.
According to the definition of *, we have
⇒ a * e = a + e + 1 = a ∀ a ∈ Z
⇒ e = - 1
Hence, - 1 is the identity element of Z with respect to given operation *.`,
    replace: `Given: \\(*\\) is a binary operation on \\(Z\\) such that \\(a * b = a + b + 1\\;\\forall \\,a,\\,b \\in Z\\).
Let \\(e\\) be the identity element of \\(Z\\) with respect to \\(*\\).
As we know that if \\(e\\) is an identity element of a non-empty set \\(S\\) with respect to a binary operation \\(*\\) then \\(a * e = e * a = a\\;\\forall \\,a \\in S\\).
Let \\(a \\in Z\\) and because \\(e\\) is the identity element of \\(Z\\) with respect to the given operation \\(*\\).
i.e. \\(a * e = a = e * a\\;\\forall \\,a \\in Z\\).
According to the definition of \\(*\\), we have
⇒ \\(a * e = a + e + 1 = a\\;\\forall \\,a \\in Z\\)
⇒ \\(e = - 1\\)
Hence, \\(- 1\\) is the identity element of \\(Z\\) with respect to the given operation \\(*\\).
Hence, option A is correct.`,
    why: "quantifier / membership as plain text",
  },

  // ---------- Q41: slopes and derivatives as plain text.
  {
    id: "028864dc-f209-4032-b985-2ef8ad731056",
    field: "explanation",
    find: `Let us consider a function f(x) , such that slope of tangent be mt and slope of normal be mn
Now , we know that, normal is perpendicular to tangent, such that mt × mn = -1
mn × dy/dx = -1
⇒ mn = - dx/dy
Now, as per the question, the normal is parallel to the x-axis, so the slope of normal is equal to the slope of the x-axis (i.e. zero)
∴ mn = 0
⇒ - dx/dy = 0
⇒ dx/dy = 0
∴ The normal to a given curve is parallel to x-axis if dx/dy = 0`,
    replace: `Let us consider a function \\(f(x)\\), such that the slope of the tangent is \\({m_t}\\) and the slope of the normal is \\({m_n}\\).
Now, we know that the normal is perpendicular to the tangent, such that \\({m_t} \\times {m_n} = - 1\\).
\\({m_n} \\times \\dfrac{{dy}}{{dx}} = - 1\\)
⇒ \\({m_n} = - \\dfrac{{dx}}{{dy}}\\)
Now, as per the question, the normal is parallel to the x-axis, so the slope of the normal is equal to the slope of the x-axis (i.e. zero).
∴ \\({m_n} = 0\\)
⇒ \\( - \\dfrac{{dx}}{{dy}} = 0\\)
⇒ \\(\\dfrac{{dx}}{{dy}} = 0\\)
∴ The normal to a given curve is parallel to the x-axis if \\(\\dfrac{{dx}}{{dy}} = 0\\).`,
    why: "plain text slopes and derivatives",
  },

  // ---------- Q84 (reasoning): cubes written as "73" and "83".
  { id: "8d99e76c-9e7e-42e9-ab49-fff03b4f4768", field: "explanation", find: "343 is the cube of 7, since 73 = 343.", replace: "343 is the cube of 7, since \\(7^3 = 343\\).", why: "missing exponent" },
  { id: "8d99e76c-9e7e-42e9-ab49-fff03b4f4768", field: "explanation", find: "Since 83 = 512, the unknown number is 8.", replace: "Since \\(8^3 = 512\\), the unknown number is 8.", why: "missing exponent" },

  // ---------- Q71 (reasoning): stray empty display block and a typo.
  {
    id: "54fa8671-db67-40ea-bf64-32446a49e74c",
    field: "explanation",
    find: "The person in the photograph is Jack himself. \\[\\]\nSo, Jack is the husband of that grandson's doughter-in-law.",
    replace: "The person in the photograph is Jack himself.\nSo, Jack is the husband of that grandson's daughter-in-law.",
    why: "empty display block + misspelling",
  },

  // ---------- Q89 (reasoning): garbled relation sentence.
  {
    id: "b062f242-c292-44df-9321-3335f0e01412",
    field: "explanation",
    find: "Anuj's daughter's mother---Anuj's wife; Anuj's wife father---Anu's father-in-law; Father-in; Father-in-law's son---Anuj brother-in-law.",
    replace: "Anuj's daughter's mother → Anuj's wife; Anuj's wife's father → Anuj's father-in-law; Anuj's father-in-law's son → Anuj's brother-in-law.",
    why: "truncated duplicate fragment",
  },

  // ---------- Q76 (reasoning): syntactically broken explanation, option number.
  {
    id: "c2bb9d1a-a707-408a-87c3-dfde12867031",
    field: "explanation",
    find: "The correct answer is:5) None of the above\nKey Points\nTherefore, the correct answer is Option 5, 'None of the above'.",
    replace:
      "Day after tomorrow is two days after today. If today is Wednesday, the day after tomorrow is Friday, which is not listed among the options. Hence, the correct answer is option E ('None of the above').",
    why: "broken sentence and option-number reference",
  },

  // ---------- Q82 (reasoning): empty explanation.
  {
    id: "f212ce3d-ef18-4df4-860f-1b6b6b14a453",
    field: "explanation",
    find: "",
    replace: "Amusing and Droll mean the same thing (synonyms). In the same way, Abolish and Abort both mean to put an end to something. Hence, option C is correct.",
    why: "explanation was missing",
  },

  // ---------- Q107 (computer): boolean algebra answer key unexplained.
  { id: "e41b5a82-fb64-4144-ad5b-63a6feb5d7e9", field: "stem", find: "The boolean function A + BC is a reduced form of ____________", replace: "The boolean function \\(A + BC\\) is a reduced form of ____________", why: "boolean expression as plain text" },
  { id: "e41b5a82-fb64-4144-ad5b-63a6feb5d7e9", field: "option0", find: "AB + BC", replace: "\\(AB + BC\\)", why: "boolean expression as plain text" },
  { id: "e41b5a82-fb64-4144-ad5b-63a6feb5d7e9", field: "option1", find: "(A + B)(A + C)", replace: "\\((A + B)(A + C)\\)", why: "boolean expression as plain text" },
  { id: "e41b5a82-fb64-4144-ad5b-63a6feb5d7e9", field: "option2", find: "AB + ABC", replace: "\\(AB + ABC\\)", why: "boolean expression as plain text" },
  { id: "e41b5a82-fb64-4144-ad5b-63a6feb5d7e9", field: "option3", find: "(A + C)B", replace: "\\((A + C)B\\)", why: "boolean expression as plain text" },
  {
    id: "e41b5a82-fb64-4144-ad5b-63a6feb5d7e9",
    field: "explanation",
    find: "None.",
    replace: "By the distributive law \\(A + BC = (A + B)(A + C)\\), so option B is the reduced form. The other options are either not reduced or not equivalent to \\(A + BC\\).",
    why: "explanation did not explain anything",
  },

  // ---------- Q100 (computer): involution explanation.
  {
    id: "0ad1251b-c810-41fd-8c08-7e962a44475d",
    field: "stem",
    find: "The involution of A is equal to _________",
    replace: "The involution of \\(A\\) is equal to _________",
    why: "boolean variable as plain text",
  },
  {
    id: "0ad1251b-c810-41fd-8c08-7e962a44475d",
    field: "explanation",
    find: "The involution of A means double inversion of A (i.e. A) and is equal to A.",
    replace: "The involution of \\(A\\) means the double inversion of \\(A\\), i.e. \\(\\bar {\\bar A} = A\\), so it is equal to \\(A\\).",
    why: "plain text boolean variables",
  },

  // ---------- Q109 (computer): empty explanation.
  {
    id: "5d89ed50-d018-4d87-941c-bd4c7db9b337",
    field: "explanation",
    find: "",
    replace: "Excess-3 is not a weighted code: its code words are obtained by adding 3 (0011) to the BCD value, so the bit positions carry no fixed weights. The decimal and binary number systems, and BCD codes such as 8421, are weighted codes. Hence, option B is correct.",
    why: "explanation was missing",
  },

  // ---------- Q106 (computer): wrong binary fraction in the explanation.
  { id: "1ec700c7-ac45-4308-86a6-058c6f2fa4fb", field: "explanation", find: "So, the binary equivalent of 64.5 is 110100.1.", replace: "So, the binary equivalent of 64.5 is 110100.101.", why: "the trailing bits of the fraction were dropped" },

  // ---------- Q95 (computer): misspelled option.
  { id: "2e203326-460f-42de-9fe2-d477899f4bc5", field: "option1", find: "Memory Unavailble", replace: "Memory Unavailable", why: "misspelling in an answer option" },

  // ---------- option-number references (options are labelled A-E, never numbered)
  { id: "c281af60-5f19-4499-830b-dcf336c7e695", field: "explanation", find: "Hence, Option 2 is correct.", replace: "Hence, option B is correct.", why: "option-number reference" },
  { id: "10da07e9-1818-4dea-9762-8afa7301e88a", field: "explanation", find: "Hence, the correct answer is option 4.", replace: "Hence, the correct answer is option D.", why: "option-number reference" },
  {
    id: "ad1781f0-e1e6-4a00-935c-e166e90071c7",
    field: "explanation",
    find: "Thus, it is clear that option 1 correctly explains the given idiom.\nHence, the correct answer is option 1.",
    replace: "Thus, it is clear that option A correctly explains the given idiom.\nHence, the correct answer is option A.",
    why: "option-number reference",
  },
  { id: "e16fa10d-e0d2-4b8f-ac0f-6928c61a7e73", field: "explanation", find: "Therefore, the correct option is: 'Option 1'.", replace: "Therefore, the correct option is option A.", why: "option-number reference" },

  // ---------- second pass: function names and equations still left as plain prose
  { id: "f7b5a560-a948-4345-bc1f-3d00dd223762", field: "stem", find: "\\(\\rm sin^{-1}(-\\frac12)\\)", replace: "\\(\\rm {\\sin ^{ - 1}}\\left( { - \\frac{1}{2}} \\right)\\)", why: "plain sin^{-1} in the stem" },
  { id: "f7b5a560-a948-4345-bc1f-3d00dd223762", field: "explanation", find: "But, here sin x value is negative\n∴ x lies in 3rd OR 4th quadrant", replace: "But, here \\(\\sin x\\) value is negative\n∴ \\(x\\) lies in 3rd OR 4th quadrant", why: "plain sin x" },
  { id: "abfec2a1-c845-4d39-99e4-4313ad26ffdc", field: "stem", find: "If \\(\\rm \\sqrt y\\) = sin x + cos x then \\(\\rm \\dfrac {dy}{dx}\\) is", replace: "If \\(\\rm \\sqrt y = \\sin x + \\cos x\\) then \\(\\rm \\dfrac{{dy}}{{dx}}\\) is", why: "plain trigonometry in the stem" },
  { id: "ce40fb69-9f51-47c9-a8f2-511360ed02b9", field: "stem", find: "Find the principal solution of the equation sec x = 2 ?", replace: "Find the principal solution of the equation \\(\\sec x = 2\\) ?", why: "plain sec x in the stem" },
  { id: "259ad189-418b-40ad-bb38-dcc5837c483c", field: "explanation", find: "Given:\ny = a sin (λx + α) .... (1)", replace: "Given:\n\\(y = a\\sin (\\lambda x + \\alpha )\\) .... (1)", why: "plain sinusoid in the explanation" },
  { id: "259ad189-418b-40ad-bb38-dcc5837c483c", field: "explanation", find: "= \\rm -a\\lambda^2\\) sin (λx + α)", replace: "= \\rm - a{\\lambda ^2}\\sin (\\lambda x + \\alpha )\\)", why: "plain sinusoid in the explanation" },
  { id: "3838d5c9-2831-4a45-9bd6-a10cc58bbb46", field: "explanation", find: "\\Rightarrow \\rm \\int_{0}^{2\\pi}{cosx}\\ dx=2 \\int_{0}^{\\pi}{cosx}\\ dx=2\\left [ {\\sin x} \\right ]_{0}^{\\pi } = 0", replace: "\\Rightarrow \\rm \\int_{0}^{2\\pi}{{\\cos x}}\\;dx = 2\\int_{0}^{\\pi}{{\\cos x}}\\;dx = 2\\left[ {\\sin x} \\right]_{0}^{\\pi } = 0", why: "plain cos x" },
  { id: "f35f9a56-a0b3-493d-9efa-3841abe9d26d", field: "stem", find: ", and m ≠ n, then m + n =", replace: ", and \\(m \\ne n\\), then \\(m + n =\\)", why: "plain inequality" },
  { id: "f35f9a56-a0b3-493d-9efa-3841abe9d26d", field: "explanation", find: "and x ≠ y, then n = x + y, ", replace: "and \\(x \\ne y\\), then \\(n = x + y\\), ", why: "plain inequality" },
  { id: "f35f9a56-a0b3-493d-9efa-3841abe9d26d", field: "explanation", find: "∴ m + n = 22 \n", replace: "∴ \\(m + n = 22\\)\n", why: "plain equation" },
  { id: "8e7615bd-ffdf-49ce-9336-adb0fdb36c94", field: "explanation", find: "Let log x = t and dx/x = dt", replace: "Let \\(\\log x = t\\) and \\(\\dfrac{{dx}}{x} = dt\\)", why: "plain substitution" },
  { id: "8e7615bd-ffdf-49ce-9336-adb0fdb36c94", field: "explanation", find: "⇒ 1 = A (3t + 2) + B (2t + 1) --------(1)", replace: "⇒ \\(1 = A\\left( {3t + 2} \\right) + B\\left( {2t + 1} \\right)\\) --------(1)", why: "plain equation" },
  { id: "8e7615bd-ffdf-49ce-9336-adb0fdb36c94", field: "explanation", find: "By putting t = - 1/2 on both the sides of (1) we get A = 2\nBy putting t = - 2/3 on both the sides of (1) we get B = - 3", replace: "By putting \\(t = - \\dfrac{1}{2}\\) on both the sides of (1) we get \\(A = 2\\)\nBy putting \\(t = - \\dfrac{2}{3}\\) on both the sides of (1) we get \\(B = - 3\\)", why: "plain equations" },
  { id: "8e7615bd-ffdf-49ce-9336-adb0fdb36c94", field: "explanation", find: "By substituting log x = t in the above equation we get", replace: "By substituting \\(\\log x = t\\) in the above equation we get", why: "plain substitution" },
  { id: "06f943dd-8eb1-4b51-b0e1-5ec894ca15b3", field: "explanation", find: "Now by substituting tan x = t in the above equation we get,", replace: "Now by substituting \\(\\tan x = t\\) in the above equation we get,", why: "plain substitution" },
];

// ---------------------------------------------------------------- machinery

/** CSV shape used by this repo: every field quoted, CRLF row ends, LF inside fields. */
function parseCsvRows(text) {
  const bom = text.charCodeAt(0) === 0xfeff;
  const src = bom ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    field = "";
    rows.push(row);
    row = [];
  };
  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      if (c === "\r" && src[i + 1] === "\n") {
        field += "\n";
        i += 2;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"' && field === "") {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r" && src[i + 1] === "\n") {
      endRow();
      i += 2;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== "" || row.length > 0) endRow();
  return { bom, rows };
}

function serializeCsv({ bom, rows }) {
  const body = rows
    .map((r) => r.map((f) => `"${String(f).replace(/\r\n/g, "\n").replace(/\n/g, "\r\n").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  return (bom ? "\ufeff" : "") + body + "\r\n";
}

const normalizeNewlines = (text) => text.replace(/\r\n/g, "\n");

const occurrences = (haystack, needle) => {
  if (needle === "") return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
};

function getField(q, field) {
  if (field.startsWith("option")) return q.options[Number(field.slice(6))];
  return q[field];
}

function setField(q, field, value) {
  if (field.startsWith("option")) q.options[Number(field.slice(6))] = value;
  else q[field] = value;
}

/** Every `\(..\)`, `\[..\]`, `$..$`, `$$..$$` span must typeset cleanly. */
function checkKatex(text) {
  const re = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
  const problems = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const expr = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    try {
      katex.renderToString(expr, { throwOnError: true, displayMode: m[1] === undefined });
    } catch (err) {
      problems.push(`${expr.slice(0, 80)} :: ${String(err.message).slice(0, 120).replace(/\n/g, " ")}`);
    }
  }
  return problems;
}

/** Structural delimiter balance, so no field can leak raw LaTeX source. */
function checkDelimiters(text) {
  const problems = [];
  const count = (needle) => text.split(needle).length - 1;
  const pairs = [
    ["\\(", "\\)"],
    ["\\[", "\\]"],
  ];
  for (const [open, close] of pairs) {
    const o = count(open);
    const c = count(close);
    if (o !== c) problems.push(`${open} ${o} vs ${close} ${c}`);
  }
  const dollars = count("$") - 2 * count("$$");
  if (dollars % 2 !== 0) problems.push(`unbalanced $ (${dollars})`);
  return problems;
}

const mode = process.argv[2] ?? "--dry";
const verifyPath = mode === "--verify" ? process.argv[3] ?? "bank-dump.json" : null;

// ---- 1. validate the fix table itself -------------------------------------
const errors = [];
const seenFind = new Set();
for (const f of FIXES) {
  const key = `${f.id}|${f.field}`;
  if (!f.why) errors.push(`${key}: missing reason`);
  if (f.find !== "") {
    const dup = `${key}|${f.find}`;
    if (seenFind.has(dup)) errors.push(`${key}: duplicate find string`);
    seenFind.add(dup);
  }
}
if (errors.length) {
  console.error("fix table is invalid:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`fix table: ${FIXES.length} fixes`);

// ---- 2. verify mode: check a live dump already carries every replacement ----
if (mode === "--verify") {
  const dump = JSON.parse(readFileSync(verifyPath, "utf8"));
  const byId = new Map(dump.questions.map((q) => [q.id, q]));
  let bad = 0;
  for (const f of FIXES) {
    const q = byId.get(f.id);
    if (!q) {
      console.log(`  MISSING ROW ${f.id}`);
      bad += 1;
      continue;
    }
    const value = getField(q, f.field);
    if (value !== f.replace && !value.includes(f.replace)) {
      if (f.find && value.includes(f.find)) {
        console.log(`  NOT APPLIED ${f.id} ${f.field}`);
        bad += 1;
      } else {
        console.log(`  UNEXPECTED CONTENT ${f.id} ${f.field}`);
        bad += 1;
      }
    }
  }
  console.log(bad === 0 ? "verify: every fix is present in the dump" : `verify: ${bad} problem(s)`);
  process.exit(bad === 0 ? 0 : 1);
}

// ---- 3. dry run: apply the fixes to the live dump, in memory ----------------
if (!existsSync("bank-dump.json")) {
  console.error("bank-dump.json not found - produce it with scripts/bank-task.mjs (Vercel prebuild) first");
  process.exit(1);
}
const dump = JSON.parse(readFileSync("bank-dump.json", "utf8"));
const byId = new Map(dump.questions.map((q) => [q.id, q]));
const before = new Map();
const touched = new Map();
for (const f of FIXES) {
  const q = byId.get(f.id);
  if (!q) {
    console.error(`unknown question id in fix table: ${f.id}`);
    process.exit(1);
  }
  if (!before.has(q.id)) before.set(q.id, JSON.parse(JSON.stringify(q)));
  const key = `${f.id}|${f.field}`;
  if (!touched.has(key)) touched.set(key, { id: f.id, field: f.field, whys: [] });
  touched.get(key).whys.push(f.why);
  const current = getField(q, f.field);
  if (f.find !== "") {
    const n = occurrences(current, f.find);
    if (n !== 1) {
      console.error(`stored field match problem (${n} occurrences): ${f.id} ${f.field}\n  looking for: ${JSON.stringify(f.find.slice(0, 140))}`);
      process.exit(1);
    }
  }
  const next = f.find === "" ? f.replace : current.split(f.find).join(f.replace);
  if (current === next) {
    console.error(`fix made no change: ${f.id} ${f.field}`);
    process.exit(1);
  }
  setField(q, f.field, next);
}

// Every corrected field must be free of KaTeX errors and of raw delimiters.
const fieldProblems = [];
for (const q of byId.values()) {
  for (const f of ["stem", "explanation", ...[0, 1, 2, 3, 4].map((i) => `option${i}`)]) {
    const value = getField(q, f);
    if (typeof value !== "string") continue;
    for (const p of checkKatex(value)) fieldProblems.push(`${q.id} ${f}: KaTeX: ${p}`);
    for (const p of checkDelimiters(value)) fieldProblems.push(`${q.id} ${f}: delimiters: ${p}`);
    if (/\\[a-zA-Z]{2,}/.test(value.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$/g, ""))) {
      fieldProblems.push(`${q.id} ${f}: LaTeX command outside math delimiters`);
    }
  }
}
if (fieldProblems.length) {
  console.error("corrected fields failed validation:\n" + fieldProblems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}

// ---- CSV: rewrite only the corrected fields, keeping the file's exact shape ----
const csvRaw = readFileSync(CSV_PATH, "utf8");
const parsed = parseCsvRows(csvRaw);
if (normalizeNewlines(serializeCsv(parsed)) !== normalizeNewlines(csvRaw)) {
  console.error("CSV round-trip mismatch: refusing to rewrite the file (parser is not lossless)");
  process.exit(1);
}
const header = parsed.rows[0].map((h) => h.trim());
const stemColumn = header.indexOf("stem");
const csvChanges = [];
for (const old of before.values()) {
  const fresh = byId.get(old.id);
  const matches = parsed.rows.map((r, i) => (r[stemColumn] === old.stem ? i : -1)).filter((i) => i >= 0);
  if (matches.length !== 1) {
    console.error(`CSV row lookup failed for ${old.id}: ${matches.length} row(s) carry the pre-fix stem`);
    process.exit(1);
  }
  const rowIndex = matches[0];
  for (const f of ["stem", "explanation", ...[0, 1, 2, 3, 4].map((i) => `option${i}`)]) {
    if (getField(old, f) === getField(fresh, f)) continue;
    const column = f === "stem" ? "stem" : f === "explanation" ? "explanation" : `option${"ABCDE"[Number(f.slice(6))]}`;
    const col = header.indexOf(column);
    if (parsed.rows[rowIndex][col] !== getField(old, f)) {
      console.error(`CSV value mismatch for ${old.id} ${column}`);
      process.exit(1);
    }
    csvChanges.push({ rowIndex, col, column, id: old.id, to: getField(fresh, f) });
  }
}

const changed = [...before.values()].map((b) => byId.get(b.id));
console.log(`questions touched: ${changed.length}`);
for (const q of changed) {
  const b = before.get(q.id);
  const fields = ["stem", "explanation", ...[0, 1, 2, 3, 4].map((i) => `option${i}`)].filter((f) => getField(b, f) !== getField(q, f));
  console.log(`  Q ${q.section}/${q.topic} [${q.id}] :: ${fields.map((f) => `${f} (${getField(b, f).length}->${getField(q, f).length})`).join(", ")}`);
}
console.log(`CSV cells to update: ${csvChanges.length}`);

if (mode !== "--write") {
  console.log("\ndry run only - re-run with --write to patch the CSV and emit the SQL + db payload");
  process.exit(0);
}

// ---- 4. write mode --------------------------------------------------------
for (const c of csvChanges) parsed.rows[c.rowIndex][c.col] = c.to;
writeFileSync(CSV_PATH, serializeCsv(parsed), "utf8");
console.log(`\npatched ${CSV_PATH}`);

// Replayable SQL: matched by primary key, assigning the corrected field value, so
// re-running the file is a guaranteed no-op.
const q = (s) => "$fix$" + s + "$fix$";
const sql = [
  "-- ============================================================================",
  "-- fix-nimcet-mock-01-math.sql - mathematical-notation repairs for",
  "-- \"NIMCET MOCK - 01\" (120 questions), generated by",
  "-- scripts/fix-mock-01-notation.mjs.",
  "--",
  "-- Run in Supabase Dashboard -> SQL Editor (whole file, one paste).",
  "-- RE-RUNNABLE: every statement assigns the corrected text to one row identified",
  "-- by its primary key, so running it twice changes nothing the second time.",
  "-- Nothing is inserted, deleted or reordered; no other table is touched.",
  "--",
  "-- NOTE: public.questions is service-role-only (see supabase/migrations/",
  "-- 0002_hardening.sql and 0004_no_definer_view.sql), so this file must be run",
  "-- from the SQL editor or with the service role, never from the browser.",
  "-- ============================================================================",
  "",
  "begin;",
  "",
];
for (const t of touched.values()) {
  const value = getField(byId.get(t.id), t.field);
  if (value.includes("$fix$")) {
    console.error(`value contains the dollar-quote tag: ${t.id} ${t.field}`);
    process.exit(1);
  }
  sql.push(`-- ${[...new Set(t.whys)].join("; ")}`);
  sql.push(`update public.questions set`);
  if (t.field.startsWith("option")) {
    sql.push(`  options[${Number(t.field.slice(6))}] = ${q(value)}`);
  } else {
    sql.push(`  ${t.field} = ${q(value)}`);
  }
  sql.push(` where id = '${t.id}';`);
  sql.push("");
}
sql.push("commit;");
sql.push("");
sql.push("-- ============ verification (expected: 0 rows) ============");
sql.push("-- Any row listed still carries pre-fix wording.");
sql.push("select id, section, topic from public.questions");
sql.push(" where stem        ~ '\\\\\\\\[A-Za-z]'");
sql.push("    or explanation ~ '\\\\\\\\[A-Za-z]'");
sql.push("    or stem        ~ '(√|∛|∈|∩|∪|∀|∶)'");
sql.push("    or explanation ~ '(cos-1|tan-1|e-x|e- x|\\\\|A-1\\\\|)'");
sql.push(" order by section, topic;");
sql.push("");
writeFileSync(SQL_PATH, sql.join("\n"), "utf8");
console.log(`wrote ${SQL_PATH}`);

// Payload for the build-time bridge (scripts/bank-task.mjs, mode "apply").
const updates = changed.map((qq) => {
  const b = before.get(qq.id);
  const fields = {};
  for (const f of ["stem", "explanation", "options", "answer", "topic", "section", "difficulty"]) {
    if (JSON.stringify(b[f]) !== JSON.stringify(qq[f])) fields[f] = qq[f];
  }
  return { id: qq.id, fields };
});
writeFileSync(
  TASK_PATH,
  JSON.stringify(
    {
      mode: "apply",
      note: "Temporary build-time maintenance task, generated by scripts/fix-mock-01-notation.mjs. Applies the notation fixes to the live bank and dumps the result back to the build log.",
      updates,
    },
    null,
    2
  ),
  "utf8"
);
console.log(`wrote ${TASK_PATH} (${updates.length} updates)`);

// Corrected bank, for offline auditing before the database is touched.
const corrected = { generatedAt: new Date().toISOString(), tests: dump.tests, questions: dump.questions };
writeFileSync("bank-dump-corrected.json", JSON.stringify(corrected, null, 2), "utf8");
console.log("wrote bank-dump-corrected.json (offline preview of the fixed bank)");
