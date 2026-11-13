// Display helpers shared by the UI and "Copy as markdown". Client-safe: no Zod, no fs.
import { SEVERITIES, SEVERITY_RANK, type Severity } from "./constants";
import type { Finding, Review } from "./schema";

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical", high: "High", medium: "Medium", low: "Low", suggestion: "Suggestion",
};

/** "ready-with-minor-changes" -> "Ready with minor changes" */
export function humanize(value: string) {
  const text = value.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function lineLabel(f: Pick<Finding, "line" | "endLine">) {
  return f.endLine && f.endLine > f.line ? `Lines ${f.line}–${f.endLine}` : `Line ${f.line}`;
}

export function countBySeverity(findings: Finding[]) {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const f of findings) counts[f.severity]++;
  return counts;
}

const bySeverity = (a: Finding, b: Finding) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];

/** Findings grouped by file, most severe first; files with the most severe findings come first. */
export function groupByFile(findings: Finding[]) {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) groups.set(f.file, [...(groups.get(f.file) ?? []), f]);
  return [...groups]
    .map(([file, list]) => ({ file, findings: [...list].sort(bySeverity) }))
    .sort((a, b) => bySeverity(a.findings[0], b.findings[0]) || a.file.localeCompare(b.file));
}

export function reviewToMarkdown(review: Review) {
  const out = [
    "# Code review",
    "",
    `**Rating:** ${humanize(review.rating)} · **Readiness:** ${humanize(review.readiness)}`,
    "",
    review.summary,
    "",
  ];

  if (review.findings.length === 0) {
    out.push("## Findings", "", "No issues found.", "");
  } else {
    const counts = countBySeverity(review.findings);
    const tally = SEVERITIES.filter((s) => counts[s]).map((s) => `${counts[s]} ${SEVERITY_LABEL[s].toLowerCase()}`);
    out.push(`## Findings (${tally.join(", ")})`, "");
    for (const group of groupByFile(review.findings)) {
      out.push(`### \`${group.file}\``, "");
      for (const f of group.findings) {
        out.push(
          `#### [${SEVERITY_LABEL[f.severity]}] ${f.title}`,
          "",
          `${lineLabel(f)} · ${humanize(f.category)} · ${humanize(f.kind)}`,
          "",
          `**Why:** ${f.why}`,
          "",
          `**Fix:** ${f.fix}`,
          "",
        );
        if (f.suggestedCode) out.push(fence(f.suggestedCode, languageOf(f.file)), "");
      }
    }
  }

  for (const [heading, items] of [["Strengths", review.strengths], ["Assumptions", review.assumptions]] as const) {
    if (items.length) out.push(`## ${heading}`, "", ...items.map((item) => `- ${item}`), "");
  }
  return `${out.join("\n").trimEnd()}\n`;
}

/** A code fence longer than any backtick run inside the code. */
function fence(code: string, language: string) {
  const longest = Math.max(2, ...[...code.matchAll(/`+/g)].map((m) => m[0].length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks}${language}\n${code.replace(/\n+$/, "")}\n${ticks}`;
}

function languageOf(path: string) {
  return path.match(/\.([cm]?[jt]sx?|css|scss|json|md)$/i)?.[1].toLowerCase() ?? "";
}
