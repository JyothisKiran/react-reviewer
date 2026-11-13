import { describe, expect, it } from "vitest";
import { annotate } from "./annotate";
import { MAX_FINDINGS, postprocess } from "./postprocess";
import type { Finding, Review } from "./schema";

const code = [
  "export function total(items: Item[]) {",
  "  let sum = 0;",
  "  for (const item of items) sum += item.price;",
  "  return sum;",
  "}",
].join("\n");
const { addedLines } = annotate([{ path: "src/total.ts", content: code }]);

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    file: "src/total.ts",
    line: 3,
    evidence: "sum += item.price",
    title: "Float sum",
    why: "Prices are floats.",
    fix: "Use integer cents.",
    category: "correctness",
    kind: "bug",
    severity: "medium",
    confidence: 0.9,
    ...overrides,
  };
}

function review(findings: Finding[]): Review {
  return { summary: "s", rating: "good", readiness: "ready", strengths: [], assumptions: [], findings };
}

describe("postprocess", () => {
  it("keeps a grounded, confident finding", () => {
    const result = postprocess(review([finding()]), addedLines);
    expect(result.review.findings).toHaveLength(1);
    expect(result.dropped).toEqual([]);
  });

  describe("confidence filter", () => {
    it("drops findings below 0.6 and keeps 0.6 itself", () => {
      const low = finding({ title: "low", confidence: 0.59 });
      const edge = finding({ title: "edge", confidence: 0.6 });
      const result = postprocess(review([low, edge]), addedLines);
      expect(result.review.findings.map((f) => f.title)).toEqual(["edge"]);
      expect(result.dropped).toEqual([{ reason: "low-confidence", detail: expect.stringContaining("0.59"), finding: low }]);
    });
  });

  describe("grounding", () => {
    it("matches evidence regardless of whitespace", () => {
      const result = postprocess(review([finding({ evidence: "  sum   +=  item.price " })]), addedLines);
      expect(result.review.findings).toHaveLength(1);
    });

    it("finds evidence anywhere in line..endLine", () => {
      const result = postprocess(review([finding({ line: 2, endLine: 4, evidence: "return sum" })]), addedLines);
      expect(result.review.findings).toHaveLength(1);
    });

    it.each([
      ["a file that wasn't reviewed", { file: "src/other.ts" }, "isn't one of the reviewed files"],
      ["evidence on a different line", { line: 1 }, "isn't on line 1"],
      ["paraphrased evidence", { evidence: "adds the price" }, "isn't on line 3"],
      ["empty evidence", { evidence: "   " }, "No evidence"],
      ["a line past the end of the file", { line: 40, endLine: 1_000_000_000 }, "lines 40–1000000000"],
    ])("drops %s", (_, overrides, detail) => {
      const result = postprocess(review([finding(overrides)]), addedLines);
      expect(result.review.findings).toEqual([]);
      expect(result.dropped[0].reason).toBe("ungrounded");
      expect(result.dropped[0].detail).toContain(detail);
    });
  });

  describe("sorting and cap", () => {
    it("sorts by severity and keeps model order within a severity", () => {
      const findings = [
        finding({ title: "low", severity: "low" }),
        finding({ title: "high-1", severity: "high" }),
        finding({ title: "suggestion", severity: "suggestion" }),
        finding({ title: "critical", severity: "critical" }),
        finding({ title: "high-2", severity: "high" }),
      ];
      const result = postprocess(review(findings), addedLines);
      expect(result.review.findings.map((f) => f.title)).toEqual(["critical", "high-1", "high-2", "low", "suggestion"]);
    });

    it(`keeps the ${MAX_FINDINGS} most severe and reports the rest as over-cap`, () => {
      const findings = [
        ...Array.from({ length: MAX_FINDINGS }, (_, i) => finding({ title: `low-${i}`, severity: "low" })),
        finding({ title: "critical", severity: "critical" }),
        finding({ title: "suggestion", severity: "suggestion" }),
      ];
      const result = postprocess(review(findings), addedLines);
      expect(result.review.findings).toHaveLength(MAX_FINDINGS);
      expect(result.review.findings[0].title).toBe("critical");
      expect(result.dropped.map((d) => [d.reason, d.finding.title])).toEqual([
        ["over-cap", `low-${MAX_FINDINGS - 1}`],
        ["over-cap", "suggestion"],
      ]);
    });

    it("applies the cap after filtering, so dropped findings don't use up slots", () => {
      const findings = [
        ...Array.from({ length: 3 }, () => finding({ confidence: 0.1 })),
        ...Array.from({ length: MAX_FINDINGS }, () => finding()),
      ];
      const result = postprocess(review(findings), addedLines);
      expect(result.review.findings).toHaveLength(MAX_FINDINGS);
      expect(result.dropped.every((d) => d.reason === "low-confidence")).toBe(true);
    });
  });

  it("leaves the rest of the review unchanged", () => {
    const input = { ...review([]), summary: "All good", strengths: ["Clear names"] };
    expect(postprocess(input, addedLines).review).toEqual(input);
  });
});
