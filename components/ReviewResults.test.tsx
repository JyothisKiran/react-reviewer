// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Finding, LinterDiagnostic, LinterFinding, ReviewResult } from "@/lib/review";
import { ReviewResults } from "./ReviewResults";

const files = [{ path: "src/a.tsx", content: "a\nb\nc" }];

function result(
  findings: Finding[],
  extra: Partial<ReviewResult["review"]> = {},
  linter: { findings?: LinterFinding[]; diagnostics?: LinterDiagnostic[] } = {},
): ReviewResult {
  return {
    review: {
      summary: "Adds a small component.",
      rating: "excellent",
      readiness: "ready",
      strengths: ["Clear prop names"],
      assumptions: [],
      findings,
      ...extra,
    },
    dropped: [],
    meta: { model: "m", promptVersion: "review.v1", latencyMs: 1, calls: 1, validationRetries: 0, lintLatencyMs: 0 },
    linter: { findings: linter.findings ?? [], diagnostics: linter.diagnostics ?? [], latencyMs: 0 },
  };
}

const finding = (title: string, severity: Finding["severity"]): Finding => ({
  file: "src/a.tsx", line: 1, evidence: "a", title, why: "w", fix: "f",
  category: "react", kind: "bug", severity, confidence: 0.9,
});

describe("ReviewResults", () => {
  it("shows a clear No issues found state for zero findings", () => {
    render(<ReviewResults result={result([])} files={files} />);
    expect(screen.getByRole("heading", { name: "No issues found" })).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Adds a small component.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Strengths" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Show" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("filters findings by severity", async () => {
    const user = userEvent.setup();
    render(<ReviewResults result={result([finding("A high one", "high"), finding("A low one", "low")])} files={files} />);
    expect(screen.getAllByRole("article")).toHaveLength(2);

    await user.click(screen.getByRole("checkbox", { name: "High (1)" }));
    expect(screen.queryByRole("article", { name: "A high one" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "A low one" })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Low (1)" }));
    expect(screen.getByText(/No findings match/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("shows linter cards with a label, textual severity, location and keyboard focus", () => {
    const linterFinding: LinterFinding = {
      file: "src/parseError.ts",
      line: 1,
      rule: "@typescript-eslint/no-explicit-any",
      message: "Unexpected any. Specify a different type.",
    };

    render(<ReviewResults result={result([], {}, { findings: [linterFinding] })} files={files} />);

    const card = screen.getByRole("article", { name: "@typescript-eslint/no-explicit-any" });
    expect(screen.getByText("Linter")).toBeInTheDocument();
    expect(screen.getByText("Severity: Error")).toBeInTheDocument();
    expect(screen.getByText(linterFinding.message)).toBeInTheDocument();
    expect(screen.getByText("src/parseError.ts, line 1")).toBeInTheDocument();
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card.className).toContain("focus-visible:outline-pencil");
    expect(screen.getByRole("heading", { name: "No model findings" })).toBeInTheDocument();
  });

  it("shows React Hook warnings as readable warnings", () => {
    const linterFinding: LinterFinding = {
      file: "src/useData.ts",
      line: 8,
      rule: "react-hooks/exhaustive-deps",
      message: "React Hook useEffect has a missing dependency.",
    };

    render(<ReviewResults result={result([], {}, { findings: [linterFinding] })} files={files} />);

    expect(screen.getByText("Severity: Warning")).toBeInTheDocument();
  });

  it("labels parse failures as linter limitations, not code findings", () => {
    const diagnostic: LinterDiagnostic = {
      file: "src/Broken.tsx",
      status: "could not lint",
      reason: "parse-failure",
      message: "Could not lint this file: Unexpected token.",
      line: 1,
      column: 17,
    };

    render(<ReviewResults result={result([], {}, { diagnostics: [diagnostic] })} files={files} />);

    const card = screen.getByRole("article", { name: "Could not lint this file" });
    expect(screen.getByRole("heading", { name: "Linter limitations" })).toBeInTheDocument();
    expect(screen.getByText("Linter limitation · Parse failure")).toBeInTheDocument();
    expect(screen.getByText("This is a linter limitation, not a model code finding.")).toBeInTheDocument();
    expect(screen.getByText("Location: line 1, column 17")).toBeInTheDocument();
    expect(card).toHaveAttribute("tabindex", "0");
    expect(screen.queryByText("Severity: Error")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No model findings" })).toBeInTheDocument();
  });
});
