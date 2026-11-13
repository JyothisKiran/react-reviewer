// Review enums, kept free of Zod so client components can import them
// without pulling Zod into the browser bundle.

export const SEVERITIES = ["critical", "high", "medium", "low", "suggestion"] as const;
export const CATEGORIES = [
  "correctness", "react", "state-management", "typescript", "performance",
  "api", "security", "accessibility", "testing", "maintainability", "architecture",
] as const;
export const KINDS = ["bug", "risk", "improvement", "preference"] as const;
export const RATINGS = ["excellent", "good", "acceptable", "needs-improvement", "major-issues"] as const;
export const READINESS = ["ready", "ready-with-minor-changes", "changes-required", "major-refactor"] as const;

export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  suggestion: 0, low: 1, medium: 2, high: 3, critical: 4,
};
