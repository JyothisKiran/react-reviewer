import { describe, expect, it } from "vitest";
import { lintFiles } from "./linter";

describe("lintFiles", () => {
  it("reports recommended TypeScript and JSX accessibility findings with original line numbers", async () => {
    const result = await lintFiles([
      {
        path: "src/Example.tsx",
        content: "const title = 'image';\nconst value: any = title;\nexport const View = () => <img src={value} />;",
      },
    ]);

    expect(result.findings).toContainEqual(
      expect.objectContaining({ file: "src/Example.tsx", line: 2, rule: "@typescript-eslint/no-explicit-any" }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ file: "src/Example.tsx", line: 3, rule: "jsx-a11y/alt-text" }),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns an explicit diagnostic for a parse failure and continues linting files", async () => {
    const result = await lintFiles([
      { path: "src/Broken.tsx", content: "export function (" },
      { path: "src/Valid.ts", content: "const value: any = 1;" },
    ]);

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        file: "src/Broken.tsx",
        status: "could not lint",
        reason: "parse-failure",
        message: expect.stringContaining("Could not lint this file:"),
      }),
    ]);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ file: "src/Valid.ts", line: 1, rule: "@typescript-eslint/no-explicit-any" }),
    );
  });

  it("returns an explicit diagnostic for unsupported file types", async () => {
    const result = await lintFiles([{ path: "README.md", content: "# Project" }]);

    expect(result.findings).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        file: "README.md",
        status: "could not lint",
        reason: "unsupported-file-type",
        message: expect.stringContaining("Could not lint this file:"),
      }),
    ]);
  });
});
