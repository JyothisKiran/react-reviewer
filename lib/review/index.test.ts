import { describe, expect, it } from "vitest";
import type { GeminiClient } from "./gemini";
import { reviewFiles } from "./index";
import type { Finding } from "./schema";

const file = { path: "src/total.ts", content: "let sum = 0;\nfor (const i of items) sum += i.price;\n" };

const base: Omit<Finding, "title" | "evidence"> = {
  file: "src/total.ts", line: 2, why: "w", fix: "f",
  category: "correctness", kind: "bug", severity: "high", confidence: 0.9,
};

function fakeClient(findings: Finding[]) {
  const prompts: string[] = [];
  const client: GeminiClient = {
    models: {
      async generateContent(params) {
        prompts.push(params.contents as string);
        const review = { summary: "s", rating: "good", readiness: "ready", strengths: [], assumptions: [], findings };
        return { text: JSON.stringify(review) };
      },
    },
  };
  return { client, prompts };
}

describe("reviewFiles", () => {
  it("annotates, calls Gemini, and postprocesses", async () => {
    const grounded = { ...base, title: "Float sum", evidence: "sum += i.price" };
    const madeUp = { ...base, title: "Made up", evidence: "items.reduce(" };
    const { client, prompts } = fakeClient([madeUp, grounded]);

    const result = await reviewFiles([file], { change: "Add totals", gemini: { client } });

    expect(prompts[0]).toContain("### src/total.ts\n+ 1 | let sum = 0;\n+ 2 | for (const i of items) sum += i.price;");
    expect(prompts[0]).toContain("<title>Add totals</title>");
    expect(result.review.findings.map((f) => f.title)).toEqual(["Float sum"]);
    expect(result.dropped).toEqual([{ reason: "ungrounded", detail: expect.any(String), finding: madeUp }]);
    expect(result.meta).toMatchObject({ model: "gemini-3.5-flash-lite", promptVersion: "review.v2", calls: 1, validationRetries: 0 });
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("passes linter findings through, and None when there are none", async () => {
    const { client, prompts } = fakeClient([]);
    await reviewFiles([file], { gemini: { client } });
    await reviewFiles([file], { linter: [{ file: file.path, line: 1, rule: "prefer-const", message: "Use const." }], gemini: { client } });
    expect(prompts[0]).toContain("<linter_findings>\nNone\n</linter_findings>");
    expect(prompts[1]).toContain('"rule": "prefer-const"');
  });
});
