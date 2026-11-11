import type { Finding, Review } from "./schema";

const RANK = { suggestion: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;
const MIN_CONFIDENCE = 0.6; // tune this with evals
const MAX_FINDINGS = 10;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// addedLines: file path -> (new-file line number -> line text), built from the diff
export function postprocess(review: Review, addedLines: Map<string, Map<number, string>>) {
  const dropped = { lowConfidence: 0, ungrounded: 0 };

  const findings = review.findings
    .filter((f) => (f.confidence >= MIN_CONFIDENCE ? true : (dropped.lowConfidence++, false)))
    .filter((f) => (isGrounded(f, addedLines.get(f.file)) ? true : (dropped.ungrounded++, false)))
    .sort((a, b) => RANK[b.severity] - RANK[a.severity])
    .slice(0, MAX_FINDINGS);

  return { review: { ...review, findings }, dropped };
}

function isGrounded(f: Finding, added?: Map<number, string>) {
  if (!added || !f.evidence.trim()) return false;
  const quote = norm(f.evidence);
  for (let l = f.line; l <= (f.endLine ?? f.line); l++) {
    const text = added.get(l);
    if (text && norm(text).includes(quote)) return true;
  }
  return false;
}
