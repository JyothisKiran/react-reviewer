import type { AddedLines } from "./annotate";
import { SEVERITY_RANK } from "./constants";
import type { Finding, Review } from "./schema";

export const MIN_CONFIDENCE = 0.6; // tune this with evals
export const MAX_FINDINGS = 10;

export type DropReason = "low-confidence" | "ungrounded" | "over-cap";
export type DroppedFinding = { reason: DropReason; detail: string; finding: Finding };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// addedLines: file path -> (new-file line number -> line text), from annotate()
export function postprocess(review: Review, addedLines: AddedLines) {
  const dropped: DroppedFinding[] = [];
  const kept: Finding[] = [];

  for (const finding of review.findings) {
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
