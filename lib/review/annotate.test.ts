import { describe, expect, it } from "vitest";
import { annotate, splitLines } from "./annotate";

describe("splitLines", () => {
  it("numbers lines like an editor", () => {
    expect(splitLines("a\nb")).toEqual(["a", "b"]);
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("a\r\nb\r\n")).toEqual(["a", "b"]);
    expect(splitLines("a\n\n")).toEqual(["a", ""]);
    expect(splitLines("")).toEqual([]);
  });
});

describe("annotate", () => {
  it("marks every line of an uploaded file as added, with its line number", () => {
    const { annotatedDiff } = annotate([{ path: "src/a.ts", content: "const a = 1;\n\nexport { a };\n" }]);
    expect(annotatedDiff).toBe(["### src/a.ts", "+ 1 | const a = 1;", "+ 2 |", "+ 3 | export { a };"].join("\n"));
  });

  it("keeps indentation and handles CRLF files", () => {
    const { annotatedDiff } = annotate([{ path: "a.ts", content: "if (x) {\r\n  y();\r\n}" }]);
    expect(annotatedDiff).toContain("+ 2 |   y();");
    expect(annotatedDiff).not.toContain("\r");
  });

  it("separates files and returns the added lines per path", () => {
    const { annotatedDiff, addedLines } = annotate([
      { path: "a.ts", content: "one\ntwo" },
      { path: "b.ts", content: "three" },
    ]);
    expect(annotatedDiff).toBe("### a.ts\n+ 1 | one\n+ 2 | two\n\n### b.ts\n+ 1 | three");
    expect(addedLines.get("a.ts")).toEqual(new Map([[1, "one"], [2, "two"]]));
    expect(addedLines.get("b.ts")?.get(1)).toBe("three");
  });

  it("includes an empty file with no lines", () => {
    const { annotatedDiff, addedLines } = annotate([{ path: "empty.ts", content: "" }]);
    expect(annotatedDiff).toBe("### empty.ts");
    expect(addedLines.get("empty.ts")?.size).toBe(0);
  });
});
