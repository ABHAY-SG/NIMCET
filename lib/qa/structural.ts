// Structural, rendering and duplicate validation.
//
// These checks are intentionally independent of a question's subject. They run
// for every question (mathematics, reasoning, computer awareness, English, …)
// and cover the failures that make a question unusable regardless of topic.

import katex from "katex";
import { subjectForSection } from "../nimcet-full-mock";
import {
  delimiterIssues,
  inspectHtml,
  normalizeOption,
  optionLetter,
  plainMathIssues,
  similarity,
  snippet,
  tokenizeMath,
  normalizeText,
} from "./text";
import { finding, type QaFinding, type QaQuestion, type QuestionKind, type QuestionSibling } from "./types";

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

export function inferQuestionKind(question: Pick<QaQuestion, "exam" | "section" | "topic" | "stem" | "options">): QuestionKind {
  const section = `${question.section ?? ""} ${question.topic ?? ""}`.toLowerCase();
  const stem = String(question.stem ?? "").toLowerCase();
  if (/reason|logic|aptitude|puzzle|seating|syllog|blood relation|coding|ranking|arrangement/.test(section)) return "logical-reasoning";
  if (/computer|programming|coding|algorithm|data structure|dbms|operating|network|software|boolean|number system/.test(section)) return "computer-science";
  if (/english|verbal|grammar|vocabulary|comprehension|antonym|synonym|idiom/.test(section)) return "english";
  if (/math|algebra|geometry|calculus|trigonometry|probability|permutation|combination|statistics|number theory|arithmetic|mensuration/.test(section)) return "mathematics";
  if (/\\\(|\\\[|\$/.test(String(question.stem ?? "")) || /\b(?:equation|solve|value|triangle|probability|integral|matrix)\b/.test(stem)) return "mathematics";
  const exam = String(question.exam ?? "").toLowerCase();
  if (exam.includes("nimcet")) return "general";
  return "general";
}

function checkRendering(text: string, field: QaFinding["field"], validator: string): QaFinding[] {
  const findings: QaFinding[] = [];
  if (!text) return findings;
  for (const issue of inspectHtml(text)) {
    findings.push(
      finding({
        code: issue.severity === "critical" ? "RENDER_HTML_CRITICAL" : "RENDER_HTML_WARNING",
        category: "rendering",
        severity: issue.severity,
        field,
        message: issue.message,
        suggestion: issue.severity === "critical" ? "Remove the unsafe tag/attribute." : "Close the tag or remove the stray markup.",
        evidence: issue.evidence,
        validator,
      })
    );
  }
  for (const issue of delimiterIssues(text)) {
    findings.push(
      finding({
        code: "RENDER_DELIMITER",
        category: "rendering",
        severity: issue.severity,
        field,
        message: issue.message,
        suggestion: "Balance the math delimiters or remove the stray delimiter.",
        validator,
      })
    );
  }
  for (const token of tokenizeMath(text)) {
    if (token.kind !== "math") continue;
    try {
      katex.renderToString(token.content, {
        throwOnError: true,
        displayMode: token.display,
        strict: (code) => (code === "unicodeTextInMathMode" ? "warn" : "error"),
        trust: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      findings.push(
        finding({
          code: "RENDER_KATEX",
          category: "rendering",
          severity: "critical",
          field,
          message: `KaTeX cannot render this math span: ${message.replace(/\s+/g, " ").slice(0, 180)}`,
          suggestion: "Fix the LaTeX command or close the brace/bracket.",
          evidence: token.content.slice(0, 120),
          validator,
        })
      );
    }
  }
  return findings;
}

function checkPlainMath(text: string, field: QaFinding["field"], kind: QuestionKind): QaFinding[] {
  if (!text) return [];
  const findings: QaFinding[] = [];
  for (const issue of plainMathIssues(text)) {
    // Critical pasted-LaTeX/unicode rules apply everywhere. The ambiguous
    // warning rules only apply to maths/reasoning to avoid flagging code such
    // as "MP3" or "Q1" in computer questions.
    if (issue.severity === "warning" && !["mathematics", "logical-reasoning"].includes(kind)) continue;
    findings.push(
      finding({
        code: issue.severity === "critical" ? "RENDER_PLAIN_MATH_CRITICAL" : "RENDER_PLAIN_MATH_WARNING",
        category: "rendering",
        severity: issue.severity,
        field,
        message: issue.message,
        suggestion: "Rewrite the expression using properly delimited LaTeX, e.g. \\(x^{2}\\).",
        evidence: issue.evidence,
        validator: "structure",
        confidence: issue.severity === "critical" ? "high" : "medium",
        deterministic: issue.severity === "critical",
      })
    );
  }
  return findings;
}

function explanationClaims(explanation: string): number[] {
  const claims: number[] = [];
  const patterns = [
    /option\s+([A-H])\s+is\s+(?:the\s+)?(?:correct|right|answer)/gi,
    /(?:correct|right)\s+(?:answer|option|choice)\s*(?:is|:)?\s*(?:option\s+)?([A-H])\b/gi,
    /(?:answer|choice)\s+is\s+(?:option\s+)?([A-H])\b/gi,
    /(?:thus|therefore|hence|so)[,:\s]+(?:the\s+)?(?:answer|option|choice)\s*(?:is|:)?\s*(?:option\s+)?([A-H])\b/gi,
    /(?:the\s+)?(?:correct|right)\s+option\s+is\s*\(?([A-H])\)?/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(explanation)) !== null) claims.push(m[1].toUpperCase().charCodeAt(0) - 65);
  }
  return claims;
}

export function validateStructure(
  question: QaQuestion,
  kind: QuestionKind,
  siblings: QuestionSibling[] = []
): QaFinding[] {
  const findings: QaFinding[] = [];
  const stem = String(question.stem ?? "");
  const explanation = String(question.explanation ?? "");
  const options = Array.isArray(question.options) ? question.options.map((o) => String(o ?? "")) : [];
  const answer = question.answer;
  const plus = Number(question.plus);
  const minus = Number(question.minus);

  const add = (input: Parameters<typeof finding>[0]) => findings.push(finding(input));

  // Metadata -----------------------------------------------------------------
  if (!String(question.exam ?? "").trim()) {
    add({ code: "META_EXAM_MISSING", category: "metadata", severity: "critical", field: "exam", message: "Exam is empty.", suggestion: "Set the exam key (for example \"nimcet\").", validator: "structure" });
  }
  if (!String(question.section ?? "").trim()) {
    add({ code: "META_SECTION_MISSING", category: "metadata", severity: "critical", field: "section", message: "Section is empty.", suggestion: "Choose a section such as maths, reasoning, computer or english.", validator: "structure" });
  } else if (/nimcet/i.test(question.exam) && !subjectForSection(question.section)) {
    add({
      code: "META_SECTION_UNKNOWN",
      category: "metadata",
      severity: "warning",
      field: "section",
      message: `Section "${snippet(question.section, 60)}" is not one of the four NIMCET subjects, so full-mock composition cannot place it.`,
      suggestion: "Use maths, reasoning, computer or english (the aliases are case-insensitive).",
      evidence: question.section,
      validator: "structure",
    });
  }
  if (!String(question.topic ?? "").trim()) {
    add({ code: "META_TOPIC_MISSING", category: "metadata", severity: "warning", field: "topic", message: "Topic is empty.", suggestion: "Add a short topic label for search and analytics.", validator: "structure" });
  }
  if (!DIFFICULTIES.has(String(question.difficulty ?? "").toLowerCase())) {
    add({ code: "META_DIFFICULTY", category: "metadata", severity: "warning", field: "difficulty", message: `Difficulty "${snippet(question.difficulty, 40)}" is not Easy/Medium/Hard.`, suggestion: "Use Easy, Medium or Hard.", validator: "structure" });
  }

  // Stem and rendering -------------------------------------------------------
  if (!stem.trim()) {
    add({ code: "STEM_EMPTY", category: "structure", severity: "critical", field: "stem", message: "Question stem is empty.", suggestion: "Write the question before saving/publishing.", validator: "structure" });
  } else {
    const plain = normalizeText(stem);
    if (plain.length < 8) {
      add({ code: "STEM_TOO_SHORT", category: "structure", severity: "critical", field: "stem", message: "Question stem is too short to be answerable.", suggestion: "Add the full question text.", evidence: snippet(stem, 80), validator: "structure" });
    } else if (plain.length < 20) {
      add({ code: "STEM_SHORT", category: "structure", severity: "warning", field: "stem", message: "Question stem is very short; check that it is self-contained.", suggestion: "Add context, units or instructions if needed.", evidence: snippet(stem, 100), validator: "structure" });
    }
    if (stem.length > 20000) {
      add({ code: "STEM_TOO_LONG", category: "structure", severity: "warning", field: "stem", message: `Stem is ${stem.length} characters; this may be a copy/paste accident.`, suggestion: "Split the passage or trim it.", validator: "structure" });
    }
    findings.push(...checkRendering(stem, "stem", "structure"));
    findings.push(...checkPlainMath(stem, "stem", kind));
  }

  // Options ------------------------------------------------------------------
  if (options.length < 2) {
    add({ code: "OPTIONS_TOO_FEW", category: "options", severity: "critical", field: "options", message: "A multiple-choice question needs at least two options.", suggestion: "Add four distinct options.", validator: "structure" });
  } else if (options.length !== 4 && options.length !== 5) {
    add({ code: "OPTIONS_COUNT", category: "options", severity: "warning", field: "options", message: `Expected 4 or 5 options, found ${options.length}.`, suggestion: "Use four options unless the paper format requires five.", validator: "structure" });
  }
  const normalized = options.map((o) => normalizeOption(o));
  const seen = new Map<string, number>();
  options.forEach((option, i) => {
    if (!option.trim()) {
      add({ code: "OPTION_EMPTY", category: "options", severity: "critical", field: "options", message: `Option ${optionLetter(i)} is empty.`, suggestion: "Fill the option or remove it and renumber the key.", validator: "structure" });
      return;
    }
    if (option.length > 2000) {
      add({ code: "OPTION_TOO_LONG", category: "options", severity: "warning", field: "options", message: `Option ${optionLetter(i)} is ${option.length} characters; check for a copy/paste error.`, suggestion: "Keep options concise.", validator: "structure" });
    }
    const n = normalized[i];
    if (n && seen.has(n)) {
      add({
        code: "OPTION_DUPLICATE",
        category: "options",
        severity: "critical",
        field: "options",
        message: `Options ${optionLetter(seen.get(n)!)} and ${optionLetter(i)} are identical after formatting is removed.`,
        suggestion: "Remove the duplicate and ensure the answer key still points to the intended option.",
        evidence: snippet(option, 90),
        validator: "structure",
      });
    } else if (n) {
      seen.set(n, i);
    }
    findings.push(...checkRendering(option, "options", "structure"));
    findings.push(...checkPlainMath(option, "options", kind));
  });
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (normalized[i] && normalized[j] && normalized[i] !== normalized[j] && options[i].length > 20 && options[j].length > 20) {
        const sim = similarity(options[i], options[j]);
        if (sim >= 0.95) {
          add({
            code: "OPTION_NEAR_DUPLICATE",
            category: "options",
            severity: "review",
            field: "options",
            message: `Options ${optionLetter(i)} and ${optionLetter(j)} are nearly identical (${Math.round(sim * 100)}% similar).`,
            suggestion: "Make the options clearly distinct or remove the duplicate.",
            evidence: `${snippet(options[i], 70)} / ${snippet(options[j], 70)}`,
            validator: "structure",
            confidence: "medium",
            deterministic: false,
          });
        }
      }
    }
  }
  if (options.some((o) => /\b(?:all|none)\s+of\s+the\s+above\b/i.test(o))) {
    add({
      code: "OPTION_COMPOSITE",
      category: "options",
      severity: "review",
      field: "options",
      message: "A composite option (\"all/none of the above\") cannot be independently verified by the deterministic solver.",
      suggestion: "Review the options manually, or replace the composite option with explicit statements.",
      validator: "structure",
      confidence: "medium",
      deterministic: false,
    });
  }

  // Answer key ---------------------------------------------------------------
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    add({ code: "ANSWER_RANGE", category: "answer", severity: "critical", field: "answer", message: `Answer key ${String(answer)} is not a valid 0-based option index (options: ${options.length}).`, suggestion: "Set the key to the index of the correct option.", validator: "structure" });
  } else if (!options[answer]?.trim()) {
    add({ code: "ANSWER_EMPTY_OPTION", category: "answer", severity: "critical", field: "answer", message: "The answer key points to an empty option.", suggestion: "Correct the option or the key.", validator: "structure" });
  }

  // Explanation --------------------------------------------------------------
  if (!explanation.trim()) {
    add({ code: "EXPLANATION_MISSING", category: "explanation", severity: "warning", field: "explanation", message: "No explanation is stored.", suggestion: "Add a concise solution so students and reviewers can verify the key.", validator: "structure" });
  } else {
    if (explanation.length > 20000) {
      add({ code: "EXPLANATION_TOO_LONG", category: "explanation", severity: "warning", field: "explanation", message: `Explanation is ${explanation.length} characters; check for a copy/paste accident.`, suggestion: "Trim it or split the passage.", validator: "structure" });
    }
    findings.push(...checkRendering(explanation, "explanation", "structure"));
    findings.push(...checkPlainMath(explanation, "explanation", kind));
    const claims = explanationClaims(explanation);
    const last = claims.at(-1);
    if (last !== undefined && Number.isInteger(answer) && last !== answer) {
      add({
        code: "EXPLANATION_ANSWER_MISMATCH",
        category: "explanation",
        severity: "critical",
        field: "explanation",
        message: `The explanation claims option ${optionLetter(last)}, but the stored key is option ${optionLetter(answer)}.`,
        suggestion: "Make the final explanation sentence and the answer key agree.",
        validator: "structure",
      });
    }
  }

  // Marks --------------------------------------------------------------------
  if (!Number.isFinite(plus) || plus <= 0) {
    add({ code: "MARKS_PLUS", category: "marks", severity: "critical", field: "plus", message: `Marks for a correct answer must be positive (found ${String(question.plus)}).`, suggestion: "Use the paper's positive mark, for example 12 or 6.", validator: "structure" });
  } else if (plus > 1000) {
    add({ code: "MARKS_PLUS_LARGE", category: "marks", severity: "warning", field: "plus", message: `Positive marks are unusually large (${plus}).`, suggestion: "Check the paper's marking scheme.", validator: "structure" });
  }
  if (!Number.isFinite(minus) || minus > 0) {
    add({ code: "MARKS_MINUS", category: "marks", severity: "critical", field: "minus", message: `Negative marks must be zero or negative (found ${String(question.minus)}).`, suggestion: "Store a penalty as a negative number, for example -3.", validator: "structure" });
  } else if (minus < -1000) {
    add({ code: "MARKS_MINUS_LARGE", category: "marks", severity: "warning", field: "minus", message: `Negative marks are unusually large (${minus}).`, suggestion: "Check the paper's marking scheme.", validator: "structure" });
  }

  // Image URL ----------------------------------------------------------------
  const image = String(question.image_url ?? "").trim();
  if (image) {
    if (/^javascript:/i.test(image)) {
      add({ code: "IMAGE_UNSAFE", category: "rendering", severity: "critical", field: "image_url", message: "Image URL uses javascript:.", suggestion: "Use an https URL or a local /images path.", validator: "structure" });
    } else if (!/^(?:https:\/\/|\/)/i.test(image)) {
      add({ code: "IMAGE_URL", category: "rendering", severity: "warning", field: "image_url", message: "Image URL is neither an https URL nor a local /path.", suggestion: "Use https://… or /images/….", evidence: snippet(image, 100), validator: "structure" });
    }
  }

  // Optional structured model ------------------------------------------------
  if (question.qa_model !== undefined && question.qa_model !== null && question.qa_model !== "") {
    if (typeof question.qa_model !== "object" || Array.isArray(question.qa_model)) {
      add({ code: "QA_MODEL_INVALID", category: "logic", severity: "critical", field: "qa_model", message: "qa_model must be a JSON object.", suggestion: "Remove it or supply a structured model object.", validator: "structure" });
    }
  }

  // Duplicates against the bank ---------------------------------------------
  const ownStem = normalizeText(stem);
  for (const sibling of siblings) {
    if (question.id && sibling.id && question.id === sibling.id) continue;
    const other = normalizeText(sibling.stem);
    if (!ownStem || !other) continue;
    if (ownStem === other) {
      add({
        code: "DUPLICATE_STEM",
        category: "duplicates",
        severity: "critical",
        field: "stem",
        message: sibling.id ? `Exact duplicate of question ${sibling.id.slice(0, 8)}…` : "Exact duplicate of another question in the bank.",
        suggestion: "Keep one copy and revalidate the test that referenced the duplicate.",
        evidence: snippet(stem, 100),
        validator: "duplicates",
      });
      break;
    }
    if (ownStem.length >= 40 && other.length >= 40) {
      const sim = similarity(stem, sibling.stem);
      if (sim >= 0.94) {
        add({
          code: "DUPLICATE_NEAR",
          category: "duplicates",
          severity: "review",
          field: "stem",
          message: sibling.id ? `Near-duplicate (${Math.round(sim * 100)}%) of question ${sibling.id.slice(0, 8)}…` : `Near-duplicate (${Math.round(sim * 100)}%) of another question in the bank.`,
          suggestion: "Review both questions; near-duplicates often have an inconsistent answer key.",
          evidence: snippet(stem, 100),
          validator: "duplicates",
          confidence: "medium",
          deterministic: false,
        });
        break;
      }
    }
  }

  return findings;
}
