// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Finding } from "@/lib/review";
import { excerptFor, FindingCard } from "./FindingCard";

const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");

const finding: Finding = {
  file: "src/features/search/useSearch.ts",
  line: 10,
  endLine: 11,
  evidence: "line 10",
  title: "Responses can arrive out of order",
  why: "A slow response for `ab` can overwrite the result for `abc`.",
  fix: "Ignore stale responses with an `AbortController`.",
  suggestedCode: "const controller = new AbortController();",
  category: "correctness",
  kind: "bug",
  severity: "high",
  confidence: 0.9,
};

describe("FindingCard", () => {
  it("shows severity as text, plus category, kind, lines, title, why, fix and suggested code", () => {
    render(<FindingCard finding={finding} fileContent={content} />);
    const card = screen.getByRole("article", { name: finding.title });
    expect(within(card).getByText("High")).toBeInTheDocument();
    expect(within(card).getByText("Correctness")).toBeInTheDocument();
    expect(within(card).getByText("Bug")).toBeInTheDocument();
    expect(within(card).getByText("Lines 10–11")).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: finding.title })).toBeInTheDocument();
    expect(within(card).getByText(/can overwrite the result/)).toBeInTheDocument();
    expect(within(card).getByText("AbortController")).toBeInTheDocument();
    expect(within(card).getByText(finding.suggestedCode!)).toBeInTheDocument();
  });

  it("reveals the flagged lines with 3 lines of context on demand", async () => {
    const user = userEvent.setup();
    const { container } = render(<FindingCard finding={finding} fileContent={content} />);
    const button = screen.getByRole("button", { name: `Show code for ${finding.title}` });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("line 7")).not.toBeVisible();

    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAccessibleName(`Hide code for ${finding.title}`);
    expect(screen.getByText(/lines 7–14/)).toBeVisible();
    expect(screen.getByText("line 7")).toBeVisible();
    expect(screen.getByText("line 14")).toBeVisible();
    expect(screen.queryByText("line 6")).not.toBeInTheDocument();
    expect(screen.queryByText("line 15")).not.toBeInTheDocument();

    // Flagged lines are marked with text, not only a background colour.
    const flagged = [...container.querySelectorAll("[data-flagged]")].map((row) => row.textContent);
    expect(flagged).toEqual(["▶10Flagged: line 10", "▶11Flagged: line 11"]);
  });

  it("has no Show code button when the line isn't in the uploaded file", () => {
    render(<FindingCard finding={{ ...finding, line: 99, endLine: undefined }} fileContent={content} />);
    expect(screen.queryByRole("button", { name: /show code/i })).not.toBeInTheDocument();
  });
});

describe("excerptFor", () => {
  it("clamps the context at the start and end of the file", () => {
    expect(excerptFor({ line: 1 }, content)?.map((r) => r.number)).toEqual([1, 2, 3, 4]);
    expect(excerptFor({ line: 20 }, content)?.map((r) => r.number)).toEqual([17, 18, 19, 20]);
  });
});
