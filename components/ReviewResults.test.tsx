// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Finding, ReviewResult } from "@/lib/review";
import { ReviewResults } from "./ReviewResults";

const files = [{ path: "src/a.tsx", content: "a\nb\nc" }];

function result(findings: Finding[], extra: Partial<ReviewResult["review"]> = {}): ReviewResult {
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
    meta: { model: "m", promptVersion: "review.v1", latencyMs: 1, calls: 1, validationRetries: 0 },
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
});
