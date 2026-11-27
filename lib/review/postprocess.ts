import type { AddedLines } from "./annotate";
import { SEVERITY_RANK } from "./constants";
import type { LinterFinding } from "./prompt";
import type { Finding, Review } from "./schema";

export const MIN_CONFIDENCE = 0.6; // tune this with evals
export const MAX_FINDINGS = 10;

export type DropReason = "duplicate of linter finding" | "low-confidence" | "ungrounded" | "over-cap";
export type DroppedFinding = { reason: DropReason; detail: string; finding: Finding };

const norm = (s: string) => s.replace(/\s/g, "");

const LINTER_DUPLICATE_MAP: Record<string, { category: Finding["category"]; titlePatterns: readonly RegExp[] }> = {
  "@typescript-eslint/no-explicit-any": {
    category: "typescript",
    titlePatterns: [/\bany\b/i],
  },
  "react-hooks/rules-of-hooks": {
    category: "react",
    titlePatterns: [/(?:conditional|conditionally).{0,30}\bhooks?\b|\bhooks?\b.{0,30}(?:conditional|loop)/i],
  },
  "react-hooks/exhaustive-deps": {
    category: "react",
    titlePatterns: [/\bdependency array\b|(?:missing|incorrect|stale).{0,30}\b(?:dependencies|dependency|closure)\b/i],
  },
  "jsx-a11y/alt-text": {
    category: "accessibility",
    titlePatterns: [/\balt(?: text| attribute)?\b|alternative text/i],
  },
  "jsx-a11y/anchor-has-content": {
    category: "accessibility",
    titlePatterns: [/(?:empty|missing|unnamed|accessible name).{0,20}(?:anchor|link)|(?:anchor|link).{0,20}(?:empty|missing|unnamed|accessible name)/i],
  },
  "jsx-a11y/click-events-have-key-events": {
    category: "accessibility",
    titlePatterns: [/\bkeyboard (?:event|handler|equivalent)\b|\bkey event\b/i],
  },
  "jsx-a11y/interactive-supports-focus": {
    category: "accessibility",
    titlePatterns: [/\b(?:not focusable|focusable|keyboard focus|tabindex)\b/i],
  },
  "jsx-a11y/label-has-associated-control": {
    category: "accessibility",
    titlePatterns: [/\blabel\b.{0,30}\b(?:associated|control|input)\b|\bform control\b.{0,30}\blabel\b/i],
  },
  "jsx-a11y/no-autofocus": {
    category: "accessibility",
    titlePatterns: [/\bauto.?focus\b/i],
  },
  "jsx-a11y/no-static-element-interactions": {
    category: "accessibility",
    titlePatterns: [/\bnon.?interactive element\b|\bstatic element interaction\b/i],
  },
};

// addedLines: file path -> (new-file line number -> line text), from annotate()
export function postprocess(
  review: Review,
  addedLines: AddedLines,
  linterFindings: LinterFinding[] = [],
) {
  const dropped: DroppedFinding[] = [];
  const kept: Finding[] = [];

  for (const finding of review.findings) {
    const duplicate = duplicateOfLinter(finding, linterFindings);
    if (duplicate) {
      dropped.push({
        reason: "duplicate of linter finding",
        detail: `Matches ${duplicate.rule} at ${duplicate.file}:${duplicate.line}.`,
        finding,
      });
      continue;
    }

    if (finding.confidence < MIN_CONFIDENCE) {
      dropped.push({
        reason: "low-confidence",
        detail: `Confidence ${finding.confidence} is below ${MIN_CONFIDENCE}.`,
        finding,
      });
      continue;
    }
    const problem = groundingProblem(finding, addedLines.get(finding.file));
    if (problem) {
      dropped.push({ reason: "ungrounded", detail: problem, finding });
      continue;
    }
    kept.push(finding);
  }

  // Stable sort: findings of equal severity keep the model's order.
  kept.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  for (const finding of kept.slice(MAX_FINDINGS)) {
    dropped.push({ reason: "over-cap", detail: `Only the ${MAX_FINDINGS} most severe findings are kept.`, finding });
  }

  return { review: { ...review, findings: kept.slice(0, MAX_FINDINGS) }, dropped };
}

function duplicateOfLinter(finding: Finding, linterFindings: LinterFinding[]) {
  for (const linterFinding of linterFindings) {
    const mapping = LINTER_DUPLICATE_MAP[linterFinding.rule];
    if (
      mapping &&
      finding.file === linterFinding.file &&
      finding.line === linterFinding.line &&
      finding.category === mapping.category &&
      mapping.titlePatterns.some((pattern) => pattern.test(finding.title))
    ) {
      return linterFinding;
    }
  }
  return undefined;
}

/** Why a finding can't be tied to an added line, or null if it can. */
function groundingProblem(f: Finding, added?: Map<number, string>): string | null {
  if (!added) return `"${f.file}" isn't one of the reviewed files.`;
  const quote = norm(f.evidence);
  if (!quote) return "No evidence was quoted.";

  const end = f.endLine ?? f.line;
  // Walk the file's lines, not the range, so a huge endLine can't stall the loop.
  for (const [line, text] of added) {
    if (line >= f.line && line <= end && norm(text).includes(quote)) return null;
  }
  const where = end > f.line ? `lines ${f.line}–${end}` : `line ${f.line}`;
  return `The quoted evidence isn't on ${where} of ${f.file}.`;
}
