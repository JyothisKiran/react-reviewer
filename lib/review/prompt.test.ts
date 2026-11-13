import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPrompt, fillTemplate, NONE, NOT_PROVIDED, splitChange } from "./prompt";

const diff = "### src/a.ts\n+ 1 | const a = 1;";

describe("buildPrompt", () => {
  it("uses review.v1.md as the system instruction", () => {
    const { system } = buildPrompt({ annotatedDiff: diff });
    expect(system).toBe(readFileSync("prompts/review.v1.md", "utf8").trim());
  });

  it("fills every placeholder in the user template", () => {
    const { user } = buildPrompt({ annotatedDiff: diff });
    expect(user).not.toMatch(/\{\{\w+\}\}/);
    expect(user).toContain(`<diff>\n${diff}\n</diff>`);
  });

  it("fills the default project context", () => {
    const { user } = buildPrompt({ annotatedDiff: diff });
    expect(user).toContain("React: 19 · React Compiler: disabled");
    expect(user).toContain("TypeScript strict: yes");
    expect(user).toContain("State/data: Redux Toolkit + RTK Query");
    expect(user).toContain("Framework/build: Vite");
    expect(user).toContain("Tests: Vitest + React Testing Library");
  });

  it("says None or Not provided for empty sections, never a blank tag", () => {
    const { user } = buildPrompt({ annotatedDiff: diff });
    expect(user).toContain(`<title>${NOT_PROVIDED}</title>`);
    expect(user).toContain(`<description>${NOT_PROVIDED}</description>`);
    expect(user).toContain(`<team_rules>\n${NONE}\n</team_rules>`);
    expect(user).toContain(`<linter_findings>\n${NONE}\n</linter_findings>`);
  });

  it("puts linter findings in as JSON", () => {
    const linter = [{ file: "src/a.ts", line: 1, rule: "no-explicit-any", message: "Unexpected any." }];
    const { user } = buildPrompt({ annotatedDiff: diff, linter });
    expect(user).toContain(`<linter_findings>\n${JSON.stringify(linter, null, 2)}\n</linter_findings>`);
  });

  it("turns the change description into the PR title and description", () => {
    const { user } = buildPrompt({ annotatedDiff: diff, change: "Add search\nDebounces the query.\nCancels stale requests." });
    expect(user).toContain("<title>Add search</title>");
    expect(user).toContain("<description>Debounces the query.\nCancels stale requests.</description>");
  });

  it("inserts code literally, even when it looks like a placeholder or a replacement pattern", () => {
    const tricky = "### a.ts\n+ 1 | const s = '$& $1 {{prTitle}}';";
    const { user } = buildPrompt({ annotatedDiff: tricky, change: "Real title" });
    expect(user).toContain(tricky);
    expect(user).toContain("<title>Real title</title>");
  });
});

describe("splitChange", () => {
  it("handles empty and one-line descriptions", () => {
    expect(splitChange("")).toEqual({ title: "", description: "" });
    expect(splitChange("   \n ")).toEqual({ title: "", description: "" });
    expect(splitChange("  Fix the timer \n")).toEqual({ title: "Fix the timer", description: "" });
  });
});

describe("fillTemplate", () => {
  it("throws when a placeholder has no value", () => {
    expect(() => fillTemplate("Hi {{name}} {{missing}}", { name: "x" })).toThrow("{{missing}}");
  });
});
