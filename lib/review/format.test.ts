import { describe, expect, it } from "vitest";
import { groupByFile, humanize, reviewToMarkdown } from "./format";
import type { Finding, Review } from "./schema";

const finding = (file: string, severity: Finding["severity"], title: string = severity): Finding => ({
  file, line: 3, endLine: 4, evidence: "x", title, why: "Because.", fix: "Do y.",
  category: "state-management", kind: "risk", severity, confidence: 0.9,
});

describe("humanize", () => {
  it("turns enum values into labels", () => {
    expect(humanize("ready-with-minor-changes")).toBe("Ready with minor changes");
    expect(humanize("state-management")).toBe("State management");
  });
});

describe("groupByFile", () => {
  it("puts the file with the most severe finding first, and sorts within a file", () => {
    const groups = groupByFile([finding("b.ts", "low"), finding("a.ts", "medium"), finding("b.ts", "critical")]);
    expect(groups.map((g) => [g.file, g.findings.map((f) => f.severity)])).toEqual([
      ["b.ts", ["critical", "low"]],
      ["a.ts", ["medium"]],
    ]);
  });
});

describe("reviewToMarkdown", () => {
  const review: Review = {
    summary: "Adds a slice.",
    rating: "needs-improvement",
    readiness: "changes-required",
    strengths: ["Typed actions"],
    assumptions: [],
    findings: [{ ...finding("src/slice.ts", "high", "State mutated"), suggestedCode: "const s = \"```\";" }],
  };

  it("includes the header, findings by file, and strengths", () => {
    const md = reviewToMarkdown(review);
    expect(md).toContain("**Rating:** Needs improvement · **Readiness:** Changes required");
    expect(md).toContain("## Findings (1 high)");
    expect(md).toContain("### `src/slice.ts`");
    expect(md).toContain("#### [High] State mutated\n\nLines 3–4 · State management · Risk");
    expect(md).toContain("## Strengths\n\n- Typed actions");
    expect(md).not.toContain("## Assumptions");
  });

  it("fences suggested code safely, even when it contains backticks", () => {
    expect(reviewToMarkdown(review)).toContain("````ts\nconst s = \"```\";\n````");
  });

  it("says No issues found for zero findings", () => {
    expect(reviewToMarkdown({ ...review, findings: [] })).toContain("## Findings\n\nNo issues found.");
  });
});
