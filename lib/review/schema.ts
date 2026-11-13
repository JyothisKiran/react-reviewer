import { z } from "zod";
import { CATEGORIES, KINDS, RATINGS, READINESS, SEVERITIES } from "./constants";

export { CATEGORIES, SEVERITIES } from "./constants";

// The model only sees the JSON Schema generated from these (see gemini.ts), so every
// constraint must be one JSON Schema can express. No .refine(), .superRefine() or
// .transform(): the model couldn't see them. schema.test.ts checks this.

// Field order is deliberate: quote the code, explain, then judge.
export const FindingSchema = z.object({
  file: z.string(),
  line: z.number().int().min(1),
  endLine: z.number().int().min(1).optional(),
  evidence: z.string(),
  title: z.string(),
  why: z.string(),
  fix: z.string(),
  suggestedCode: z.string().optional(),
  category: z.enum(CATEGORIES),
  kind: z.enum(KINDS),
  severity: z.enum(SEVERITIES),
  confidence: z.number().min(0).max(1),
});

export const ReviewSchema = z.object({
  summary: z.string(),
  rating: z.enum(RATINGS),
  readiness: z.enum(READINESS),
  strengths: z.array(z.string()),
  assumptions: z.array(z.string()),
  findings: z.array(FindingSchema),
});

export type Finding = z.infer<typeof FindingSchema>;
export type Review = z.infer<typeof ReviewSchema>;
