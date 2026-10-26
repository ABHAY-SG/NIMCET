// Deterministic logical-reasoning checks.
//
// The engine recognises a small but useful family of formal puzzles (team
// allocation, linear ordering, coding-decoding and categorical syllogisms),
// enumerates all valid models, and verifies that exactly one option follows.
// Questions outside these forms are honestly reported as needing review rather
// than being given a false PASS.

import { finding, type QaFinding } from "./types";
import { decodeEntities, normalizeText, sentenceChunks } from "./text";

export type LogicCheck = {
  computedAnswer: number | null;
  deterministicVerified: boolean;
  findings: QaFinding[];
  model: string | null;
};

const MAX_PERMUTATIONS = 60000;

function asText(stem: string): string {
  return decodeEntities(
    String(stem ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|li|tr)>/gi, "\n")
      .replace(/<div[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function lines(stem: string): string[] {
  return asText(stem)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function entityList(text: string): string[] {
  // Prefer the explicit list that introduces a group of people.
  const patterns = [
    /(?:people|creators|persons|students|members|friends|candidates|employees|individuals|children|players)\s*(?:-|:)?\s*([A-Z](?:\s*,\s*[A-Z])+(?:\s*,?\s*and\s*[A-Z])?)/,
    /(?:seven|six|five|four|eight|nine|ten)\s+(?:people|creators|persons|students|members|friends|candidates|employees|individuals|children|players)\s*[-:]\s*([A-Z](?:\s*,\s*[A-Z])+(?:\s*,?\s*and\s*[A-Z])?)/,
    /-\s*([A-Z](?:\s*,\s*[A-Z])+(?:\s*,?\s*and\s*[A-Z])?)\s*,?\s*(?:by|are|stand|sit)/,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const out = [...new Set((m[1].match(/\b[A-Z]\b/g) ?? []).map((x) => x.toUpperCase()))];
      if (out.length >= 3) return out;
    }
  }
  return [];
}

function canonicalGroup(raw: string, groups: string[]): string | null {
  const n = normalizeText(raw);
  return groups.find((g) => normalizeText(g) === n) ?? null;
}

function groupList(text: string): string[] {
  const patterns = [
    /(?:teams?|groups?)\s*(?:based on|named|called|:|-)?\s*[-:]?\s*([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)+(?:\s*,?\s*and\s+[A-Z][a-z]+)?)/,
    /into\s+(?:three|four|five)\s+(?:teams?|groups?)\s*[-:]\s*([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)+(?:\s*,?\s*and\s+[A-Z][a-z]+)?)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const out = m[1]
        .split(/\s*,\s*|\s+and\s+/i)
        .map((s) => s.trim())
        .filter((s) => /^[A-Z][a-z]+$/.test(s));
      if (out.length >= 2) return [...new Set(out)];
    }
  }
  return [];
}

function optionSet(option: string, entities: string[]): string[] {
  const found = [...new Set((option.match(/\b[A-Z]\b/g) ?? []).map((s) => s.toUpperCase()))];
  return found.filter((x) => entities.includes(x)).sort();
}

function setsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function setKey(a: string[]): string {
  return [...a].sort().join("|");
}

function addNoSolution(findings: QaFinding[], model: string): void {
  findings.push(
    finding({
      code: "LOGIC_NO_SOLUTION",
      category: "logic",
      severity: "critical",
      field: "stem",
      message: `The ${model} constraints are contradictory: no arrangement satisfies all of them.`,
      suggestion: "Re-check the constraints or correct the one that makes the puzzle impossible.",
      validator: "logic",
    })
  );
}

function addAnswerMismatch(findings: QaFinding[], computed: number, stored: number, options: string[], model: string): void {
  findings.push(
    finding({
      code: "LOGIC_ANSWER_MISMATCH",
      category: "answer",
      severity: "critical",
      field: "answer",
      message: `The deterministic ${model} solver gives option ${String.fromCharCode(65 + computed)}, but the stored key is option ${String.fromCharCode(65 + stored)}.`,
      suggestion: `Review the puzzle. The solver's answer is "${options[computed] ?? ""}".`,
      validator: "logic",
    })
  );
}

// ---------------------------------------------------------------------------
// Team allocation

type TeamConstraint =
  | { type: "same"; a: string; b: string }
  | { type: "different"; a: string; b: string }
  | { type: "group"; entity: string; group: string }
  | { type: "not-group"; entity: string; group: string }
  | { type: "domain"; entity: string; groups: string[] }
  | { type: "implication"; ifEntity: string; ifGroup: string; thenEntity: string; thenGroup: string }
  | { type: "xor-with"; entity: string; a: string; b: string; notGroup?: string }
  | { type: "group-size"; group: string; min?: number; max?: number; exact?: number };

type TeamModel = {
  entities: string[];
  groups: string[];
  constraints: TeamConstraint[];
  queryGroup: string;
  unparsed: string[];
};

function parseTeamModel(stem: string): TeamModel | null {
  const text = asText(stem);
  if (!/\b(?:team|teams|group|groups|grouping)\b/i.test(text)) return null;
  const entities = entityList(text);
  const groups = groupList(text);
  if (entities.length < 3 || groups.length < 2) return null;

  const constraints: TeamConstraint[] = [];
  const unparsed: string[] = [];
  const clues = lines(stem).filter((line) => {
    const l = line.toLowerCase();
    return (
      /^[a-z][).]\s*/i.test(line) ||
      /\b(?:refuse|cannot|can't|must|should|if|no team|each team|exactly|at least|at most|not in the|same team)\b/i.test(l)
    );
  });

  for (const line of clues) {
    const l = line.replace(/\s+/g, " ").trim();
    let matched = false;

    // A and B refuse to be on the same team.
    let m = /\b([A-Z])\s+and\s+([A-Z])\s+(?:refuse|must not|cannot|can't|should not)\s+(?:to\s+)?(?:be\s+)?(?:on|in)\s+the\s+same\s+(?:team|group)/i.exec(l);
    if (m) {
      constraints.push({ type: "different", a: m[1].toUpperCase(), b: m[2].toUpperCase() });
      matched = true;
    }
    if (!matched) {
      m = /\b([A-Z])\s+and\s+([A-Z])\s+(?:must|should|have\s+to|need\s+to)\s+be\s+(?:on|in)\s+the\s+same\s+(?:team|group)/i.exec(l);
      if (m) {
        constraints.push({ type: "same", a: m[1].toUpperCase(), b: m[2].toUpperCase() });
        matched = true;
      }
    }
    if (!matched) {
      // C can be in team Travel or Beauty but not Tech.
      m = /\b([A-Z])\s+(?:can|must|may|should)\s+be\s+(?:in|on)\s+(?:the\s+)?(?:team\s+)?([A-Za-z]+)\s+or\s+([A-Za-z]+)\s+but\s+not\s+(?:in\s+)?(?:the\s+)?(?:team\s+)?([A-Za-z]+)/i.exec(l);
      if (m) {
        const a = canonicalGroup(m[2], groups);
        const b = canonicalGroup(m[3], groups);
        const no = canonicalGroup(m[4], groups);
        if (a && b) {
          constraints.push({ type: "domain", entity: m[1].toUpperCase(), groups: [a, b] });
          if (no) constraints.push({ type: "not-group", entity: m[1].toUpperCase(), group: no });
          matched = true;
        }
      }
    }
    if (!matched) {
      // If D goes to Tech then E also must be in Tech.
      m = /\bif\s+([A-Z])\s+(?:goes|is|joins|moves)\s+(?:to|in|into)\s+(?:the\s+)?(?:team\s+)?([A-Za-z]+)\s*,?\s*then\s+([A-Z])\s+(?:also\s+)?must\s+be\s+(?:in|on|to)\s+(?:the\s+)?(?:team\s+)?([A-Za-z]+)/i.exec(l);
      if (m) {
        const g1 = canonicalGroup(m[2], groups);
        const g2 = canonicalGroup(m[4], groups);
        if (g1 && g2) {
          constraints.push({
            type: "implication",
            ifEntity: m[1].toUpperCase(),
            ifGroup: g1,
            thenEntity: m[3].toUpperCase(),
            thenGroup: g2,
          });
          matched = true;
        }
      }
    }
    if (!matched) {
      // F must be with either A or B but not both and not in the Travel team.
      m = /\b([A-Z])\s+must\s+be\s+with\s+either\s+([A-Z])\s+or\s+([A-Z])\s+but\s+not\s+both(?:\s+and\s+not\s+in\s+the\s+([A-Za-z]+)\s+team)?/i.exec(l);
      if (m) {
        const notGroup = m[4] ? canonicalGroup(m[4], groups) : null;
        constraints.push({
          type: "xor-with",
          entity: m[1].toUpperCase(),
          a: m[2].toUpperCase(),
          b: m[3].toUpperCase(),
          ...(notGroup ? { notGroup } : {}),
        });
        matched = true;
      }
    }
    if (!matched) {
      // G must be in team Travel.
      m = /\b([A-Z])\s+(?:must|should|has to|have to|needs to)\s+be\s+(?:in|on)\s+(?:the\s+)?(?:team\s+)?([A-Za-z]+)/i.exec(l);
      if (m) {
        const g = canonicalGroup(m[2], groups);
        if (g) {
          constraints.push({ type: "group", entity: m[1].toUpperCase(), group: g });
          matched = true;
        }
      }
    }
    if (!matched) {
      // A cannot be in team Beauty.
      m = /\b([A-Z])\s+(?:cannot|can't|must not|should not)\s+be\s+(?:in|on)\s+(?:the\s+)?(?:team\s+)?([A-Za-z]+)/i.exec(l);
      if (m) {
        const g = canonicalGroup(m[2], groups);
        if (g) {
          constraints.push({ type: "not-group", entity: m[1].toUpperCase(), group: g });
          matched = true;
        }
      }
    }
    if (!matched) {
      // E must not be in same team as G.
      m = /\b([A-Z])\s+(?:must not|cannot|can't|should not)\s+be\s+in\s+(?:the\s+)?same\s+(?:team|group)\s+as\s+([A-Z])/i.exec(l);
      if (m) {
        constraints.push({ type: "different", a: m[1].toUpperCase(), b: m[2].toUpperCase() });
        matched = true;
      }
    }
    if (!matched) {
      // Tech team should have exactly 2 members.
      m = /\b(?:the\s+)?([A-Za-z]+)\s+team\s+(?:should|must|needs? to|has to)\s+have\s+exactly\s+(\d+)\s+(?:members?|people|(?:content\s+)?creators?)/i.exec(l);
      if (m) {
        const g = canonicalGroup(m[1], groups);
        if (g) {
          constraints.push({ type: "group-size", group: g, exact: Number(m[2]) });
          matched = true;
        }
      }
    }
    if (!matched) {
      m = /\bno\s+team\s+(?:can|should|must)\s+have\s+more\s+than\s+(\d+)\s+(?:members?|people|(?:content\s+)?creators?)/i.exec(l);
      if (m) {
        constraints.push({ type: "group-size", group: "*", max: Number(m[1]) });
        matched = true;
      }
    }
    if (!matched) {
      m = /\beach\s+team\s+(?:needs?|must have|should have)\s+at\s+least\s+(\d+)\s+(?:members?|people|(?:content\s+)?creators?)/i.exec(l);
      if (m) {
        constraints.push({ type: "group-size", group: "*", min: Number(m[1]) });
        matched = true;
      }
    }
    if (!matched && /\b[A-Z]\b/.test(l) && !/^who\s|^which\s|^what\s|^the\s+members/i.test(l)) {
      unparsed.push(l.slice(0, 180));
    }
  }

  const qm = /(?:members?\s+of\s+the|who\s+are\s+(?:in|on)\s+the|which\s+(?:people|creators|members)\s+are\s+(?:in|on)\s+the)\s+([A-Za-z]+)\s+(?:team|group)/i.exec(text);
  const queryGroup = qm ? canonicalGroup(qm[1], groups) : null;
  if (!queryGroup) return null;

  return { entities, groups, constraints, queryGroup, unparsed };
}

function solveTeam(model: TeamModel, limit: number): Array<Record<string, string>> {
  const { entities, groups, constraints } = model;
  const solutions: Array<Record<string, string>> = [];
  const assignment: Record<string, string> = {};

  const domain = new Map<string, string[]>();
  for (const e of entities) domain.set(e, [...groups]);
  for (const c of constraints) {
    if (c.type === "domain") domain.set(c.entity, c.groups.filter((g) => groups.includes(g)));
    if (c.type === "group") domain.set(c.entity, [c.group]);
    if (c.type === "not-group") domain.set(c.entity, (domain.get(c.entity) ?? groups).filter((g) => g !== c.group));
  }

  const countGroup = (g: string) => Object.values(assignment).filter((v) => v === g).length;
  const validPartial = (): boolean => {
    for (const c of constraints) {
      if (c.type === "same" && assignment[c.a] && assignment[c.b] && assignment[c.a] !== assignment[c.b]) return false;
      if (c.type === "different" && assignment[c.a] && assignment[c.b] && assignment[c.a] === assignment[c.b]) return false;
      if (c.type === "group" && assignment[c.entity] && assignment[c.entity] !== c.group) return false;
      if (c.type === "not-group" && assignment[c.entity] === c.group) return false;
      if (c.type === "domain" && assignment[c.entity] && !c.groups.includes(assignment[c.entity])) return false;
      if (c.type === "implication") {
        if (assignment[c.ifEntity] === c.ifGroup && assignment[c.thenEntity] && assignment[c.thenEntity] !== c.thenGroup) return false;
      }
      if (c.type === "xor-with") {
        if (assignment[c.entity]) {
          const sameA = assignment[c.a] === assignment[c.entity];
          const sameB = assignment[c.b] === assignment[c.entity];
          if (sameA === sameB) return false;
          if (c.notGroup && assignment[c.entity] === c.notGroup) return false;
        }
      }
      if (c.type === "group-size") {
        const gs = c.group === "*" ? groups : [c.group];
        for (const g of gs) {
          const n = countGroup(g);
          if (c.min !== undefined && n > 0 && n < c.min && Object.keys(assignment).length === entities.length) return false;
          if (c.max !== undefined && n > c.max) return false;
          if (c.exact !== undefined && n > c.exact) return false;
        }
      }
    }
    return true;
  };

  const rec = (i: number) => {
    if (solutions.length >= limit) return;
    if (i === entities.length) {
      // Exact/at-least counts are only meaningful once everyone is assigned.
      for (const c of constraints) {
        if (c.type !== "group-size") continue;
        const gs = c.group === "*" ? groups : [c.group];
        for (const g of gs) {
          const n = countGroup(g);
          if (c.min !== undefined && n < c.min) return;
          if (c.max !== undefined && n > c.max) return;
          if (c.exact !== undefined && n !== c.exact) return;
        }
      }
      solutions.push({ ...assignment });
      return;
    }
    const e = entities[i];
    for (const g of domain.get(e) ?? groups) {
      assignment[e] = g;
      if (validPartial()) rec(i + 1);
      delete assignment[e];
    }
  };
  rec(0);
  return solutions;
}

function verifyTeam(model: TeamModel, options: string[], stored: number, limit: number): LogicCheck {
  const findings: QaFinding[] = [];
  const solutions = solveTeam(model, limit);
  if (solutions.length === 0) {
    addNoSolution(findings, "team-allocation");
    return { computedAnswer: null, deterministicVerified: false, findings, model: "team-allocation" };
  }

  const targetSets = [...new Set(solutions.map((s) => setKey(Object.entries(s).filter(([, g]) => g === model.queryGroup).map(([e]) => e))))];
  const targetKeys = new Set(targetSets);
  const optionMatches = options.map((o) => optionSet(o, model.entities));
  const matching = optionMatches
    .map((set, i) => (targetKeys.has(setKey(set)) ? i : null))
    .filter((i): i is number => i !== null);

  // "Cannot be determined" is legitimate when the requested group is not
  // fixed across all valid models and no concrete option matches.
  const cannotDetermine = options.findIndex((o) => /cannot\s+be\s+determined|insufficient|not\s+possible\s+to\s+determine/i.test(o));
  if (targetSets.length > 1 && cannotDetermine >= 0 && matching.length === 0) {
    matching.push(cannotDetermine);
  }
  if (targetSets.length > 1 && matching.length === 1) {
    findings.push(
      finding({
        code: "LOGIC_NON_UNIQUE_ALLOCATION",
        category: "logic",
        severity: "warning",
        field: "stem",
        message: `The clues allow ${targetSets.length} different valid ${model.queryGroup} teams; the selected option is one of them, but the puzzle is not unique.`,
        suggestion: "Add a clue that fixes the remaining team, or ask which option could be the team.",
        evidence: targetSets.slice(0, 6).join(" / "),
        validator: "logic",
        confidence: "high",
        deterministic: true,
      })
    );
  }

  if (matching.length > 1) {
    findings.push(
      finding({
        code: "LOGIC_MULTIPLE_CORRECT",
        category: "logic",
        severity: "critical",
        field: "options",
        message: `More than one option is a valid answer (${matching.map((i) => String.fromCharCode(65 + i)).join(", ")}).`,
        suggestion: "Change the constraints or options so exactly one answer follows.",
        validator: "logic",
      })
    );
  } else if (matching.length === 0) {
    findings.push(
      finding({
        code: "LOGIC_NO_OPTION_MATCH",
        category: "answer",
        severity: "critical",
        field: "options",
        message: "None of the supplied options is a valid member set for the queried team.",
        suggestion: "Re-check the options and the stated constraints.",
        evidence: `valid target sets: ${targetSets.map((s) => s.replace(/\|/g, ", ") || "(empty)").slice(0, 6).join(" / ")}`,
        validator: "logic",
      })
    );
  }

  const computed = matching.length === 1 ? matching[0] : null;
  if (computed !== null && computed !== stored) addAnswerMismatch(findings, computed, stored, options, "team-allocation");
  if (model.unparsed.length) {
    findings.push(
      finding({
        code: "LOGIC_UNPARSED_CONSTRAINTS",
        category: "logic",
        severity: "review",
        field: "stem",
        message: `The team solver could not interpret ${model.unparsed.length} constraint line(s).`,
        suggestion: "Rewrite the constraint in one of the supported forms, or review the question manually.",
        evidence: model.unparsed.slice(0, 3).join(" | "),
        validator: "logic",
        confidence: "medium",
        deterministic: false,
      })
    );
  }
  return {
    computedAnswer: computed,
    deterministicVerified: computed !== null && model.unparsed.length === 0,
    findings,
    model: "team-allocation",
  };
}

// ---------------------------------------------------------------------------
// Linear ordering

type OrderingConstraint =
  | { type: "pos"; entity: string; position: number }
  | { type: "left"; a: string; b: string; immediate: boolean }
  | { type: "right"; a: string; b: string; immediate: boolean }
  | { type: "offset"; a: string; b: string; delta: number }
  | { type: "between"; middle: string; a: string; b: string }
  | { type: "not-end"; entity: string }
  | { type: "adjacent"; a: string; b: string };

type OrderingModel = {
  entities: string[];
  constraints: OrderingConstraint[];
  query: { kind: "position"; position: number } | { kind: "end"; side: "left" | "right" } | null;
  unparsed: string[];
};

function parseOrderingModel(stem: string): OrderingModel | null {
  const text = asText(stem);
  if (!/\b(?:line|row|queue|order|ranking|positions?|sitting|seated|standing)\b/i.test(text)) return null;
  const entities = entityList(text);
  if (entities.length < 3) return null;

  const constraints: OrderingConstraint[] = [];
  const unparsed: string[] = [];
  const clueSource = sentenceChunks(text).length > 1 ? sentenceChunks(text) : lines(stem);
  const clues = clueSource.filter((line) =>
    /\b(?:left|right|between|position|end|adjacent|beside|immediately|order|rank|sits?|stands?)\b/i.test(line)
  );

  for (const line of clues) {
    const l = line.replace(/\s+/g, " ").trim();
    let matched = false;

    let m = /\b([A-Z])\s+is\s+(?:to\s+the\s+)?(?:immediate(?:ly)?\s+)?left\s+of\s+([A-Z])\b/i.exec(l);
    if (m) {
      constraints.push({ type: "left", a: m[1].toUpperCase(), b: m[2].toUpperCase(), immediate: /immediate/i.test(l) });
      matched = true;
    }
    if (!matched) {
      m = /\b([A-Z])\s+is\s+(?:to\s+the\s+)?(?:immediate(?:ly)?\s+)?right\s+of\s+([A-Z])\b/i.exec(l);
      if (m) {
        constraints.push({ type: "right", a: m[1].toUpperCase(), b: m[2].toUpperCase(), immediate: /immediate/i.test(l) });
        matched = true;
      }
    }
    if (!matched) {
      m = /\b([A-Z])\s+is\s+between\s+([A-Z])\s+and\s+([A-Z])\b/i.exec(l);
      if (m) {
        constraints.push({ type: "between", middle: m[1].toUpperCase(), a: m[2].toUpperCase(), b: m[3].toUpperCase() });
        matched = true;
      }
    }
    if (!matched) {
      m = /\b([A-Z])\s+is\s+not\s+at\s+either\s+end\b/i.exec(l);
      if (m) {
        constraints.push({ type: "not-end", entity: m[1].toUpperCase() });
        matched = true;
      }
    }
    if (!matched) {
      m = /\b([A-Z])\s+is\s+at\s+the\s+(?:far\s+)?(left|right)\b/i.exec(l);
      if (m) {
        constraints.push({ type: "pos", entity: m[1].toUpperCase(), position: m[2].toLowerCase() === "left" ? 1 : entities.length });
        matched = true;
      }
    }
    if (!matched) {
      m = /\b([A-Z])\s+is\s+in\s+the\s+(\d+)(?:st|nd|rd|th)\s+position\b/i.exec(l);
      if (m) {
        constraints.push({ type: "pos", entity: m[1].toUpperCase(), position: Number(m[2]) });
        matched = true;
      }
    }
    if (!matched) {
      m = /\b([A-Z])\s+(?:sits?|stands?)\s+(?:immediately\s+)?(?:to\s+the\s+)?(left|right)\s+of\s+([A-Z])\b/i.exec(l);
      if (m) {
        constraints.push({
          type: m[2].toLowerCase() === "left" ? "left" : "right",
          a: m[1].toUpperCase(),
          b: m[3].toUpperCase(),
          immediate: /immediately/i.test(l),
        });
        matched = true;
      }
    }
    if (!matched) {
      m = /\b([A-Z])\s+is\s+(?:second|two\s+places?|2\s+places?)\s+(?:to\s+the\s+)?(left|right)\s+of\s+([A-Z])\b/i.exec(l);
      if (m) {
        const delta = 2;
        constraints.push({
          type: "offset",
          a: m[1].toUpperCase(),
          b: m[3].toUpperCase(),
          delta: m[2].toLowerCase() === "left" ? -delta : delta,
        });
        matched = true;
      }
    }
    if (!matched) {
      m = /\b([A-Z])\s+and\s+([A-Z])\s+are\s+(?:immediate\s+)?(?:adjacent|beside|next\s+to)\b/i.exec(l);
      if (m) {
        constraints.push({ type: "adjacent", a: m[1].toUpperCase(), b: m[2].toUpperCase() });
        matched = true;
      }
    }
    if (!matched && /\b(?:left|right|between|position|end|adjacent)\b/i.test(l) && !/^who\s|^which\s|^what\s/i.test(l)) {
      unparsed.push(l.slice(0, 180));
    }
  }

  let query: OrderingModel["query"] = null;
  let qm = /who\s+is\s+in\s+the\s+(\d+)(?:st|nd|rd|th)\s+position\s+from\s+the\s+left/i.exec(text);
  if (qm) query = { kind: "position", position: Number(qm[1]) };
  if (!query) {
    qm = /who\s+is\s+(?:at|in)\s+the\s+(\d+)(?:st|nd|rd|th)\s+position/i.exec(text);
    if (qm) query = { kind: "position", position: Number(qm[1]) };
  }
  if (!query) {
    qm = /who\s+is\s+at\s+the\s+(?:far\s+)?(left|right)\s+end/i.exec(text);
    if (qm) query = { kind: "end", side: qm[1].toLowerCase() as "left" | "right" };
  }
  if (!query) return null;

  return { entities, constraints, query, unparsed };
}

function permutations<T>(items: T[], cap = MAX_PERMUTATIONS): T[][] {
  const out: T[][] = [];
  const rec = (prefix: T[], rest: T[]) => {
    if (out.length >= cap) return;
    if (rest.length === 0) {
      out.push(prefix);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      rec([...prefix, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (out.length >= cap) return;
    }
  };
  rec([], items);
  return out;
}

function verifyOrdering(model: OrderingModel, options: string[], stored: number): LogicCheck {
  const findings: QaFinding[] = [];
  const n = model.entities.length;
  const all = permutations(model.entities);
  const pos = (a: string[], e: string) => a.indexOf(e) + 1;
  const valid = all.filter((a) => {
    for (const c of model.constraints) {
      if (c.type === "pos" && pos(a, c.entity) !== c.position) return false;
      if (c.type === "left") {
        const d = pos(a, c.a) - pos(a, c.b);
        if (c.immediate ? d !== -1 : d >= 0) return false;
      }
      if (c.type === "right") {
        const d = pos(a, c.a) - pos(a, c.b);
        if (c.immediate ? d !== 1 : d <= 0) return false;
      }
      if (c.type === "offset" && pos(a, c.a) - pos(a, c.b) !== c.delta) return false;
      if (c.type === "between") {
        const m = pos(a, c.middle);
        const x = pos(a, c.a);
        const y = pos(a, c.b);
        if (!(m > Math.min(x, y) && m < Math.max(x, y))) return false;
      }
      if (c.type === "not-end" && (pos(a, c.entity) === 1 || pos(a, c.entity) === n)) return false;
      if (c.type === "adjacent" && Math.abs(pos(a, c.a) - pos(a, c.b)) !== 1) return false;
    }
    return true;
  });

  if (valid.length === 0) {
    addNoSolution(findings, "ordering");
    return { computedAnswer: null, deterministicVerified: false, findings, model: "ordering" };
  }

  let possible: string[] = [];
  if (model.query?.kind === "position") {
    possible = [...new Set(valid.map((a) => a[model.query!.kind === "position" ? model.query!.position - 1 : 0]).filter(Boolean))];
  } else if (model.query?.kind === "end") {
    possible = [...new Set(valid.map((a) => (model.query!.kind === "end" && model.query!.side === "left" ? a[0] : a[n - 1])).filter(Boolean))];
  }
  possible.sort();
  const matching = options
    .map((o, i) => (setsEqual(optionSet(o, model.entities), possible) ? i : null))
    .filter((i): i is number => i !== null);

  if (matching.length > 1) {
    findings.push(
      finding({
        code: "LOGIC_MULTIPLE_CORRECT",
        category: "logic",
        severity: "critical",
        field: "options",
        message: `More than one option matches all valid arrangements (${matching.map((i) => String.fromCharCode(65 + i)).join(", ")}).`,
        suggestion: "Make the options mutually exclusive.",
        validator: "logic",
      })
    );
  } else if (matching.length === 0) {
    findings.push(
      finding({
        code: "LOGIC_NO_OPTION_MATCH",
        category: "answer",
        severity: "critical",
        field: "options",
        message: `No option matches the possible occupant${possible.length === 1 ? "" : "s"} across all valid arrangements (${possible.join(", ")}).`,
        suggestion: "Re-check the options or the arrangement clues.",
        evidence: `possible=${possible.join(", ") || "(none)"}`,
        validator: "logic",
      })
    );
  }
  const computed = matching.length === 1 ? matching[0] : null;
  if (computed !== null && computed !== stored) addAnswerMismatch(findings, computed, stored, options, "ordering");
  if (model.unparsed.length) {
    findings.push(
      finding({
        code: "LOGIC_UNPARSED_CONSTRAINTS",
        category: "logic",
        severity: "review",
        field: "stem",
        message: `The ordering solver could not interpret ${model.unparsed.length} clue line(s).`,
        suggestion: "Rewrite the clue in a supported form, or review manually.",
        evidence: model.unparsed.slice(0, 3).join(" | "),
        validator: "logic",
        confidence: "medium",
        deterministic: false,
      })
    );
  }
  return {
    computedAnswer: computed,
    deterministicVerified: computed !== null && model.unparsed.length === 0,
    findings,
    model: "ordering",
  };
}

// ---------------------------------------------------------------------------
// Coding-decoding

function alphaCode(word: string, vowelShift = 0): string {
  return [...word.toUpperCase()]
    .map((ch) => {
      let n = ch.charCodeAt(0) - 64;
      if (!(n >= 1 && n <= 26)) return "";
      if (vowelShift && "AEIOU".includes(ch)) n = ((n - 1 + vowelShift) % 26 + 26) % 26 + 1;
      return String(n);
    })
    .join("-");
}

function verifyCoding(stem: string, options: string[], stored: number): LogicCheck | null {
  const text = asText(stem);
  if (!/\b(?:coded|coding|code)\b/i.test(text)) return null;
  const examples = [...text.matchAll(/"([A-Za-z]{2,})"\s+is\s+coded\s+as\s+"([0-9\-]+)"/gi)];
  const target = /how\s+would\s+"?([A-Za-z]{2,})"?\s+be\s+coded/i.exec(text)?.[1] ?? /code\s+for\s+"([A-Za-z]{2,})"/i.exec(text)?.[1] ?? null;
  if (!target) return null;

  const shiftMatch = /(?:every\s+)?vowel\s+is\s+shifted\s+by\s*([+-])?\s*(\d+)/i.exec(text);
  const shift = shiftMatch ? Number(shiftMatch[2]) * (shiftMatch[1] === "-" ? -1 : 1) : 0;
  const expected = alphaCode(target, shift);
  const findings: QaFinding[] = [];

  // The examples must be internally consistent with the stated rule. A
  // mismatch is a review signal, not an automatic failure: the paper may have
  // intentionally used a different coding scheme in the examples.
  for (const m of examples) {
    const standard = alphaCode(m[1], 0);
    if (standard !== m[2].replace(/\s+/g, "")) {
      findings.push(
        finding({
          code: "LOGIC_CODING_EXAMPLE_MISMATCH",
          category: "logic",
          severity: "review",
          field: "stem",
          message: `The example "${m[1]}" is coded as "${m[2]}", but standard alphabet positions give "${standard}".`,
          suggestion: "Clarify the coding rule or correct the worked example.",
          evidence: `${m[1]} -> ${m[2]} vs ${standard}`,
          validator: "logic",
          confidence: "medium",
          deterministic: false,
        })
      );
      break;
    }
  }

  const normalizeCode = (s: string) => s.replace(/[^0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const matching = options
    .map((o, i) => (normalizeCode(o) === normalizeCode(expected) ? i : null))
    .filter((i): i is number => i !== null);

  if (matching.length === 0) {
    findings.push(
      finding({
        code: "LOGIC_CODING_NO_OPTION",
        category: "answer",
        severity: "critical",
        field: "options",
        message: `The coding rule produces "${expected}", which is not among the options.`,
        suggestion: "Re-check the target word or the options.",
        evidence: expected,
        validator: "logic",
      })
    );
  } else if (matching.length > 1) {
    findings.push(
      finding({
        code: "LOGIC_MULTIPLE_CORRECT",
        category: "logic",
        severity: "critical",
        field: "options",
        message: "Multiple options encode the target word identically after punctuation is ignored.",
        suggestion: "Remove the duplicate option.",
        validator: "logic",
      })
    );
  }
  const computed = matching.length === 1 ? matching[0] : null;
  if (computed !== null && computed !== stored) addAnswerMismatch(findings, computed, stored, options, "coding rule");
  return {
    computedAnswer: computed,
    deterministicVerified: computed !== null && findings.every((f) => f.severity !== "review"),
    findings,
    model: "coding-decoding",
  };
}

// ---------------------------------------------------------------------------
// Categorical syllogisms

type Categorical = { kind: "all" | "no" | "some" | "some-not"; a: string; b: string };

function normalizeTerm(term: string): string {
  return normalizeText(term)
    .replace(/\b(?:all|some|no|the|a|an|materials?|things?|items?|objects?|people|persons?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

function parseCategorical(sentence: string): Categorical | null {
  const s = sentence.replace(/[.]/g, "").replace(/\s+/g, " ").trim();
  let m = /\ball\s+(.+?)\s+are\s+(?:the\s+)?(.+)$/i.exec(s);
  if (m) return { kind: "all", a: normalizeTerm(m[1]), b: normalizeTerm(m[2]) };
  m = /\bno\s+(.+?)\s+(?:is|are)\s+(?:a\s+|an\s+|the\s+)?(.+)$/i.exec(s);
  if (m) return { kind: "no", a: normalizeTerm(m[1]), b: normalizeTerm(m[2]) };
  m = /\bsome\s+(.+?)\s+are\s+not\s+(?:a\s+|an\s+|the\s+)?(.+)$/i.exec(s);
  if (m) return { kind: "some-not", a: normalizeTerm(m[1]), b: normalizeTerm(m[2]) };
  m = /\bsome\s+(.+?)\s+are\s+(?:a\s+|an\s+|the\s+)?(.+)$/i.exec(s);
  if (m) return { kind: "some", a: normalizeTerm(m[1]), b: normalizeTerm(m[2]) };
  return null;
}

function universeHolds(c: Categorical, model: number[], termIndex: Map<string, number>): boolean {
  const ia = termIndex.get(c.a);
  const ib = termIndex.get(c.b);
  if (ia === undefined || ib === undefined) return false;
  const inA = (mask: number) => (mask & (1 << ia)) !== 0;
  const inB = (mask: number) => (mask & (1 << ib)) !== 0;
  if (c.kind === "all") return model.every((mask) => !inA(mask) || inB(mask));
  if (c.kind === "no") return model.every((mask) => !(inA(mask) && inB(mask)));
  if (c.kind === "some") return model.some((mask) => inA(mask) && inB(mask));
  return model.some((mask) => inA(mask) && !inB(mask));
}

function verifySyllogism(stem: string, options: string[], stored: number): LogicCheck | null {
  const text = asText(stem);
  if (!/\b(?:syllogism|statement|conclusion|follows|must be false|must be true|necessarily)\b/i.test(text)) return null;
  const statements: Categorical[] = [];
  const premisePart = text.split(/which\s+of\s+the\s+following|conclusion/i)[0];
  const chunks = premisePart
    .replace(/statement\s*\d+\s*:/gi, "|")
    .replace(/[;\n]/g, "|")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const c = parseCategorical(chunk);
    if (c) statements.push(c);
  }
  if (statements.length === 0) return null;
  const terms = [...new Set(statements.flatMap((s) => [s.a, s.b]))].filter(Boolean);
  if (terms.length < 2 || terms.length > 4) return null;
  const termIndex = new Map(terms.map((t, i) => [t, i]));

  // A finite universe model: every element has a membership mask over the
  // terms. Five elements are enough to provide a witness for every existential
  // statement while still checking universal statements over all elements.
  const maxElements = Math.min(5, terms.length + 1);
  const masks = Array.from({ length: (1 << terms.length) - 1 }, (_, i) => i + 1);
  const models: number[][] = [];
  const rec = (start: number, model: number[]) => {
    if (models.length >= 20000) return;
    if (statements.every((s) => universeHolds(s, model, termIndex))) models.push([...model]);
    if (model.length >= maxElements) return;
    for (let i = start; i < masks.length; i++) {
      model.push(masks[i]);
      rec(i, model);
      model.pop();
      if (models.length >= 20000) return;
    }
  };
  rec(0, []);
  if (models.length === 0) {
    const findings: QaFinding[] = [];
    addNoSolution(findings, "syllogism");
    return { computedAnswer: null, deterministicVerified: false, findings, model: "syllogism" };
  }

  const parsedOptions = options.map(parseCategorical);
  const ask = /\bmust\s+be\s+false|can\s+never\s+be\s+true|cannot\s+be\s+true|is\s+not\s+possible/i.test(text)
    ? "false"
    : /\bmust\s+be\s+true|necessarily\s+true|definitely\s+follows|logically\s+follows|which\s+of\s+the\s+following\s+follows/i.test(text)
      ? "true"
      : /\bcould\s+be\s+true|is\s+possible|can\s+be\s+true/i.test(text)
        ? "possible"
        : null;
  if (!ask) return null;

  const verdicts = parsedOptions.map((c) => {
    if (!c) return null;
    const holds = models.filter((m) => universeHolds(c, m, termIndex)).length;
    if (ask === "false") return holds === 0;
    if (ask === "true") return holds === models.length;
    return holds > 0;
  });
  const matching = verdicts.map((v, i) => (v ? i : null)).filter((i): i is number => i !== null);
  const findings: QaFinding[] = [];

  if (matching.length === 0) {
    findings.push(
      finding({
        code: "LOGIC_SYLLOGISM_NO_CORRECT",
        category: "logic",
        severity: "critical",
        field: "options",
        message:
          ask === "false"
            ? "No option is necessarily false under the stated premises; the question has no correct answer as written."
            : ask === "true"
              ? "No option is necessarily true under the stated premises."
              : "No option is possible under the stated premises.",
        suggestion: "Re-check the premises and options; one of them is inconsistent with the requested conclusion.",
        validator: "logic",
      })
    );
  } else if (matching.length > 1) {
    findings.push(
      finding({
        code: "LOGIC_MULTIPLE_CORRECT",
        category: "logic",
        severity: "critical",
        field: "options",
        message: `Multiple options satisfy the requested conclusion (${matching.map((i) => String.fromCharCode(65 + i)).join(", ")}).`,
        suggestion: "Make the options mutually exclusive or ask for a different conclusion.",
        validator: "logic",
      })
    );
  }
  const computed = matching.length === 1 ? matching[0] : null;
  if (computed !== null && computed !== stored) addAnswerMismatch(findings, computed, stored, options, "syllogism");
  return { computedAnswer: computed, deterministicVerified: computed !== null, findings, model: "syllogism" };
}

// ---------------------------------------------------------------------------
// Public entry point

export function looksFormalReasoning(topic: string, stem: string): boolean {
  const t = `${topic} ${stem}`.toLowerCase();
  return /\b(?:puzzle|puzzles|seating|arrangement|order|ranking|syllogism|statement|conclusion|blood\s+relation|coding|decoding|team|group|selection|scheduling|input.?output|direction|series|analogy)\b/i.test(t);
}

export function verifyLogicQuestion(
  stem: string,
  options: string[],
  storedAnswer: number,
  topic: string,
  qaModel?: unknown
): LogicCheck {
  // A formal model is authoritative when supplied: it lets a new question type
  // opt into deterministic validation without changing the engine.
  if (qaModel && typeof qaModel === "object") {
    const raw = qaModel as Record<string, unknown>;
    if (raw.type === "team" && Array.isArray(raw.entities) && Array.isArray(raw.groups)) {
      const entities = raw.entities.map(String).filter((e) => /^[A-Z]$/.test(e));
      const groups = raw.groups.map(String);
      const queryGroup = String(raw.queryGroup ?? "");
      const constraints = Array.isArray(raw.constraints)
        ? (raw.constraints as TeamConstraint[]).filter((c) => c && typeof c === "object" && typeof (c as { type?: unknown }).type === "string")
        : [];
      if (entities.length >= 2 && groups.length >= 2 && groups.includes(queryGroup)) {
        return verifyTeam({ entities, groups, constraints, queryGroup, unparsed: [] }, options, storedAnswer, 200000);
      }
    }
  }

  const text = asText(stem);
  if (/\b(?:team|teams|grouping|groups?)\b/i.test(text) && entityList(text).length >= 3) {
    const model = parseTeamModel(stem);
    if (model) return verifyTeam(model, options, storedAnswer, 200000);
  }
  if (/\b(?:line|row|queue|order|positions?|sitting|seated|standing)\b/i.test(text) && entityList(text).length >= 3) {
    const model = parseOrderingModel(stem);
    if (model) return verifyOrdering(model, options, storedAnswer);
  }
  const coding = verifyCoding(stem, options, storedAnswer);
  if (coding) return coding;
  const syllogism = verifySyllogism(stem, options, storedAnswer);
  if (syllogism) return syllogism;

  const findings: QaFinding[] = [];
  if (looksFormalReasoning(topic, stem)) {
    findings.push(
      finding({
        code: "LOGIC_UNSUPPORTED",
        category: "logic",
        severity: "review",
        field: "question",
        message: "This looks like a formal reasoning question, but no deterministic solver could model it from the text.",
        suggestion: "Review manually, or add an optional structured qa_model for this question type.",
        validator: "logic",
        confidence: "low",
        deterministic: false,
      })
    );
  }
  return { computedAnswer: null, deterministicVerified: false, findings, model: null };
}
