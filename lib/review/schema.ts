import { z } from "zod";

export const SEVERITIES = ["critical", "high", "medium", "low", "suggestion"] as const;
export const CATEGORIES = [
  "correctness", "react", "state-management", "typescript", "performance",
  "api", "security", "accessibility", "testing", "maintainability", "architecture",
] as const;

// Field order is deliberate: quote the code, explain, then judge.
export const FindingSchema = z.object({
  file: z.string(),
  line: z.number().int(),
  endLine: z.number().int().optional(),
  evidence: z.string(),
  title: z.string(),
  why: z.string(),
  fix: z.string(),
  suggestedCode: z.string().optional(),
  category: z.enum(CATEGORIES),
  kind: z.enum(["bug", "risk", "improvement", "preference"]),
  severity: z.enum(SEVERITIES),
  confidence: z.number(),
});

export const ReviewSchema = z.object({
  summary: z.string(),
  rating: z.enum(["excellent", "good", "acceptable", "needs-improvement", "major-issues"]),
  readiness: z.enum(["ready", "ready-with-minor-changes", "changes-required", "major-refactor"]),
  strengths: z.array(z.string()),
  assumptions: z.array(z.string()),
  findings: z.array(FindingSchema),
});

export type Finding = z.infer<typeof FindingSchema>;
export type Review = z.infer<typeof ReviewSchema>;
